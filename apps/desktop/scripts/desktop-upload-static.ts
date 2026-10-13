/** Durable, credential-free evidence for static SSH Desktop uploads. */
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { DesktopUploadArtifact, DesktopUploadPlan } from './desktop-upload-plan.ts'
import { recordPackagingEvent } from './packaging-run.mjs'

const TRANSFER_TIMEOUT_MS = 900_000
const MAX_BUFFER_BYTES = 16 * 1024 * 1024

const FAILURE_CODES = new Set(['AccessDenied', 'InternalError', 'BadDigest', 'ENOENT', 'EACCES', 'EPERM', 'ENOSPC',
  'ECONNRESET', 'ETIMEDOUT', 'RequestTimeout', 'TimeoutError', 'AbortError', 'ENOTFOUND'])

/** Result of one ssh or scp process; a non-zero or missing exit code is a failed transfer. */
export interface DesktopStaticCommandResult {
  readonly code: number | string | null
  readonly stdout: string
  readonly stderr: string
}

/** Command runner injection point for tests that must never contact a release host. */
export type DesktopStaticCommand = (
  command: string,
  args: readonly string[],
) => Promise<DesktopStaticCommandResult>

/** Optional overrides for static release uploads. */
export interface DesktopStaticUploadOptions {
  readonly runCommand?: DesktopStaticCommand
}

const execute = promisify(execFile)

async function runCommand(command: string, args: readonly string[]): Promise<DesktopStaticCommandResult> {
  try {
    const result = await execute(command, [...args], {
      windowsHide: true, timeout: TRANSFER_TIMEOUT_MS, maxBuffer: MAX_BUFFER_BYTES,
    })
    return { code: 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
  } catch (error) {
    const candidate = error as Error & { code?: unknown; stdout?: unknown; stderr?: unknown }
    return {
      code: typeof candidate.code === 'number' || typeof candidate.code === 'string' ? candidate.code : null,
      stdout: typeof candidate.stdout === 'string' ? candidate.stdout : '',
      stderr: typeof candidate.stderr === 'string' ? candidate.stderr : '',
    }
  }
}

async function fingerprint(artifact: DesktopUploadArtifact) {
  const sha512 = createHash('sha512')
  const md5 = createHash('md5')
  let size = 0
  const source = artifact.contents === undefined ? createReadStream(artifact.path) : [Buffer.from(artifact.contents)]
  for await (const bytes of source) {
    size += bytes.length
    sha512.update(bytes)
    md5.update(bytes)
  }
  return { size, sha512: sha512.digest('base64'), md5: md5.digest('base64') }
}

function failureReceipt(error: unknown): { readonly errorCode: string } {
  const candidate = error as Error & { code?: unknown }
  const code = typeof candidate.code === 'string' ? candidate.code : undefined
  return { errorCode: code !== undefined && FAILURE_CODES.has(code) ? code : 'UNCLASSIFIED' }
}

function commandError(command: string, result: DesktopStaticCommandResult): Error {
  return Object.assign(new Error(`desktop upload: ${command} exited with ${String(result.code)}`), { code: result.code })
}

async function stageArtifact(artifact: DesktopUploadArtifact, staging: string): Promise<string> {
  const target = join(staging, ...artifact.key.split('/'))
  await mkdir(dirname(target), { recursive: true })
  if (artifact.contents === undefined) await copyFile(artifact.path, target)
  else await writeFile(target, artifact.contents)
  return target
}

/**
 * Upload an already validated static release plan over SSH, retaining the same audit evidence as COS uploads.
 *
 * Each artifact is staged locally, hashed, and copied exactly once with scp into
 * `${staticRemoteRoot}/${artifact.key}`. Remote parent directories are created with one ssh
 * invocation before any file transfer. Failures stop later transfers and leave the partial
 * evidence directory for the operator to reconcile.
 * @param plan Validated release metadata; static host and remote root must be present.
 * @param recordsRoot Local retained evidence parent, outside disposable artifact directories.
 * @param options Optional command runner override for tests.
 * @returns Fresh record directory after all transfers succeed.
 */
export async function uploadDesktopReleaseStatic(
  plan: DesktopUploadPlan,
  recordsRoot: string,
  options: DesktopStaticUploadOptions = {},
): Promise<string> {
  if (plan.transport !== 'static' || plan.staticHost === undefined || plan.staticRemoteRoot === undefined) {
    throw new Error('desktop upload: static publication requires a host and remote root')
  }
  const runCommandForPlan = options.runCommand ?? runCommand
  await mkdir(recordsRoot, { recursive: true })
  const directory = await mkdtemp(join(recordsRoot, `${plan.environment}-${plan.target}-`))
  const staging = join(directory, 'staging')
  await mkdir(staging, { recursive: true })
  process.stdout.write(`desktop upload: record ${directory}\n`)
  const startedAt = new Date().toISOString()
  let stage = 'prepare'
  let key: string | undefined
  let confirmedPuts = 0
  let success = false
  let failure: object | undefined
  try {
    await writeFile(join(directory, 'events.jsonl'), '', { flag: 'wx', mode: 0o600, flush: true })
    recordPackagingEvent(directory, { type: 'upload-start', environment: plan.environment, target: plan.target, version: plan.version })
    const artifacts = []
    const stagedByKey = new Map<string, string>()
    for (const artifact of plan.artifacts) {
      stage = 'hash-input'
      key = artifact.key
      stagedByKey.set(artifact.key, await stageArtifact(artifact, staging))
      artifacts.push({ ...artifact, ...await fingerprint(artifact) })
    }
    const sourceSha256: Record<string, string> = {}
    for (const filename of ['desktop-upload-static.ts', 'desktop-upload-plan.ts', 'upload-target.ts', 'desktop-auto-update-environment.mjs']) {
      sourceSha256[filename] = createHash('sha256').update(await readFile(join(import.meta.dirname, filename))).digest('hex')
    }
    await writeFile(join(directory, 'plan.json'), `${JSON.stringify({ schemaVersion: 1,
      environment: plan.environment, target: plan.target, version: plan.version, transport: 'static',
      staticHost: plan.staticHost, staticRemoteRoot: plan.staticRemoteRoot, publicUrl: plan.publicUrl, maxAttempts: 1,
      sourceSha256, artifacts }, null, 2)}\n`, { flag: 'wx', mode: 0o600, flush: true })
    const directories = [...new Set(artifacts.map(artifact => dirname(artifact.key)))]
    if (directories.length > 0) {
      stage = 'prepare-dirs'
      const remoteDirectories = directories.map(relative => `${plan.staticRemoteRoot}/${relative}`)
      const mkdirResult = await runCommandForPlan('ssh', ['-o', 'BatchMode=yes', plan.staticHost, 'mkdir', '-p', '--', ...remoteDirectories])
      if (mkdirResult.code !== 0) throw commandError('ssh mkdir', mkdirResult)
      recordPackagingEvent(directory, { type: 'remote-dirs-created', directories: remoteDirectories, attempts: 1 })
    }
    for (const artifact of artifacts) {
      key = artifact.key
      stage = 'put'
      const remotePath = `${plan.staticRemoteRoot}/${artifact.key}`
      recordPackagingEvent(directory, { type: 'put-intent', key, remotePath, size: artifact.size, sha512: artifact.sha512,
        channelMetadata: artifact.channelMetadata })
      const staged = stagedByKey.get(artifact.key)
      if (staged === undefined) throw new Error('desktop upload: staged artifact missing')
      const result = await runCommandForPlan('scp', ['-o', 'BatchMode=yes', staged, `${plan.staticHost}:${remotePath}`])
      if (result.code !== 0) throw commandError('scp', result)
      confirmedPuts++
      stage = 'record-response'
      recordPackagingEvent(directory, { type: 'put-confirmed', key, remotePath, attempts: 1 })
      process.stdout.write(`desktop upload: uploaded ${remotePath}\n`)
    }
    stage = 'complete'
    recordPackagingEvent(directory, { type: 'upload-complete', confirmedPuts })
    success = true
    return directory
  } catch (error) {
    failure = failureReceipt(error)
    throw new Error(`desktop upload: stopped at ${stage}; inspect ${directory} before another upload`)
  } finally {
    await rm(staging, { recursive: true, force: true }).catch(() => {})
    await writeFile(join(directory, 'result.json'), `${JSON.stringify({ schemaVersion: 1, startedAt,
      finishedAt: new Date().toISOString(), environment: plan.environment, target: plan.target, version: plan.version,
      transport: 'static', success, stage, key, confirmedPuts, failure, publicReadback: 'not-performed' }, null, 2)}\n`,
    { flag: 'wx', mode: 0o600, flush: true })
  }
}

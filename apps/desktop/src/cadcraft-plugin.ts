/** Open-time installation of the Huayu AI CADCraft plugin bundle. */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'
import { withFileLock, writeFileAtomic } from '@hy/dsh-atomic-write'

/** Plugin package identity shared by the feed, the profile, and the install check. */
export const CADCRAFT_PLUGIN_NAME = '@hy/dsh-experimental-huayu-cadcraft'

/** Feed URL served from the Huayu site; mirrors the desktop installer feed layout. */
export const CADCRAFT_FEED_URL = 'https://lanhc.com/lanhc/plugins/cadcraft.json'

/** Profile-relative directory holding downloaded plugin tarballs. */
const PLUGIN_CACHE_DIR = '.plugin-cache'

/** Whole-operation deadline: feed fetch, tarball download, and pnpm install. */
const DEFAULT_TIMEOUT_MS = 120_000

/** Feed read bound once a plugin version is installed: an offline host must not stall desktop startup. */
const INSTALLED_FEED_CHECK_MS = 5_000

/** Tarball download bound: the 8 MiB archive must arrive within this window or the launch proceeds without it. */
const DOWNLOAD_TIMEOUT_MS = 30_000

/** One feed document published beside the tarball. */
interface CadcraftFeed {
  readonly name: string
  readonly version: string
  readonly tarball: string
  readonly sha256: string
}

/** One package.json manifest slice the installer reads or writes. */
interface ProfileManifest {
  readonly dependencies?: Readonly<Record<string, string>>
  dsh?: { profile?: { bundles?: string[] } }
}

/** One feed read: the validated document, or the reason it is unavailable. */
interface FeedRead {
  readonly feed?: CadcraftFeed
  readonly error?: string
}

function sha256Of(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function isFeed(value: unknown): value is CadcraftFeed {
  if (typeof value !== 'object' || value === null) return false
  const feed = value as Record<string, unknown>
  return feed.name === CADCRAFT_PLUGIN_NAME
    && typeof feed.version === 'string' && feed.version !== ''
    && typeof feed.tarball === 'string' && /^https:\/\//.test(feed.tarball)
    && typeof feed.sha256 === 'string' && /^[a-f0-9]{64}$/.test(feed.sha256)
}

/**
 * Download and verify the CADCraft tarball, installing it through the profile's
 * pnpm when the profile does not already carry the feed version. Never throws:
 * a failed installation reports `failed` so the desktop start continues without it.
 * @param options - desktop-owned paths and executables.
 * @returns the outcome of this run.
 */
export async function installCadcraftPlugin(options: {
  readonly profileDir: string
  readonly node: string
  readonly pnpm: string
  readonly timeoutMs?: number
}): Promise<{ readonly status: 'current' | 'installed' | 'failed'; readonly message: string }> {
  const { profileDir, node, pnpm } = options
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  try {
    const installed = readInstalledVersion(profileDir)
    const read = await readFeed(installed, timeoutMs)
    if (read.feed === undefined) {
      // An already-installed version stays in service without a feed round trip:
      // the bounded read above is the only startup cost an unreachable host can add.
      if (installed !== undefined) {
        return { status: 'current', message: 'CADCraft plugin ' + installed + ' stays installed (' + (read.error ?? 'feed unavailable') + ')' }
      }
      return { status: 'failed', message: read.error ?? 'cadcraft feed unavailable' }
    }
    const parsed = read.feed
    if (installed === parsed.version) return { status: 'current', message: 'CADCraft plugin ' + parsed.version + ' is installed' }

    const cacheDir = join(profileDir, PLUGIN_CACHE_DIR)
    mkdirSync(cacheDir, { recursive: true, mode: 0o700 })
    const tarballName = parsed.name.replace('@hy/', 'hy-').replaceAll('/', '-') + '-' + parsed.version + '.tgz'
    const tarball = join(cacheDir, tarballName)
    const partial = tarball + '.part'
    rmSync(partial, { force: true })
    const download = await fetch(parsed.tarball, { signal: AbortSignal.timeout(Math.min(timeoutMs, DOWNLOAD_TIMEOUT_MS)) })
    if (!download.ok || download.body === null) {
      rmSync(partial, { force: true })
      return { status: 'failed', message: 'cadcraft tarball HTTP ' + String(download.status) }
    }
    const body = Buffer.from(await download.arrayBuffer())
    if (createHash('sha256').update(body).digest('hex') !== parsed.sha256) {
      rmSync(partial, { force: true })
      return { status: 'failed', message: 'cadcraft tarball sha256 mismatch' }
    }
    writeFileSync(partial, body, { mode: 0o600 })
    renameSync(partial, tarball)

    await withFileLock(join(profileDir, 'package.json'), async () => {
      await runPnpm(node, pnpm, profileDir, ['add', tarball, '--save-exact'], timeoutMs)
      await enableBundle(profileDir)
    })
    if (sha256Of(tarball) !== parsed.sha256) return { status: 'failed', message: 'cadcraft tarball changed on disk after install' }
    return { status: 'installed', message: 'CADCraft plugin ' + parsed.version + ' installed and enabled' }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Read and validate the plugin feed. With a version installed the read is bounded to
 * {@link INSTALLED_FEED_CHECK_MS}; a first install keeps the full operation budget.
 * @param installed - the installed plugin version, if any.
 * @param timeoutMs - whole-operation deadline.
 * @returns the feed or the failure reason.
 */
async function readFeed(installed: string | undefined, timeoutMs: number): Promise<FeedRead> {
  const bound = installed === undefined ? Math.min(timeoutMs, 30_000) : INSTALLED_FEED_CHECK_MS
  try {
    const response = await fetch(CADCRAFT_FEED_URL, {
      signal: AbortSignal.timeout(bound),
      headers: { accept: 'application/json' },
    })
    if (!response.ok) return { error: 'cadcraft feed HTTP ' + String(response.status) }
    const parsed: unknown = await response.json()
    if (!isFeed(parsed)) return { error: 'cadcraft feed has an invalid document' }
    return { feed: parsed }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/** The version of an installed CADCraft plugin, or undefined when absent. */
function readInstalledVersion(profileDir: string): string | undefined {
  const manifestPath = join(profileDir, 'node_modules', ...CADCRAFT_PLUGIN_NAME.split('/'), 'package.json')
  if (!existsSync(manifestPath)) return undefined
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : undefined
  } catch {
    return undefined
  }
}

/** Add the bundle to the profile's selected bundle layer without touching other entries. */
async function enableBundle(profileDir: string): Promise<void> {
  const manifestPath = join(profileDir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ProfileManifest
  const bundles = manifest.dsh?.profile?.bundles ?? []
  if (!bundles.includes(CADCRAFT_PLUGIN_NAME)) {
    manifest.dsh = {
      ...manifest.dsh,
      profile: { ...manifest.dsh?.profile, bundles: [...bundles, CADCRAFT_PLUGIN_NAME] },
    }
    await writeFileAtomic(manifestPath, JSON.stringify(manifest, undefined, 2) + '\n', { mode: 0o600 })
  }
}

/** Run the bundled pnpm through the bundled Node with a hard deadline. */
function runPnpm(node: string, pnpm: string, cwd: string, args: readonly string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(node, ['--expose-internals', pnpm, '--dir', cwd, ...args], {
      cwd: dirname(pnpm),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        DSH_DESKTOP_NODE_EXECUTABLE: node,
      },
      stdio: 'ignore',
      windowsHide: true,
    })
    const timer = setTimeout(() => { child.kill(); reject(new Error('cadcraft pnpm install timed out')) }, timeoutMs)
    child.once('error', (error) => { clearTimeout(timer); reject(error) })
    child.once('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error('cadcraft pnpm install exited with ' + String(code)))
    })
  })
}

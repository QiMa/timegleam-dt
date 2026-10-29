/**
 * Host half of @hy/dsh-experimental-huayu-cadcraft: serve the bundled CADCraft web client under
 * one URL prefix and tell browser pages where it lives.
 *
 * M3: this plugin also owns the CADCraft drawing store. Every agent session
 * keeps its drawing at '<cwd>/cadcraft/drawing.dxf' (the session cwd is its
 * workspace directory), so each project directory carries its own drawing and
 * sessions inside one workspace share it. The Creator-mode dynamic halves
 * bridge the iframe to this store over the private harness methods
 * 'cadcraft.drawing.*'; the chat tool 'cadcraft_project_new' (registered by
 * the dynamic host half) calls the store's ensureProject to create the
 * project directory, register a DSH workspace and its first agent session —
 * the M3 'new project from the left sidebar' lifecycle, wired for chat.
 */
import type { Context } from '@hy/cordis'
import type {} from '@hy/dsh-host-webserver'
import type {} from '@hy/dsh-workspace'
import type {} from '@hy/dsh-api-session-controller'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import z from '@hy/schemastery'

/** Stable Cordis plugin name. */
export const name = 'huayu-cadcraft'

/** Services required before the static route can be claimed. */
export const inject = ['webServer', 'workspaceRegistry']

/** Plugin config: where the CADCraft dist lives and the URL prefix it is served under. */
export interface Config {
  /** Absolute path of index.html inside the CADCraft web dist root; empty serves the package's bundled assets/web. */
  distIndex: string
  /** URL prefix the dist is served under, without trailing slash. */
  mountPath: string
  /** Directory that new CADCraft projects are created under; empty falls back to the DSH home. */
  projectsRoot: string
}

export const Config: z<Config> = z.object({
  distIndex: z.string().default(''),
  mountPath: z.string().default('/cadcraft'),
  projectsRoot: z.string().default(''),
})

/** File name every project keeps its drawing in. */
const DRAWING_FILE = 'drawing.dxf'

/** Upper bound on one accepted drawing, in bytes. */
const DRAWING_BYTES_LIMIT = 64 * 1024 * 1024

/** Upper bound on one accepted base64 save chunk. */
const DRAWING_CHUNK_LIMIT = 128 * 1024

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

const MISS_CODES: ReadonlySet<string | undefined> = new Set(['ENOENT', 'EISDIR', 'ENOTDIR'])

function sanitizeSlug(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug === '' ? 'project' : slug
}

/** Chunk-assembled drawing transfer state for one session. */
interface TransferState {
  chunks: (string | null)[]
}

/**
 * Serve the CADCraft dist under one prefix and inject the mount path into pages.
 * @param ctx - plugin context carrying the webserver service.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  const distIndex = config.distIndex.trim() === ''
    ? fileURLToPath(new URL('../assets/web/index.html', import.meta.url))
    : resolve(config.distIndex)
  const distRoot = dirname(distIndex)
  const mountPath = '/' + config.mountPath.replace(/^\/+|\/+$/g, '')
  const projectsRoot = config.projectsRoot.trim() === ''
    ? join(process.env.DSH_HOME ?? process.cwd(), 'cadcraft-projects')
    : resolve(config.projectsRoot)

  // ---- M3 drawing store -------------------------------------------------
  // Drawings are cached in memory; every accepted save lands on disk first.
  const drawings = new Map<string, { bytes: Buffer }>()
  const saves = new Map<string, TransferState>()
  const loads = new Map<string, TransferState>()

  function drawingPath(workspacePath: string): string {
    return join(resolve(workspacePath), 'cadcraft', DRAWING_FILE)
  }

  async function loadDrawing(sessionId: string, workspacePath: string): Promise<{ bytes: string } | { missing: true }> {
    if (sessionId.trim() === '' || workspacePath.trim() === '') return { missing: true }
    let stored = drawings.get(sessionId)
    if (stored === undefined) {
      let bytes: Buffer
      try {
        bytes = await readFile(drawingPath(workspacePath))
      } catch {
        return { missing: true }
      }
      if (bytes.length > DRAWING_BYTES_LIMIT) return { missing: true }
      stored = { bytes }
      drawings.set(sessionId, stored)
    }
    return { bytes: stored.bytes.toString('base64') }
  }

  async function storeDrawing(sessionId: string, workspacePath: string, bytes: Buffer): Promise<{ ok: boolean; message?: string }> {
    if (sessionId.trim() === '' || workspacePath.trim() === '') {
      return { ok: false, message: 'drawing save needs the current session and its workspace directory' }
    }
    if (bytes.length === 0 || bytes.length > DRAWING_BYTES_LIMIT) {
      return { ok: false, message: `drawing save rejected invalid bytes: ${bytes.length}` }
    }
    const path = drawingPath(workspacePath)
    try {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes)
    } catch (error) {
      return { ok: false, message: `drawing save failed to write: ${error instanceof Error ? error.message : String(error)}` }
    }
    drawings.set(sessionId, { bytes })
    return { ok: true, message: `saved ${bytes.length} bytes` }
  }

  async function ensureProject(name: string): Promise<Record<string, unknown>> {
    const projectPath = join(projectsRoot, sanitizeSlug(name))
    let workspace
    try {
      await mkdir(projectPath, { recursive: true })
      workspace = await ctx.workspaceRegistry.create(projectPath, name)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
    const sessionController = ctx.get('sessionController') as {
      create(input: { workspaceId?: string; cwd?: string }): Promise<{ sessionId: string }>
    } | undefined
    let sessionId: string | undefined
    let message: string | undefined
    if (sessionController !== undefined && typeof sessionController.create === 'function') {
      try {
        const created = await sessionController.create({ workspaceId: workspace.id })
        sessionId = String(created.sessionId)
      } catch (error) {
        message = `workspace created, but its session could not be created: ${error instanceof Error ? error.message : String(error)}`
      }
    } else {
      message = 'workspace created; no session controller is mounted, so open it from the sidebar'
    }
    return {
      ok: true,
      created: true,
      workspaceId: String(workspace.id),
      workspacePath: workspace.path,
      ...(sessionId === undefined ? {} : { sessionId }),
      ...(message === undefined ? {} : { message }),
    }
  }

  // Drawing transfer relays for the dynamic host half. The dynamic half's
  // harness.handle methods reach this store through ctx.get(name).
  ctx.provide('huayuCadcraftDrawingStore', {
    projectsRoot,
    async load(sessionId: string, workspacePath: string) {
      return loadDrawing(sessionId, workspacePath)
    },
    async beginLoad(sessionId: string, workspacePath: string) {
      if (sessionId.trim() === '' || workspacePath.trim() === '') return
      loads.set(sessionId, { chunks: [] })
    },
    async loadChunk(sessionId: string, chunk: string) {
      if (sessionId.trim() === '') return
      const state = loads.get(sessionId)
      if (state === undefined || chunk.length === 0 || chunk.length > DRAWING_CHUNK_LIMIT) return
      state.chunks.push(chunk)
    },
    async endLoad(sessionId: string, workspacePath: string) {
      if (sessionId.trim() === '' || workspacePath.trim() === '') return { missing: true }
      const state = loads.get(sessionId)
      loads.delete(sessionId)
      if (state === undefined) return loadDrawing(sessionId, workspacePath)
      const text = state.chunks.filter((chunk): chunk is string => chunk !== null).join('')
      if (text === '') return loadDrawing(sessionId, workspacePath)
      let bytes: Buffer
      try {
        bytes = Buffer.from(text, 'base64')
        if (bytes.length === 0 || bytes.length > DRAWING_BYTES_LIMIT) throw new Error(`unexpected drawing size ${bytes.length}`)
      } catch {
        return { ok: false, message: `drawing load rejected invalid bytes: ${text.length}` }
      }
      return storeDrawing(sessionId, workspacePath, bytes)
    },
    async beginSave(sessionId: string, workspacePath: string) {
      if (sessionId.trim() === '' || workspacePath.trim() === '') return
      saves.set(sessionId, { chunks: [] })
    },
    async saveChunk(sessionId: string, chunk: string) {
      if (sessionId.trim() === '') return
      const state = saves.get(sessionId)
      if (state === undefined || chunk.length === 0 || chunk.length > DRAWING_CHUNK_LIMIT) return
      state.chunks.push(chunk)
    },
    async endSave(sessionId: string, workspacePath: string, name: string | undefined) {
      if (sessionId.trim() === '' || workspacePath.trim() === '') {
        return { ok: false, message: 'drawing save needs the current session and its workspace directory' }
      }
      const state = saves.get(sessionId)
      saves.delete(sessionId)
      if (state === undefined) return { ok: false, message: 'drawing save ended without chunks' }
      const text = state.chunks.filter((chunk): chunk is string => chunk !== null).join('')
      let bytes: Buffer
      try {
        bytes = Buffer.from(text, 'base64')
        if (bytes.length === 0 || bytes.length > DRAWING_BYTES_LIMIT) throw new Error(`unexpected drawing size ${bytes.length}`)
      } catch {
        return { ok: false, message: `drawing save rejected invalid bytes: ${text.length}` }
      }
      const result = await storeDrawing(sessionId, workspacePath, bytes)
      return { ok: result.ok, message: name === undefined ? result.message : `${result.message} (${name})` }
    },
    async ensureProject(name: string) {
      return ensureProject(name)
    },
  })

  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: '__HUAYU_CADCAST_CONFIG__', value: { mountPath } })
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: mountPath,
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405)
        res.end()
        return
      }
      const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
      const relative = pathname === mountPath ? '' : pathname.slice(mountPath.length + 1)
      const target = resolve(normalize(join(distRoot, relative)))
      if (target !== distRoot && !target.startsWith(distRoot + sep)) {
        res.writeHead(403)
        res.end()
        return
      }
      let body: string | Buffer
      let type: string
      try {
        const file = target === distRoot ? distIndex : target
        body = await readFile(file)
        type = MIME[extname(file)] ?? 'application/octet-stream'
        if (file === distIndex) {
          body = ctx.webServer.applyIndexTaps(body.toString('utf8'))
        }
      } catch (error) {
        if (!MISS_CODES.has((error as NodeJS.ErrnoException).code)) throw error
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, { 'content-type': type })
      res.end(body)
    },
  }), 'huayu-cadcraft: cadcraft static route')
}

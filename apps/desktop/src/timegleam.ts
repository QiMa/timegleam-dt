/** TimeGleam account facts shared by the welcome flow and deep links. */

/** Public TimeGleam MCP endpoint the desktop Host connects to. */
export const TIMEGLEAM_MCP_URL = 'https://timegleam.com/mcp'

/** OpenAI-compatible model proxy served by the TimeGleam workspace. */
export const TIMEGLEAM_API_BASE = 'https://timegleam.com/api/llm/v1'

/** Public origin that hosts desktop sign-in. */
export const TIMEGLEAM_ORIGIN = 'https://timegleam.com'

/** Route that mints one browser-approval token for a desktop client. */
export const TIMEGLEAM_LOGIN_START_URL = `${TIMEGLEAM_ORIGIN}/api/desktop/login/start`

/** Route that reports approval and releases the issued key exactly once. */
export const TIMEGLEAM_LOGIN_POLL_URL = `${TIMEGLEAM_ORIGIN}/api/desktop/login/poll`

/** Provider route this desktop seeds for every TimeGleam model call. */
export const TIMEGLEAM_PROVIDER = 'timegleam'

/**
 * Model this desktop selects after sign-in when the granted list offers it.
 * The list is workspace-specific, so an absent id falls back to its first entry.
 */
export const TIMEGLEAM_DEFAULT_MODEL = 'huayu-v2'

/**
 * Console page that issues access keys. The online workspace is a single-page
 * application whose account views live on the root path; `/account/ai-tools`
 * is only the API route and returns 404 when opened directly.
 */
export const TIMEGLEAM_CONSOLE_URL = 'https://timegleam.com/?account=security'

/**
 * Credential reference the TimeGleam MCP registration resolves per connection.
 * Keep in sync with `packages/bundle/timegleam/src/index.ts`.
 */
export const TIMEGLEAM_CREDENTIAL_REF = 'TIMEGLEAM_TOKEN'

/** Access-key shape issued by the TimeGleam console (`tmg_`, legacy `aym_`). */
export const TIMEGLEAM_TOKEN_PATTERN = /^(?:tmg|aym)_[\x21-\x7e]+$/u

/** Approval tokens are 16 random bytes rendered as lowercase hex. */
export const TIMEGLEAM_LOGIN_TOKEN_PATTERN = /^[a-f0-9]{32}$/u

/** One model the proxy reports for this workspace. */
export interface TimeGleamModel {
  readonly id: string
  readonly name: string
}

/** Narrow an untrusted JSON value to an object with string keys. */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Build the approval URL the user's browser opens.
 * @param token - token minted by {@link TIMEGLEAM_LOGIN_START_URL}.
 * @returns timegleam.com URL that never exposes anything but the one-time token.
 */
export function timeGleamLoginUrl(token: string): string {
  if (!TIMEGLEAM_LOGIN_TOKEN_PATTERN.test(token)) throw new Error('desktop login: invalid token')
  return `${TIMEGLEAM_ORIGIN}/?desktop_login=${token}`
}

/**
 * Read the models this connection may call through the proxy.
 * @param token - access key just stored for the provider route.
 * @param send - HTTP client, injectable for tests.
 * @returns unique model ids in proxy order; rejects when the list is unusable.
 */
export async function fetchTimeGleamModels(
  token: string,
  send: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<TimeGleamModel[]> {
  if (!TIMEGLEAM_TOKEN_PATTERN.test(token)) throw new Error('desktop login: invalid access key')
  const response = await send(`${TIMEGLEAM_API_BASE}/models`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  if (!response.ok) throw new Error('desktop login: model list unavailable')
  const payload: unknown = await response.json()
  if (!record(payload) || !Array.isArray(payload.data)) throw new Error('desktop login: invalid model list')
  const seen = new Set<string>()
  const models: TimeGleamModel[] = []
  for (const entry of payload.data) {
    if (!record(entry)) continue
    const id = entry.id
    if (typeof id !== 'string' || !/^[\x21-\x7e]{1,200}$/u.test(id) || seen.has(id)) continue
    seen.add(id)
    const owned = entry.owned_by
    models.push({ id, name: typeof owned === 'string' && owned !== '' ? owned : id })
  }
  if (models.length === 0) throw new Error('desktop login: no authorized text model')
  return models
}

/** Outcome of verifying an access key against the live MCP endpoint. */
export type TimeGleamTokenProbe = 'ok' | 'invalid' | 'unreachable'

/**
 * Ask the public MCP endpoint to initialize with the candidate key.
 * The key travels only in the Authorization header; nothing is logged or echoed.
 * @param token - candidate access key.
 * @param send - HTTP client, injectable for tests.
 * @returns `ok` on any success, `invalid` for an authenticated refusal,
 * `unreachable` for network failures and every other response.
 */
export async function probeTimeGleamToken(
  token: string,
  send: (input: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<TimeGleamTokenProbe> {
  try {
    const response = await send(TIMEGLEAM_MCP_URL, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'timegleam-desktop', version: '1' },
        },
      }),
    })
    void response.body?.cancel().catch(() => undefined)
    if (response.status === 401 || response.status === 403) return 'invalid'
    return response.ok ? 'ok' : 'unreachable'
  } catch {
    return 'unreachable'
  }
}

/** A recognized `timegleam://` launch. */
export type TimeGleamDeepLink =
  | { readonly kind: 'open' }
  | { readonly kind: 'project'; readonly projectId: string }

/** Project ids the online workspace mints; anything else is refused. */
const PROJECT_ID = /^[A-Za-z0-9_-]{1,128}$/u

/**
 * Parse a TimeGleam deep link without trusting the caller.
 * Only `timegleam://open` and `timegleam://project/<id>` are accepted.
 * @param raw - argv entry or macOS open-url payload.
 * @returns the recognized intent, or undefined for every other URL.
 */
export function parseTimeGleamDeepLink(raw: string): TimeGleamDeepLink | undefined {
  // WHATWG URL normalization collapses `..` before we inspect the path, which
  // would turn `timegleam://project/../../etc` into the project id `etc`.
  // Refuse dot segments in the original payload instead of trusting the rewrite.
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return undefined
  }
  if (/(?:^|[\\/])\.{1,2}(?:[\\/]|$)/u.test(decoded)) return undefined
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return undefined
  }
  if (url.protocol !== 'timegleam:') return undefined
  // No form carries userinfo; refusing it keeps "exactly two shapes" literal.
  if (url.username !== '' || url.password !== '') return undefined
  if (url.search !== '' || url.hash !== '') return undefined
  const segments = url.pathname.split('/').filter(segment => segment !== '')
  const host = url.hostname
  if (host === 'open' && segments.length === 0) return { kind: 'open' }
  if (host === 'project') return singleProject(segments)
  if (host === '' && segments[0] === 'open' && segments.length === 1) return { kind: 'open' }
  if (host === '' && segments[0] === 'project') return singleProject(segments.slice(1))
  return undefined
}

/** Accept a project link only when exactly one minted id follows the host. */
function singleProject(segments: string[]): TimeGleamDeepLink | undefined {
  const projectId = segments[0]
  if (segments.length !== 1 || projectId === undefined) return undefined
  return PROJECT_ID.test(projectId) ? { kind: 'project', projectId } : undefined
}

/**
 * Build the online workspace URL that opens one project.
 * @param projectId - id already accepted by {@link parseTimeGleamDeepLink}.
 */
export function timeGleamProjectUrl(projectId: string): string {
  return `https://timegleam.com/?project=${encodeURIComponent(projectId)}`
}

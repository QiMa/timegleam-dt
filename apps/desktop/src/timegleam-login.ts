/**
 * Browser sign-in for the TimeGleam desktop edition.
 *
 * The desktop asks timegleam.com for a one-time token, opens the account page
 * with it, and polls until the signed-in browser approves. The server then
 * releases one personal access key, which the shell stores through the
 * credentials seam. Nothing about the account session reaches the desktop.
 */
import { setTimeout as delay } from 'node:timers/promises'
import {
  TIMEGLEAM_LOGIN_POLL_URL,
  TIMEGLEAM_LOGIN_START_URL,
  TIMEGLEAM_LOGIN_TOKEN_PATTERN,
  TIMEGLEAM_TOKEN_PATTERN,
  timeGleamLoginUrl,
} from './timegleam.ts'

/** Poll cadence between the desktop and the sign-in record. */
const POLL_INTERVAL_MS = 2_500
/** Server-side approval lifetime the desktop uses when the response omits it. */
const DEFAULT_WAIT_MS = 10 * 60 * 1000

/** Facts one attempt needs from its environment. */
export interface TimeGleamLoginEnvironment {
  /** Unix milliseconds; injectable for tests. */
  now(): number
  /** Open the approval page in the user's default browser. */
  openExternal(url: string): Promise<void>
  /** HTTP client for the two desktop-login routes; injectable for tests. */
  fetch(input: string, init?: RequestInit): Promise<Response>
  /** Idle time between polls; the shell uses the default. */
  pollIntervalMs?: number
}

/** Terminal outcome of one sign-in attempt. */
export type TimeGleamLoginResult =
  | { readonly kind: 'succeeded'; readonly token: string; readonly workspaceId: string }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'expired' }
  | { readonly kind: 'failed'; readonly reason: 'network' }

/** Approval-page facts while an attempt waits for the browser. */
export interface TimeGleamLoginView {
  readonly authorizeUrl: string
  readonly expiresAt: number
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Accept only a 32-hex token and a bounded lifetime from the start route. */
function parseStart(value: unknown): { token: string; expiresIn: number } {
  if (!record(value) || typeof value.token !== 'string' || !TIMEGLEAM_LOGIN_TOKEN_PATTERN.test(value.token)) {
    throw new Error('desktop login: invalid start response')
  }
  const expires = value.expires_in
  const expiresIn = typeof expires === 'number' && Number.isInteger(expires) && expires >= 60 && expires <= 900
    ? expires * 1000 : DEFAULT_WAIT_MS
  return { token: value.token, expiresIn }
}

/** Accept the one-time key and its workspace; every other status stays pending. */
function parsePoll(value: unknown): { token: string; workspaceId: string } | undefined {
  if (!record(value) || value.status !== 'done' || typeof value.key !== 'string'
    || !TIMEGLEAM_TOKEN_PATTERN.test(value.key) || typeof value.workspace_id !== 'string'
    || value.workspace_id === '' || value.workspace_id.length > 160) return undefined
  return { token: value.key, workspaceId: value.workspace_id }
}

/** One self-contained sign-in attempt; the shell owns its lifetime. */
export class TimeGleamLogin {
  readonly #environment: TimeGleamLoginEnvironment
  #active: TimeGleamLoginView | undefined
  #pending: Promise<TimeGleamLoginResult> | undefined
  #aborted = false

  constructor(environment: TimeGleamLoginEnvironment) {
    this.#environment = environment
  }

  /** The approval page while this attempt is still waiting, or none. */
  state(): TimeGleamLoginView | undefined {
    return this.#active
  }

  /** Drop the running attempt; called once when the shell tears the window down. */
  dispose(): void {
    this.#aborted = true
    this.#active = undefined
    this.#pending = undefined
  }

  /**
   * Start (or join) browser approval.
   * @param onWaiting - receives the approval page as soon as it exists.
   * @returns the issued key on success, or why approval ended.
   */
  async start(onWaiting?: (view: TimeGleamLoginView) => void): Promise<TimeGleamLoginResult> {
    const existing = this.#active
    if (existing !== undefined) {
      onWaiting?.(existing)
      return this.#pending ?? Promise.resolve({ kind: 'cancelled' })
    }
    this.#aborted = false
    const pending = this.#run(onWaiting)
    this.#pending = pending
    try {
      return await pending
    } finally {
      this.#active = undefined
      if (this.#pending === pending) this.#pending = undefined
    }
  }

  /** Cancel a waiting attempt. A completed attempt keeps its key. */
  cancel(): void {
    this.#aborted = true
    this.#active = undefined
  }

  async #run(onWaiting?: (view: TimeGleamLoginView) => void): Promise<TimeGleamLoginResult> {
    let started: { token: string; expiresIn: number }
    try {
      const response = await this.#environment.fetch(TIMEGLEAM_LOGIN_START_URL, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
        headers: { 'content-type': 'application/json' }, body: '{}',
      })
      if (!response.ok) return { kind: 'failed', reason: 'network' }
      started = parseStart(await response.json())
    } catch {
      return { kind: 'failed', reason: 'network' }
    }
    if (this.#aborted) return { kind: 'cancelled' }
    const view = { authorizeUrl: timeGleamLoginUrl(started.token), expiresAt: this.#environment.now() + started.expiresIn }
    this.#active = view
    onWaiting?.(view)
    try {
      await this.#environment.openExternal(view.authorizeUrl)
    } catch {
      // The window offers a retry; the browser is not required to approve.
    }
    return this.#poll(started.token, view.expiresAt)
  }

  async #poll(token: string, expiresAt: number): Promise<TimeGleamLoginResult> {
    for (;;) {
      if (this.#aborted) return { kind: 'cancelled' }
      if (this.#environment.now() >= expiresAt) return { kind: 'expired' }
      try {
        const response = await this.#environment.fetch(TIMEGLEAM_LOGIN_POLL_URL, {
          method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
          headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }),
        })
        // A 404 means the server dropped the record; retrying cannot revive it.
        if (response.status === 404 || response.status === 410) return { kind: 'expired' }
        if (response.ok) {
          const issued = parsePoll(await response.json())
          if (issued !== undefined) return { kind: 'succeeded', ...issued }
        }
      } catch {
        // A single transport hiccup keeps polling until the attempt expires.
      }
      await delay(this.#environment.pollIntervalMs ?? POLL_INTERVAL_MS)
    }
  }
}

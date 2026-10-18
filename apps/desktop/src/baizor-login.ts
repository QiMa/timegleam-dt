/**
 * Baizor account sign-in for the desktop shell: the device-style CLI login
 * the baizor console exposes. The shell opens https://baizor.com/keys with a
 * one-time poll token; the signed-in console reveals (or auto-creates) an API
 * key and submits it under that token, and this controller stores the
 * returned key through the credentials seam.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import type { SignInAttemptId, SignInAttemptView, SignInErrorCode } from '@hy/dsh-deepseek-account/types'

/** The baizor console origin this login protocol rides. */
const BAIZOR_ORIGIN = 'https://baizor.com'
/** Poll interval between the baizor session store and this client. */
const POLL_INTERVAL_MS = 2500
/** The baizor session store expires sessions after ten minutes; stop a little earlier. */
const MAX_WAIT_MS = 9 * 60 * 1000
/** Valid baizor keys carry printable bytes after the sk- prefix. */
const API_KEY_PATTERN = /^sk-[\x21-\x7e]+$/

/** Facts a login attempt needs from its environment. */
export interface BaizorLoginEnvironment {
  /** Unix milliseconds; injectable for tests. */
  now(): number
  /** Open the baizor keys page in the user's default browser. */
  openExternal(url: string): Promise<void>
  /** Fetch the baizor poll endpoint; injectable for tests. */
  fetch(input: string, init?: RequestInit): Promise<Response>
}

/** The local persistence half of a login; a refused write fails the attempt. */
export interface BaizorCredentialStore {
  /** @returns when the key is stored through the credentials seam. */
  save(key: string): Promise<void>
}

/** Terminal outcome of one login attempt. */
export type BaizorLoginResult =
  | { readonly kind: 'succeeded'; readonly view: SignInAttemptView }
  | { readonly kind: 'cancelled'; readonly view: SignInAttemptView }
  | { readonly kind: 'expired'; readonly view: SignInAttemptView }
  | { readonly kind: 'failed'; readonly view: SignInAttemptView; readonly errorCode: SignInErrorCode }

/** Snapshot of the single running attempt, for shell-owned copy/cancel flows. */
export type BaizorLoginState =
  | { readonly active: true; readonly attempt: SignInAttemptView }
  | { readonly active: false }

interface BaizorAttempt {
  readonly id: SignInAttemptId
  readonly token: string
  view: SignInAttemptView
}

/**
 * The baizor keys page: an already signed-in account reveals (or auto-creates)
 * an API key and submits it to the server under the poll token.
 */
export function baizorLoginUrl(token: string): string {
  const url = new URL(`${BAIZOR_ORIGIN}/keys`)
  url.searchParams.set('login_token', token)
  return url.href
}

/** 16 random bytes rendered as 32 lowercase hex characters, matching the server's token generator. */
function loginToken(): string {
  return randomBytes(16).toString('hex')
}

/** Strict validation of a poll response; every shape mismatch reads as a pending poll. */
function parseSubmittedKey(envelope: unknown): string | undefined {
  if (typeof envelope !== 'object' || envelope === null) return undefined
  const data = (envelope as { data?: unknown }).data
  if (typeof data !== 'object' || data === null) return undefined
  const record = data as { status?: unknown; key?: unknown }
  if (record.status !== 'done' || typeof record.key !== 'string' || !API_KEY_PATTERN.test(record.key)) return undefined
  return record.key
}

/** One self-contained baizor login session; the shell owns its lifetime. */
export class BaizorLogin {
  readonly #environment: BaizorLoginEnvironment
  readonly #store: BaizorCredentialStore
  #active: BaizorAttempt | undefined
  #pending: Promise<BaizorLoginResult> | undefined
  #aborted = false

  constructor(environment: BaizorLoginEnvironment, store: BaizorCredentialStore) {
    this.#environment = environment
    this.#store = store
  }

  /** The single running attempt, or none. */
  state(): BaizorLoginState {
    return this.#active === undefined ? { active: false } : { active: true, attempt: this.#active.view }
  }

  /** Drop the running attempt; called once when the shell tears the backend down. */
  dispose(): void {
    this.#aborted = true
    this.#active = undefined
    this.#pending = undefined
  }

  /**
   * Start (or join) browser authorization: open the baizor keys page and poll
   * until the console submits a key, the attempt expires, or the shell
   * cancels it. A concurrent start joins the running attempt.
   * @param onWaiting - receives the waiting view once the keys link is ready.
   * @returns the terminal outcome; a stored key's view carries `succeeded`.
   */
  async start(onWaiting?: (view: SignInAttemptView) => void): Promise<BaizorLoginResult> {
    const existing = this.#active
    if (existing !== undefined) {
      if (onWaiting !== undefined && existing.view.phase === 'waiting-browser') onWaiting(existing.view)
      return this.#pending ?? Promise.resolve({ kind: 'cancelled', view: { id: existing.id, phase: 'cancelled' } })
    }
    const id = randomUUID() as SignInAttemptId
    const attempt: BaizorAttempt = { id, token: loginToken(), view: { id, phase: 'initializing' } }
    this.#aborted = false
    this.#active = attempt
    const pending = this.#run(attempt, onWaiting)
    this.#pending = pending
    try {
      return await pending
    } finally {
      if (this.#active === attempt) this.#active = undefined
      if (this.#pending === pending) this.#pending = undefined
    }
  }

  /**
   * Cancel the running attempt if it is still waiting; committing attempts
   * settle with their current view.
   */
  cancel(id: SignInAttemptId): Promise<BaizorLoginResult> {
    const current = this.#active
    if (current === undefined || current.id !== id) {
      throw new Error('desktop welcome: login link is unavailable')
    }
    if (current.view.phase === 'succeeded' || current.view.phase === 'committing') {
      return Promise.resolve({ kind: 'cancelled', view: current.view })
    }
    this.#active = undefined
    return Promise.resolve({ kind: 'cancelled', view: { id: current.id, phase: 'cancelled' } })
  }

  async #run(attempt: BaizorAttempt, onWaiting?: (view: SignInAttemptView) => void): Promise<BaizorLoginResult> {
    const waiting: SignInAttemptView = {
      id: attempt.id,
      phase: 'waiting-browser',
      authorizeUrl: baizorLoginUrl(attempt.token),
      expiresAt: this.#environment.now() + MAX_WAIT_MS,
    }
    attempt.view = waiting
    onWaiting?.(waiting)
    try {
      await this.#environment.openExternal(waiting.authorizeUrl as string)
    } catch {
      // The renderer offers a copy link; the browser is not required for login.
    }
    return this.#poll(attempt)
  }

  async #poll(attempt: BaizorAttempt): Promise<BaizorLoginResult> {
    const deadline = this.#environment.now() + MAX_WAIT_MS
    for (;;) {
      if (this.#aborted || this.#active?.id !== attempt.id) {
        return { kind: 'cancelled', view: { id: attempt.id, phase: 'cancelled' } }
      }
      if (this.#environment.now() >= deadline) {
        return { kind: 'expired', view: { id: attempt.id, phase: 'expired' } }
      }
      try {
        const response = await this.#environment.fetch(`${BAIZOR_ORIGIN}/api/cli/poll?token=${encodeURIComponent(attempt.token)}`)
        if (!response.ok) {
          return { kind: 'failed', view: { id: attempt.id, phase: 'failed' }, errorCode: 'network' }
        }
        const key = parseSubmittedKey(await response.json())
        if (key !== undefined) {
          attempt.view = { id: attempt.id, phase: 'committing' }
          try {
            await this.#store.save(key)
          } catch {
            return { kind: 'failed', view: { id: attempt.id, phase: 'failed' }, errorCode: 'storage' }
          }
          return { kind: 'succeeded', view: { id: attempt.id, phase: 'succeeded' } }
        }
      } catch {
        // A single transport hiccup keeps polling until the attempt expires.
      }
      await delay(POLL_INTERVAL_MS)
    }
  }
}

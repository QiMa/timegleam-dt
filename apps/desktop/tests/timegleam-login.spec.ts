/** Browser approval for the TimeGleam desktop edition, driven by an injected clock and HTTP client. */

import { describe, expect, it, vi } from 'vitest'
import { TimeGleamLogin, type TimeGleamLoginEnvironment, type TimeGleamLoginView } from '../src/timegleam-login.ts'
import { TIMEGLEAM_LOGIN_POLL_URL, TIMEGLEAM_LOGIN_START_URL } from '../src/timegleam.ts'

const TOKEN = '0123456789abcdef0123456789abcdef'
const OTHER = 'fedcba9876543210fedcba9876543210'

/** A transport answering start and then each queued poll response in order. */
function transport(start: () => Response, polls: Array<() => Response>) {
  const calls: Array<[string, RequestInit | undefined]> = []
  let polled = 0
  const fetch = vi.fn(async (input: string, init?: RequestInit): Promise<Response> => {
    calls.push([input, init])
    if (input === TIMEGLEAM_LOGIN_START_URL) return start()
    const next = polls[Math.min(polled++, polls.length - 1)]
    if (next === undefined) throw new Error('unexpected poll')
    return next()
  })
  return { fetch, calls }
}

function environment(fetch: TimeGleamLoginEnvironment['fetch'], clock = { now: 1_000, openExternal: vi.fn(async () => {}) }) {
  return {
    clock,
    environment: { now: () => clock.now, openExternal: clock.openExternal, fetch, pollIntervalMs: 1 } satisfies TimeGleamLoginEnvironment,
  }
}

const started = (overrides: Record<string, unknown> = {}) =>
  () => Response.json({ token: TOKEN, verification_url: 'https://timegleam.com/?desktop_login=' + TOKEN, expires_in: 600, ...overrides })

const pending = () => Response.json({ status: 'pending' })
const approved = () => Response.json({ status: 'done', key: 'tmg_issued', workspace_id: 'ws-1' })

describe('TimeGleam browser sign-in', () => {
  it('mints one token, opens the approval page, and returns the issued key', async () => {
    const { fetch, calls } = transport(started(), [pending, approved])
    const { clock, environment: env } = environment(fetch)
    const view = vi.fn<(view: TimeGleamLoginView) => void>()
    const login = new TimeGleamLogin(env)
    await expect(login.start(view)).resolves.toEqual({ kind: 'succeeded', token: 'tmg_issued', workspaceId: 'ws-1' })
    expect(view).toHaveBeenCalledExactlyOnceWith({
      authorizeUrl: `https://timegleam.com/?desktop_login=${TOKEN}`,
      expiresAt: clock.now + 600_000,
    })
    expect(clock.openExternal).toHaveBeenCalledExactlyOnceWith(`https://timegleam.com/?desktop_login=${TOKEN}`)
    expect(calls.map(([url]) => url)).toEqual([TIMEGLEAM_LOGIN_START_URL, TIMEGLEAM_LOGIN_POLL_URL, TIMEGLEAM_LOGIN_POLL_URL])
    expect(calls[1]![1]).toMatchObject({ method: 'POST', body: JSON.stringify({ token: TOKEN }) })
    expect(login.state()).toBeUndefined()
  })

  it('keeps polling while the browser has not approved yet', async () => {
    const { fetch, calls } = transport(started(), [pending, approved])
    const { environment: env } = environment(fetch)
    const login = new TimeGleamLogin(env)
    await expect(login.start()).resolves.toMatchObject({ kind: 'succeeded', token: 'tmg_issued' })
    expect(calls.filter(([url]) => url === TIMEGLEAM_LOGIN_POLL_URL)).toHaveLength(2)
  })

  it('treats a delivered record as already consumed and keeps waiting', async () => {
    const { fetch } = transport(started(), [() => Response.json({ status: 'delivered' }), approved])
    const login = new TimeGleamLogin(environment(fetch).environment)
    await expect(login.start()).resolves.toMatchObject({ kind: 'succeeded' })
  })

  it.each([404, 410])('stops at HTTP %i because the record is gone', async (status) => {
    const { fetch } = transport(started(), [() => new Response(null, { status })])
    const login = new TimeGleamLogin(environment(fetch).environment)
    await expect(login.start()).resolves.toEqual({ kind: 'expired' })
  })

  it('reports a start failure without opening a browser', async () => {
    const { fetch } = transport(() => new Response(null, { status: 503 }), [])
    const { clock, environment: env } = environment(fetch)
    const login = new TimeGleamLogin(env)
    await expect(login.start()).resolves.toEqual({ kind: 'failed', reason: 'network' })
    expect(clock.openExternal).not.toHaveBeenCalled()
  })

  it.each([
    { token: 'short', expires_in: 600 },
    { token: 'ABCDEF0123456789ABCDEF0123456789', expires_in: 600 },
    { token: undefined, expires_in: 600 },
  ])('refuses a start response the shell cannot trust: %j', async (body) => {
    const { fetch } = transport(started(body), [])
    const login = new TimeGleamLogin(environment(fetch).environment)
    await expect(login.start()).resolves.toEqual({ kind: 'failed', reason: 'network' })
  })

  it('falls back to ten minutes when the start response omits a usable lifetime', async () => {
    const { fetch } = transport(started({ expires_in: '600' }), [approved])
    const { clock, environment: env } = environment(fetch)
    const view = vi.fn<(view: TimeGleamLoginView) => void>()
    await new TimeGleamLogin(env).start(view)
    expect(view.mock.calls[0]?.[0].expiresAt).toBe(clock.now + 600_000)
  })

  it('cancels a waiting attempt and leaves the page unused', async () => {
    const { fetch } = transport(started(), [pending])
    const { environment: env } = environment(fetch)
    const login = new TimeGleamLogin(env)
    const pendingAttempt = login.start()
    await vi.waitFor(() => { expect(login.state()).toBeDefined() })
    login.cancel()
    await expect(pendingAttempt).resolves.toEqual({ kind: 'cancelled' })
    expect(login.state()).toBeUndefined()
  })

  it('joins a repeated start instead of minting a second token', async () => {
    const gate = Promise.withResolvers<undefined>()
    const calls: string[] = []
    const fetch = vi.fn(async (input: string): Promise<Response> => {
      calls.push(input)
      if (input === TIMEGLEAM_LOGIN_START_URL) return started()()
      await gate.promise
      return approved()
    })
    const login = new TimeGleamLogin(environment(fetch).environment)
    const first = login.start()
    await vi.waitFor(() => { expect(login.state()).toBeDefined() })
    const second = login.start()
    gate.resolve(undefined)
    await expect(Promise.all([first, second])).resolves.toEqual([
      { kind: 'succeeded', token: 'tmg_issued', workspaceId: 'ws-1' },
      { kind: 'succeeded', token: 'tmg_issued', workspaceId: 'ws-1' },
    ])
    expect(calls.filter(url => url === TIMEGLEAM_LOGIN_START_URL)).toHaveLength(1)
  })

  it('keeps polling through one transport failure and still accepts approval', async () => {
    let polls = 0
    const fetch = vi.fn(async (input: string): Promise<Response> => {
      if (input === TIMEGLEAM_LOGIN_START_URL) return started()()
      polls++
      if (polls === 1) throw new Error('offline')
      return approved()
    })
    const login = new TimeGleamLogin(environment(fetch).environment)
    await expect(login.start()).resolves.toMatchObject({ kind: 'succeeded' })
    expect(polls).toBe(2)
  })

  it('hands the minted token to the browser rather than a shell-built page', async () => {
    const { fetch, calls } = transport(started({ token: OTHER }), [approved])
    const { clock, environment: env } = environment(fetch)
    await new TimeGleamLogin(env).start()
    expect(clock.openExternal).toHaveBeenCalledExactlyOnceWith(`https://timegleam.com/?desktop_login=${OTHER}`)
    expect(calls[1]![1]).toMatchObject({ body: JSON.stringify({ token: OTHER }) })
  })
})

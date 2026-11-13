/** TimeGleam deep links, access-key shape, and the live MCP probe. */

import { describe, expect, it } from 'vitest'
import {
  fetchTimeGleamModels, parseTimeGleamDeepLink, probeTimeGleamToken, TIMEGLEAM_API_BASE,
  TIMEGLEAM_CONSOLE_URL, TIMEGLEAM_CREDENTIAL_REF, TIMEGLEAM_MCP_URL, TIMEGLEAM_ORIGIN,
  TIMEGLEAM_PROVIDER, TIMEGLEAM_TOKEN_PATTERN, timeGleamLoginUrl, timeGleamProjectUrl,
} from '../src/timegleam.ts'

describe('TimeGleam account facts', () => {
  it('pins the MCP endpoint, console page, and credential reference', () => {
    expect(TIMEGLEAM_MCP_URL).toBe('https://timegleam.com/mcp')
    expect(TIMEGLEAM_CONSOLE_URL).toBe('https://timegleam.com/?account=security')
    expect(TIMEGLEAM_CREDENTIAL_REF).toBe('TIMEGLEAM_TOKEN')
    expect(TIMEGLEAM_API_BASE).toBe('https://timegleam.com/api/llm/v1')
    expect(TIMEGLEAM_ORIGIN).toBe('https://timegleam.com')
    expect(TIMEGLEAM_PROVIDER).toBe('timegleam')
  })

  it('builds one approval URL and refuses anything but a minted token', () => {
    expect(timeGleamLoginUrl('0123456789abcdef0123456789abcdef'))
      .toBe('https://timegleam.com/?desktop_login=0123456789abcdef0123456789abcdef')
    expect(() => timeGleamLoginUrl('not-a-token')).toThrow('invalid token')
  })

  it.each(['tmg_abc123', 'aym_legacy-key', 'tmg_' + 'x'.repeat(64)])('accepts issued key %s', (key) => {
    expect(TIMEGLEAM_TOKEN_PATTERN.test(key)).toBe(true)
  })

  it.each(['', 'tmg_', 'tmg_ has space', 'tmg_\nnewline', 'sk_example', 'tmg', 'TMG_upper'])(
    'rejects malformed key %j', (key) => {
      expect(TIMEGLEAM_TOKEN_PATTERN.test(key)).toBe(false)
    },
  )
})

describe('TimeGleam deep links', () => {
  it.each([
    ['timegleam://open', { kind: 'open' }],
    ['timegleam://project/proj-1', { kind: 'project', projectId: 'proj-1' }],
    ['timegleam:open', { kind: 'open' }],
    ['timegleam:project/abc_DEF-9', { kind: 'project', projectId: 'abc_DEF-9' }],
  ] as const)('accepts %s', (raw, expected) => {
    expect(parseTimeGleamDeepLink(raw)).toEqual(expected)
  })

  it.each([
    'dsh://open',
    'https://timegleam.com/?project=x',
    'timegleam://',
    'timegleam://open/extra',
    'timegleam://project',
    'timegleam://project/a/b',
    'timegleam://project/bad%20id',
    'timegleam://project/..%2fetc',
    'timegleam://project/../../etc',
    'timegleam://open?next=https://evil.example',
    'timegleam://open#fragment',
    'timegleam://project/' + 'a'.repeat(129),
    'timegleam://user@open',
  ])('refuses %s', (raw) => {
    expect(parseTimeGleamDeepLink(raw)).toBeUndefined()
  })

  it('builds the workspace project URL with an encoded id', () => {
    expect(timeGleamProjectUrl('proj-1')).toBe('https://timegleam.com/?project=proj-1')
  })
})

describe('TimeGleam access-key probe', () => {
  type Send = (input: string, init?: RequestInit) => Promise<Response>
  /** A fetch stand-in that answers one status and records every request. */
  const respond = (status: number): Send & { calls: Array<[string, RequestInit | undefined]> } => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const send = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push([input, init])
      return new Response(null, { status })
    }
    return Object.assign(send, { calls })
  }

  it('sends a single initialize request with the key only in the header', async () => {
    const send = respond(200)
    await expect(probeTimeGleamToken('tmg_secret', send)).resolves.toBe('ok')
    expect(send.calls).toHaveLength(1)
    const [url, init] = send.calls[0]!
    expect(url).toBe(TIMEGLEAM_MCP_URL)
    expect(init?.method).toBe('POST')
    expect(init?.redirect).toBe('error')
    expect(init?.headers).toMatchObject({ authorization: 'Bearer tmg_secret' })
    const body = typeof init?.body === 'string' ? init.body : ''
    expect(body).not.toContain('tmg_secret')
    expect(JSON.parse(body)).toMatchObject({ method: 'initialize', id: 1 })
  })

  it.each([[401, 'invalid'], [403, 'invalid'], [404, 'unreachable'], [500, 'unreachable']] as const)(
    'classifies HTTP %i as %s', async (status, outcome) => {
      await expect(probeTimeGleamToken('tmg_key', respond(status))).resolves.toBe(outcome)
    },
  )

  it('reports network failures as unreachable', async () => {
    const send: Send = async () => { throw new Error('offline') }
    await expect(probeTimeGleamToken('tmg_key', send)).resolves.toBe('unreachable')
  })
})

describe('TimeGleam proxy model list', () => {
  it('sends the key in the header and keeps only usable unique ids', async () => {
    const calls: Array<[string, RequestInit | undefined]> = []
    const send = async (input: string, init?: RequestInit): Promise<Response> => {
      calls.push([input, init])
      return Response.json({ object: 'list', data: [
        { id: 'deepseek-chat', owned_by: 'DeepSeek' },
        { id: 'deepseek-chat', owned_by: 'duplicate' },
        { id: 'svc::vision', owned_by: 'Service' },
        { id: 'bad id' },
        { id: '' },
        { id: 42 },
      ] })
    }
    await expect(fetchTimeGleamModels('tmg_secret', send)).resolves.toEqual([
      { id: 'deepseek-chat', name: 'DeepSeek' },
      { id: 'svc::vision', name: 'Service' },
    ])
    expect(calls).toHaveLength(1)
    expect(calls[0]![0]).toBe(`${TIMEGLEAM_API_BASE}/models`)
    expect(calls[0]![1]).toMatchObject({ method: 'GET', redirect: 'error', headers: { authorization: 'Bearer tmg_secret' } })
  })

  it.each([
    [401, 'model list unavailable'],
    [500, 'model list unavailable'],
  ] as const)('reports HTTP %i as an unusable list', async (status, message) => {
    const send = async (): Promise<Response> => new Response(null, { status })
    await expect(fetchTimeGleamModels('tmg_key', send)).rejects.toThrow(message)
  })

  it('rejects a malformed or empty list instead of seeding nothing', async () => {
    await expect(fetchTimeGleamModels('tmg_key', async () => Response.json({}))).rejects.toThrow('invalid model list')
    await expect(fetchTimeGleamModels('tmg_key', async () => Response.json({ data: [] }))).rejects.toThrow('no authorized text model')
    await expect(fetchTimeGleamModels('tmg_key', async () => Response.json({ data: [{ id: 'bad id' }] })))
      .rejects.toThrow('no authorized text model')
  })

  it('refuses to send a malformed access key', async () => {
    const send = async (): Promise<Response> => Response.json({ data: [{ id: 'm' }] })
    await expect(fetchTimeGleamModels('sk_wrong', send)).rejects.toThrow('invalid access key')
  })
})

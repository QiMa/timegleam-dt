/** Native onboarding reuses authenticated Web RPC and never reads credential values. */
import { describe, expect, it, vi } from 'vitest'
import { connectDesktopWelcome } from '../src/welcome-backend.ts'

function transport(preference?: string) {
  const keys = new Map<string, string>()
  const namespaces: { ns: string; value: Record<string, unknown>; user?: Record<string, unknown> }[] = [
    { ns: 'llm-deepseek', value: { apiKeyEnv: 'CUSTOM_DEEPSEEK_KEY' } },
    { ns: 'llm-pi-ai', value: { profiles: { example: { apiKeyEnv: 'EXAMPLE_API_KEY' } } } },
    { ns: 'locale', value: preference === undefined ? {} : { preference } },
  ]
  const send = vi.fn<NonNullable<Parameters<typeof connectDesktopWelcome>[2]>>(async (_input, init) => {
    const { rpcId, method, payload } = JSON.parse(init!.body as string) as {
      rpcId: string
      method: string
      payload: { args: { ref: string; value: string; refs: string[] } }
    }
    let value: unknown
    if (method === 'account/getState') value = { links: { usageUrl: 'http://localhost/usage', topUpUrl: 'http://localhost/top_up' }, status: 'signed-out', attempt: null }
    else if (method === 'settings/describe') value = { namespaces }
    else if (method === 'llm/listConfigurableProviders') value = [{ settingsNs: 'llm-pi-ai', settingsPath: ['profiles', 'example'] }]
    else if (method === 'productAnalytics/enabled') value = true
    else if (method === 'productAnalytics/report') value = undefined
    else if (method === 'settings/update') value = undefined
    else if (method === 'credentials/set') keys.set(payload.args.ref, payload.args.value)
    else value = Object.fromEntries(payload.args.refs.map(ref => [ref, { configured: keys.has(ref), writable: true }]))
    return Response.json({ type: 'server-response', rpcId, result: { ok: true, value } })
  })
  return { send, keys, namespaces }
}

const url = 'http://127.0.0.1:19387/'
const cookie = 'dsh-auth-fixture=signed'

describe('desktop welcome Web operations', () => {
  it('authenticates with the explicit Host cookie and stores only through the configured credential reference', async () => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    expect(await backend.analyticsEnabled()).toBe(true)
    await backend.storeTimeGleamToken('tmg_example-key')
    expect(host.keys.get('TIMEGLEAM_TOKEN')).toBe('tmg_example-key')
    expect(await backend.read()).toEqual({
      loggedIn: false, hasApiKey: false, writable: false,
      hasTimeGleamToken: true, timeGleamWritable: true, localePreference: null,
    })
    for (const [input, init] of host.send.mock.calls) {
      expect(input).toMatch(/^http:\/\/127\.0\.0\.1:19387\/api\//u)
      expect(init).toMatchObject({ redirect: 'error', headers: { cookie } })
      expect(init).not.toHaveProperty('credentials')
    }
  })

  it('reads the explicit language preference and recognizes another provider key', async () => {
    const host = transport('zh')
    host.keys.set('EXAMPLE_API_KEY', 'sk-other')
    const backend = connectDesktopWelcome(url, cookie, host.send)
    expect(await backend.read()).toMatchObject({ localePreference: 'zh', hasApiKey: true })
    host.keys.clear()
    expect(await backend.read()).toMatchObject({ hasApiKey: false })
    expect(host.send.mock.calls.every(([, init]) => !(init?.body as string | undefined)?.includes('credentials/set'))).toBe(true)
  })

  it('reads language without querying account or model providers', async () => {
    const host = transport('zh')
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockClear()
    expect(await backend.readLocalePreference()).toBe('zh')
    expect(host.send).toHaveBeenCalledOnce()
    expect(host.send.mock.calls[0]![0]).toContain('/api/settings/describe')
  })

  it('allows profiles without the official provider and retains custom key detection', async () => {
    const host = transport()
    host.namespaces.splice(0, 1)
    const backend = connectDesktopWelcome(url, cookie, host.send)
    expect(await backend.read()).toMatchObject({ hasApiKey: false, writable: false })
    host.keys.set('EXAMPLE_API_KEY', 'custom-key')
    expect(await backend.read()).toMatchObject({ hasApiKey: true, writable: false })
    expect(await backend.save('official-key')).toEqual({ ok: false })
    expect(host.keys.has('undefined')).toBe(false)
  })

  it.each(['', 'sk-format', 'tmg_has space', 'aym_key\n'])('rejects a malformed TimeGleam access key before the Host: %s', async (value) => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockClear()
    await expect(backend.storeTimeGleamToken(value)).rejects.toThrow('invalid TimeGleam access key')
    expect(host.send).not.toHaveBeenCalled()
  })

  it.each(['', 'bad key', 'key\n'])('rejects malformed keys without contacting a provider: %s', async (value) => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockClear()
    expect(await backend.save(value)).toEqual({ ok: false })
    expect(host.send).not.toHaveBeenCalled()
  })

  it('keeps provider diagnostics out of failures and rejects unmatched RPC envelopes', async () => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockRejectedValueOnce(new Error('private credential sk-must-not-leak'))
    expect(await backend.save('sk-example')).toEqual({ ok: false })
    host.send.mockResolvedValueOnce(Response.json({ type: 'server-response', rpcId: 'other', result: { ok: true } }))
    await expect(backend.read()).rejects.toThrow('Web RPC failed')
  })

  it('submits native analytics through authenticated RPC with a bounded request', async () => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    const event = { eventName: 'desktop_app_launch' as const, timestamp: 100, attributes: {} }
    await backend.report(event)
    const [input, init] = host.send.mock.calls.at(-1)!
    expect(input).toBe('http://127.0.0.1:19387/api/productAnalytics/report')
    expect(init?.headers).toMatchObject({ cookie })
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    expect(JSON.parse(init!.body as string)).toMatchObject({ payload: { args: { event } } })
  })

  it('seeds the airgap provider route and default selection for the enterprise edition', async () => {
    const host = transport()
    const updates = new Map<string, Record<string, unknown>>()
    host.send.mockImplementation(async (_input, init) => {
      if (init?.method !== 'POST') return new Response('index')
      const { rpcId, method, payload } = JSON.parse(init.body as string) as {
        rpcId: string
        method: string
        payload: { args: { ns?: string; patch?: Record<string, unknown>; ref?: string; value?: string; refs?: string[] } }
      }
      let value: unknown
      if (method === 'account/getState') value = { links: { usageUrl: 'http://localhost/usage', topUpUrl: 'http://localhost/top_up' }, status: 'signed-out', attempt: null }
      else if (method === 'settings/describe') value = { namespaces: host.namespaces }
      else if (method === 'settings/update' && payload.args.ns !== undefined && payload.args.patch !== undefined) updates.set(payload.args.ns, payload.args.patch)
      else if (method === 'llm/listConfigurableProviders') value = []
      else if (method === 'productAnalytics/enabled') value = true
      else if (method === 'credentials/set') host.keys.set(payload.args.ref!, payload.args.value!)
      else value = Object.fromEntries((payload.args.refs ?? []).map((ref: string) => [
        ref, { configured: host.keys.has(ref), writable: true },
      ]))
      return Response.json({ type: 'server-response', rpcId, result: { ok: true, value } })
    })
    const gateway = { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' }
    const backend = connectDesktopWelcome(url, cookie, host.send, gateway)
    await backend.ensureModelConfiguration()
    const seeded = { providers: { airgap: { apiKeyEnv: 'DSH_BAIZOR_API_KEY', baseURL: 'https://airgap.example.com/v1' } } }
    host.namespaces[1] = { ns: 'llm-pi-ai', value: seeded }
    expect(updates.get('llm-pi-ai')).toMatchObject({ providers: { airgap: { displayName: 'AirGap',
      baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY', models: [{ id: 'huayu-v2' }] } } })
    expect(updates.get('agent-default-model')).toEqual({ provider: 'airgap', model: 'huayu-v2' })
    expect(await backend.read()).toMatchObject({ writable: true, hasApiKey: false })
  })

  it('stores enterprise keys through the seeded airgap credential reference', async () => {
    const host = transport()
    const gateway = { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' }
    host.namespaces[1] = { ns: 'llm-pi-ai', value: { providers: { airgap: { apiKeyEnv: 'DSH_BAIZOR_API_KEY', baseURL: 'https://airgap.example.com/v1' } } } }
    const backend = connectDesktopWelcome(url, cookie, host.send, gateway)
    await backend.storeProviderKey('ag-secret-key')
    expect(host.keys.get('DSH_BAIZOR_API_KEY')).toBe('ag-secret-key')
  })

  it('migrates a stale baizor default selection to the airgap route in the enterprise edition', async () => {
    const host = transport()
    const updates = new Map<string, Record<string, unknown>>()
    host.namespaces.push({ ns: 'agent-default-model', value: {}, user: { provider: 'baizor', model: 'huayu-v2' } })
    host.namespaces[1] = { ns: 'llm-pi-ai', value: { providers: { airgap: { apiKeyEnv: 'DSH_BAIZOR_API_KEY', baseURL: 'https://airgap.example.com/v1' }, baizor: { apiKeyEnv: 'DSH_BAIZOR_API_KEY', baseURL: 'https://baizor.com/v1' } } } }
    host.send.mockImplementation(async (_input, init) => {
      if (init?.method !== 'POST') return new Response('index')
      const { rpcId, method, payload } = JSON.parse(init.body as string) as {
        rpcId: string
        method: string
        payload: { args: { ns?: string; patch?: Record<string, unknown>; ref?: string; value?: string; refs?: string[] } }
      }
      let value: unknown
      if (method === 'settings/describe') value = { namespaces: host.namespaces }
      else if (method === 'settings/update' && payload.args.ns !== undefined && payload.args.patch !== undefined) updates.set(payload.args.ns, payload.args.patch)
      return Response.json({ type: 'server-response', rpcId, result: { ok: true, value } })
    })
    const gateway = { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' }
    const backend = connectDesktopWelcome(url, cookie, host.send, gateway)
    await backend.ensureModelConfiguration()
    expect(updates.get('agent-default-model')).toEqual({ provider: 'airgap', model: 'huayu-v2' })
    expect(updates.get('llm-pi-ai')).toMatchObject({ providers: { baizor: { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' } } })
  })

  it('keeps an already migrated airgap default selection untouched', async () => {
    const host = transport()
    const updates = new Map<string, Record<string, unknown>>()
    host.namespaces.push({ ns: 'agent-default-model', value: {}, user: { provider: 'airgap', model: 'huayu-v2' } })
    host.namespaces[1] = { ns: 'llm-pi-ai', value: { providers: { airgap: { apiKeyEnv: 'DSH_BAIZOR_API_KEY', baseURL: 'https://airgap.example.com/v1' } } } }
    host.send.mockImplementation(async (_input, init) => {
      if (init?.method !== 'POST') return new Response('index')
      const { rpcId, method, payload } = JSON.parse(init.body as string) as {
        rpcId: string
        method: string
        payload: { args: { ns?: string; patch?: Record<string, unknown>; ref?: string; value?: string; refs?: string[] } }
      }
      let value: unknown
      if (method === 'settings/describe') value = { namespaces: host.namespaces }
      else if (method === 'settings/update' && payload.args.ns !== undefined && payload.args.patch !== undefined) updates.set(payload.args.ns, payload.args.patch)
      return Response.json({ type: 'server-response', rpcId, result: { ok: true, value } })
    })
    const gateway = { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' }
    const backend = connectDesktopWelcome(url, cookie, host.send, gateway)
    await backend.ensureModelConfiguration()
    expect(updates.has('agent-default-model')).toBe(false)
  })

  it('refreshes a stale airgap route so the enterprise gateway stays sealed', async () => {
    const host = transport()
    const updates = new Map<string, Record<string, unknown>>()
    host.namespaces.push({ ns: 'agent-default-model', value: {}, user: { provider: 'airgap', model: 'huayu-v2' } })
    host.namespaces[1] = { ns: 'llm-pi-ai', value: { providers: { airgap: { apiKeyEnv: 'DSH_BAIZOR_API_KEY', baseURL: 'https://old-gateway.example.com/v1' } } } }
    host.send.mockImplementation(async (_input, init) => {
      if (init?.method !== 'POST') return new Response('index')
      const { rpcId, method, payload } = JSON.parse(init.body as string) as {
        rpcId: string
        method: string
        payload: { args: { ns?: string; patch?: Record<string, unknown>; ref?: string; value?: string; refs?: string[] } }
      }
      let value: unknown
      if (method === 'settings/describe') value = { namespaces: host.namespaces }
      else if (method === 'settings/update' && payload.args.ns !== undefined && payload.args.patch !== undefined) updates.set(payload.args.ns, payload.args.patch)
      return Response.json({ type: 'server-response', rpcId, result: { ok: true, value } })
    })
    const gateway = { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' }
    const backend = connectDesktopWelcome(url, cookie, host.send, gateway)
    await backend.ensureModelConfiguration()
    expect(updates.get('llm-pi-ai')).toMatchObject({ providers: { airgap: { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' } } })
    expect(updates.has('agent-default-model')).toBe(false)
  })

  it('leaves model configuration untouched in the standard edition', async () => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockClear()
    await backend.ensureModelConfiguration()
    expect(host.send).not.toHaveBeenCalled()
  })

  it('seeds the TimeGleam proxy route and its default model from the granted list', async () => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockClear()
    await backend.ensureTimeGleamModelConfiguration([
      { id: 'deepseek-chat', name: 'DeepSeek' },
      { id: 'svc::vision', name: 'Service' },
    ], 'svc::vision')
    type Update = { method: string; payload: { args: { ns?: string; patch?: Record<string, unknown> } } }
    const updates = host.send.mock.calls
      .map(([, init]) => JSON.parse(init!.body as string) as Update)
      .filter(({ method }) => method === 'settings/update')
    expect(updates.map(({ payload }) => payload.args.ns)).toEqual(['llm-pi-ai', 'agent-default-model'])
    expect(updates[0]!.payload.args.patch).toEqual({ providers: { timegleam: {
      displayName: 'TimeGleam',
      apiKeyEnv: 'TIMEGLEAM_TOKEN',
      api: 'openai-completions',
      baseURL: 'https://timegleam.com/v1',
      defaultContextWindow: 128000,
      defaultMaxTokens: 32768,
      reasoning: 'medium',
      models: [
        { id: 'deepseek-chat', name: 'DeepSeek', contextWindow: 128000, maxTokens: 32768 },
        { id: 'svc::vision', name: 'Service', contextWindow: 128000, maxTokens: 32768 },
      ],
    } } })
    expect(updates[1]!.payload.args.patch).toEqual({ provider: 'timegleam', model: 'svc::vision' })
    expect((host.send.mock.calls[0]![1]!.signal as AbortSignal)).toBeInstanceOf(AbortSignal)
  })

  it('falls back to the first granted model and refuses an empty list', async () => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockClear()
    await backend.ensureTimeGleamModelConfiguration([{ id: 'only-model', name: 'Only' }], 'missing-model')
    const selection = host.send.mock.calls
      .map(([, init]) => JSON.parse(init!.body as string) as { method: string; payload: { args: { ns?: string; patch?: unknown } } })
      .find(({ payload }) => payload.args.ns === 'agent-default-model')
    expect(selection?.payload.args.patch).toEqual({ provider: 'timegleam', model: 'only-model' })
    host.send.mockClear()
    await expect(backend.ensureTimeGleamModelConfiguration([])).rejects.toThrow('no TimeGleam model to seed')
    expect(host.send).not.toHaveBeenCalled()
  })

  it('prefers the desktop default when the workspace grants it', async () => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockClear()
    await backend.ensureTimeGleamModelConfiguration([
      { id: 'deepseek-chat', name: 'DeepSeek' },
      { id: 'huayu-v2', name: 'Huayu v2' },
    ], 'huayu-v2')
    const selection = host.send.mock.calls
      .map(([, init]) => JSON.parse(init!.body as string) as { payload: { args: { ns?: string; patch?: unknown } } })
      .find(({ payload }) => payload.args.ns === 'agent-default-model')
    expect(selection?.payload.args.patch).toEqual({ provider: 'timegleam', model: 'huayu-v2' })
  })

  it('offers reasoning levels only on the routes the proxy accepts them for', async () => {
    const host = transport()
    const backend = connectDesktopWelcome(url, cookie, host.send)
    host.send.mockClear()
    await backend.ensureTimeGleamModelConfiguration([
      { id: 'deepseek-chat', name: 'DeepSeek' },
      { id: 'huayu-v2', name: 'Huayu v2' },
    ], 'huayu-v2')
    type Update = { payload: { args: { ns?: string; patch?: { providers?: { timegleam?: { models?: unknown[] } } } } } }
    const seed = host.send.mock.calls
      .map(([, init]) => JSON.parse(init!.body as string) as Update)
      .find(({ payload }) => payload.args.ns === 'llm-pi-ai')
    expect(seed?.payload.args.patch?.providers?.timegleam?.models).toEqual([
      { id: 'deepseek-chat', name: 'DeepSeek', contextWindow: 128000, maxTokens: 32768 },
      { id: 'huayu-v2', name: 'Huayu v2', contextWindow: 128000, maxTokens: 32768,
        reasoningEfforts: {
          off: 'none', minimal: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max',
        } },
    ])
  })
})

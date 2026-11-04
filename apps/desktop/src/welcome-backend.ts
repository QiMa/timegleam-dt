import type { ProductEvent } from '@hy/dsh-client-product-analytics/types'
/** Native welcome operations using the shared Web authentication and RPC APIs. */

import { randomUUID } from 'node:crypto'
import { desktopAccountBackend, type DesktopAccountBackend } from './account-backend.ts'
import {
  AIRGAP_ENTERPRISE_DEFAULT_SELECTION,
  AIRGAP_ENTERPRISE_PROVIDER,
  airgapEnterpriseProviderProfile,
  type DesktopEnterpriseModelGateway,
} from './product-edition.ts'

/** The credential reference the seeded baizor provider route resolves per request. */
export const BAIZOR_CREDENTIAL_REF = 'DSH_BAIZOR_API_KEY'

/** The baizor provider profile the desktop seeds into the llm-pi-ai settings section. */
export const BAIZOR_PROVIDER_PROFILE = {
  displayName: 'Baizor',
  apiKeyEnv: BAIZOR_CREDENTIAL_REF,
  api: 'openai-completions',
  baseURL: 'https://baizor.com/v1',
  compat: { thinkingFormat: 'deepseek' },
  defaultContextWindow: 128000,
  defaultMaxTokens: 8192,
  models: [{ id: 'huayu-v2', name: 'Huayu v2', contextWindow: 128000, maxTokens: 8192 }],
} as const

/** The default selection the desktop seeds while the user has chosen none. */
export const BAIZOR_DEFAULT_SELECTION = { provider: 'baizor', model: 'huayu-v2' } as const

/** Metadata needed before the native entry or workspace becomes visible. */
export interface WelcomeState {
  readonly loggedIn: boolean
  readonly hasApiKey: boolean
  readonly writable: boolean
  readonly localePreference: string | null
}

/** Narrow operations available to the native welcome flow. */
export interface DesktopWelcomeBackend {
  /** @returns the current Host policy; every read observes live configuration. */
  analyticsEnabled(): Promise<boolean>
  readonly account: DesktopAccountBackend
  /** @param event - desktop-owned fields. @returns after local Host intake. */
  report(event: ProductEvent): Promise<void>
  /** @returns Configured-key presence and the shared language preference, without credential values. */
  read(): Promise<WelcomeState>
  /** @returns The saved UI language without account or provider requests. */
  readLocalePreference(): Promise<string | null>
  /** Seed the edition provider route and default selection into this desktop profile. */
  ensureModelConfiguration(): Promise<void>
  /**
   * @param apiKey - User-entered provider key.
   * @returns A safe write outcome without provider diagnostics.
   */
  save(apiKey: string): Promise<{ ok: boolean }>
  /**
   * Store the edition provider key through the credentials seam; a refused write
   * rejects instead of swallowing the diagnostic.
   * @param apiKey - key returned by the login or gateway provisioning flow.
   */
  storeProviderKey(apiKey: string): Promise<void>
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Connect the native HTTP client to the Desktop Host; every request sends `cookie` explicitly and uses no cookie jar.
 * @param hostUrl - URL of the running Desktop Host; only its origin is used.
 * @param cookie - Cookie header returned by `authenticateWebHost` for this Host.
 * @param send - HTTP client for Host requests.
 * @param modelGateway - Optional enterprise model gateway; when present the
 * AirGap provider route is seeded instead of baizor.com.
 * @returns metadata reads and write-only credential operations over standard RPC.
 */
export function connectDesktopWelcome(
  hostUrl: string,
  cookie: string,
  send: (input: string, init?: RequestInit) => Promise<Response> = fetch,
  modelGateway?: DesktopEnterpriseModelGateway,
): DesktopWelcomeBackend {
  const origin = new URL(hostUrl).origin
  const invoke = async (
    request: { namespace: string; method: string; args: Record<string, unknown> },
    signal?: AbortSignal,
  ): Promise<unknown> => {
    const rpcId = randomUUID()
    const method = `${request.namespace}/${request.method}`
    const response = await send(new URL(`/api/${method}`, origin).href, {
      method: 'POST', redirect: 'error', ...(signal === undefined ? {} : { signal }),
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { args: request.args } }),
    })
    if (!response.ok) throw new Error('desktop welcome: Web request failed')
    const envelope: unknown = await response.json()
    if (!record(envelope) || envelope.type !== 'server-response' || envelope.rpcId !== rpcId
      || !record(envelope.result) || envelope.result.ok !== true) {
      throw new Error('desktop welcome: Web RPC failed')
    }
    return envelope.result.value
  }
  const account = desktopAccountBackend(origin, invoke, cookie)
  const provider = modelGateway === undefined ? 'baizor' : AIRGAP_ENTERPRISE_PROVIDER
  const providerProfile = modelGateway === undefined ? BAIZOR_PROVIDER_PROFILE : airgapEnterpriseProviderProfile(modelGateway)
  const defaultSelection = modelGateway === undefined ? BAIZOR_DEFAULT_SELECTION : AIRGAP_ENTERPRISE_DEFAULT_SELECTION
  /** The `apiKeyEnv` a provider profile stored for this route names, when present. */
  const providerRef = (namespace: unknown, route: string): string | undefined => {
    if (!record(namespace) || !record(namespace.value) || !record(namespace.value.providers)) return undefined
    const profile: unknown = namespace.value.providers[route]
    return record(profile) && typeof profile.apiKeyEnv === 'string' ? profile.apiKeyEnv : undefined
  }
  const settingsAndReference = async () => {
    const settings = await invoke({ namespace: 'settings', method: 'describe', args: {} })
    if (!record(settings) || !Array.isArray(settings.namespaces)) throw new Error('desktop welcome: missing settings namespaces')
    const namespaces = settings.namespaces
    const piAi: unknown = namespaces.find((item: unknown) => record(item) && item.ns === 'llm-pi-ai')
    const seededRef = providerRef(piAi, provider)
    if (seededRef !== undefined) return { settings: { namespaces }, ref: seededRef }
    if (modelGateway !== undefined) return { settings: { namespaces }, ref: undefined }
    const official: unknown = namespaces.find((item: unknown) => record(item) && item.ns === 'llm-deepseek')
    if (official === undefined) return { settings: { namespaces }, ref: undefined }
    if (!record(official) || !record(official.value) || typeof official.value.apiKeyEnv !== 'string') {
      throw new Error('desktop welcome: missing official DeepSeek credential reference')
    }
    return { settings: { namespaces }, ref: official.value.apiKeyEnv }
  }
  const localePreference = (namespaces: unknown[]): string | null => {
    const locale: unknown = namespaces.find((item: unknown) => record(item) && item.ns === 'locale')
    if (!record(locale) || !record(locale.value)
      || (locale.value.preference !== undefined && typeof locale.value.preference !== 'string')) {
      throw new Error('desktop welcome: invalid locale preference')
    }
    return locale.value.preference ?? null
  }
  const read = async (): Promise<WelcomeState> => {
    const { settings, ref } = await settingsAndReference()
    const providers = await invoke({ namespace: 'llm', method: 'listConfigurableProviders', args: {} })
    if (!Array.isArray(providers)) throw new Error('desktop welcome: invalid provider directory')
    const namespaces = settings.namespaces
    const refs = providers.flatMap((entry: unknown) => {
      if (!record(entry) || typeof entry.settingsNs !== 'string' || !Array.isArray(entry.settingsPath)) {
        throw new Error('desktop welcome: invalid provider settings address')
      }
      const namespace: unknown = namespaces.find((item: unknown) => record(item) && item.ns === entry.settingsNs)
      let value: unknown = record(namespace) ? namespace.value : undefined
      for (const key of entry.settingsPath as unknown[]) {
        if (typeof key !== 'string') throw new Error('desktop welcome: invalid provider settings path')
        value = record(value) ? value[key] : undefined
      }
      return record(value) && typeof value.apiKeyEnv === 'string' ? [value.apiKeyEnv] : []
    })
    const unique = [...new Set([...(ref === undefined ? [] : [ref]), ...refs])]
    const states: Record<string, unknown> = {}
    // credentials.describe accepts at most 64 references per request.
    for (let offset = 0; offset < unique.length; offset += 64) {
      const batch = await invoke({ namespace: 'credentials', method: 'describe', args: { refs: unique.slice(offset, offset + 64) } })
      if (!record(batch)) throw new Error('desktop welcome: invalid credential metadata')
      Object.assign(states, batch)
    }
    if (ref !== undefined && !record(states[ref])) throw new Error('desktop welcome: missing credential metadata')
    return {
      loggedIn: (await account.state()).status === 'credential-stored',
      hasApiKey: Object.values(states).some(value => record(value) && value.configured === true),
      writable: ref !== undefined && record(states[ref]) && states[ref].writable === true,
      localePreference: localePreference(namespaces),
    }
  }
  const storeProviderKey = async (apiKey: string): Promise<void> => {
    if (!/^[\x21-\x7e]+$/.test(apiKey)) throw new Error('desktop welcome: invalid API key')
    const { ref } = await settingsAndReference()
    if (ref === undefined) throw new Error('desktop welcome: no writable credential reference')
    await invoke({ namespace: 'credentials', method: 'set', args: { ref, value: apiKey } })
  }
  return {
    account,
    read,
    async analyticsEnabled() {
      const enabled = await invoke({ namespace: 'productAnalytics', method: 'enabled', args: {} }, AbortSignal.timeout(1000))
      if (typeof enabled !== 'boolean') throw new Error('desktop analytics: invalid collection policy')
      return enabled
    },
    async report(event) { await invoke({ namespace: 'productAnalytics', method: 'report', args: { event } }, AbortSignal.timeout(1000)) },
    async readLocalePreference() {
      const settings = await invoke({ namespace: 'settings', method: 'describe', args: {} })
      if (!record(settings) || !Array.isArray(settings.namespaces)) throw new Error('desktop welcome: missing settings namespaces')
      return localePreference(settings.namespaces)
    },
    async ensureModelConfiguration() {
      const signal = AbortSignal.timeout(10_000)
      const settings = await invoke({ namespace: 'settings', method: 'describe', args: {} }, signal)
      if (!record(settings) || !Array.isArray(settings.namespaces)) throw new Error('desktop welcome: missing settings namespaces')
      const namespaces = settings.namespaces
      const namespace = (ns: string): unknown => namespaces.find((item: unknown) => record(item) && item.ns === ns)
      const piAi = namespace('llm-pi-ai')
      const profiles = record(piAi) && record(piAi.value) && record(piAi.value.providers) ? piAi.value.providers : undefined
      const seeded = record(profiles) ? profiles[provider] : undefined
      const seededRoute = record(seeded) && typeof seeded.apiKeyEnv === 'string'
      const gatewayRoute = modelGateway !== undefined && seededRoute
        && seeded.baseURL === providerProfile.baseURL && seeded.apiKeyEnv === providerProfile.apiKeyEnv
      if (!seededRoute || (modelGateway !== undefined && !gatewayRoute)) {
        await invoke({ namespace: 'settings', method: 'update', args: { ns: 'llm-pi-ai', patch: { providers: { [provider]: providerProfile } }, expectedRevision: undefined } }, signal)
      }
      // The enterprise edition is the AirGap distribution channel: an installed
      // baizor route predates the gateway and no longer reaches the closed
      // network. Repoint it at the sealed gateway so recorded per-session
      // selections continue to answer through AirGap instead of failing 401.
      if (modelGateway !== undefined) {
        const baizor = record(profiles) ? profiles.baizor : undefined
        const misrouted = record(baizor) && (baizor.baseURL !== providerProfile.baseURL || baizor.apiKeyEnv !== providerProfile.apiKeyEnv)
        if (misrouted) {
          await invoke({ namespace: 'settings', method: 'update', args: { ns: 'llm-pi-ai', patch: { providers: { baizor: { ...providerProfile, displayName: 'Baizor' } } }, expectedRevision: undefined } }, signal)
        }
      }
      const defaultModel = namespace('agent-default-model')
      const user = record(defaultModel) ? defaultModel.user : undefined
      const selection = record(user) ? user : {}
      const migrated = selection.provider === provider && selection.model === defaultSelection.model
      if (modelGateway !== undefined ? !migrated : selection.provider === undefined && selection.model === undefined) {
        await invoke({ namespace: 'settings', method: 'update', args: { ns: 'agent-default-model', patch: defaultSelection, expectedRevision: undefined } }, signal)
      }
    },
    async save(apiKey) {
      if (!/^[\x21-\x7e]+$/.test(apiKey)) return { ok: false }
      try {
        await storeProviderKey(apiKey)
        return { ok: true }
      } catch {
        // Provider diagnostics may contain credentials; the native form owns failure copy.
        return { ok: false }
      }
    },
    storeProviderKey,
  }
}

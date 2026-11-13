import type { ProductEvent } from '@hy/dsh-client-product-analytics/types'
/** Native welcome operations using the shared Web authentication and RPC APIs. */

import { randomUUID } from 'node:crypto'
import { desktopAccountBackend, type DesktopAccountBackend } from './account-backend.ts'
import {
  TIMEGLEAM_API_BASE, TIMEGLEAM_CREDENTIAL_REF, TIMEGLEAM_PROVIDER, TIMEGLEAM_TOKEN_PATTERN,
  type TimeGleamModel,
} from './timegleam.ts'
import {
  AIRGAP_ENTERPRISE_DEFAULT_SELECTION,
  AIRGAP_ENTERPRISE_PROVIDER,
  airgapEnterpriseProviderProfile,
  type DesktopEnterpriseModelGateway,
} from './product-edition.ts'

/**
 * Output cap older enterprise seeds wrote. Installations still carrying it cut
 * long answers off, so the seed refresh replaces it in place.
 */
const LEGACY_SEEDED_MAX_TOKENS = 8192

/** Metadata needed before the native entry or workspace becomes visible. */
export interface WelcomeState {
  readonly loggedIn: boolean
  readonly hasApiKey: boolean
  readonly writable: boolean
  /** A TimeGleam access key is stored for the MCP registration. */
  readonly hasTimeGleamToken: boolean
  /** The credential store accepts a TimeGleam access key. */
  readonly timeGleamWritable: boolean
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
   * Seed the TimeGleam proxy route with the models this workspace granted.
   * @param models - model list read from the proxy after sign-in.
   * @param preferred - model the profile should default to; the first when absent.
   * @returns after both the route and the default selection are written.
   */
  ensureTimeGleamModelConfiguration(models: readonly TimeGleamModel[], preferred?: string): Promise<void>
  /**
   * @param apiKey - User-entered provider key.
   * @returns A safe write outcome without provider diagnostics.
   */
  save(apiKey: string): Promise<{ ok: boolean }>
  /**
   * Store the TimeGleam access key the MCP registration resolves per request.
   * @param token - console-issued key with a tmg_ or aym_ prefix.
   */
  storeTimeGleamToken(token: string): Promise<void>
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
  // The standard TimeGleam edition configures chat models only when the user
  // asks in Settings; the enterprise edition still seeds its sealed gateway.
  const provider = AIRGAP_ENTERPRISE_PROVIDER
  const providerProfile = modelGateway === undefined ? undefined : airgapEnterpriseProviderProfile(modelGateway)
  const defaultSelection = AIRGAP_ENTERPRISE_DEFAULT_SELECTION
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
    if (modelGateway === undefined) return { settings: { namespaces }, ref: undefined }
    const piAi: unknown = namespaces.find((item: unknown) => record(item) && item.ns === 'llm-pi-ai')
    return { settings: { namespaces }, ref: providerRef(piAi, provider) }
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
    const unique = [...new Set([...(ref === undefined ? [] : [ref]), ...refs, TIMEGLEAM_CREDENTIAL_REF])]
    const states: Record<string, unknown> = {}
    // credentials.describe accepts at most 64 references per request.
    for (let offset = 0; offset < unique.length; offset += 64) {
      const batch = await invoke({ namespace: 'credentials', method: 'describe', args: { refs: unique.slice(offset, offset + 64) } })
      if (!record(batch)) throw new Error('desktop welcome: invalid credential metadata')
      Object.assign(states, batch)
    }
    if (ref !== undefined && !record(states[ref])) throw new Error('desktop welcome: missing credential metadata')
    if (!record(states[TIMEGLEAM_CREDENTIAL_REF])) throw new Error('desktop welcome: missing TimeGleam credential metadata')
    return {
      loggedIn: (await account.state()).status === 'credential-stored',
      hasApiKey: Object.entries(states).some(([ref, value]) =>
        ref !== TIMEGLEAM_CREDENTIAL_REF && record(value) && value.configured === true),
      writable: ref !== undefined && record(states[ref]) && states[ref].writable === true,
      hasTimeGleamToken: record(states[TIMEGLEAM_CREDENTIAL_REF]) && states[TIMEGLEAM_CREDENTIAL_REF].configured === true,
      timeGleamWritable: record(states[TIMEGLEAM_CREDENTIAL_REF]) && states[TIMEGLEAM_CREDENTIAL_REF].writable === true,
      localePreference: localePreference(namespaces),
    }
  }
  const storeProviderKey = async (apiKey: string): Promise<void> => {
    if (!/^[\x21-\x7e]+$/.test(apiKey)) throw new Error('desktop welcome: invalid API key')
    const { ref } = await settingsAndReference()
    if (ref === undefined) throw new Error('desktop welcome: no writable credential reference')
    await invoke({ namespace: 'credentials', method: 'set', args: { ref, value: apiKey } })
  }
  const storeTimeGleamToken = async (token: string): Promise<void> => {
    if (!TIMEGLEAM_TOKEN_PATTERN.test(token)) throw new Error('desktop welcome: invalid TimeGleam access key')
    await invoke({ namespace: 'credentials', method: 'set', args: { ref: TIMEGLEAM_CREDENTIAL_REF, value: token } })
  }
  const timeGleamProfile = (models: readonly TimeGleamModel[]) => ({
    displayName: 'TimeGleam',
    apiKeyEnv: TIMEGLEAM_CREDENTIAL_REF,
    api: 'openai-completions',
    baseURL: TIMEGLEAM_API_BASE,
    defaultContextWindow: 128000,
    defaultMaxTokens: 32768,
    models: models.map(model => ({
      id: model.id, name: model.name, contextWindow: 128000, maxTokens: 32768,
    })),
  })
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
      if (modelGateway === undefined || providerProfile === undefined) return
      const profile = providerProfile
      const signal = AbortSignal.timeout(10_000)
      const settings = await invoke({ namespace: 'settings', method: 'describe', args: {} }, signal)
      if (!record(settings) || !Array.isArray(settings.namespaces)) throw new Error('desktop welcome: missing settings namespaces')
      const namespaces = settings.namespaces
      const namespace = (ns: string): unknown => namespaces.find((item: unknown) => record(item) && item.ns === ns)
      const piAi = namespace('llm-pi-ai')
      const profiles = record(piAi) && record(piAi.value) && record(piAi.value.providers) ? piAi.value.providers : undefined
      const seeded = record(profiles) ? profiles[provider] : undefined
      const seededRoute = record(seeded) && typeof seeded.apiKeyEnv === 'string'
      const gatewayRoute = seededRoute
        && seeded.baseURL === profile.baseURL && seeded.apiKeyEnv === profile.apiKeyEnv
      const legacyCapacity = seededRoute
        && seeded.defaultMaxTokens === LEGACY_SEEDED_MAX_TOKENS
        && Array.isArray(seeded.models)
        && seeded.models.some(model => record(model) && model.maxTokens === LEGACY_SEEDED_MAX_TOKENS)
      if (!gatewayRoute || legacyCapacity) {
        await invoke({ namespace: 'settings', method: 'update', args: { ns: 'llm-pi-ai', patch: { providers: { [provider]: profile } }, expectedRevision: undefined } }, signal)
      }
      // The enterprise edition is the AirGap distribution channel: an installed
      // baizor route predates the gateway and no longer reaches the closed
      // network. Repoint it at the sealed gateway so recorded per-session
      // selections continue to answer through AirGap instead of failing 401.
      const baizor = record(profiles) ? profiles.baizor : undefined
      const misrouted = record(baizor) && (baizor.baseURL !== profile.baseURL || baizor.apiKeyEnv !== profile.apiKeyEnv)
      if (misrouted) {
        await invoke({ namespace: 'settings', method: 'update', args: { ns: 'llm-pi-ai', patch: { providers: { baizor: { ...profile, displayName: 'Baizor' } } }, expectedRevision: undefined } }, signal)
      }
      const defaultModel = namespace('agent-default-model')
      const user = record(defaultModel) ? defaultModel.user : undefined
      const selection = record(user) ? user : {}
      const migrated = selection.provider === provider && selection.model === defaultSelection.model
      if (!migrated) {
        await invoke({ namespace: 'settings', method: 'update', args: { ns: 'agent-default-model', patch: defaultSelection, expectedRevision: undefined } }, signal)
      }
    },
    async ensureTimeGleamModelConfiguration(models, preferred) {
      if (models.length === 0) throw new Error('desktop welcome: no TimeGleam model to seed')
      const selected = preferred !== undefined && models.some(model => model.id === preferred)
        ? preferred : models[0]?.id
      if (selected === undefined) throw new Error('desktop welcome: no TimeGleam model to seed')
      const signal = AbortSignal.timeout(10_000)
      await invoke({
        namespace: 'settings', method: 'update',
        args: { ns: 'llm-pi-ai', patch: { providers: { [TIMEGLEAM_PROVIDER]: timeGleamProfile(models) } }, expectedRevision: undefined },
      }, signal)
      await invoke({
        namespace: 'settings', method: 'update',
        args: { ns: 'agent-default-model', patch: { provider: TIMEGLEAM_PROVIDER, model: selected }, expectedRevision: undefined },
      }, signal)
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
    storeTimeGleamToken,
  }
}

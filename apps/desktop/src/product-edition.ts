/** Sealed distribution facts and the enterprise model gateway they carry. */

import { secureOrIntranetTransport } from './intranet-http.ts'

/** Environment variable that overrides the sealed enterprise gateway at runtime. */
export const AIRGAP_MODEL_GATEWAY_ENV = 'DSH_AIRGAP_MODEL_GATEWAY_URL'

/** Edition sealed into the packaged application manifest by the installer. */
export type DesktopProductEdition = 'standard' | 'enterprise'

/** Validated endpoint the enterprise provider profile routes every request through. */
export interface DesktopEnterpriseModelGateway {
  readonly baseURL: string
  readonly apiKeyEnv: string
}

/**
 * Read the packaged product edition; older manifests retain the standard edition.
 * @param manifest - Parsed application manifest.
 * @returns Validated edition. Invalid explicit values reject instead of changing providers.
 */
export function desktopProductEdition(manifest: unknown): DesktopProductEdition {
  if (typeof manifest !== 'object' || manifest === null) return 'standard'
  const edition: unknown = Reflect.get(manifest, 'dshDesktopEdition')
  if (edition === undefined) return 'standard'
  if (edition !== 'standard' && edition !== 'enterprise') {
    throw new Error('desktop product edition: invalid packaged edition')
  }
  return edition
}

/**
 * Validate one gateway base URL. The client routes requests here, so it must be
 * an HTTPS URL (or loopback HTTP for a local AirGap) without credentials, query,
 * or fragment; the path keeps the OpenAI-compatible `/v1` base.
 * @param value - Candidate URL read from the manifest or the environment.
 * @param source - Diagnostic name of the configuration source.
 * @returns Normalized URL without a trailing slash.
 */
function gatewayBaseURL(value: string, source: string): string {
  let parsed: URL
  try { parsed = new URL(value) } catch { throw new Error(`desktop product edition: ${source} must be an absolute URL`) }
  if (!secureOrIntranetTransport(parsed) || parsed.username !== '' || parsed.password !== ''
    || parsed.search !== '' || parsed.hash !== '') {
    throw new Error(`desktop product edition: ${source} must be an HTTPS or intranet HTTP URL without credentials, query, or fragment`)
  }
  if (parsed.pathname === '/' || parsed.pathname === '') parsed.pathname = '/v1'
  else if (!parsed.pathname.endsWith('/v1')) parsed.pathname = `${parsed.pathname.replace(/\/+$/u, '')}/v1`
  return parsed.href.replace(/\/+$/u, '')
}

/**
 * Read the sealed enterprise gateway, allowing an operator-set runtime override
 * for closed networks whose AirGap host moved after installation.
 * @param manifest - Parsed application manifest.
 * @param env - Process environment; runtime overrides live here.
 * @returns validated gateway for the enterprise edition; undefined for the standard edition.
 * @throws When the sealed or overridden gateway is present but invalid.
 */
export function desktopEnterpriseModelGateway(
  manifest: unknown,
  env: NodeJS.ProcessEnv = process.env,
): DesktopEnterpriseModelGateway | undefined {
  if (desktopProductEdition(manifest) !== 'enterprise') return undefined
  if (typeof manifest !== 'object' || manifest === null) return undefined
  const sealed = Reflect.get(manifest, 'dshAirgapModelGateway')
  if (typeof sealed !== 'object' || sealed === null || typeof Reflect.get(sealed, 'baseURL') !== 'string'
    || typeof Reflect.get(sealed, 'apiKeyEnv') !== 'string') {
    throw new Error('desktop product edition: enterprise manifest is missing its model gateway')
  }
  const ref = Reflect.get(sealed, 'apiKeyEnv') as string
  if (!/^[A-Z][A-Z0-9_]*$/u.test(ref)) throw new Error('desktop product edition: invalid enterprise credential reference')
  const override = env[AIRGAP_MODEL_GATEWAY_ENV]?.trim()
  return {
    baseURL: override === undefined || override === '' ? gatewayBaseURL(Reflect.get(sealed, 'baseURL') as string, 'sealed gateway') : gatewayBaseURL(override, 'runtime gateway override'),
    apiKeyEnv: ref,
  }
}

/** Provider route the enterprise edition seeds; the standard edition seeds baizor. */
export const AIRGAP_ENTERPRISE_PROVIDER = 'airgap'

/** Default model selection while the user has chosen none in the enterprise edition. */
export const AIRGAP_ENTERPRISE_DEFAULT_SELECTION = { provider: AIRGAP_ENTERPRISE_PROVIDER, model: 'huayu-v2' } as const

/**
 * Build the AirGap provider profile the enterprise edition seeds into the
 * llm-pi-ai settings section. The upstream gateway serves the same huayu-v2
 * model as baizor.com, so capacity facts stay fixed in code instead of being
 * trusted to a manifest.
 * @param gateway - Validated gateway endpoint and credential reference.
 * @returns provider profile accepted by the llm-pi-ai settings schema.
 */
export function airgapEnterpriseProviderProfile(gateway: DesktopEnterpriseModelGateway) {
  return {
    displayName: 'AirGap',
    apiKeyEnv: gateway.apiKeyEnv,
    api: 'openai-completions',
    baseURL: gateway.baseURL,
    compat: { thinkingFormat: 'deepseek' },
    defaultContextWindow: 128000,
    // The gateway serves the same huayu-v2 build as baizor.com: 8192 truncated
    // reasoning-heavy turns, so the AirGap route matches the 32768 baizor seed.
    defaultMaxTokens: 32768,
    models: [{ id: 'huayu-v2', name: 'TimeGleam v2', contextWindow: 128000, maxTokens: 32768 }],
  } as const
}

import { describe, expect, it, vi } from 'vitest'
import {
  AIRGAP_ENTERPRISE_DEFAULT_SELECTION,
  AIRGAP_ENTERPRISE_PROVIDER,
  airgapEnterpriseProviderProfile,
  desktopEnterpriseModelGateway,
  desktopProductEdition,
} from '../src/product-edition.ts'

describe('desktop product edition', () => {
  it('retains the standard edition for older manifests', () => {
    expect(desktopProductEdition({ version: '1.0.0' })).toBe('standard')
    expect(desktopProductEdition(null)).toBe('standard')
  })

  it('rejects an invalid sealed edition', () => {
    expect(() => desktopProductEdition({ dshDesktopEdition: 'beta' })).toThrow(/edition/u)
  })

  it('reads the sealed gateway and appends the /v1 base path', () => {
    const manifest = { dshDesktopEdition: 'enterprise',
      dshAirgapModelGateway: { baseURL: 'https://airgap.example.com/airgap', apiKeyEnv: 'DSH_BAIZOR_API_KEY' } }
    expect(desktopProductEdition(manifest)).toBe('enterprise')
    expect(desktopEnterpriseModelGateway(manifest, {})).toEqual({
      baseURL: 'https://airgap.example.com/airgap/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY',
    })
  })

  it('keeps an existing /v1 path without duplicating it', () => {
    const manifest = { dshDesktopEdition: 'enterprise',
      dshAirgapModelGateway: { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' } }
    expect(desktopEnterpriseModelGateway(manifest, {})!.baseURL).toBe('https://airgap.example.com/v1')
  })

  it('allows an intranet runtime override for AirGap sites without internal TLS', () => {
    const manifest = { dshDesktopEdition: 'enterprise',
      dshAirgapModelGateway: { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' } }
    for (const value of ['http://10.99.0.10:8001', 'http://airgap:8080', 'http://192.168.1.245:8001']) {
      expect(desktopEnterpriseModelGateway(manifest, { DSH_AIRGAP_MODEL_GATEWAY_URL: value })!.baseURL)
        .toBe(value + '/v1')
    }
  })

  it('seals an intranet gateway at packaging time', () => {
    const manifest = { dshDesktopEdition: 'enterprise',
      dshAirgapModelGateway: { baseURL: 'http://10.99.0.10:8001/airgap', apiKeyEnv: 'DSH_BAIZOR_API_KEY' } }
    expect(desktopEnterpriseModelGateway(manifest, {})!.baseURL).toBe('http://10.99.0.10:8001/airgap/v1')
  })

  it.each(['http://airgap.example.com/v1', 'http://8.8.8.8/v1'])('still rejects plain HTTP to a public host: %s', (value) => {
    const manifest = { dshDesktopEdition: 'enterprise',
      dshAirgapModelGateway: { baseURL: value, apiKeyEnv: 'DSH_BAIZOR_API_KEY' } }
    expect(() => desktopEnterpriseModelGateway(manifest, {})).toThrow(/intranet HTTP/u)
  })

  it('allows a loopback runtime override for closed networks', () => {
    const manifest = { dshDesktopEdition: 'enterprise',
      dshAirgapModelGateway: { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' } }
    expect(desktopEnterpriseModelGateway(manifest, { DSH_AIRGAP_MODEL_GATEWAY_URL: 'http://127.0.0.1:8001' })).toEqual({
      baseURL: 'http://127.0.0.1:8001/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY',
    })
  })

  it.each(['ftp://airgap.example.com', 'http://airgap.example.com/v1?key=x', 'https://user:pass@airgap.example.com/v1'])
  ('rejects invalid gateway URLs: %s', (value) => {
    const manifest = { dshDesktopEdition: 'enterprise',
      dshAirgapModelGateway: { baseURL: value, apiKeyEnv: 'DSH_BAIZOR_API_KEY' } }
    expect(() => desktopEnterpriseModelGateway(manifest, {})).toThrow(/gateway/u)
  })

  it('rejects a malformed sealed credential reference', () => {
    const manifest = { dshDesktopEdition: 'enterprise',
      dshAirgapModelGateway: { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'bad ref' } }
    expect(() => desktopEnterpriseModelGateway(manifest, {})).toThrow(/credential reference/u)
  })

  it('requires a gateway object on enterprise manifests', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(() => desktopEnterpriseModelGateway({ dshDesktopEdition: 'enterprise' }, {})).toThrow(/missing its model gateway/u)
    } finally { warn.mockRestore() }
  })

  it('builds the enterprise provider profile', () => {
    const gateway = { baseURL: 'https://airgap.example.com/v1', apiKeyEnv: 'DSH_BAIZOR_API_KEY' }
    expect(airgapEnterpriseProviderProfile(gateway)).toMatchObject({
      displayName: 'AirGap', apiKeyEnv: 'DSH_BAIZOR_API_KEY', api: 'openai-completions',
      baseURL: 'https://airgap.example.com/v1',
      models: [{ id: 'huayu-v2' }],
    })
    expect(AIRGAP_ENTERPRISE_PROVIDER).toBe('airgap')
    expect(AIRGAP_ENTERPRISE_DEFAULT_SELECTION).toEqual({ provider: 'airgap', model: 'huayu-v2' })
  })
})

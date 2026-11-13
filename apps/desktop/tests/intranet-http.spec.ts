import { describe, expect, it } from 'vitest'
import { isIntranetHostname, secureOrIntranetTransport } from '../src/intranet-http.ts'
import { isIntranetHostname as isIntranetHostnameForScripts } from '../scripts/intranet-host.mjs'

const transport = (value: string): boolean => secureOrIntranetTransport(new URL(value))

describe('intranet HTTP transport policy', () => {
  it.each([
    'http://localhost:8001', 'http://127.0.0.1:8001', 'http://[::1]:8001',
    'http://10.99.0.10:8001', 'http://172.16.0.1', 'http://172.31.255.254',
    'http://192.168.1.245:8001', 'http://169.254.10.20', 'http://airgap:8080',
    'http://100.64.0.20:8001', 'http://100.127.255.254',
    'http://airgap.local', 'http://airgap.lan', 'http://airgap.internal',
    'http://[fe80::1]', 'http://[fd00::1]',
  ])('accepts plain HTTP to an intranet host: %s', (value) => {
    expect(transport(value)).toBe(true)
  })

  it.each([
    'http://airgap.example.com', 'http://8.8.8.8', 'http://172.15.0.1', 'http://172.32.0.1',
    'http://192.169.0.1', 'http://[2001:db8::1]',
    'http://100.63.255.255', 'http://100.128.0.1',
  ])('rejects plain HTTP to a public host: %s', (value) => {
    expect(transport(value)).toBe(false)
  })

  it('accepts HTTPS anywhere and no other scheme', () => {
    expect(transport('https://lanhc.com/lanhc/airgap')).toBe(true)
    expect(transport('https://airgap.example.com/v1')).toBe(true)
    expect(transport('ftp://airgap.example.com')).toBe(false)
  })

  it('keeps the desktop source and the packaging script helper identical', () => {
    const hosts = ['localhost', '127.0.0.1', '[::1]', '10.0.0.1', '172.20.96.1', '192.168.148.145',
      '100.64.0.20', '100.63.0.1', '100.128.0.1',
      '169.254.1.1', '8.8.8.8', '172.15.0.1', '172.32.0.1', 'airgap', 'airgap.local', 'airgap.example.com',
      '[fe80::1]', '[fd00::1]', '[2001:db8::1]', '::1']
    for (const host of hosts) expect(isIntranetHostnameForScripts(host)).toBe(isIntranetHostname(host))
  })
})

import { describe, expect, it } from 'vitest'
import {
  desktopBuildRecordFilename,
  desktopUpdateMetadataFilename,
  resolveDesktopAutoUpdateConfig,
  resolveDesktopAutoUpdateEnvironment,
  resolveDesktopAutoUpdateTarget,
  resolveDesktopUploadConfig,
} from '../scripts/desktop-auto-update-environment.mjs'

const RELEASE_ID = '0123456789abcdef0123456789abcdef'

describe('desktop auto-update environment', () => {
  it.each([undefined, 'test'])('requires a release ID for deployment %s', (deployment) => {
    const environment = { DSH_DESKTOP_AUTO_UPDATE_ENV: deployment, DOWNLOAD_TEST_ORIGIN: 'https://updates.example.com',
      DOWNLOAD_TEST_COS_BUCKET: 'test-bucket' }
    expect(() => resolveDesktopAutoUpdateConfig(environment, 'win32', 'x64')).toThrow(/DOWNLOAD_TEST_RELEASE_ID/u)
    expect(() => resolveDesktopUploadConfig(environment, 'win32', 'x64')).toThrow(/DOWNLOAD_TEST_RELEASE_ID/u)
  })

  it.each(['', ' ', 'release-1', 'a'.repeat(31), 'a'.repeat(33), 'A'.repeat(32), 'g'.repeat(32),
    '../feeds', '01234567-89ab-cdef-0123-456789abcdef', `${RELEASE_ID}/bin`])('rejects invalid test release ID %j', (id) => {
    const environment = { DOWNLOAD_TEST_ORIGIN: 'https://updates.example.com', DOWNLOAD_TEST_RELEASE_ID: id }
    expect(() => resolveDesktopAutoUpdateConfig(environment, 'darwin', 'arm64')).toThrow(/DOWNLOAD_TEST_RELEASE_ID/u)
  })

  it.each([['darwin', 'arm64', 'mac-arm64'], ['darwin', 'x64', 'mac-x64'], ['win32', 'x64', 'win-x64'], ['linux', 'x64', 'linux-x64'], ['linux', 'arm64', 'linux-arm64']] as const)
  ('uses one test release directory for %s %s feeds and binaries', (platform, arch, target) => {
    expect(resolveDesktopAutoUpdateConfig({ DOWNLOAD_TEST_ORIGIN: 'https://updates.example.com',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID }, platform, arch)).toMatchObject({
      publicUrl: `https://updates.example.com/dsh-desk/${RELEASE_ID}/feeds/${target}/`,
      keyPrefix: `dsh-desk/${RELEASE_ID}/feeds/${target}`,
      binaryKeyPrefix: `dsh-desk/${RELEASE_ID}/bin/${target}`,
    })
  })

  it('defaults packages and uploads to the test deployment', () => {
    expect(resolveDesktopAutoUpdateEnvironment({})).toBe('test')
    expect(resolveDesktopAutoUpdateConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com/',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID,
    }, 'darwin', 'arm64')).toEqual({
      environment: 'test', channel: 'nightly',
      target: 'mac-arm64',
      origin: 'https://desktop-updates.example.com',
      publicUrl: `https://desktop-updates.example.com/dsh-desk/${RELEASE_ID}/feeds/mac-arm64/`,
      keyPrefix: `dsh-desk/${RELEASE_ID}/feeds/mac-arm64`,
      binaryKeyPrefix: `dsh-desk/${RELEASE_ID}/bin/mac-arm64`,
    })
    expect(resolveDesktopUploadConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com/',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID,
      DOWNLOAD_TEST_COS_BUCKET: 'test-download-bucket',
    }, 'darwin', 'arm64')).toMatchObject({
      bucket: 'test-download-bucket',
      secretIdEnvName: 'DOWNLOAD_TEST_COS_SECRET_ID',
      secretKeyEnvName: 'DOWNLOAD_TEST_COS_SECRET_KEY',
    })
  })

  it.each([undefined, RELEASE_ID, 'unused-test-value'])('keeps production paths independent of test release ID %s', (id) => {
    expect(resolveDesktopAutoUpdateConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
      DOWNLOAD_TEST_RELEASE_ID: id,
    }, 'win32', 'x64')).toMatchObject({
      environment: 'production',
      target: 'win-x64',
      origin: 'https://lanhc.com/lanhc',
      publicUrl: 'https://lanhc.com/lanhc/dsh-desk/feeds/win-x64/',
      binaryKeyPrefix: 'dsh-desk/bin/win-x64',
    })
    expect(resolveDesktopUploadConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
    }, 'win32', 'x64')).toMatchObject({
      transport: 'static',
      staticHost: 'baizor',
      staticRemoteRoot: '/lucky/lanhc-hugo/lanhc',
    })
  })

  it('requires the test origin and bucket while production publishes to the fixed static destination', () => {
    expect(() => resolveDesktopAutoUpdateConfig({}, 'darwin', 'arm64'))
      .toThrow(/DOWNLOAD_TEST_ORIGIN/u)
    expect(resolveDesktopAutoUpdateConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID,
    }, 'darwin', 'arm64').publicUrl).toContain('/mac-arm64/')
    expect(() => resolveDesktopUploadConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com',
      DOWNLOAD_TEST_RELEASE_ID: RELEASE_ID,
    }, 'darwin', 'arm64')).toThrow(/DOWNLOAD_TEST_COS_BUCKET/u)
    expect(resolveDesktopUploadConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'production',
    }, 'win32', 'x64')).toMatchObject({
      transport: 'static',
      staticHost: 'baizor',
      staticRemoteRoot: '/lucky/lanhc-hugo/lanhc',
    })
  })

  it('rejects a test download URL that is not an HTTPS origin', () => {
    expect(() => resolveDesktopAutoUpdateConfig({
      DOWNLOAD_TEST_ORIGIN: 'https://desktop-updates.example.com/releases',
    }, 'darwin', 'arm64')).toThrow(/HTTPS origin without a path/u)
    expect(() => resolveDesktopAutoUpdateConfig({
      DOWNLOAD_TEST_ORIGIN: 'http://desktop-updates.example.com',
    }, 'darwin', 'arm64')).toThrow(/HTTPS origin/u)
  })

  it('resolves the airgap deployment to the AirGap public root over static transport', () => {
    expect(resolveDesktopAutoUpdateConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'airgap',
      AIRGAP_BASE_URL: 'https://airgap.example.cn/lanhc/airgap/',
    }, 'win32', 'x64')).toMatchObject({
      environment: 'airgap',
      target: 'win-x64',
      origin: 'https://airgap.example.cn/lanhc/airgap',
      publicUrl: 'https://airgap.example.cn/lanhc/airgap/timegleam/dsh-desk/feeds/win-x64/',
      binaryKeyPrefix: 'timegleam/dsh-desk/bin/win-x64',
    })
    expect(resolveDesktopUploadConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'airgap',
      AIRGAP_BASE_URL: 'https://airgap.example.cn/lanhc/airgap',
    }, 'win32', 'x64')).toMatchObject({
      transport: 'static',
      staticHost: 'baizor',
      staticRemoteRoot: '/lucky/airgap/data/public',
    })
    expect(() => resolveDesktopAutoUpdateConfig({ DSH_DESKTOP_AUTO_UPDATE_ENV: 'airgap' }, 'win32', 'x64'))
      .toThrow(/AIRGAP_BASE_URL/u)
  })

  it('accepts an intranet AirGap root for sites without internal TLS', () => {
    expect(resolveDesktopAutoUpdateConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'airgap',
      AIRGAP_BASE_URL: 'http://10.99.0.10:8001/',
    }, 'win32', 'x64')).toMatchObject({
      origin: 'http://10.99.0.10:8001',
      publicUrl: 'http://10.99.0.10:8001/timegleam/dsh-desk/feeds/win-x64/',
    })
    expect(() => resolveDesktopAutoUpdateConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'airgap',
      AIRGAP_BASE_URL: 'http://airgap.example.cn/lanhc/airgap',
    }, 'win32', 'x64')).toThrow(/intranet HTTP/u)
  })

  it('routes airgap enterprise builds to the separate timegleam-enterprise catalog', () => {
    expect(resolveDesktopAutoUpdateConfig({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'airgap',
      DSH_DESKTOP_EDITION: 'enterprise',
      AIRGAP_BASE_URL: 'https://airgap.example.cn/lanhc/airgap',
    }, 'win32', 'x64')).toMatchObject({
      publicUrl: 'https://airgap.example.cn/lanhc/airgap/timegleam-enterprise/dsh-desk/feeds/win-x64/',
      binaryKeyPrefix: 'timegleam-enterprise/dsh-desk/bin/win-x64',
    })
  })
  it('rejects unknown deployments and targets', () => {
    expect(() => resolveDesktopAutoUpdateEnvironment({
      DSH_DESKTOP_AUTO_UPDATE_ENV: 'staging',
    })).toThrow(/test.*production/u)
    expect(resolveDesktopAutoUpdateTarget('linux', 'x64')).toBe('linux-x64')
    expect(resolveDesktopAutoUpdateTarget('linux', 'arm64')).toBe('linux-arm64')
    expect(desktopBuildRecordFilename('linux-x64')).toBe('linux-x64-release.json')
    expect(desktopBuildRecordFilename('linux-arm64')).toBe('linux-arm64-release.json')
  })

  it('uses Nightly metadata for stable and prerelease Desktop versions', () => {
    expect(desktopUpdateMetadataFilename('1.2.3', 'darwin')).toBe('nightly-mac.yml')
    expect(desktopUpdateMetadataFilename('1.2.3-alpha.4', 'darwin')).toBe('nightly-mac.yml')
    expect(desktopUpdateMetadataFilename('1.2.3-beta.2', 'win32')).toBe('nightly.yml')
    expect(() => desktopUpdateMetadataFilename('not-semver', 'darwin')).toThrow(/invalid Desktop version/u)
    expect(() => desktopUpdateMetadataFilename('1.2.3', 'linux')).toThrow(/unsupported metadata platform/u)
  })
})


it.each([['darwin', 'arm64', 'mac-arm64', 'stable-mac.yml'], ['darwin', 'x64', 'mac-x64', 'stable-mac.yml'], ['win32', 'x64', 'win-x64', 'stable.yml']] as const)
('routes stable metadata and binaries separately for %s %s', (platform, arch, target, filename) => {
  const config = resolveDesktopAutoUpdateConfig({ DSH_DESKTOP_AUTO_UPDATE_ENV: 'production', DSH_DESKTOP_UPDATE_CHANNEL: 'stable' }, platform, arch)
  expect(config.channel).toBe('stable')
  expect(config.keyPrefix).toBe(`dsh-desk/feeds/${target}`)
  expect(config.binaryKeyPrefix).toBe(`dsh-desk/bin/${target}/stable`)
  expect(desktopUpdateMetadataFilename('1.0.0', platform, config.channel)).toBe(filename)
  expect(() => resolveDesktopAutoUpdateConfig({ DSH_DESKTOP_UPDATE_CHANNEL: 'latest' }, platform, arch)).toThrow(/channel/u)
})

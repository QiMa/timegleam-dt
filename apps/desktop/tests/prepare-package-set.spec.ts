import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  assertDesktopHostPackageFiles,
  selectDesktopPackageClosure,
  type PackedDesktopPackage,
} from '../scripts/prepare-package-set.ts'

function packed(name: string, manifest: Record<string, unknown> = {}): PackedDesktopPackage {
  return { tarball: `${name}.tgz`, manifest: { name, version: '1.0.0', ...manifest } }
}

describe('desktop package-set selection', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not select a packaging target when imported as a library', async () => {
    vi.stubEnv('DSH_DESKTOP_TARGET_PLATFORM', 'linux')
    vi.stubEnv('DSH_DESKTOP_TARGET_ARCH', 'x64')
    vi.resetModules()
    await expect(import('../scripts/prepare-package-set.ts')).resolves.toHaveProperty('prepareDesktopPackageSet')
  })

  it('includes only the available internal production closure', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@hy/dsh', packed('@hy/dsh', {
        dependencies: { '@hy/dsh-base': '^1.0.0', external: '^2.0.0' },
        optionalDependencies: { '@hy/platform-package': '1.0.0', '@hy/missing-platform': '1.0.0' },
      })],
      ['@hy/dsh-desktop-host', packed('@hy/dsh-desktop-host', {
        dependencies: { '@hy/dsh': '^1.0.0' },
      })],
      ['@hy/dsh-base', packed('@hy/dsh-base', {
        peerDependencies: { '@hy/cordis': '^1.0.0' },
      })],
      ['@hy/cordis', packed('@hy/cordis')],
      ['@hy/platform-package', packed('@hy/platform-package')],
      ['@hy/unused', packed('@hy/unused')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@hy/cordis',
      '@hy/dsh',
      '@hy/dsh-base',
      '@hy/dsh-desktop-host',
      '@hy/platform-package',
    ])
  })

  it.each([
    '@hy/dsh-base', '@hy/cordis', '@hy/node-addon-system',
  ])('rejects required prepared package %s absent from the packed release inputs', (dependency) => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@hy/dsh', packed('@hy/dsh', {
        dependencies: { [dependency]: '^1.0.0' },
      })],
      ['@hy/dsh-desktop-host', packed('@hy/dsh-desktop-host', {
        dependencies: { '@hy/dsh': '^1.0.0' },
      })],
    ])
    expect(() => selectDesktopPackageClosure(available)).toThrow(/unpacked package/u)
    expect(() => selectDesktopPackageClosure(new Map([
      ['@hy/dsh', packed('@hy/dsh')],
    ]))).toThrow(/omit @hy\/dsh-desktop-host/u)
  })

  it('leaves independently published Office packages to npm resolution', () => {
    const available = new Map<string, PackedDesktopPackage>([
      ['@hy/dsh', packed('@hy/dsh', {
        dependencies: {
          '@deepseek-ai/libreoffice-kit': '0.0.1',
          '@deepseek-ai/libreoffice-kit-wasm': '0.0.1',
        },
      })],
      ['@hy/dsh-desktop-host', packed('@hy/dsh-desktop-host')],
    ])
    expect(selectDesktopPackageClosure(available).map(entry => entry.manifest.name)).toEqual([
      '@hy/dsh', '@hy/dsh-desktop-host',
    ])
  })

  it('requires both Desktop Host and public CLI entries', () => {
    const files = [
      'package/lib/index.js',
      'package/lib/cli.js',
    ]
    expect(() => {
      assertDesktopHostPackageFiles(files)
    }).not.toThrow()
    expect(() => {
      assertDesktopHostPackageFiles(files.slice(1))
    }).toThrow(/lib\/index\.js/u)
    expect(() => { assertDesktopHostPackageFiles(files.slice(0, 1)) }).toThrow(/lib\/cli\.js/u)
  })
})

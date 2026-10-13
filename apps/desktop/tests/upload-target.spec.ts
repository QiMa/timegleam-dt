import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDesktopUploadPlan, type DesktopUploadPlan } from '../scripts/desktop-upload-plan.ts'
import { loadDesktopPackageEnvironment } from '../scripts/desktop-package-environment.mjs'
import { tagDesktopRelease } from '../scripts/desktop-release-tag.ts'
import { uploadDesktopRelease } from '../scripts/desktop-upload-run.ts'
import { uploadDesktopReleaseStatic } from '../scripts/desktop-upload-static.ts'
import { uploadDesktopTarget } from '../scripts/upload-target.ts'

vi.mock('../scripts/desktop-package-environment.mjs', () => ({ loadDesktopPackageEnvironment: vi.fn() }))
vi.mock('../scripts/desktop-upload-plan.ts', () => ({ createDesktopUploadPlan: vi.fn() }))
vi.mock('../scripts/desktop-cos.ts', () => ({ createDesktopCos: vi.fn() }))
vi.mock('../scripts/desktop-upload-run.ts', () => ({ uploadDesktopRelease: vi.fn() }))
vi.mock('../scripts/desktop-upload-static.ts', () => ({ uploadDesktopReleaseStatic: vi.fn() }))
vi.mock('../scripts/desktop-release-tag.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../scripts/desktop-release-tag.ts')>(),
  tagDesktopRelease: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
})

describe('desktop upload command', () => {
  it.each([
    { environment: 'production', latest: true, tagged: false, transport: 'static' },
    { environment: 'production', latest: false, tagged: true, transport: 'static' },
    { environment: 'test', latest: true, tagged: false, transport: 'cos' },
    { environment: 'test', latest: false, tagged: false, transport: 'cos' },
  ] as const)('uploads $environment latest=$latest through $transport with tagged=$tagged', async ({ environment, latest, tagged, transport }) => {
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    const credentials = { DOWNLOAD_TEST_COS_SECRET_ID: 'fixture-id', DOWNLOAD_TEST_COS_SECRET_KEY: 'fixture-key' }
    const plan: DesktopUploadPlan = transport === 'static'
      ? {
        environment, target: 'win-x64', version: '1.2.3-alpha.4', transport: 'static',
        publicUrl: 'https://lanhc.com/lanhc/desktop/dsh-latest-windows-x64.exe',
        staticHost: 'baizor', staticRemoteRoot: '/lucky/lanhc-hugo/lanhc',
        artifacts: [], commit: '0'.repeat(40), dirty: false,
      }
      : {
        environment, target: 'win-x64', version: '1.2.3-alpha.4', transport: 'cos',
        publicUrl: 'https://desktop-updates.example.com/desktop/dsh-latest-windows-x64.exe',
        bucket: 'fixture-bucket', secretIdEnvName: 'DOWNLOAD_TEST_COS_SECRET_ID',
        secretKeyEnvName: 'DOWNLOAD_TEST_COS_SECRET_KEY', artifacts: [], commit: '0'.repeat(40), dirty: false,
      }
    vi.mocked(loadDesktopPackageEnvironment).mockReturnValue(credentials)
    vi.mocked(createDesktopUploadPlan).mockResolvedValue(plan)
    vi.mocked(uploadDesktopRelease).mockResolvedValue('fixture-records')
    vi.mocked(uploadDesktopReleaseStatic).mockResolvedValue('fixture-records')
    vi.mocked(tagDesktopRelease).mockReturnValue({ status: 'created', tag: 'desktop-v1.2.3-alpha.4' })

    await uploadDesktopTarget(['win-x64', ...latest ? ['--latest'] : []])

    expect(createDesktopUploadPlan).toHaveBeenCalledWith('win-x64', { environment: credentials, latest })
    if (transport === 'static') {
      expect(uploadDesktopReleaseStatic).toHaveBeenCalledOnce()
      expect(vi.mocked(uploadDesktopReleaseStatic).mock.calls[0]![0]).toBe(plan)
      expect(uploadDesktopRelease).not.toHaveBeenCalled()
    } else {
      expect(uploadDesktopRelease).toHaveBeenCalledOnce()
      expect(vi.mocked(uploadDesktopRelease).mock.calls[0]![0]).toBe(plan)
      expect(uploadDesktopReleaseStatic).not.toHaveBeenCalled()
    }
    if (tagged) {
      expect(tagDesktopRelease).toHaveBeenCalledWith(expect.objectContaining({ version: plan.version, commit: plan.commit }))
      const uploadCallOrder = transport === 'static'
        ? vi.mocked(uploadDesktopReleaseStatic).mock.invocationCallOrder[0]!
        : vi.mocked(uploadDesktopRelease).mock.invocationCallOrder[0]!
      expect(vi.mocked(tagDesktopRelease).mock.invocationCallOrder[0]).toBeGreaterThan(uploadCallOrder)
    } else {
      expect(tagDesktopRelease).not.toHaveBeenCalled()
    }
  })
})

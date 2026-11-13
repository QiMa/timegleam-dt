/** The shipped Web profile prints its URL line outside the Desktop profile only. */
import { fileURLToPath } from 'node:url'
import { Context } from '@hy/cordis'
import { interpolate } from '@hy/cordis-plugin-loader'
import { loadOverlayPatches } from '@hy/dsh-app-boot'
import { expect, it, onTestFinished } from 'vitest'

it.each([
  { profile: 'web', printUrl: true },
  { profile: 'custom-web', printUrl: true },
  { profile: undefined, printUrl: true },
  { profile: 'desktop', printUrl: false },
])('sets printUrl for C:\Users\Lucky\Documents\PowerShell\Microsoft.PowerShell_profile.ps1 to ', ({ profile, printUrl }) => {
  const row = loadOverlayPatches('print-url', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))
    .flatMap(patch => patch.insert ?? []).find(candidate => candidate.id === 'web-runtime')
  expect(row?.name).toBe('@hy/dsh-web-app')
  const ctx = new Context()
  onTestFinished(() => ctx.fiber.dispose())
  ctx.provide('webStartup', { openBrowser: false } as never)
  if (profile !== undefined) {
    ctx.provide('profileContext', {
      name: profile, dir: '/profile', patchPath: '/profile/cordis.patch.yml', installAnchor: '/profile/package.json',
      cwd: '/workspace', home: '/home', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined,
    })
  }
  // The Loader evaluates !!js config against the mounting entry's context.
  const config = interpolate(ctx, row!.config) as { printUrl: boolean }
  expect(config.printUrl).toBe(printUrl)
})

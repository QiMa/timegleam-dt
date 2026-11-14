/** The Desktop profile mounts no keyless DeepSeek model route; the Web profile keeps both. */
import { fileURLToPath } from 'node:url'
import { Context } from '@hy/cordis'
import Loader from '@hy/cordis-plugin-loader'
import { applyEntryPatches } from '@hy/cordis-plugin-include'
import { loadOverlayPatches } from '@hy/dsh-app-boot'
import { expect, it, onTestFinished } from 'vitest'

const ROUTES = ['llm-deepseek', 'llm-deepseek-account'] as const

/** A plugin module that only has to load: this test reads the entry's disabled flag. */
const ROW_MODULE = { inject: [], apply: () => {} }

it.each(ROUTES)('disables %s on the Desktop profile and keeps it on Web', async (id) => {
  const patches = loadOverlayPatches('desktop-model-routes', fileURLToPath(new URL('../cordis.patch.yml', import.meta.url)))
    .filter(patch => patch.id === id)
  expect(patches).toHaveLength(1)
  expect(patches[0]!.disabled).toBeDefined()
  const base = [{ id, name: `cordis:${id}` }]
  for (const profile of ['desktop', 'web'] as const) {
    const [entry] = applyEntryPatches(base, patches, (message) => { throw new Error(message) })
    const ctx = new Context()
    onTestFinished(() => ctx.fiber.dispose())
    ctx.provide('profileContext', {
      name: profile, dir: '/profile', patchPath: '/profile/cordis.patch.yml', installAnchor: '/profile/package.json',
      cwd: '/workspace', home: '/home', startedBundles: [], overlays: [], telemetryDisabledEnv: undefined,
    })
    ctx.baseUrl = 'file:///'
    await ctx.plugin(Loader).await()
    ctx.loader.builtins[id] = ROW_MODULE
    await ctx.loader.root.update([entry!])
    await ctx.loader.await()
    const resolved = ctx.loader.resolve(id)
    expect(resolved.disabled).toBe(profile === 'desktop')
    expect(resolved.fiber !== undefined).toBe(profile !== 'desktop')
  }
})

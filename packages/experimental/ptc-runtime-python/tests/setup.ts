import { Context } from '@hy/cordis'
import Sandbox from '@hy/dsh-sandbox-local'
import SandboxPolicy from '@hy/dsh-sandbox-policy'
import SessionProjections from '@hy/dsh-session-projection'
import { onTestFinished } from 'vitest'
import type { SandboxMode } from '@hy/dsh-sandbox'

/** Mount the Python runtime's policy and confinement providers with owned teardown. */
export async function createRuntimeContext(policy: { mode?: SandboxMode; workspaceRoot?: string } = {}): Promise<Context> {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  await ctx.plugin(Sandbox, {})
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', ...policy })
  return ctx
}

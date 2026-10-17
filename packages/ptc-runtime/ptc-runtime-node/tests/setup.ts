import { Context } from '@hy/cordis'
import { onTestFinished } from 'vitest'
import SessionStore from '@hy/dsh-session'
import FileSystem from '@hy/dsh-fs-local'
import Subprocess from '@hy/dsh-subprocess-local'
import Sandbox from '@hy/dsh-sandbox-local'
import SandboxPolicy from '@hy/dsh-sandbox-policy'
import SessionProjections from '@hy/dsh-session-projection'
import type { SandboxMode } from '@hy/dsh-sandbox'
import NodeRuntime from '../src/index.ts'
import type { Config } from '../src/index.ts'

export async function mountRuntime(ctx: Context, config: Config = {}, policy: { mode?: SandboxMode; workspaceRoot?: string } = {}) {
  onTestFinished(async () => { await ctx.fiber.dispose() })
  if (!ctx.get('sessions')) await ctx.plugin(SessionStore)
  if (!ctx.get('fs')) await ctx.plugin(FileSystem)
  if (!ctx.get('subprocess')) await ctx.plugin(Subprocess)
  if (!ctx.get('sandbox')) await ctx.plugin(Sandbox, {})
  if (!ctx.get('sessionProjections')) await ctx.plugin(SessionProjections)
  if (!ctx.get('sandboxPolicy')) await ctx.plugin(SandboxPolicy, { mode: 'danger-full-access', ...policy })
  const fiber = await ctx.plugin(NodeRuntime, config)
  return { runtime: ctx.ptcRuntime as NodeRuntime, fiber }
}

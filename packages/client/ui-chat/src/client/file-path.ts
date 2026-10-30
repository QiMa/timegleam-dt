/** Gesture-time path resolution for Chat-owned file references. */
import type { Context } from '@hy/cordis'
import type { SessionId } from '@hy/dsh-session/types'
import { resolveWorkspacePath } from '@hy/dsh-util-workspace-path'
import type {} from '@hy/dsh-api-session-controller/client'

/**
 * Bind path resolution to the originating Session without capturing its current directory.
 * @param ctx - Chat plugin context.
 * @param sessionId - Original Session identity.
 * @returns Resolver using the live working directory, falling back to the workspace root.
 */
export function sessionFilePath(ctx: Context, sessionId: SessionId): (path: string) => string {
  return (path) => {
    const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd
    const current = ctx.sessions.binding(sessionId)?.session.projections.faceOf('workingDirectory').getSnapshot() as string | null | undefined
    return resolveWorkspacePath(current ?? cwd, path)
  }
}

import type { TurnBoundaryProjection } from './types.ts'
import type {} from '@hy/dsh-session-projection'

declare module '@hy/dsh-session-projection/types' {
  interface SessionProjectionStateMap {
    /** The agent session's open/last turn and step boundary facts (whole value). */
    turnBoundary: TurnBoundaryProjection
  }
}

export {}

/** Animated TimeGleam mark for the running Chat status. */
import { TimeGleamMark } from '@hy/dsh-client-ui-primitives'
import css from './ChatView.module.css'

/**
 * Render the decorative running mark. The animation is a CSS opacity pulse, so
 * reduced-motion and forced-colors preferences keep the static glyph.
 * @returns the animated mark container.
 */
export function RunningBrandMark() {
  return (
    <span className={css.runningIcon} aria-hidden="true">
      <TimeGleamMark className={css.runningMark} size={14} />
    </span>
  )
}

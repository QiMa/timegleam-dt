/** Animated Huayu mark and static SVG fallback for the running Chat status. */
import { HUAYU_LOGO_DATA_URI } from '@hy/dsh-client-ui-primitives'
import css from './ChatView.module.css'

/**
 * Render the decorative running icon; the APNG asset owns its animation timing.
 * @returns mask and static SVG selected by browser capabilities and accessibility preferences.
 */
export function RunningWhaleTail() {
  return (
    <span className={css.runningIcon} aria-hidden="true">
      <span className={css.runningWhaleAnimated} />
      <svg className={css.runningWhaleStill} width="100%" height="100%" viewBox="0 0 96 96" fill="none">
        <image href={HUAYU_LOGO_DATA_URI} width={96} height={96} />
      </svg>
    </span>
  )
}

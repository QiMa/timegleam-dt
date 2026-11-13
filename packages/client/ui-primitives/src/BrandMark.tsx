import { TIMEGLEAM_GLYPH_PATH, TIMEGLEAM_MARK_VIEWBOX } from './BrandAssets.ts'
import type { IconProps } from './icons/props.ts'

/**
 * Render the TimeGleam aperture mark.
 * @param props.size - width in px (default 24; the mark is square).
 * @param props.className - extra class for layout placement.
 * @returns the decorative mark svg; pair it with the wordmark for an accessible name.
 */
export function TimeGleamMark({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox={`0 0 ${TIMEGLEAM_MARK_VIEWBOX.width} ${TIMEGLEAM_MARK_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <path d={TIMEGLEAM_GLYPH_PATH} fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    </svg>
  )
}

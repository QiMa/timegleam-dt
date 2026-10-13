import { HUAYU_LOGO_DATA_URI } from './BrandAssets.ts'
import type { IconProps } from './icons/props.ts'

/** Native viewBox of {@link HUAYU_LOGO_DATA_URI} (width and height in user units). */
export const FISH_LOGO_VIEWBOX = { width: 96, height: 96 }

/**
 * Render the official Huayu AI mark.
 * @param props.size - width in px (default 24; the mark is square).
 * @param props.className - extra class for layout placement.
 * @returns the mark svg (aria-hidden; pair with the wordmark for accessibility).
 */
export function FishLogo({ size = 24, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox={`0 0 ${FISH_LOGO_VIEWBOX.width} ${FISH_LOGO_VIEWBOX.height}`}
      fill="none"
      aria-hidden="true"
    >
      <image href={HUAYU_LOGO_DATA_URI} width={96} height={96} />
    </svg>
  )
}

import { HUAYU_LOGO_DATA_URI, HUAYU_WORDMARK_MASK_DATA_URI, HUAYU_WORDMARK_VIEWBOX } from './BrandAssets.ts'
import type { IconProps } from './icons/props.ts'

/** Display options for the official brand wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading Huayu mark; defaults to true. */
  includeMark?: boolean | undefined
}

/**
 * Render the full brand wordmark.
 * @param props.size - height in px (default 24; width follows the selected artwork).
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading Huayu mark.
 * @returns the wordmark svg (aria-hidden decorative brand art).
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  const wordWidth = Number(((HUAYU_WORDMARK_VIEWBOX.width * size) / HUAYU_WORDMARK_VIEWBOX.height).toFixed(2))
  const markSize = size * 1.125
  const width = Number((includeMark ? markSize + 4 + wordWidth : wordWidth).toFixed(2))
  return (
    <svg
      width={width}
      height={size}
      className={className}
      viewBox={`0 0 ${width} ${size}`}
      fill="none"
      aria-hidden="true"
    >
      {includeMark && <image href={HUAYU_LOGO_DATA_URI} width={markSize} height={markSize} />}
      <image
        href={HUAYU_WORDMARK_MASK_DATA_URI}
        x={includeMark ? markSize + 4 : 0}
        width={wordWidth}
        height={size}
        preserveAspectRatio="none"
        style={{ maskImage: `url("${HUAYU_WORDMARK_MASK_DATA_URI}")`, maskMode: 'alpha', maskSize: `${wordWidth}px ${size}px`, maskRepeat: 'no-repeat', backgroundColor: 'currentColor' }}
      />
    </svg>
  )
}

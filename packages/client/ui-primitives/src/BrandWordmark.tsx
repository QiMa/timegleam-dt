import { TIMEGLEAM_WORDMARK_ASPECT } from './BrandAssets.ts'
import { TimeGleamMark } from './BrandMark.tsx'
import { BRAND_LABEL, BRAND_NAME, BRAND_NAME_LATIN } from './brand/locales.ts'
import type { IconProps } from './icons/props.ts'

/** Display options for the TimeGleam wordmark. */
export interface BrandWordmarkProps extends IconProps {
  /** Whether to include the leading aperture mark; defaults to true. */
  includeMark?: boolean | undefined
}

/**
 * Render the TimeGleam lockup as the mark plus live text, so the name inherits
 * the surrounding font and color.
 * @param props.size - cap height in px (default 24); width follows {@link TIMEGLEAM_WORDMARK_ASPECT}.
 * @param props.className - extra class for layout placement.
 * @param props.includeMark - whether to include the leading aperture mark.
 * @returns the decorative lockup with an accessible product name.
 */
export function BrandWordmark({ size = 24, className, includeMark = true }: BrandWordmarkProps) {
  return (
    <span
      className={className}
      role="img"
      aria-label={BRAND_LABEL}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.25,
        height: size,
        maxWidth: size * TIMEGLEAM_WORDMARK_ASPECT,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {includeMark && <TimeGleamMark size={size} />}
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'baseline', gap: size * 0.18 }}>
        <span style={{ fontSize: size * 0.9, fontWeight: 600 }}>{BRAND_NAME}</span>
        <span style={{ fontSize: size * 0.62, letterSpacing: size * 0.045, opacity: 0.72 }}>{BRAND_NAME_LATIN}</span>
      </span>
    </span>
  )
}

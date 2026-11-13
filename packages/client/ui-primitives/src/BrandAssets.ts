/**
 * TimeGleam brand artwork shared by every client surface.
 *
 * The aperture glyph is the product mark and the wordmark sets the product name
 * in live text, so both follow the surrounding color and font instead of an
 * embedded raster lockup.
 * @module @hy/dsh-client-ui-primitives/brand
 */

/** Brand gold used by the aperture glyph on light and dark surfaces. */
export const TIMEGLEAM_BRAND_COLOR = '#E0A64B'

/** Cabinet color of the square application tile. */
export const TIMEGLEAM_TILE_COLOR = '#121110'

/** Native coordinate space of the aperture glyph. */
export const TIMEGLEAM_MARK_VIEWBOX = { width: 32, height: 32 } as const

/** Outline path of the aperture glyph; even-odd fill keeps the centre open. */
export const TIMEGLEAM_GLYPH_PATH = 'M4 12V6.5A2.5 2.5 0 0 1 6.5 4H12V6.6H6.6V12Z M20 4h5.5A2.5 2.5 0 0 1 28 6.5V12h-2.6V6.6H20Z M4 20h2.6v5.4H12V28H6.5A2.5 2.5 0 0 1 4 25.5Z M28 20v5.5A2.5 2.5 0 0 1 25.5 28H20v-2.6h5.4V20Z M16 9.6L22.4 16L16 22.4L9.6 16ZM16 13.2L13.2 16L16 18.8L18.8 16Z M16 14.5L17.5 16L16 17.5L14.5 16Z'

/**
 * Aspect ratio of the full lockup (mark plus wordmark) per unit of height.
 *
 * Measured from the shipped wordmark at its design height so the two call sites
 * that reserve space agree.
 */
export const TIMEGLEAM_WORDMARK_ASPECT = 6.3

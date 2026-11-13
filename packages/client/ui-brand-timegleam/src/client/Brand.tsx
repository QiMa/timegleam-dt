/** Inline TimeGleam artwork; no network asset or theme-specific variant. */
import { BrandWordmark, TimeGleamMark } from '@hy/dsh-client-ui-primitives'
import type { SidebarBrandMarkOwnerProps } from '@hy/dsh-client-ui-sidebar/client'

/**
 * Render the TimeGleam aperture mark at the host-requested edge.
 * @param props - Host-supplied mark presentation.
 * @returns the TimeGleam mark.
 */
export function TimeGleamBrandMark({ size }: SidebarBrandMarkOwnerProps) {
  return <TimeGleamMark size={size} />
}

/**
 * Render the TimeGleam name without its independently slotted mark. The
 * sidebar supplies the typography container; this keeps the compact product
 * name legible instead of scaling down the stacked lockup artwork.
 * @returns the TimeGleam wordmark.
 */
export function TimeGleamBrandName() {
  return <BrandWordmark includeMark={false} />
}

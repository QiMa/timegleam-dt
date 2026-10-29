/**
 * The CADCraft tab body: a same-origin iframe around the CADCraft web client.
 * The mount path arrives from the host half through a global injected at index
 * render time (`__HUAYU_CADCAST_CONFIG__`), defaulting to `/cadcraft`.
 */
import type { ReactNode } from 'react'

interface CadcraftConfig {
  readonly mountPath?: string
}

function resolveMountPath(): string {
  const config = (globalThis as { __HUAYU_CADCAST_CONFIG__?: CadcraftConfig }).__HUAYU_CADCAST_CONFIG__
  const path = config?.mountPath?.trim() || '/cadcraft'
  return path.endsWith('/') ? path : `${path}/`
}

/** @returns the iframe showing the CADCraft web client. */
export function CadcraftFrame(): ReactNode {
  return (
    <iframe
      src={resolveMountPath()}
      title="CADCraft"
      style={{ width: '100%', height: '100%', border: 'none', background: '#22282f' }}
    />
  )
}

/**
 * Stage one of this package's registration: what the cadcraft tab type is.
 * It is a page type, opened by kind, so it recognizes no address and its body
 * registers under its id in the sidebar.right.pane.tab seat.
 *
 * The static registration ships in the uiltin band under a distinct id:
 * the Creator-mode dynamic half registers the same kind with the
 * extension band (id '@hy/huayu-extension/cadcraft'), and the registry's
 * builtin/extension pairing lets that dynamic half take the kind over while
 * it runs and restores this viewer when it stops. The guide entry gives the
 * right sidebar a visible CADCraft launcher (picking it opens the type as a
 * page), so the drawing is reachable without a chat command; the dynamic
 * command bridge auto-opens the same kind on demand.
 */
import type { SidebarRightTabDefinition } from '@hy/dsh-client-ui-sidebar-right/client'

/** The tab kind this package owns. */
export const CADCRAFT_TAB_KIND = 'cadcraft'

/** The static viewer's identity in the tab system. */
export const CADCRAFT_TAB_ID = '@hy/dsh-experimental-huayu-cadcraft/cadcraft-static'

/** @returns the tab type definition. */
export function cadcraftDefinition(): SidebarRightTabDefinition {
  return {
    id: CADCRAFT_TAB_ID,
    kind: CADCRAFT_TAB_KIND,
    priority: 'builtin',
    title: () => 'CADCraft',
    guide: [{
      id: 'cadcraft-entry',
      order: 30,
      title: () => 'CADCraft',
      description: () => 'Open the CADCraft drawing engine',
    }],
  }
}

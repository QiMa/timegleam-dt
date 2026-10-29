/**
 * Browser half of @hy/dsh-experimental-huayu-cadcraft: register the CADCraft tab type and its
 * iframe body in the right sidebar. Nothing here reaches into the Sidebar's
 * store, panes, or sequence; it uses only the public registration path.
 */
import type { Context as ClientContext } from '@hy/cordis'
import type {} from '@hy/dsh-client-ui-renderer/client'
import type {} from '@hy/dsh-client-ui-sidebar-right/client'
import { CadcraftFrame } from './CadcraftFrame.tsx'
import { CADCRAFT_TAB_ID, cadcraftDefinition } from './definition.ts'

/** Required browser services. */
export const inject = ['sidebarRightTabs', 'slots']

/** Client plugin body: register the type and its keyed body. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.sidebarRightTabs.register(cadcraftDefinition()), 'huayu-cadcraft: cadcraft tab type')
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register(
    { name: 'sidebar.right.pane.tab', key: CADCRAFT_TAB_ID },
    CadcraftFrame,
  )), 'huayu-cadcraft: cadcraft tab body')
}

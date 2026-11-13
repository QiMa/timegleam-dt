/**
 * Fill the sidebar brand slots. The web-app patch mounts this row only in the
 * Desktop profile, so the browser half does not gate on the build profile.
 */

import type { Context as ClientContext } from '@hy/cordis'
import type {} from '@hy/dsh-client-ui-renderer/client'
import type {} from '@hy/dsh-client-ui-sidebar/client'
import { TimeGleamBrandMark, TimeGleamBrandName } from './Brand.tsx'

/** Required service: the UI slot registry. */
export const inject = ['slots']

/**
 * @param ctx - Client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.brand.mark', () =>
    ctx.slots.inject('sidebar.brand.name', function* () {
      yield ctx.slots.register({ name: 'sidebar.brand.mark' }, TimeGleamBrandMark)
      yield ctx.slots.register({ name: 'sidebar.brand.name' }, TimeGleamBrandName)
    }))
}

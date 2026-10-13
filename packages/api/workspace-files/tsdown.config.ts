import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@hy/dsh-api-workspace-files',
  ['lib/types/index.js'],
  { hostPhase: true },
)

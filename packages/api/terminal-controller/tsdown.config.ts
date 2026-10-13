import { clientBundle } from '../../client/tsdown.client.ts'

export default clientBundle(
  '@hy/dsh-api-terminal-controller',
  ['lib/types/index.js'],
  { hostPhase: true },
)

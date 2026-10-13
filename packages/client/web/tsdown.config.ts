import { staticLinked } from '../tsdown.client.ts'

export default staticLinked(
  '@hy/dsh-client-web',
  ['lib/types/index.js', 'lib/types/apply-injections.js'],
)

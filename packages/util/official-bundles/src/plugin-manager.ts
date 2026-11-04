/** The package names the plugin manager protects, hides, orders, or marks experimental. */

/**
 * Plugin packages the plugin manager refuses to disable or remove, because management itself needs them; a bundle that
 * contains one is read-only as well. Removing a name drops only this `management-required` refusal; the manager's own
 * entry, installation-carried bundles, and unaddressable rows stay protected by their own rules.
 */
export const PROTECTED_PLUGINS: ReadonlySet<string> = new Set([
  '@hy/dsh-plugin-manager', '@hy/cordis-plugin-loader',
  '@hy/cordis-plugin-include', '@hy/dsh-api-gateway',
  '@hy/dsh-host-webserver', '@hy/dsh-client-modules',
  '@hy/dsh-client-ui-settings-plugin-inventory', '@hy/dsh-client-ui-plugin-manager',
  '@hy/dsh-host-plugin-inventory', '@hy/dsh-typert-registry',
  '@hy/dsh-api-remotes', '@hy/dsh-api-remote-access',
  '@hy/cordis-plugin-timer', '@hy/dsh-client-connection',
  '@hy/dsh-host-frontend-static', '@hy/dsh-tools',
  '@hy/dsh-hmr',
])

/**
 * Built-in profile bundles, persistent terminals, and the standalone worktree tool, which have no plugin manager page.
 * Their Host availability and activation stay intact.
 */
export const HIDDEN_BUNDLES: ReadonlySet<string> = new Set([
  '@hy/dsh-base',
  '@hy/dsh-web-app',
  '@hy/dsh-headless',
  '@hy/dsh-sdk-app',
  '@hy/dsh-acp-app',
  '@hy/dsh-sdk-minimal',
  '@hy/dsh-experimental-terminal-bundle',
  '@hy/dsh-experimental-tool-worktree',
])

/**
 * The optional bundles the plugin manager's main and More lists rank first, in this order. {@link MORE_BUNDLES}, not
 * this list, decides whether a bundle appears on the main list.
 */
export const EXTENSION_BUNDLES: readonly string[] = [
  '@hy/dsh-experimental-voice-input-bundle',
  '@hy/dsh-experimental-plugin-market-bundle',
  '@hy/dsh-experimental-auto-review',
]

/**
 * The optional bundles the plugin manager's main list leaves out until the profile enables them; its More list,
 * which includes every eligible bundle, ranks them last in this order.
 */
export const MORE_BUNDLES: readonly string[] = [
  '@hy/dsh-personalized-recommendations',
  '@hy/dsh-experimental-inspector-profile',
  '@hy/dsh-cua-bundle',
  '@hy/dsh-experimental-cot-translation-bundle',
  '@hy/dsh-experimental-session-search',
  '@hy/dsh-experimental-session-titles-bundle',
  '@hy/dsh-experimental-badge-skill-bundle',
  '@hy/dsh-experimental-ralph-bundle',
  '@hy/dsh-subagent-codex',
  '@hy/dsh-subagent-claude-code',
]

/** Official bundles the plugin manager marks with the Experimental badge. */
export const EXPERIMENTAL_BUNDLES: ReadonlySet<string> = new Set([
  '@hy/dsh-personalized-recommendations',
  '@hy/dsh-cua-bundle',
  '@hy/dsh-experimental-voice-input-bundle',
  '@hy/dsh-experimental-auto-review',
  '@hy/dsh-experimental-inspector-profile',
  '@hy/dsh-experimental-forge-bundle',
  '@hy/dsh-experimental-tool-worktree',
  '@hy/dsh-experimental-cot-translation-bundle',
  '@hy/dsh-experimental-session-search',
  '@hy/dsh-experimental-session-titles-bundle',
  '@hy/dsh-experimental-badge-skill-bundle',
  '@hy/dsh-experimental-ralph-bundle',
  '@hy/dsh-experimental-plugin-market-bundle',
  '@hy/dsh-experimental-liveshare',
])

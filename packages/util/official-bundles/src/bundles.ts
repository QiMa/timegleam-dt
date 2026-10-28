/** The bundle package names the dsh installation selects, offers, installs on demand, or retires. */

/** Installation-owned defaults used when a shipped profile is first opened. */
export interface ProfileTemplate {
  /** Ordered bundle layer list. */
  bundles: readonly string[]
}

/** The shipped profile templates auto-initialized on first use, by name. */
export const PROFILE_TEMPLATES: Record<string, ProfileTemplate> = {
  acp: {
    bundles: ['@hy/dsh-base', '@hy/dsh-acp-app'],
  },
  web: {
    bundles: ['@hy/dsh-base', '@hy/dsh-web-app'],
  },
  headless: {
    bundles: ['@hy/dsh-base', '@hy/dsh-headless'],
  },
  sdk: {
    bundles: ['@hy/dsh-base', '@hy/dsh-sdk-app'],
  },
  'sdk-minimal': {
    bundles: ['@hy/dsh-sdk-minimal'],
  },
}

/**
 * Installation-owned bundle tuples that an earlier release wrote into a shipped profile; app-boot replaces an exact
 * match with the {@link PROFILE_TEMPLATES} entry of the same name and leaves every other list untouched.
 */
export const INSTALLATION_OWNED_PROFILE_TUPLES: Readonly<Record<string, readonly string[]>> = {
  headless: ['@hy/dsh-base', '@hy/dsh-web-app', '@hy/dsh-headless'],
}

/** Bundles an earlier release shipped and the installation no longer carries; app-boot removes them from profiles. */
export const RETIRED_BUNDLES: ReadonlySet<string> = new Set([
  // The Web composition mounts Schedule itself
  // ([upgrade guide](../../../../docs/upgrade-guide/v0.2.0-rc.2/schedule-bundle-retired/guide.md)).
  '@hy/dsh-experimental-schedule-bundle',
])

/** The bundle list a `dsh plugin` init uses for a name with no shipped template. */
export const DEFAULT_PROFILE_BUNDLES: readonly string[] = ['@hy/dsh-base']

/**
 * The bundles the dsh installation ships for a person to switch on: each a
 * runtime dependency of the installation that declares `dsh.bundle.patch`,
 * an `icon`, and `./locale/*.json` display metadata, selected by no shipped
 * template, and offered switched off by the plugin manager except persistent
 * terminals, which have no page switch
 * ([rationale](../../../../.agents/notes/implemented/process/2026-09-15-shipped-optional-bundles.md),
 * [admission](../../../../.agents/notes/implemented/architecture/2026-09-21-experimental-capabilities-as-optional-bundles.md)).
 */
export const OPTIONAL_BUNDLES: readonly string[] = [
  '@hy/dsh-personalized-recommendations',
  '@hy/dsh-cua-bundle',
  '@hy/dsh-experimental-session-search',
  '@hy/dsh-experimental-ralph-bundle',
  '@hy/dsh-experimental-terminal-bundle',
  '@hy/dsh-experimental-badge-skill-bundle',
  '@hy/dsh-experimental-session-titles-bundle',
  '@hy/dsh-experimental-agent-team-profile',
  '@hy/dsh-experimental-voice-input-bundle',
  '@hy/dsh-experimental-cot-translation-bundle',
  '@hy/dsh-experimental-auto-review',
  '@hy/dsh-experimental-inspector-profile',
  '@hy/dsh-experimental-liveshare',
  '@hy/dsh-experimental-plugin-market-bundle',
  '@hy/dsh-experimental-tool-worktree',
  '@hy/dsh-experimental-forge-bundle',
]

/** Public DSH release members available through the ordinary on-demand bundle installer. */
export const ON_DEMAND_BUNDLES: readonly string[] = [
  '@hy/dsh-subagent-claude-code',
  '@hy/dsh-subagent-codex',
]

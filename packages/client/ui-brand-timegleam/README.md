---
description: "Render the 拾光 TimeGleam mark and wordmark in the Desktop sidebar; for users and maintainers choosing or replacing the Desktop brand presentation."
kind: "package-reference"
---

# @hy/dsh-client-ui-brand-timegleam

English | [中文](README.zh.md)

## Summary

This package fills the sidebar mark and name slots with the 拾光 TimeGleam identity in Desktop builds, while the Web build keeps the `ui-brand-official` row. Another identity replaces it with a package occupying the same slots. Both occupants are inline SVG and text, so the package ships no network asset, theme variant, or runtime state, and it does not affect model requests.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount this plugin in a composition whose sidebar should show the TimeGleam identity. The Desktop profile already does; no per-user setting selects it.

### Choosing the profile

`packages/bundle/web-app/cordis.patch.yml` enables this row only when the profile name is `desktop`, and disables the `ui-brand-official` row on that profile. The row does not gate on `DSH_CLIENT_BUILD_PROFILE`, because the profile gate already keeps exactly one occupant in the single-occupant slots. The conversation hero keeps the shared fallback mark from `dsh-client-ui-conversation`; this package does not occupy that slot.

### Replacing the brand

Provide another Cordis package that registers `sidebar.brand.mark` and `sidebar.brand.name`, and disable this row in the composition. Occupying the slots is the only route; the package has no brand configuration surface.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The browser half in `src/client/index.ts` nests two `ctx.slots.inject()` calls so registration waits for the sidebar declaration, withdraws both occupants when the declaration collapses, and leaves no partial brand during HMR. `src/client/Brand.tsx` delegates to `TimeGleamMark` and `BrandWordmark` in `ui-primitives`, so the Desktop and Web occupants draw one artwork and one copy source. `src/index.ts` is an empty host-side Loader seat because the package contributes browser presentation only. The browser title is a build concern (`DSH_CLIENT_TITLE`), outside the slot system.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [ui-sidebar](../ui-sidebar/README.md) — declares the mark and name slots and renders fallbacks.
- [ui-brand-official](../ui-brand-official/README.md) — the web occupants this package replaces on Desktop.
- [ui-conversation](../ui-conversation/README.md) — declares the hero brand mark.
- [TimeGleam Desktop integration](../../../docs/timegleam-desktop.md) — the full Desktop integration.

-----

<a id="model-experience"></a>
## Model Experience

None, as the package contributes browser presentation only; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define how the TimeGleam presentation is supplied; they are current constraints, not a design backlog.

- **One occupant set** — alternative presentation belongs in another Cordis package occupying the same two slots.
- **Hero stays shared** — the conversation hero uses the shell fallback mark; branding it requires occupying `conversation.hero.brand.mark` from another package.
- **Browser title is independent** — `DSH_CLIENT_TITLE` selects title text at build time rather than through a UI slot.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

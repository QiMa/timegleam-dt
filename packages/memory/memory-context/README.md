---
description: "Session-lifecycle memory hooks for the huayu-memory service: recall memories before each turn and refine finished conversations into new memories."
kind: "package-reference"
---

# @hy/dsh-memory-context

English | [中文](README.zh.md)

## Summary

Mount `dsh-memory-context` to give agents automatic memory without explicit tool calls. Before the first step of every turn it searches the huayu-memory service with the turn's user text and prepends recalled memories whose score clears the threshold as a snapshot message; while the session runs it collects user and assistant text, and on session disposal it refines that text through the service and saves the returned candidates. Injected snapshots carry `source.kind === 'memory-context'` so the collector never re-ingests them. Failures degrade silently: an unreachable memory service logs a warning and never interrupts the conversation.

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

Mount it in a composition that already loads `@hy/dsh-tool-memory`; it reuses that package's `MemoryClient`. The overall design is described in [`docs/huayu-memory-architecture.md`](../../../docs/huayu-memory-architecture.md).

### Minimal configuration

```yaml
- name: '@hy/dsh-memory-context'
```

The package declares `endpoint`, `apiKey`, `enabled`, `maxInjected`, `threshold`, `refineOnDispose`, and `refineMinChars` config fields; see the generated [configuration catalog](../../../docs/config-catalog.md) for their defaults.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin subscribes to `agent/pre-step`, `session/event`, and `session/disposed`. On the first step of a turn it joins the turn's user text (capped at 500 characters) into a query, calls `/v1/search` with the session namespace and `maxInjected` limit, filters hits to `score >= threshold`, and prepends a snapshot-form user message. `session/event` accumulates user and assistant text per session, skipping messages whose source kind is `memory-context`. On `session/disposed`, when the collected text reaches `refineMinChars`, it posts that text to `/v1/refine` and saves each returned candidate with `memory_save`; the refine runs detached so disposal is never delayed.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Huayu memory architecture](../../../docs/huayu-memory-architecture.md) — service contract, injection points, and configuration.
- [tool-memory package](../tool-memory/README.md) — the model-facing tools and service client.
- [Sessions subsystem](../../../docs/subsystems/session.md) — the event log this plugin observes.

-----

<a id="model-experience"></a>
## Model Experience

### Injected recall snapshot

#### What the model sees

A `snapshot`-form user message prepended to the first step of a turn, listing each recalled memory as `[记忆 namespace/type] content`. It appears only when the service returns hits scoring at least `threshold`.

#### Token effect

Up to `maxInjected` recalled entries per turn; the cost grows with the rendered length of the matched contents. Turns with no qualifying hits pay nothing.

#### KV Cache effect

The injection is prepended to the first step of each turn, so the reusable prefix ends before the snapshot and KV Cache reuse for that turn starts after it. The snapshot text is prefix-stable when the same query recalls the same scored hits.

### Refine output

#### What the model sees

Nothing in the current session. Refined candidates are saved through the service and re-enter model context only when a later turn recalls them.

#### Token effect

Zero in the disposing session; later sessions pay the recall cost only when the saved memories are injected.

#### KV Cache effect

No effect on the disposing session's cache. Later sessions follow the injected-recall cache behavior above.

## Known Limitations and Deferred Work

- **Silent degradation is one-way** — recall and refine failures only log warnings; nothing surfaces them to the model, so the model cannot retry or explain a memory outage.
- **Refine is fire-and-forget** — the dispose-time refine runs detached from disposal; if the process exits immediately, the merge may not complete.
- **Character floor delays refinement** — collected text below `refineMinChars` is discarded at disposal, so short sessions never refine.
- **First-step-only recall** — recall runs only when `step === 1`; later steps in the same turn never inject memories.
- **Namespace derives from cwd** — a missing or root working directory falls back to `global`, so two sessions in the same directory share a project namespace.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

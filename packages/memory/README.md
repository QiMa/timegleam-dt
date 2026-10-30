---
description: "The memory package group: persistent cross-session memory tools and session-lifecycle recall and refinement over the huayu-memory service."
kind: "package-group"
---

# memory/ — persistent memories for agents

English | [中文](README.zh.md)

## Summary

Give agents durable, cross-session memory backed by the huayu-memory service: explicit `memory_search` and `memory_save` tools for the model, plus session-lifecycle hooks that recall related memories before each turn and refine finished conversations into new memories. Failures are enhancement-only — tool failures surface as failed calls and lifecycle failures log quietly, so the memory service never interrupts a conversation.

## Table of Contents

- [Packages](#packages)
- [Related documentation](#related-documentation)
- [Dev Note](#dev-note)

-----

<a id="packages"></a>
## Packages

| Package | Role |
|---|---|
| [`tool-memory/`](tool-memory/README.md) | Model-facing `memory_search` and `memory_save` tools plus the typed service client |
| [`memory-context/`](memory-context/README.md) | Pre-step memory recall and dispose-time refinement over session events |

-----

<a id="related-documentation"></a>
## Related documentation

- [Sessions subsystem](../../docs/subsystems/session.md) — the event-sourced Session log the memory hooks observe.
- [Huayu memory architecture](../../docs/huayu-memory-architecture.md) — service contract, injection points, and configuration.
- [Generated tool catalog](../../docs/tool-catalog.md#hydsh-tool-memory) — the `memory_search` and `memory_save` schemas.

-----

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

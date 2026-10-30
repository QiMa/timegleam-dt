---
description: "Model-facing persistent-memory tools (memory_search / memory_save) over the huayu-memory service, with failures surfaced as failed tool calls."
kind: "package-reference"
---

# @hy/dsh-tool-memory

English | [中文](README.zh.md)

## Summary

Mount `dsh-tool-memory` to give agents the `memory_search` and `memory_save` tools over the huayu-memory service. `memory_search` recalls cross-session memories such as preferences, decisions, conventions, and verified facts; `memory_save` records one durable memory in a namespace. Both tools talk to the configured service endpoint and surface failures as failed tool calls, so an unreachable memory service never breaks the conversation. Endpoint and API key come from plugin config; the default endpoint is `http://192.168.100.196:8780`.

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

Mount it in any composition whose agents should remember facts across sessions. Both tools are registered as soon as the plugin loads with `enabled: true`.

### Minimal configuration

```yaml
- name: '@hy/dsh-tool-memory'
```

The package declares `endpoint`, `apiKey`, and `enabled` config fields; see the generated [configuration catalog](../../../docs/config-catalog.md) for their defaults. The overall design is described in [`docs/huayu-memory-architecture.md`](../../../docs/huayu-memory-architecture.md).

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin registers two `defineTool` definitions and owns `MemoryClient`, the typed HTTP client for the service. `search` calls `/v1/search`, `save` calls `/v1/memories`, and `refine` calls `/v1/refine`; requests carry `Authorization: Bearer <apiKey>` when a key is configured and all requests use AbortSignal timeouts. Every non-2xx response throws `MemoryServiceError`, which tool execution reports as a failed call.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [Generated tool catalog](../../../docs/tool-catalog.md#hydsh-tool-memory) — the exact `memory_search` and `memory_save` schemas.
- [Huayu memory architecture](../../../docs/huayu-memory-architecture.md) — service contract, injection points, and configuration.
- [memory-context package](../memory-context/README.md) — the lifecycle half of the memory feature.

-----

<a id="model-experience"></a>
## Model Experience

### Tool schemas

#### What the model sees

The generated [`memory_search` and `memory_save` schemas](../../../docs/tool-catalog.md#hydsh-tool-memory) whenever this package is visible in the calling Agent's scope. The catalog shows the default configuration.

#### Token effect

A fixed schema cost on every request from an Agent whose preset mounts the package. Agents under a preset that omits the row pay nothing.

#### KV Cache effect

Prefix-stable while tool definitions and visibility are unchanged. Mounting, disposal, or a scope change may invalidate reuse from the first changed schema token.

## Known Limitations and Deferred Work

- **No service, no memories** — every call to an unreachable endpoint returns a failed tool call; the model can continue without memory but cannot read or write the store.
- **No retries or caching** — the client issues one bounded request per call with a 5-second timeout and does not retry, deduplicate, or cache results.
- **Plain bearer authentication** — the client sends one static bearer token from plugin config; there is no per-session identity or scope.
- **Search quality belongs to the service** — recall relevance and ranking come from the service; the client only applies the caller-provided `limit`, clamped to 1 through 16.
- **No tool-side access control** — any Agent whose scope mounts the package can read and write every namespace; the model-facing guidance, not the Host, keeps secrets out of memory.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

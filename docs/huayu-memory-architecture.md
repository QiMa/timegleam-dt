# Huayu Memory Architecture

English | [中文](huayu-memory-architecture.zh.md)

Persistent memory for Huayu AI agents, backed by the huayu-memory service. Two plugins cooperate across a session: `@hy/dsh-tool-memory` gives the model explicit `memory_search` and `memory_save` tools, and `@hy/dsh-memory-context` hooks the agent lifecycle so recalled memories are injected before the first step of a turn and turn conversations are refined into memories when a session is disposed.

## Components

- `packages/memory/tool-memory` (`@hy/dsh-tool-memory`) — registers `memory_search` and `memory_save` in `ctx.tools`, and owns `MemoryClient`, the typed HTTP client for the service. Failures surface as failed tool calls.
- `packages/memory/memory-context` (`@hy/dsh-memory-context`) — subscribes to `agent/pre-step` and `session/event` / `session/disposed`. Failures degrade silently; memory never interrupts a conversation.
- `packages/memory/tool-memory/src/client.ts` (`MemoryClient`) — `search`, `save`, and `refine` against the three service routes below. Requests carry `Authorization: Bearer <apiKey>` when a key is configured.

## Service contract

| Route | Method | Used by | Timeout |
|---|---|---|---|
| `/v1/search` | GET | `memory_search`, pre-step recall | 5 s |
| `/v1/memories` | POST | `memory_save`, refine merge | 5 s |
| `/v1/refine` | POST | dispose refine | 10 s |

Namespaces partition the store: `global` for cross-project memories, or `project:<repo>` derived from the session working-directory basename. The context plugin derives the namespace automatically; the tools accept it as an argument.

## Injection points

### Injection A — recall at `agent/pre-step`

On the first step of every turn (`step === 1`), the plugin joins the turn's user text (capped at 500 characters) into a search query, calls `/v1/search` with the session namespace and `maxInjected` limit, filters hits to `score >= threshold`, and prepends a snapshot-form user message. Injected snapshots carry `source.kind === 'memory-context'`, which the refine collector skips so recalled text is not re-ingested.

### Injection C — refine at `session/disposed`

`session/event` accumulates user and assistant text per session. On `session/disposed`, if the collected text reaches `refineMinChars`, it is sent to `/v1/refine`; each returned candidate is merged with `memory_save`. The refine runs detached so disposal is never delayed.

## Failure model

The memory service is an enhancement, not a dependency. Tool failures are reported to the model as tool errors; lifecycle failures are logged with a `huayu-memory:` prefix and the conversation continues unchanged. All requests use AbortSignal timeouts.

## Configuration

| Key | Default | Meaning |
|---|---|---|
| `endpoint` | `http://192.168.100.196:8780` | huayu-memory service base URL |
| `apiKey` | `""` | optional bearer token |
| `enabled` | `true` | mounts nothing when false |
| `maxInjected` | `8` | recall cap per turn (1-16) |
| `threshold` | `0.25` | minimum score for injection (0-1) |
| `refineOnDispose` | `true` | run dispose refine |
| `refineMinChars` | `160` | minimum collected characters |

`maxInjected`, `threshold`, `refineOnDispose`, and `refineMinChars` belong to `@hy/dsh-memory-context`; `endpoint`, `apiKey`, and `enabled` are shared by both plugins.

Production profiles point `endpoint` at `https://memory.lanhc.com` (NPM reverse proxy, forced SSL, API-key auth); the default remains the intranet address `http://192.168.100.196:8780` as a safe fallback.

## Data flow

```text
turn begins -- agent/pre-step -- search(project:<repo>) -- snapshot injected
turn runs   -- session/event -- collect user+assistant text (skip memory-context)
turn ends   -- session/disposed -- refine(text) -- save(candidates)
```

---
description: "Records a persistence type transition and its compatibility acknowledgement."
kind: persistence-change
---

# 2026-10-30-memory-context-source

English | [中文](2026-10-30-memory-context-source.zh.md)

## Summary

Adds the memory-context message source kind, carrying recalled-memory snapshot context into agent inbox events, developer messages, title requests, and user messages.

## Table of Contents

- [Declaration](#declaration)
- [Compatibility](#compatibility)
- [Verification](#verification)
- [Dev Note](#dev-note)

<a id="declaration"></a>
## Declaration

```yaml persistence-change
schemaVersion: 1
id: 2026-10-30-memory-context-source
baseline: false
changes:
  - root: "event:agent/inbox/spliced"
    previous: "2026-10-27-subagent-settlement-attribution"
    after: "8028f589a6d6c4f03f6679df3162cb594c1559118fee19e3a5a84bbae69c98d1"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-27-subagent-settlement-attribution"
    after: "6a24527110a3fbde028ac048d9e217920bb4e054abd510083c372f8d63e247fb"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-27-subagent-settlement-attribution"
    after: "e6205d6ff263091d4f796ddb6e7dcde7500b76e55290340a98311c0ecb6c9c56"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-27-subagent-settlement-attribution"
    after: "40c5ac20a6fa1792fee42f7d3e9cae0abfcbd1a01f46a725634f78f964df061c"
    decision: same-version
```

<a id="compatibility"></a>
## Compatibility

The new source kind variant is additive: previously persisted events keep their existing kinds, and readers that do not recognize memory-context can fall back to ordinary user-message handling. No existing stored data changes shape.

<a id="verification"></a>
## Verification

Verified by running the package memory test suite (memory-context and tool-memory, 13 tests) and the full typecheck gates after regenerating the persistence catalog.

<a id="dev-note"></a>
## Dev Note

None.

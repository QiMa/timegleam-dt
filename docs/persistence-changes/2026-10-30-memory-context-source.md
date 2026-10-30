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
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "b11ccc44b1e8fd14452bfd68e0e87e82b78375462b8509ad77289f0d5a083f06"
    decision: same-version
  - root: "event:developer/message"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "0dd02ddd0f9452216dfee24f2c08f437bf74f827f725eeda97accb19643a75bb"
    decision: same-version
  - root: "event:session/title-llm-request"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "e265b067529faa992407dcaa9bcda819e984b486c2de1f65951e737d9d7070ad"
    decision: same-version
  - root: "event:user/message"
    previous: "2026-10-13-liveshare-share-viewer-principal"
    after: "e88b97b1e6f003911669051132069e0ebce17140e796df7b9afe5c4f7f9d7fd3"
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

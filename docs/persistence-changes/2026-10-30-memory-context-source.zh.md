---
description: "记录持久化类型更改及其兼容性确认。"
kind: persistence-change
---

# 2026-10-30-memory-context-source

[English](2026-10-30-memory-context-source.md) | 中文

## 概述

新增 memory-context 消息来源 kind，把召回的持久记忆快照上下文带入 agent 收件箱事件、开发者消息、标题请求与用户消息。

## 目录

- [声明](#declaration)
- [兼容性](#compatibility)
- [验证](#verification)
- [开发备注](#dev-note)

<a id="declaration"></a>
## 声明

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
## 兼容性

新来源 kind 变体是纯增量：已持久化的事件保持原有 kind，不识别 memory-context 的读取方可回退到普通用户消息处理。已有存储数据不变形。

<a id="verification"></a>
## 验证

重新生成持久化目录后，通过 package memory 测试套件（memory-context 与 tool-memory 共 13 个测试）和完整 typecheck 门禁验证。

<a id="dev-note"></a>
## 开发备注

无。

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
## 兼容性

新来源 kind 变体是纯增量：已持久化的事件保持原有 kind，不识别 memory-context 的读取方可回退到普通用户消息处理。已有存储数据不变形。

<a id="verification"></a>
## 验证

重新生成持久化目录后，通过 package memory 测试套件（memory-context 与 tool-memory 共 13 个测试）和完整 typecheck 门禁验证。

<a id="dev-note"></a>
## 开发备注

无。

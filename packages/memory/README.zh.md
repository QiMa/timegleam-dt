---
description: "memory 包组：基于 huayu-memory 服务的持久跨会话记忆工具，以及会话生命周期内的召回与精炼。"
kind: "package-group"
---

# memory/ — 面向智能体的持久记忆

[English](README.md) | 中文

## 概述

基于 huayu-memory 服务，为智能体提供持久、跨会话的记忆：面向模型的显式 `memory_search` 与 `memory_save` 工具，以及会话生命周期钩子，在每个 turn 前召回相关记忆，并在会话结束后把对话精炼成新记忆。失败只影响增强能力——工具失败以失败调用呈现，生命周期失败静默记录日志，因此记忆服务绝不打断对话。

## 目录

- [包](#packages)
- [相关文档](#related-documentation)
- [开发备注](#dev-note)

-----

<a id="packages"></a>
## 包

| 包 | 职责 |
|---|---|
| [`tool-memory/`](tool-memory/README.zh.md) | 面向模型的 `memory_search` 与 `memory_save` 工具，以及类型化服务客户端 |
| [`memory-context/`](memory-context/README.zh.md) | 基于会话事件的 pre-step 记忆召回与销毁时精炼 |

-----

<a id="related-documentation"></a>
## 相关文档

- [Sessions 子系统](../../docs/subsystems/session.zh.md) —— 记忆钩子所观察的事件溯源 Session 日志。
- [Huayu memory 架构](../../docs/huayu-memory-architecture.zh.md) —— 服务契约、注入点与配置。
- [生成的工具目录](../../docs/tool-catalog.zh.md#hydsh-tool-memory) —— `memory_search` 与 `memory_save` 的 schema。

-----

<a id="dev-note"></a>
## 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

None.

</details>

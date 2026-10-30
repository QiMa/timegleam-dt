---
description: "基于 huayu-memory 服务的面向模型持久记忆工具（memory_search / memory_save），失败以失败的工具调用呈现。"
kind: "package-reference"
---

# @hy/dsh-tool-memory

[English](README.md) | 中文

## 概述

挂载 `dsh-tool-memory`，让 agent 获得基于 huayu-memory 服务的 `memory_search` 与 `memory_save` 工具。`memory_search` 召回跨会话记忆，例如偏好、决策、约定与已核实的事实；`memory_save` 在命名空间中记录一条持久记忆。两个工具都访问已配置的服务端点，失败以失败的工具调用呈现，因此记忆服务不可达时绝不打断对话。Endpoint 与 API key 来自插件配置；默认 endpoint 为 `http://192.168.100.196:8780`。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在任何希望 agent 跨会话记住事实的组合中挂载它。插件以 `enabled: true` 加载后即注册两个工具。

### 最小配置

```yaml
- name: '@hy/dsh-tool-memory'
```

本包声明 `endpoint`、`apiKey` 与 `enabled` 配置字段；默认值见生成的[配置目录](../../../docs/config-catalog.zh.md)。整体设计见 [`docs/huayu-memory-architecture.md`](../../../docs/huayu-memory-architecture.zh.md)。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

插件注册两个 `defineTool` 定义，并持有 `MemoryClient`，即面向该服务的类型化 HTTP 客户端。`search` 调用 `/v1/search`，`save` 调用 `/v1/memories`，`refine` 调用 `/v1/refine`；配置了 key 时，请求携带 `Authorization: Bearer <apiKey>`，所有请求都使用 AbortSignal 超时。任何非 2xx 响应都会抛出 `MemoryServiceError`，工具执行将其报告为失败调用。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [生成的工具目录](../../../docs/tool-catalog.zh.md#hydsh-tool-memory) —— 精确的 `memory_search` 与 `memory_save` schema。
- [Huayu memory 架构](../../../docs/huayu-memory-architecture.zh.md) —— 服务契约、注入点与配置。
- [memory-context 包](../memory-context/README.zh.md) —— 记忆功能的生命周期半区。

-----

<a id="model-experience"></a>
## 模型体验

### 工具 schema

#### What the model sees

只要本包在调用方 Agent 的作用域内可见，模型就会收到生成的 [`memory_search` 与 `memory_save` schema](../../../docs/tool-catalog.zh.md#hydsh-tool-memory)。目录展示默认配置。

#### Token effect

凡是 preset 挂载了本包的 Agent，其每次请求都有固定的 schema 开销。省略该行的 preset 下的 Agent 不付出任何开销。

#### KV Cache effect

只要工具定义与可见性不变，前缀保持稳定。挂载、释放或作用域变化都可能使从首个变化 schema token 起的复用失效。

## Known Limitations and Deferred Work

- **没有服务就没有记忆** —— 对不可达端点的每次调用都返回失败的工具调用；模型可以继续对话，但无法读写存储。
- **无重试与缓存** —— 客户端每次调用只发出一个有 5 秒超时的请求，不重试、不去重也不缓存结果。
- **明文 bearer 鉴权** —— 客户端发送插件配置中的单一静态 bearer token；没有按会话的身份或作用域。
- **检索质量属于服务** —— 召回的相关性与排序来自服务；客户端只应用调用方提供的 `limit`，钳制在 1 到 16。
- **没有工具侧访问控制** —— 作用域内挂载了本包的任何 Agent 都能读写所有命名空间；防止秘密进入记忆靠面向模型的指导，而不是宿主。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

None.

</details>

---
description: "面向 huayu-memory 服务的会话生命周期记忆钩子：每个 turn 前召回记忆，并把完成的对话精炼成新记忆。"
kind: "package-reference"
---

# @hy/dsh-memory-context

[English](README.md) | 中文

## 概述

挂载 `dsh-memory-context`，让 agent 无需显式工具调用即可自动获得记忆。在每个 turn 的第一步之前，它用该 turn 的用户文本查询 huayu-memory 服务，把分数越过阈值的召回记忆作为 snapshot 消息前置；会话运行期间它收集用户与助手文本，在会话销毁时把这些文本交给服务精炼并保存返回的候选。注入的 snapshot 携带 `source.kind === 'memory-context'`，因此收集器不会重新吸收它们。失败静默降级：记忆服务不可达只会记录一条警告，绝不打断对话。

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

在已经加载 `@hy/dsh-tool-memory` 的组合中挂载它；它复用该包的 `MemoryClient`。整体设计见 [`docs/huayu-memory-architecture.md`](../../../docs/huayu-memory-architecture.zh.md)。

### 最小配置

```yaml
- name: '@hy/dsh-memory-context'
```

本包声明 `endpoint`、`apiKey`、`enabled`、`maxInjected`、`threshold`、`refineOnDispose` 与 `refineMinChars` 配置字段；默认值见生成的[配置目录](../../../docs/config-catalog.zh.md)。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节——点击展开</summary>

插件订阅 `agent/pre-step`、`session/event` 与 `session/disposed`。在 turn 的第一步，它把该 turn 的用户文本（截断至 500 字符）拼成查询，携带会话命名空间与 `maxInjected` 上限调用 `/v1/search`，过滤出 `score >= threshold` 的结果，并前置一条 snapshot 形式的用户消息。`session/event` 按会话累积用户与助手文本，跳过来源 kind 为 `memory-context` 的消息。在 `session/disposed` 时，若累积文本达到 `refineMinChars`，就把文本发给 `/v1/refine` 并用 `memory_save` 保存每个返回的候选；精炼以脱离方式运行，绝不拖慢销毁。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [Huayu memory 架构](../../../docs/huayu-memory-architecture.zh.md) —— 服务契约、注入点与配置。
- [tool-memory 包](../tool-memory/README.zh.md) —— 面向模型的工具与服务客户端。
- [Sessions 子系统](../../../docs/subsystems/session.zh.md) —— 本插件所观察的事件日志。

-----

<a id="model-experience"></a>
## 模型体验

### 注入的召回快照

#### What the model sees

一条 `snapshot` 形式的用户消息，前置到 turn 的第一步，把每条召回记忆列为 `[记忆 namespace/type] content`。仅当服务返回分数至少达到 `threshold` 的结果时才出现。

#### Token effect

每个 turn 最多 `maxInjected` 条召回；开销随命中内容的渲染长度增长。没有合格命中的 turn 不付出任何开销。

#### KV Cache effect

注入前置到每个 turn 的第一步，因此可复用前缀止于快照之前，该 turn 的 KV Cache 复用在快照之后开始。当同一查询召回相同分数结果时，快照文本保持前缀稳定。

### 精炼输出

#### What the model sees

当前会话中什么都看不到。精炼候选通过服务保存，只有在后续 turn 召回时才重新进入模型上下文。

#### Token effect

在销毁的会话中为零；后续会话只有在保存的记忆被注入时才付出召回成本。

#### KV Cache effect

对销毁会话的缓存无影响。后续会话遵循上述注入召回的缓存行为。

## Known Limitations and Deferred Work

- **静默降级是单向的** —— 召回与精炼失败只记录警告；没有任何信息呈现给模型，因此模型无法重试或解释记忆中断。
- **精炼是即发即弃** —— 销毁时的精炼与销毁过程脱钩运行；如果进程立即退出，合并可能不会完成。
- **字符下限推迟精炼** —— 低于 `refineMinChars` 的累积文本在销毁时被丢弃，因此过短的会话永不精炼。
- **只在第一步召回** —— 只有 `step === 1` 时运行召回；同一 turn 的后续步骤永不注入记忆。
- **命名空间派生自 cwd** —— 缺失或根目录的工作目录回退到 `global`，因此同一目录下的两个会话共享一个项目命名空间。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

None.

</details>

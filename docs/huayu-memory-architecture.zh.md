# Huayu Memory 架构

[English](huayu-memory-architecture.md) | 中文

面向 Huayu AI 智能体的持久记忆，由 huayu-memory 服务支撑。两个插件在会话内协作：`@hy/dsh-tool-memory` 为模型提供显式的 `memory_search` 与 `memory_save` 工具，`@hy/dsh-memory-context` 挂接智能体生命周期，在每个 turn 第一步之前注入召回的记忆，并在会话销毁时将对话精炼为记忆。

## 组件

- `packages/memory/tool-memory`（`@hy/dsh-tool-memory`）— 在 `ctx.tools` 中注册 `memory_search` 与 `memory_save`，并持有 `MemoryClient`，即面向该服务的类型化 HTTP 客户端。失败会以失败的工具调用呈现。
- `packages/memory/memory-context`（`@hy/dsh-memory-context`）— 订阅 `agent/pre-step` 与 `session/event` / `session/disposed`。失败静默降级；记忆绝不打断对话。
- `packages/memory/tool-memory/src/client.ts`（`MemoryClient`）— 对下述三个服务路由执行 `search`、`save` 与 `refine`。配置了 key 时，请求携带 `Authorization: Bearer <apiKey>`。

## 服务契约

| 路由 | 方法 | 使用者 | 超时 |
|---|---|---|---|
| `/v1/search` | GET | `memory_search`、pre-step 召回 | 5 s |
| `/v1/memories` | POST | `memory_save`、精炼合并 | 5 s |
| `/v1/refine` | POST | 销毁精炼 | 10 s |

命名空间划分存储：`global` 用于跨项目记忆，或由会话工作目录基名派生的 `project:<repo>`。上下文插件自动派生命名空间；工具将其作为参数接受。

## 注入点

### 注入点 A — 在 `agent/pre-step` 召回

在每个 turn 的第一步（`step === 1`），插件把该 turn 的用户文本（截断至 500 字符）拼成搜索查询，携带会话命名空间与 `maxInjected` 上限调用 `/v1/search`，过滤出 `score >= threshold` 的结果，并前置一条 snapshot 形式的用户消息。注入的 snapshot 携带 `source.kind === 'memory-context'`，精炼收集器会跳过它，因此召回文本不会被重新吸收。

### 注入点 C — 在 `session/disposed` 精炼

`session/event` 按会话累积用户与助手文本。在 `session/disposed` 时，若累积文本达到 `refineMinChars`，则发送到 `/v1/refine`；返回的每个候选都用 `memory_save` 合并。精炼以脱离方式运行，绝不拖慢销毁。

## 失败模型

记忆服务是增强项而非依赖项。工具失败以工具错误报告给模型；生命周期失败以 `huayu-memory:` 前缀记录日志，对话不受影响继续。所有请求都使用 AbortSignal 超时。

## 配置

| 键 | 默认值 | 含义 |
|---|---|---|
| `endpoint` | `http://192.168.100.196:8780` | huayu-memory 服务基础 URL |
| `apiKey` | `""` | 可选的 bearer token |
| `enabled` | `true` | 为 false 时不挂载任何东西 |
| `maxInjected` | `8` | 每个 turn 的召回上限（1-16） |
| `threshold` | `0.25` | 注入所需最低分数（0-1） |
| `refineOnDispose` | `true` | 执行销毁精炼 |
| `refineMinChars` | `160` | 最低累积字符数 |

`maxInjected`、`threshold`、`refineOnDispose` 与 `refineMinChars` 属于 `@hy/dsh-memory-context`；`endpoint`、`apiKey` 与 `enabled` 为两个插件共享。

生产 profile 将 `endpoint` 指向 `https://memory.lanhc.com`（NPM 反代、强制 SSL、API key 鉴权）；默认值保留内网地址 `http://192.168.100.196:8780` 作为安全兜底。

## 数据流

```text
turn begins -- agent/pre-step -- search(project:<repo>) -- snapshot injected
turn runs   -- session/event -- collect user+assistant text (skip memory-context)
turn ends   -- session/disposed -- refine(text) -- save(candidates)
```

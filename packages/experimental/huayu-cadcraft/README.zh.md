---
description: "把 CADCraft 网页绘图引擎作为可安装插件嵌入 拾光 TimeGleam 右边栏。"
kind: "package-bundle"
---

# @hy/dsh-experimental-huayu-cadcraft

[English](README.md) | 中文

## 概述

这个可选 bundle 把 CADCraft 作为可安装插件挂载：Host 把内置的 CADCraft 网页客户端（Rust 编译的 WASM 引擎）托管在 `/cadcraft` 下，并在会话工作区旁的 `cadcraft/drawing.dxf` 里为每个项目保存一张图纸；浏览器半边在右边栏注册 CADCraft 标签页并用 iframe 承载引擎。

## 目录

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

通过插件管理器安装本插件。桌面端在首次启动且尚未安装时，会从 `https://lanhc.com/lanhc/plugins` 的拾光 TimeGleam 插件源自动安装；Web 端可在 **Plugins** 页面安装打包好的 tarball，再在 **Experimental plugins** 下开启 **CADCraft**。

启用后右边栏出现 CADCraft 入口，打开即在 `/cadcraft` 下加载引擎。聊天可通过 Creator 模式动态桥驱动绘图，每张图纸保存到对应项目目录旁。

<a id="understand-the-implementation"></a>
## 实现方式

静态 `cordis.patch.yml` 插入 `huayu-cadcraft` 行，以 `mountPath: /cadcraft` 挂载 Host 插件。Host 半边在该前缀下托管 `assets/web`，向页面注入 `__HUAYU_CADCAST_CONFIG__`，并提供动态 host 半边用于逐项目图纸持久化的 `huayuCadcraftDrawingStore`。client 半边注册 `cadcraft` 标签页类型及其 iframe 主体。

<a id="model-experience"></a>
## Model Experience

### 静态 bundle 面

#### What the model sees

静态 bundle 不注册任何工具，也不注册 system prompt 段落。聊天只能通过 Creator 模式动态桥驱动 CADCraft，其工具（如 `cadcraft_project_new`）在该动态插件运行期间出现。

#### Token effect

仅本 bundle 的贡献为零；动态桥的工具按其自身作用域的渲染计费。

#### KV Cache effect

当本 bundle 是唯一挂载的 CADCraft 插件时，没有影响。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

- 内置 web 构建是快照；如需升级 CADCraft 引擎，请重新构建并重新打包 tarball。
- 桌面自动安装读取 `https://lanhc.com/lanhc/plugins` 的插件源；网络源不可达时回退到插件管理器源。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者上下文——点击展开</summary>

本包由兄弟仓库的 CADCraft 扩展迁移而来。`assets/web/` 下的 WASM 产物来自 CADCraft 的 web 构建。

</details>

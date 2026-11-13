---
description: "在桌面端侧栏渲染拾光 TimeGleam 标志与字标；供选择或替换桌面端品牌呈现的用户与维护者阅读。"
kind: "package-reference"
---

# @hy/dsh-client-ui-brand-timegleam

[English](README.md) | 中文

## 概述

本包在 Desktop 构建中把拾光 TimeGleam 身份填入侧栏标志与名称 slot，同时 Web 构建保留 `ui-brand-official` 品牌行。其他身份应改用占据相同 slot 的包来替换它。两个填充都是内联 SVG 与文本，因此本包不附带网络资源、主题变体或运行时状态，也不影响模型请求。

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

在侧栏应显示 TimeGleam 身份的 composition 中挂载本插件。Desktop profile 已经这样做了；没有任何按用户设置来选择它。

### 选择 profile

`packages/bundle/web-app/cordis.patch.yml` 仅在 profile 名为 `desktop` 时启用本行，并在该 profile 中禁用 `ui-brand-official` 行。本行不以 `DSH_CLIENT_BUILD_PROFILE` 为门控，因为 profile 门控已经保证单占位 slot 中恰好只有一个填充。会话首屏保留来自 `dsh-client-ui-conversation` 的共享回退标志；本包不占该 slot。

### 替换品牌

提供另一个注册 `sidebar.brand.mark` 与 `sidebar.brand.name` 的 Cordis 包，并在 composition 中禁用本行。占据 slot 是唯一路径；本包没有品牌配置面。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

`src/client/index.ts` 中的浏览器半部嵌套两个 `ctx.slots.inject()` 调用，使注册等待侧栏声明，在声明消失时一并撤回两个填充，并在 HMR 期间不留残缺品牌。`src/client/Brand.tsx` 委托 `ui-primitives` 的 `TimeGleamMark` 与 `BrandWordmark`，因此 Desktop 与 Web 的填充共用同一份图形与文案来源。`src/index.ts` 是一个空的宿主侧 Loader 座位，因为本包只贡献浏览器呈现。浏览器标题是构建层面的事（`DSH_CLIENT_TITLE`），不在 slot 系统之内。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [ui-sidebar](../ui-sidebar/README.zh.md)——声明标志与名称 slot 并渲染回退。
- [ui-brand-official](../ui-brand-official/README.zh.md)——本包在 Desktop 上替换的 Web 品牌填充。
- [ui-conversation](../ui-conversation/README.zh.md)——声明首屏品牌标志。
- [TimeGleam 桌面集成](../../../docs/timegleam-desktop.zh.md)——完整的桌面端集成。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只贡献浏览器呈现；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送提供方请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制界定了 TimeGleam 呈现的供给方式；它们是当前约束，不是设计积压。

- **只有一组填充**——替代呈现属于占据这两个相同 slot 的另一个 Cordis 包。
- **首屏保持共享**——会话首屏使用外壳回退标志；若要品牌化，需由另一个包占据 `conversation.hero.brand.mark`。
- **浏览器标题独立**——`DSH_CLIENT_TITLE` 在构建时选择标题文本，而非通过 UI slot。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>

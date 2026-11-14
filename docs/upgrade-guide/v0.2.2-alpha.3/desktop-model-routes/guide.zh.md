---
kind: upgrade-guide
description: "桌面 profile 不再加载 DeepSeek 模型路由；记录在未注册路由上的 Session 改用 AgentOptions 路由恢复，而不是每一步都失败。"
---

# 桌面端只通过 `timegleam` 对话

[English](guide.md) | 中文

## 变更

共享 Web 组合此前在每个 profile 都加载 `llm-deepseek` 与 `llm-deepseek-account`。桌面 profile 现在禁用这两行，因此它的模型选择器只列出欢迎页写入的 `timegleam` 提供方。记录在 `deepseek-official` 上的桌面 Session 不再提供该路由，其请求会以 `MISSING_CREDENTIAL` 失败，因为标准版没有 DeepSeek 密钥；企业版持有的是密封网关密钥，也不是 DeepSeek 凭据。Web profile 保留两行。

恢复记录提供方未注册的 Session 时，循环回退到实时的 `AgentOptions` 提供方与模型，并把该选择记录为 `model/selection`。该步骤随即运行而不是失败，后续步骤沿用回退。仍然注册的路由即使凭据缺失也保持原样，因为该失败本身指明了补救方式。

## 迁移

1. 在桌面 profile 上确实使用 DeepSeek 密钥的部署：在自己的 patch 中以 `disabled: false` 重新加入这两行，或在 Agent 条目中把 `provider` 与 `model` 设为你的 DeepSeek 路由。确认：桌面模型选择器显示该 DeepSeek 路由，且一次对话可以完成。
2. 记录在 `deepseek-official` 或其他未注册提供方上的 Session：发送一条消息。确认：Session 日志新增一条写明 `AgentOptions` 路由的 `model/selection` 事件，回复到达，后续轮次不再出现 `MISSING_CREDENTIAL` 失败。
3. Web 部署：无需操作。确认：`cordis.yml` 在 `web` profile 下仍加载两行 DeepSeek 路由。
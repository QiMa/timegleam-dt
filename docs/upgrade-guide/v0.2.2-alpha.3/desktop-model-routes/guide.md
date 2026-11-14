---
kind: upgrade-guide
description: "The Desktop profile no longer loads the DeepSeek model routes, and a Session recorded on an unregistered route resumes on the AgentOptions route instead of failing every step."
---

# Desktop chats only through `timegleam`

English | [中文](guide.zh.md)

## Change

The shared Web composition used to load `llm-deepseek` and `llm-deepseek-account` in every profile. The Desktop profile now disables both rows, so its model picker lists only the `timegleam` provider that the welcome flow seeds. A Desktop Session recorded on `deepseek-official` no longer offers that route, and its requests failed with `MISSING_CREDENTIAL` because no DeepSeek key exists in the standard edition; the enterprise edition holds a sealed gateway key, which is not a DeepSeek credential either. The Web profile keeps both rows.

Resuming a Session whose recorded provider is not registered now falls back to the live `AgentOptions` provider and model and records that choice as `model/selection`. The step then runs instead of failing, and later steps use the fallback. A recorded route that is still registered keeps its place even when its credential is missing, because that failure identifies its own remedy.

## Migration

1. Deployments that run the Desktop profile with a real DeepSeek key: add both rows back in your own patch with `disabled: false`, or set `provider` and `model` in the Agent entry to your DeepSeek route. Confirm: the Desktop model picker shows the DeepSeek route and a chat completes.
2. Sessions recorded on `deepseek-official` or any other unregistered provider: send one message. Confirm: the Session log gains a `model/selection` event naming the `AgentOptions` route, the reply arrives, and later turns send no further `MISSING_CREDENTIAL` failure.
3. Web deployments: no action. Confirm: `cordis.yml` still loads both DeepSeek rows under the `web` profile.
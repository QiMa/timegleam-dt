---
name: huayu-brand-voice
description: Use when writing user-facing copy, product names, model identifiers, deployment scripts, or release notes for Huayu AI products (huayu-v2, huayu-v2-flash, huayu-memory, AirGap, HuayuCAD, HuayuGIS), to keep naming, slogans, and delivery conventions consistent with the LANHC brand.
---

# Huayu Brand Voice

## Identity

- 平台：华宇AI / Huayu AI；缩写 `hy`。
- 运营主体：清大华宇（厦门）数字科技有限公司（LANHC）。
- 官网：https://lanhc.com ；品牌主色 `#003cfe`，金色点缀。
- npm scope：`@hy`；镜像仓库：`ccr.ccs.tencentyun.com/lucky/<name>`。

## Model naming

- 高质量档：`huayu-v2`（Q8_0 量化）。
- 加速档：`huayu-v2-flash`（Q4_K_XL 量化）。
- 推理服务：Strata 引擎，OpenAI 兼容 API（`/v1/chat/completions`、`/v1/models`）。
- 任何用户可见文本、包名、镜像标签与日志输出不得出现上游模型名或 `qwen*` 痕迹。

## Product names

| 产品 | 标识 | 入口 |
|---|---|---|
| 清大华宇AI | Huayu AI | https://lanhc.com/huayu-ai/ |
| 华宇大模型 | huayu-v2 / huayu-v2-flash | https://lanhc.com/huayuv2/ |
| 华宇记忆 | huayu-memory | https://memory.lanhc.com |
| 华宇气隙 | AirGap | https://lanhc.com/airgap/ |
| 白泽AI平台 | baizor | https://baizor.com |
| 兰花AI中台 | lanhc-hub | https://lanhc.com/lanhc-hub/ |
| 蓝核AI智控台 | lanhc-console | https://lanhc.com/lanhc-console/ |
| 华宇CAD | HuayuCAD | https://lanhc.com/huayucad/ |
| 华宇GIS | HuayuGIS | https://lanhc.com/huayugis/ |

## Slogans

- 清大华宇AI：汇聚数据智慧，驱动产业智能。
- 白泽AI平台：以 AI 之智，传文化之美。
- 不自行发明口号；沿用上表，或先经产品方确认。

## Delivery conventions

- 部署用户一律 `sszscd`，禁止 root。
- anne-2011 禁止执行 `strata launch`（会重置配置）；变更配置后手工重启 systemd 服务。
- 服务自愈用 systemd（`Restart=on-failure`，10 秒），日志按日轮转。
- 公网入口经 NPM 反向代理并 Force SSL；发布前轮换开发期 API key。
- 密钥不入 git：`.env`、`.key` 必须列在 `.gitignore`。

## Release checklist

1. 用户可见文本、包名、镜像标签、日志输出无 qwen 痕迹；
2. 版本号写入 version.ini / package.json，官网 changelog 同步；
3. systemd / docker compose 配置经 `sszscd` 用户验证；
4. 密钥不在提交中，镜像已推 `ccr.ccs.tencentyun.com/lucky/<name>`。
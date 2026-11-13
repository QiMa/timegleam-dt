# 拾光 TimeGleam Brand

## Identity

- 名称：拾光 / TimeGleam（中文名「拾光」，英文名 `TimeGleam`）
- 站点：https://timegleam.com
- 桌面可执行文件：`timegleam`（命令行别名 `dsh`）

## Namespace

- npm scope：`@hy`（历史 scope，保持包名兼容）
- 桌面应用 ID：`com.timegleam.desktop`
- 协议：`timegleam://`（保留 `dsh://` 兼容旧登录链接）
- 数据目录：`~/.timegleam` 与 `%APPDATA%\timegleam`

## Logo

| 资源 | 路径 | 说明 |
|---|---|---|
| 图标 | `assets/brand/timegleam-icon.svg` | 512×512 方形应用图标（`#121110` 底 + 金色拾光光圈） |
| 标记 | `assets/brand/timegleam-mark.svg` | 透明底光圈标记，供深色/彩色背景复用 |
| 字标 | `assets/brand/timegleam-wordmark.svg` | 960×240 横版 lockup（光圈 + 拾光 + TIMEGLEAM） |
| Favicon | `apps/web/public/favicon.svg` | Web 站点图标 |

## 品牌色

- 品牌金：`#E0A64B`（光圈与强调）
- 底色：`#121110`（应用磁贴、深色界面）
- 正文色：`#F5F1E8`；辅助灰：`#8A8478`

## 资产与版权

光圈图形与字标为拾光 TimeGleam 自有品牌资产，随本仓库以 MIT 许可分发。客户端图形定义在 `packages/client/ui-primitives/src/BrandAssets.ts`，Web 与桌面图标由 `apps/web/scripts/render-app-icons.ts` 与 `apps/desktop/scripts/render-tray-icon.ts` 从同一份矢量生成。

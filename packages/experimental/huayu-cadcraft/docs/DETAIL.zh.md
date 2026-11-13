CADCraft 把 Rust 编译、AutoCAD 级的绘图引擎带入 拾光 TimeGleam。插件把引擎的 WASM web 构建托管在 `/cadcraft` 下，并以标签页形式显示在右边栏。

图纸贴近工作内容：每个会话把自己的图纸保存在会话工作区的 `cadcraft/drawing.dxf`，每个项目目录都携带自己的图纸。

聊天集成使用动态 Creator 模式桥：host 半边提供 `huayuCadcraftDrawingStore`，动态双半边在聊天与 iframe 之间转发命令并保存/加载图纸。

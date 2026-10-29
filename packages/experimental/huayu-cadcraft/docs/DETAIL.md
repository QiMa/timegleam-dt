CADCraft brings a Rust-compiled, AutoCAD-class drawing engine into Huayu AI. The plugin serves the engine's WASM web build under `/cadcraft` and shows it in the right sidebar as a tab.

Drawings stay beside the work: each session keeps its drawing at `cadcraft/drawing.dxf` in the session workspace, so every project directory carries its own drawing.

Chat integration uses the dynamic Creator-mode bridge: the host half provides the `huayuCadcraftDrawingStore`, and the dynamic halves relay commands and save/load drawings between the chat and the iframe.

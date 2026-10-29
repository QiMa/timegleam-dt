---
description: "Embed the CADCraft web drawing engine in the right sidebar as an installable Huayu AI plugin."
kind: "package-bundle"
---

# @hy/dsh-experimental-huayu-cadcraft

English | [中文](README.zh.md)

## Summary

This optional bundle mounts CADCraft as an installable plugin: the Host serves the bundled CADCraft web client (Rust-compiled WASM engine) under `/cadcraft` and keeps one drawing per project at `cadcraft/drawing.dxf` beside the session workspace, and the browser half registers a CADCraft tab in the right sidebar that frames the engine.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Install the plugin through the plugin manager. On Desktop, the CADCraft plugin is installed automatically on first launch when it is not already present, from the Huayu plugin feed at `https://lanhc.com/lanhc/plugins`. On the Web, install the packed tarball through the **Plugins** page, then switch on **CADCraft** under **Experimental plugins**.

Once enabled, the right sidebar gains a CADCraft entry; opening it frames the engine under `/cadcraft`. Chat can drive the drawing through the dynamic Creator-mode bridge, and each drawing is saved beside its project directory.

<a id="understand-the-implementation"></a>
## Understand the implementation

The static `cordis.patch.yml` inserts the `huayu-cadcraft` row, which mounts the Host plugin with `mountPath: /cadcraft`. The Host half serves `assets/web` under that prefix, injects `__HUAYU_CADCAST_CONFIG__` into pages, and provides the `huayuCadcraftDrawingStore` the dynamic host half uses for per-project drawing persistence. The client half registers the `cadcraft` tab kind and its iframe body.

<a id="known-limitations-and-deferred-work"></a>
## Known Limitations and Deferred Work

- The bundled web build is a snapshot; rebuild and repack the tarball to pick up CADCraft engine updates.
- Desktop auto-install reads the feed at `https://lanhc.com/lanhc/plugins`; the plugin manager feed is added as a fallback when the network feed is unreachable.

<a id="dev-note"></a>
## Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

The package was migrated from the sibling `huayu-extension` checkout. The WASM assets under `assets/web/` come from the CADCraft web build.

</details>

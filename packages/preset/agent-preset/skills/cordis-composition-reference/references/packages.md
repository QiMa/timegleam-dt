# Loadable Harness plugin packages

This file is GENERATED from workspace manifests (`scripts/gen-plugin-packages.ts`) and verified fresh by `pnpm run verify-plugin-packages` (part of `doc-sync`); do not edit it by hand.

Every package below exports a Cordis plugin that a bundle patch can name in a Loader row. `Config` marks packages whose row accepts a `config` mapping; query `Config.listConfigs` through `cordis_inspect_query` (filter by `name`, then query the `entry` id) for the mounted schema. Packages under `experimental` are pre-stable.

## acp

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-acp` | yes | Automation-only Agent Client Protocol server for driving Huayu AI agents over JSON-RPC stdio |

## api

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-api-account-controller` | no | Expose safe account operations over authenticated Remote |
| `@hy/dsh-api-gateway` | yes | Typert Remote Host dispatcher and Client API endpoint |
| `@hy/dsh-api-job-controller` | yes | Job Remote observation stream and the reference-counted client job-output service |
| `@hy/dsh-api-remote-access` | no | Method-level Remote access control for non-owner Peers and the per-Peer access snapshot |
| `@hy/dsh-api-remotes` | no | Remote BFF assembly for application-selected Host capabilities |
| `@hy/dsh-api-session-controller` | yes | Session Remote commands, cold reads, and live control transport |
| `@hy/dsh-api-settings-controller` | yes | Remote owner for the configuration surfaces over the settings-domain seams |
| `@hy/dsh-api-terminal-controller` | yes | Session-owned interactive terminals with shell discovery, screen recovery and typed Remote control |
| `@hy/dsh-api-workspace-controller` | yes | Workspace Remote commands and reconnect-safe state transport |
| `@hy/dsh-api-workspace-files` | yes | Workspace file service and Client resource provider: bounded reads, directory listing, and live metadata over the workspaceFiles Remote namespace |

## attachment

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-attachment-local` | yes | Private content-addressed DSH_HOME attachment storage |

## boot

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-config-editor` | no | Persist plugin configuration through profile patches and Loader reconciliation |
| `@hy/dsh-hmr` | yes | Coordinated module and profile configuration hot reload |
| `@hy/dsh-plugin-manager` | yes | Current-profile plugin and bundle management shared by dsh CLI, Web and agent tools |
| `@hy/dsh-plugin-market` | yes | Configured plugin market indexes for the Web Discover page and the plugin_market agent tool |

## browser-use

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-browser-use` | no | Exclusive named browser-use provider registration |

## bundle

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-acp-app` | no | The dsh ACP profile bundle: automation-only JSON-RPC stdio and process lifecycle over dsh-base |
| `@hy/dsh-headless` | yes | The dsh one-shot bundle: a direct core Agent/Session runner over dsh-base with no Host, HTTP, or browser layer |
| `@hy/dsh-sdk-app` | yes | The dsh SDK profile bundle: stdio JSON-RPC serving and process lifecycle over dsh-base |
| `@hy/dsh-web-app` | yes | The dsh browser-surface bundle: the web patch layer over dsh-base plus the runtime glue plugin (frontend dist serving, bash runtime variables, URL line) |

## client

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-client-connection` | yes | Authenticated RPC transport and generation lifecycle |
| `@hy/dsh-client-file-upload` | no | Agent-scoped browser file upload, streaming intake, and staged receipt service |
| `@hy/dsh-client-hmr` | yes | Web client graph synchronization and rebuilt-bundle reload transport |
| `@hy/dsh-client-locale` | no | Locale plugin: Host-backed preference, extensible language catalog, browser fallback, and typed built-in dictionaries |
| `@hy/dsh-client-modules` | no | Client module system, dual-face: node half composes the __DSH_BOOT__ entry graph (incremental dsh.client scan, bundle route, index tap, webPlugins service); browser half is the lazy-CJS module table the vendored cordis Loader consumes as its internal seam |
| `@hy/dsh-client-product-analytics` | yes | Desktop product event collection and authenticated Host reporting |
| `@hy/dsh-client-resources` | no | Unified client resource model: protocol-registered providers turn URL addresses into live values, consumed through the useResource global standard hook |
| `@hy/dsh-client-shortcuts` | yes | Application keyboard command registry and physical-key routing |
| `@hy/dsh-client-ui-agent-preset` | no | Agent-preset surfaces: the default for later sessions, this session's seat, and the composition editor |
| `@hy/dsh-client-ui-approval` | no | Approval composer takeover over the scoped Remote Event waterfall |
| `@hy/dsh-client-ui-attachment` | no | Dynamic attachment presentation plugin for conversation input, message-image, and trajectory image slots |
| `@hy/dsh-client-ui-brand-official` | no | Official Huayu AI brand occupants for the Web client's sidebar slots |
| `@hy/dsh-client-ui-chat` | no | Chat Conversation target, node definitions, renderers, and details surface |
| `@hy/dsh-client-ui-commands` | no | Client command surface: global directory cache, '/' source, three command UI kinds, popupSelect registry |
| `@hy/dsh-client-ui-conversation` | no | Target-neutral Conversation assembly, shell, composer, queue, and view navigation |
| `@hy/dsh-client-ui-deliverables` | no | Changed-files card with per-file comparison tabs, delivery cards, and clickable final-response file references for Web |
| `@hy/dsh-client-ui-directory-picker-browse` | no | In-app directory browsing surface: the workspace directory-flow owner rendering the host's listing and creation primitives |
| `@hy/dsh-client-ui-directory-picker-native` | no | Native directory-picker surface: the renderless workspace directory-flow occupant driving the local Desktop or Host OS chooser |
| `@hy/dsh-client-ui-goal` | no | Session goal surface: GoalBar docked above the composer, read from the goal session projection |
| `@hy/dsh-client-ui-input-trigger` | no | Input trigger pipeline: '/' and '@' detection, candidate menu, pick routing to registered sources |
| `@hy/dsh-client-ui-jobs` | no | Session-header background-job list with on-demand streaming record panels |
| `@hy/dsh-client-ui-layout` | no | Shell plugin: three-column AppFrame with drag handles, ctx.layout viewing-state service (navigation + panels) |
| `@hy/dsh-client-ui-message-feedback` | no | The Web feedback surface: per-message Like/Dislike in the assistant-message action strip and the feedback dialog behind both ratings and /feedback, backed by the messageFeedback and sessionFeedback Host Remotes |
| `@hy/dsh-client-ui-model-selection` | no | Model selection over the shared model catalog, Session projection, and session.selectModel |
| `@hy/dsh-client-ui-open-in-app` | no | Web "Open In..." controls: the Session-header split button opening the workspace directory in an installed application, and the document preview's default-application controls for one file |
| `@hy/dsh-client-ui-permission-presets` | no | Permission surfaces: a new-session default in General settings and a current-session /permission popup over the permissions projection |
| `@hy/dsh-client-ui-plan` | no | Plan mode controls, persistent transcript plan cards, and sidebar Markdown previews |
| `@hy/dsh-client-ui-plugin-manager` | yes | Plugin management for the dsh web client: the sidebar Plugins panel installs, enables, disables, retries, and composes installed plugin packages |
| `@hy/dsh-client-ui-plugin-market` | no | Discover tab of the dsh web Plugins page: browse configured plugin market indexes and install their bundles |
| `@hy/dsh-client-ui-reference` | no | Unified Web @file and @session reference source |
| `@hy/dsh-client-ui-renderer` | no | Browser UI renderer: React slot bindings, ctx.uiRenderer, and the assembled application root |
| `@hy/dsh-client-ui-schedule` | no | Host task management page and Session reminder catalog |
| `@hy/dsh-client-ui-secret-mask` | no | Web display masking for recognized credentials in sent user text |
| `@hy/dsh-client-ui-session` | no | Session Controller adapter for React and session-scoped slots |
| `@hy/dsh-client-ui-settings` | no | Settings domain base plugin: shared configuration forms and the canonical settings slot-type contract |
| `@hy/dsh-client-ui-settings-account` | yes | Manage DeepSeek login and open Platform billing pages |
| `@hy/dsh-client-ui-settings-agent-loop` | no | Settings page of the agent loop on the dsh web client's Plugins page: the parallel tool-call cap of the agent-loop namespace |
| `@hy/dsh-client-ui-settings-general` | no | Settings ownerless-copy and product onboarding plugin: the General section, shell trigger/header chrome content, settings dictionaries, and the versioned welcome notice |
| `@hy/dsh-client-ui-settings-models` | yes | Models settings and shared product-onboarding dialogs over existing settings and credential joins |
| `@hy/dsh-client-ui-settings-plugin-inventory` | no | Read-only Cordis Loader inventory tab in Web Plugins settings |
| `@hy/dsh-client-ui-settings-plugins` | no | Built-in plugins settings section for the dsh web client: the Settings navigation entry and the tab chrome feature-owned tabs register into |
| `@hy/dsh-client-ui-settings-session-log` | no | General settings control for Session-log upload with DeepSeek API requests |
| `@hy/dsh-client-ui-settings-shell` | no | Settings page of the shell executor on the dsh web client's Plugins page: the command timeout and the per-stream output cap of the shell namespace |
| `@hy/dsh-client-ui-settings-subagent` | no | Settings page of Subagent delegation on the dsh web client's Plugins page: recursion depth, parallel capacity, and the models agents may choose for subagents |
| `@hy/dsh-client-ui-settings-web-search` | no | Settings page of the DeepSeek web-search provider on the dsh web client's Plugins page: its API key, endpoint, and per-request search budget |
| `@hy/dsh-client-ui-shortcuts` | no | Keyboard shortcut reference, recording, and local preference editing |
| `@hy/dsh-client-ui-sidebar` | no | Sidebar plugin: session multi-level tree, search, grouping, state dots |
| `@hy/dsh-client-ui-sidebar-browser` | no | Sandboxed Web browser tabs for the right Sidebar |
| `@hy/dsh-client-ui-sidebar-documentpreview` | yes | Extensible Sidebar previews for Office documents, spreadsheets, Markdown, code, images, PDF, HTML, and plain text |
| `@hy/dsh-client-ui-sidebar-files` | no | Workspace file tree tab type for the right Sidebar: lazy directory listing over the workspaceFiles Remote namespace, opening files into the Sidebar |
| `@hy/dsh-client-ui-sidebar-right` | no | Right Sidebar: the docking surface's session-bound state, its panel and header expand control, and the navigation service over it |
| `@hy/dsh-client-ui-sidebar-terminal` | no | Interactive shell tabs for the right Sidebar |
| `@hy/dsh-client-ui-skill` | no | Web skill references and the dedicated skill tool row |
| `@hy/dsh-client-ui-subagent` | no | Subagent conversation catalog, continuation routing UI, and '@' reference source |
| `@hy/dsh-client-ui-theme` | yes | Theme plugin: Host bootstrap for the pre-plugin palette; DOM-free ThemeRuntime for light/dark/system state; --dsw-* token styles and Appearance settings row |
| `@hy/dsh-client-ui-tool` | no | Client Tool call-tree renderer and keyed per-tool presentation slot |
| `@hy/dsh-client-ui-trajectory` | no | Trajectory event ledger with an interactive timing overview: pure-consumer plugin registering into the conversation ViewMap (no service) |
| `@hy/dsh-client-ui-user-questions` | no | Web ask_user_question composer takeover and plan-review presentation UI |
| `@hy/dsh-client-ui-workflow-run` | no | Durable workflow-run Conversation Node and nested member disclosure for dsh web |
| `@hy/dsh-client-ui-workspace` | no | Workspace picker plugin: one WorkspacePicker registered into the sidebar and empty-state workspace slots |

## compaction

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-command-compact` | no | Human-facing slash command for explicit session compaction |
| `@hy/dsh-compaction-basic` | yes | Token-meter-driven compaction policy and LLM summarization backend for the Huayu AI |
| `@hy/dsh-compaction-image-offload` | no | Durable image offload for image-capable routes: replace over-budget request images with placeholders and retry |
| `@hy/dsh-compaction-tool-result-pruner` | yes | Replay-safe model-free head/middle/tail pruning for tool-result surface nodes |

## computer-use

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-computer-use` | no | Exclusive named computer-use provider registration |

## context

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-agent-instructions` | yes | Workspace context loader for AGENTS.md/CLAUDE.md instruction files |
| `@hy/dsh-file-reference-local` | yes | Local-filesystem ctx.fileReferences provider with bounded fuzzy indexes |
| `@hy/dsh-harness-dev-context` | no | Model context naming the Huayu AI checkout and Web GUI URL without letting either change the system prompt |
| `@hy/dsh-session-reference` | yes | Cross-session snapshot references and durable untrusted model context (ctx.sessionReferenceResolver) |
| `@hy/dsh-time-context` | yes | Durable per-step context with the current time and elapsed time |
| `@hy/dsh-tmux-context` | yes | Opt-in durable per-step context with this agent's tmux pane and window location |

## core

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-agent` | no | Agent interface, registry, initiator scope, and event vocabulary for the Huayu AI |
| `@hy/dsh-agent-default-model` | yes | Default model selection shared by Agent entry points |
| `@hy/dsh-agent-loop` | yes | The concrete agent loop plugin for the Huayu AI |
| `@hy/dsh-agent-tool-presentation` | yes | Agent-plane presentation selector: composes one agent's tools as PTC mode or native tool calls |
| `@hy/dsh-session` | no | Event-sourced session store for the Huayu AI |
| `@hy/dsh-system-prompt` | yes | System prompt assembly registry for the Huayu AI |
| `@hy/dsh-tools` | yes | Tool registry and execution pipeline for the Huayu AI |

## credentials

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-authorization` | no | Authorization seam (ctx.authorization): plugin-owned flows that obtain a credential through a conversation with the human |
| `@hy/dsh-credentials-local` | yes | File-backed credentials provider ($DSH_HOME/.env under the live process environment) for the Huayu AI |
| `@hy/dsh-deepseek-account-platform` | yes | Authorize DeepSeek accounts through browser PKCE |

## deliverables

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-tool-present` | yes | Explicit workspace file delivery declarations for the Huayu AI |
| `@hy/dsh-workspace-changes` | yes | Per-turn workspace file changes recorded from git working-tree snapshots and whole-file captures, with per-file comparisons, for the Huayu AI |

## document

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-office-to-pdf` | yes | Shared Office-to-PDF conversion with bounded queues and caching |

## experimental

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-experimental-agent-team` | yes | Implicit-root Agent Teams roster, direct peer messaging, and shared task DAG |
| `@hy/dsh-experimental-api-speech-to-text` | yes | Authenticated experimental speech transcription for browser clients |
| `@hy/dsh-experimental-auto-review` | no | Per-tool LLM authorization review for the Huayu AI Auto permission preset |
| `@hy/dsh-experimental-browser-use-chrome-devtools-mcp` | yes | Experimental per-Session Chromium browser tools through chrome-devtools-mcp |
| `@hy/dsh-experimental-browser-use-playwright-mcp` | yes | Experimental per-Session Chromium browser tools through @playwright/mcp |
| `@hy/dsh-experimental-browser-use-stagehand-native` | yes | Experimental Stagehand browser tools with separately configured native models |
| `@hy/dsh-experimental-claude-code-mods` | yes | Experimental bridge: load Claude Code mods (hooks modules) and run their hook chains on Huayu AI extension points |
| `@hy/dsh-experimental-client-ui-agent-team` | no | Web Agent Teams roster, task board, and teammate navigation |
| `@hy/dsh-experimental-client-ui-claude-code-mods` | no | Web band above the prompt for Claude Code mods: draws each session's mod tree and sends button presses back to the bridge |
| `@hy/dsh-experimental-client-ui-cot-translation` | yes | Optional machine translation of expanded reasoning, preserving original Session text |
| `@hy/dsh-experimental-client-ui-voice-input` | no | Record speech and insert editable text into the conversation draft |
| `@hy/dsh-experimental-computer-use-cua-driver-mcp` | yes | Experimental computer use through an installed Cua Driver MCP executable |
| `@hy/dsh-experimental-computer-use-cua-driver-native` | no | Experimental computer-use provider embedding the Cua Driver native npm SDK |
| `@hy/dsh-experimental-cua-macos` | yes | macOS native provider for shared Computer Use application and window objects |
| `@hy/dsh-experimental-inspector` | yes | Experimental cross-realm CDP hub for Host debugging and Client Runtime inspection |
| `@hy/dsh-experimental-ptc-runtime-python` | yes | CPython subprocess implementation of the Huayu AI PTC execution seam |
| `@hy/dsh-experimental-session-inspector` | no | Experimental virtualized Session log and live Chat group/node inspectors |
| `@hy/dsh-experimental-speech-to-text` | yes | Experimental speech recognition with independently selectable providers |
| `@hy/dsh-experimental-speech-to-text-sensevoice` | yes | Local SenseVoice ONNX transcription with a managed sherpa-onnx process |
| `@hy/dsh-experimental-tool-agent-team` | yes | Scoped model-facing Agent Teams tools over ctx.agentTeams |
| `@hy/dsh-experimental-tool-worktree` | no | Model tool that creates and enters a new Git worktree |
| `@hy/dsh-experimental-translator` | yes | Machine translation with reusable Session results |
| `@hy/dsh-experimental-worktree` | yes | Creates a named Git worktree and changes the calling Session working directory |
| `@hy/dsh-hooks-claude-code` | yes | Bridge plugin: run a Claude Code hooks.json / settings hook config on the Huayu AI interception seams |
| `@hy/dsh-hooks-codex` | yes | Bridge plugin: run a Codex hooks.json hook config on the Huayu AI interception seams |
| `@hy/dsh-session-title-all-prompts-llm` | yes | All-user-messages LLM provider plugin for Huayu AI session titles |
| `@hy/dsh-skill-badge` | no | Bundled dsh badge skill provider for Huayu AI |
| `@hy/dsh-tool-ralph` | yes | Model-facing fresh-agent Ralph loop over the workflow and subagent seams |
| `@hy/dsh-tool-session-query` | yes | Workspace-authorized model-facing session history search, trace, and event read tools |
| `@hy/dsh-tool-terminal` | yes | Six model-facing persistent PTY tools with owner isolation and generic background-job integration |
| `@hy/dsh-webhook` | no | Fire-and-forget webhook rule runtime that creates Workspace-backed Huayu AI Sessions |
| `@hy/dsh-webhook-github` | yes | Signed GitHub HTTP webhook adapter for the Huayu AI webhook runtime |

## extensions

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-client-ui-cordis` | no | Cordis dynamic-plugin definition card: the keyed cordis_define tool row with its run/stop switch |
| `@hy/dsh-cordis-client-runner` | no | Browser half of dynamic dual-half plugin packages: event subscription, closure evaluation, guard facade, and loader entries |
| `@hy/dsh-cordis-host-runner` | yes | Dynamic package definition registry, host-half sandbox lifecycle, and invoke handler table for model-mounted dual-half packages |
| `@hy/dsh-tool-cordis` | no | Read-only runtime API inspection for Harness plugin development |

## feedback

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-command-feedback` | no | Log-only session feedback: the record event, the sessionFeedback Host Remote, and the human-facing slash command |
| `@hy/dsh-message-feedback` | yes | Canonical Session-log ratings and notes for finalized assistant messages |

## fs

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-fs-local` | yes | Local-filesystem implementation of the Huayu AI filesystem seam (ctx.fs) |
| `@hy/dsh-fs-observation-policy` | no | File-context policy plugin for the Huayu AI — observed-state, read-before-edit, and version-guarded write/edit added over the ctx.fs provider seam through the fs/* event gate (no service API) |
| `@hy/dsh-fs-sandbox` | yes | Sandbox-enforcing implementation of the Huayu AI filesystem seam: fences write/edit by the per-call sandbox mode (read-only denies mutation, workspace-write contains it to the workspace + temp roots) while reads pass through |
| `@hy/dsh-tool-fs` | yes | Model-facing filesystem tools (read, write, edit) over the Huayu AI filesystem seam (ctx.fs) |
| `@hy/dsh-tool-fs-search` | yes | Model-facing filesystem discovery tools (glob, grep) backed by the packaged ripgrep binary (@vscode/ripgrep) |
| `@hy/dsh-tool-str-replace-editor` | yes | Model-facing view, create, literal replace, and line insert tool over the Harness filesystem service |

## goal

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-command-goal` | no | Human-facing slash command for persisted same-session goals |
| `@hy/dsh-goal` | yes | Event-sourced same-session goal state and lifecycle service for the Huayu AI |
| `@hy/dsh-goal-round-driver` | no | Race-fenced same-session goal-round driver |
| `@hy/dsh-tool-goal` | yes | Model-facing same-session goal tools with execution-time authority checks |

## guard

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-repeat-tool-reminder` | yes | Repeat-tool-call guard plugin: advisory reminders when an agent loops on identical tool calls |
| `@hy/dsh-tool-call-timeout-policy` | no | Tool-call timeout policy: a tools/execute wrapper that arms a per-tool deadline on exec.signal and returns TOOL_TIMEOUT when it wins |

## host

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-host-directory-picker-auto` | no | Adaptive chooser of the directory-picker seam: resolves the host situation at boot and mounts the native or browse backend for the Huayu AI web GUI host |
| `@hy/dsh-host-directory-picker-browse` | yes | In-app browsing backend of the directory-picker seam (listing/creation primitives over the host filesystem) |
| `@hy/dsh-host-directory-picker-native` | no | Native-OS-chooser backend of the directory-picker seam for the Huayu AI web GUI host |
| `@hy/dsh-host-frontend-static` | yes | SPA dist server for the Web shell: owns the webserver fallback seat, serving explicit index entries and static assets with traversal rejection and 404 misses |
| `@hy/dsh-host-open-in-app` | yes | Host half of open-in-app: resolved application catalog, icons, and the launch endpoint as three webServer routes |
| `@hy/dsh-host-plugin-inventory` | no | Read-only Remote projection of current Cordis Loader plugin state |
| `@hy/dsh-host-product-telemetry-otel` | yes | Explicit product usage events exported through OpenTelemetry HTTP logs |
| `@hy/dsh-host-webserver` | yes | Web route-registration plugin: HTTP and upgrade routes, index transform taps, and static dist fallback; knows no harness concepts |

## interaction

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-commands` | no | Plugin-owned human command registry for Huayu AI UIs |
| `@hy/dsh-permission-presets` | yes | User-facing permission presets (ctx.permissionPresets) for the Huayu AI: one product-level Permissions select bundling the sandbox-mode and approval-policy knobs, written through to their own session events |
| `@hy/dsh-tool-ask-user` | yes | Model-facing ask_user_question tool over the ctx.userQuestions seam |
| `@hy/dsh-user-approval` | yes | User-approval seam (ctx.approval) for the Huayu AI: one-shot permission decisions dispatched to composed answerers over the approval/request waterfall, fail-closed by default |
| `@hy/dsh-user-questions` | no | Abstract user-questions seam (ctx.userQuestions) for asking the human during agent runs |

## jobs

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-jobs-local` | yes | Process-local implementation of the Huayu AI background job registry seam |
| `@hy/dsh-tool-jobs` | yes | Model-facing background job control tools (job_output, job_list, job_kill) over the ctx.jobs registry |

## llm

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-deepseek-llm-api-extensions` | no | Additive request-field registry for the official DeepSeek LLM API adapter |
| `@hy/dsh-llm` | no | Provider-neutral LLM service interface for the Huayu AI |
| `@hy/dsh-llm-deepseek-account` | yes | DeepSeek account provider authentication and discovery |
| `@hy/dsh-llm-deepseek-api-key` | yes | DeepSeek api-key provider authentication and discovery |
| `@hy/dsh-llm-pi-ai` | yes | pi-ai-backed DeepSeek adapter for the Huayu AI LLM seam (design-verification twin of dsh-llm-deepseek) |
| `@hy/dsh-llm-retry` | yes | Provider-routed LLM request retry policy for the Huayu AI |
| `@hy/dsh-plugin-package-inventory-deepseek` | yes | Active Loader-backed plugin package inventory for official DeepSeek LLM API requests |
| `@hy/dsh-token-meter` | yes | Replay-aware token measurement service (ctx.tokenMeter) for the Huayu AI |

## lsp

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-lsp` | no | Abstract LSP capability seam (ctx.lsp) for the Huayu AI — language-server provider registry keyed by branded id and extension mapping, order-independent per-query selection, normalized definition/references/implementation/hover requests and results, and the LspError taxonomy |
| `@hy/dsh-lsp-stdio` | yes | Generic stdio language-server provider for the Huayu AI LSP capability seam (ctx.lsp) — spawns configured servers, translates JSON-RPC, and serves transient-open goToDefinition/findReferences/goToImplementation/hover queries in the host filesystem namespace |
| `@hy/dsh-tool-lsp` | yes | Model-facing lsp tool over the Huayu AI LSP capability seam (ctx.lsp) — one read-only tool with goToDefinition/findReferences/goToImplementation/hover operations, one-based UTF-16 cursor coordinates, bounded location rendering, and hover normalization |

## mcp

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-mcp-client` | yes | MCP client bridge: connects to MCP servers and registers their tools on ctx.tools |
| `@hy/dsh-mcp-resources` | no | Scoped MCP resource discovery and reading through shared model tools |

## plan

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-plan-mode` | yes | Logged per-agent plan mode with deployment guidance, a direct slash command, and a user-reviewed exit |

## preset

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-agent-preset` | yes | Declare an Agent capability composition in Cordis YAML |
| `@hy/dsh-agent-preset-registry` | yes | Declarative Agent preset registry and profile-backed editing |
| `@hy/dsh-persona` | yes | Composition-authored deployment persona section for the Huayu AI |

## ptc-runtime

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-ptc-runtime-node` | yes | Node PTC execution with per-call sandboxed processes or in-memory REPL state |

## sandbox

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-sandbox-local` | yes | Local process-sandbox backends for the Huayu AI sandbox seam: bwrap, the npm-distributed landlock-run launcher, macOS Seatbelt, or the Windows ACL restricted-token runner — functionally probed, fail-closed |
| `@hy/dsh-sandbox-policy` | yes | Per-call sandbox policy resolver and current model context: deployment fallbacks plus each session's mode and workspace root, shared by every enforcing capability family |

## schedule

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-schedule` | yes | Host-wide durable reminders with shared management and original-Session delivery |
| `@hy/dsh-tool-schedule` | no | Model-facing reminder management tools (schedule_create, schedule_list, schedule_update, schedule_delete) over the Host ctx.schedule service |

## sdk

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-sdk-jsonrpc-server` | yes | Stdio JSON-RPC server plugin for out-of-process Huayu AI SDK clients |

## session

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-session-checkpoint-policy` | no | Semantic session durability checkpoints before model requests and tool side effects |
| `@hy/dsh-session-log-deepseek` | yes | Incremental lossless session-log request extension for the official DeepSeek LLM API |
| `@hy/dsh-session-persistence-jsonl` | yes | JSONL durable session persistence backend for the Huayu AI |
| `@hy/dsh-session-projection` | no | Session-projection seam: the merge-extensible projection type table, the provider contract, and the ctx.sessionProjections registry serving whole current values of log-derived per-session state |
| `@hy/dsh-session-projection-cache` | yes | Persisted projection cache (ctx.sessionProjectionCache): durable per-session checkpoint records on the session_projcache storage domain (per-record layout), throttled write-behind, and the cached listing read |
| `@hy/dsh-session-stats` | no | Whole-log conversation counts and wall times projection (sessionStats) for the Huayu AI |
| `@hy/dsh-session-telemetry-otel` | yes | Feedback-authorized Session logs over byte-bounded OpenTelemetry HTTP requests |
| `@hy/dsh-session-title` | yes | Log-backed session title service and provider registry for the Huayu AI |
| `@hy/dsh-session-title-first-prompt-llm` | yes | First-message LLM provider plugin for Huayu AI session titles |
| `@hy/dsh-session-turn-outline` | no | Whole-log turn outline projection (turnOutline) for the Huayu AI |
| `@hy/dsh-tool-working-directory` | no | Read and change the active Session working directory |
| `@hy/dsh-working-directory` | yes | Session working directories with durable changes and model context |

## session-query

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-session-log-export` | yes | Web Session-log export command and shared download dialog |
| `@hy/dsh-session-query-sqlite` | yes | Concrete ctx.sessionQuery backend with SQLite FTS5 search |

## settings

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-settings` | no | Abstract user-settings seam (ctx.settings) for the Huayu AI |

## shell

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-bash-local` | yes | Local-subprocess implementation of the Huayu AI bash executor seam |
| `@hy/dsh-bash-sandbox` | yes | Sandbox-consuming implementation of the Huayu AI bash executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@hy/dsh-pwsh-local` | yes | Local PowerShell implementation of the Huayu AI bash executor seam |
| `@hy/dsh-pwsh-sandbox` | yes | Sandbox-consuming implementation of the Huayu AI PowerShell executor seam (confines every command via ctx.sandbox, reports denial/enforcement result facts) |
| `@hy/dsh-shell-env` | yes | Tool-independent managed DSH_* shell environment registry |
| `@hy/dsh-tool-bash` | yes | Model-facing bash tool with optional generic background-job and sandbox-escalation support |
| `@hy/dsh-tool-bash-persistent` | yes | Model-facing owner-scoped persistent Bash tool backed by the Harness PTY service |
| `@hy/dsh-tool-pwsh` | yes | Model-facing pwsh tool over the bash executor seam |
| `@hy/dsh-tool-pwsh-persistent` | yes | Model-facing owner-scoped persistent PowerShell tool backed by the Harness PTY service |

## skill

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-skill` | yes | Agent skill provider registry for the Huayu AI |
| `@hy/dsh-skill-filesystem` | yes | Local filesystem skill provider for the Huayu AI |
| `@hy/dsh-skill-office` | yes | Bundled Word, PowerPoint, and Excel workflows and LibreOffice Kit operations |
| `@hy/dsh-tool-skill` | yes | Model-facing skill loading tool for the Huayu AI |
| `@hy/dsh-tool-workspace-dependencies` | yes | The load_workspace_dependencies tool: absolute paths into a bundled Python, Node.js, and pnpm payload |

## spill

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-spill-local` | yes | Local-filesystem implementation of the Huayu AI spill storage seam (private session-scoped files) |
| `@hy/dsh-spill-policy` | yes | Token-budgeted tool-result retention with recoverable text and image paths |

## ssh

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-fs-ssh` | no | Filesystem provider over the shared POSIX SSH helper |
| `@hy/dsh-sandbox-ssh` | no | Remote POSIX sandbox argv provider over the shared SSH helper |
| `@hy/dsh-ssh` | yes | Shared OpenSSH connection and versioned POSIX remote helper |
| `@hy/dsh-subprocess-ssh` | no | Subprocess and terminal provider over the shared POSIX SSH helper |

## storage

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-storage` | no | Storage hub (ctx.storage): named backend registry plus mounted data-form facilities for the Huayu AI |
| `@hy/dsh-storage-domain` | yes | Domain data form (ctx.storage.domain): schema-validated, event-emitting KV domains over storage backends for the Huayu AI |
| `@hy/dsh-storage-json` | yes | JSON file KV storage backend for the Huayu AI storage hub |
| `@hy/dsh-storage-sqlite` | yes | SQLite storage backend (kv facet) for the Huayu AI storage hub |

## subagent

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-subagent` | yes | Abstract subagent seam (ctx.subagents): named-provider registry for delegating to child agents |
| `@hy/dsh-subagent-acp` | yes | Out-of-process ACP subagent backend: drives a child agent in a spawned subprocess over the Agent Client Protocol |
| `@hy/dsh-subagent-claude-code` | yes | One-shot Claude Code subagent provider over the official Agent SDK |
| `@hy/dsh-subagent-codex` | yes | One-shot Codex subagent provider over the official app-server protocol |
| `@hy/dsh-subagent-dsh-sdk` | yes | Out-of-process SDK subagent backend: drives a child Huayu AI runtime subprocess over stdio JSON-RPC through the TypeScript SDK client |
| `@hy/dsh-subagent-fork-in-process` | yes | In-process fork subagent backend: runs a child agent seeded with a prefix of the parent's log |
| `@hy/dsh-subagent-spawn-in-process` | yes | In-process spawn subagent backend: runs a fresh child agent on ctx.agents |
| `@hy/dsh-tool-subagent` | yes | Model-facing subagent delegation tool over the ctx.subagents seam |
| `@hy/dsh-tool-subagent-control` | no | Globally named send_message, interrupt_agent, and list_agents tools over ctx.subagents continuations |

## subprocess

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-subprocess-local` | no | Local-subprocess implementation of the Huayu AI subprocess seam |

## telemetry

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-otel` | no | Cordis service for independent ordinary-event and byte-bounded Session-log OTLP channels |

## terminal

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-terminal` | no | Persistent PTY session seam for the Huayu AI — owner-scoped ids, backend registry, interactive sends, reads, signals, and awaited cleanup |
| `@hy/dsh-terminal-bash` | yes | Persistent shell PTY backend over the Huayu AI subprocess terminal primitive |

## test-support

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-llm-replay` | yes | Replay LLM plugin: short-circuits llm/stream with model chunks reconstructed from a recorded session JSONL (keyless snapshot tests) |

## todo

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-tool-todo` | yes | Model-facing todo_write tool over the Huayu AI event-sourced session log |

## typert

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-typert-loader` | yes | Loader integration for generated Typert package contributions |

## web

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-tool-web` | yes | Model-facing web tools (web_search, web_fetch) over the Huayu AI web capability seam (ctx.web) |
| `@hy/dsh-web` | yes | Abstract web access capability seam (ctx.web) for the Huayu AI — search/fetch provider registry, registration-order-independent selection, request/result vocabulary, and the WebError taxonomy |
| `@hy/dsh-web-fetch-http` | yes | Anonymous public HTTP(S) fetch provider for the Huayu AI web capability seam (ctx.web) |
| `@hy/dsh-web-search-deepseek` | yes | DeepSeek-backed search provider (native web_search via the Anthropic-compatible API) for the Huayu AI web capability seam (ctx.web) |
| `@hy/dsh-web-search-exa` | yes | Exa-backed search provider for the Huayu AI web capability seam (ctx.web) |
| `@hy/dsh-web-search-perplexity` | yes | Perplexity-backed search provider for the Huayu AI web capability seam (ctx.web) |

## workflow

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-tool-workflow` | yes | Model-facing workflow tool: run a JavaScript orchestration script over ctx.workflowEngine |
| `@hy/dsh-workflow-ptc` | yes | Workflow orchestration in the shared sandboxed Node PTC runtime |

## workspace

| Package | Config | Description |
|---|---|---|
| `@hy/dsh-workspace` | no | Workspace entity registry (ctx.workspaceRegistry): durable workspace records with validated session attachment over the domain data form for the Huayu AI |

vi.mock('../src/web-document.ts', () => ({
  authenticateWebHost: async () => 'test-cookie', serveWebDocument: vi.fn(), forwardWebRequest: vi.fn(), removeLegacyHostCookies: async () => {},
}))
/** TimeGleam onboarding connects the online workspace before the local workspace opens. */

import { afterEach, expect, it, vi } from 'vitest'
import type { BrowserWindowConstructorOptions } from 'electron'
import type { DesktopLocale } from '../src/locale.ts'
import type { WelcomeOperations } from '../src/welcome-api.ts'
import { TIMEGLEAM_DEFAULT_MODEL } from '../src/timegleam.ts'
import { DESKTOP_IPC } from '../src/ipc.ts'

const state = vi.hoisted(() => ({
  appListeners: new Map<string, (...args: unknown[]) => void>(),
  dialogLocale: undefined as (() => DesktopLocale) | undefined,
  beforeRead: vi.fn(async () => {}),
  beforeWelcome: vi.fn(async () => {}),
  openExternal: vi.fn(async () => {}),
  netFetch: vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(),
  quit: vi.fn(),
  startHost: vi.fn().mockResolvedValue({ url: 'http://127.0.0.1:3080/?token=test', injections: [] }),
  stopHost: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  loadWorkspace: vi.fn<(url: string) => Promise<void>>().mockResolvedValue(undefined),
  showWorkspace: vi.fn(),
  showInactiveWorkspace: vi.fn(),
  focusWorkspace: vi.fn(),
  moveTopWorkspace: vi.fn(),
  closeWelcome: vi.fn(),
  focusWelcome: vi.fn(),
  welcomeLocale: undefined as DesktopLocale | undefined,
  preference: 'zh',
  hasTimeGleamToken: false,
  storeTimeGleamToken: vi.fn(async () => {}),
  ensureTimeGleamModels: vi.fn(async () => {}),
  saveProviderKey: vi.fn(async () => {}),
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  listeners: new Map<string, (...args: unknown[]) => void>(),
  contents: undefined as { mainFrame: { url: string } } | undefined,
  windowOptions: undefined as BrowserWindowConstructorOptions | undefined,
  menu: vi.fn(),
  operations: undefined as WelcomeOperations | undefined,
  nativeTheme: { themeSource: 'system', shouldUseDarkColors: false },
}))

vi.mock('../src/crash-report.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/crash-report.ts')>(),
  writeCrashReport: vi.fn(async () => undefined),
  pruneCrashReports: vi.fn(async () => {}),
}))
vi.mock('electron', () => ({
  clipboard: { writeText: vi.fn() },
  shell: { openExternal: state.openExternal },
  net: { fetch: state.netFetch },
  app: {
    isPackaged: false,
    name: 'TimeGleam',
    requestSingleInstanceLock: () => true,
    setAsDefaultProtocolClient: vi.fn(),
    whenReady: () => Promise.resolve(),
    getLocale: () => 'en',
    getVersion: () => '1.0.0',
    setAboutPanelOptions: vi.fn(),
    getAppPath: () => '/development-app',
    getPath: (name: string) => name === 'userData' ? '/desktop-user-data' : `/development-${name}`,
    setAppLogsPath: vi.fn(),
    getPreferredSystemLanguages: () => ['en-US'],
    on: (name: string, callback: (...args: unknown[]) => void) => { state.appListeners.set(name, callback) },
    quit: state.quit,
    exit: vi.fn(),
  },
  powerMonitor: { on: vi.fn(), off: vi.fn() },
  BrowserWindow: class {
    constructor(options: BrowserWindowConstructorOptions) { state.windowOptions = options }
    private ready: (() => void) | undefined
    webContents = { mainFrame: { url: 'dsh-app://app/' }, setWindowOpenHandler: vi.fn(),
      on: vi.fn(), once: vi.fn(), send: vi.fn(), openDevTools: vi.fn() }
    static getAllWindows() { return [] }
    once(name: string, callback: () => void) { if (name === 'ready-to-show') this.ready = callback; return this }
    on() { return this }
    isDestroyed() { return false }
    isMinimized() { return false }
    restore = vi.fn()
    focus = state.focusWorkspace
    moveTop = state.moveTopWorkspace
    hide = vi.fn()
    show = state.showWorkspace
    showInactive = state.showInactiveWorkspace
    async loadURL(url: string) { state.contents = this.webContents; await state.loadWorkspace(url); this.ready?.() }
  },
  nativeTheme: state.nativeTheme,
  session: { defaultSession: {
    on: vi.fn(), cookies: {},
    setPermissionCheckHandler: vi.fn(), setPermissionRequestHandler: vi.fn(), webRequest: { onBeforeSendHeaders: vi.fn() },
  } },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
  ipcMain: {
    handle: (name: string, callback: (...args: unknown[]) => unknown) => { state.handlers.set(name, callback) },
    on: (name: string, callback: (...args: unknown[]) => void) => { state.listeners.set(name, callback) },
  },
  dialog: { showErrorBox: vi.fn(), showMessageBox: vi.fn() },
  Menu: { buildFromTemplate: state.menu, setApplicationMenu: vi.fn() },
  nativeImage: { createFromPath: (path: string) => ({ path }) },
}))
vi.mock('../src/tray.ts', () => ({ DesktopTray: class { relabel() {} dispose() {} } }))
vi.mock('../src/paths.ts', () => ({
  installDesktopUserDataRoot: () => '/user-data',
  resolveDesktopPaths: () => ({ profile: '/profile' }),
}))
vi.mock('../src/settings.ts', () => ({ readDesktopSettings: () => ({ updates: { allowTestAuthPopupWindow: false } }) }))
vi.mock('../src/login-shell-environment.ts', async importOriginal => ({
  ...await importOriginal<typeof import('../src/login-shell-environment.ts')>(),
  readDesktopLoginShellEnvironment: async (base: NodeJS.ProcessEnv) => ({ environment: base, failures: [] }),
}))
vi.mock('../src/project-manager.ts', () => ({ DesktopProjectManager: class {
  applyRelease = vi.fn(async () => {})
  canRecoverProfile = vi.fn(() => true)
} }))
vi.mock('../src/host-process.ts', () => ({
  DesktopHostProcess: class {
    start = state.startHost
    stop = state.stopHost
  },
}))
vi.mock('../src/welcome-backend.ts', () => ({
  connectDesktopWelcome: () => ({
    analyticsEnabled: async () => false,
    readLocalePreference: async () => state.preference,
    read: async () => {
      await state.beforeRead()
      return {
        loggedIn: false, hasApiKey: false, writable: false,
        hasTimeGleamToken: state.hasTimeGleamToken, timeGleamWritable: true, localePreference: state.preference,
      }
    },
    save: async () => ({ ok: true }),
    storeProviderKey: state.saveProviderKey,
    storeTimeGleamToken: state.storeTimeGleamToken,
    ensureModelConfiguration: async () => undefined,
    ensureTimeGleamModelConfiguration: state.ensureTimeGleamModels,
    account: { watch: () => () => {}, state: async () => ({ status: 'signed-out', attempt: null, links: { usageUrl: '', topUpUrl: '' } }) },
  }),
}))
vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(),
  readFile: vi.fn(async () => '{}'),
}))
vi.mock('../src/enterprise-gateway-key.ts', () => ({
  AIRGAP_GATEWAY_KEY_FILENAME: '.airgap-gateway-key',
  readGatewayKey: vi.fn(async () => undefined),
  gatewayKeyDirectories: vi.fn(() => []),
  readInstalledGatewayKey: vi.fn(async () => undefined),
  writeGatewayKey: vi.fn(async () => undefined),
}))
vi.mock('../src/update-dialog.ts', () => ({ DesktopUpdateDialog: class {
  constructor(_preload: string, locale: () => DesktopLocale) { state.dialogLocale = locale }
  dispose() {}
} }))
vi.mock('../src/update-coordinator.ts', () => ({ DesktopUpdateCoordinator: class {
  state = { phase: 'idle' }
  check = vi.fn(async () => this.state)
  dispose = vi.fn()
} }))
vi.mock('../src/welcome-window.ts', () => ({
  openWelcomeWindow: async (locale: DesktopLocale, operations: WelcomeOperations) => {
    state.welcomeLocale = locale
    state.operations = operations
    await state.beforeWelcome()
    return { once: vi.fn(), close: state.closeWelcome, isDestroyed: () => false,
      isMinimized: () => false, isVisible: () => true,
      show: vi.fn(), focus: state.focusWelcome, webContents: { send: vi.fn() } }
  },
}))

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubEnvironment(): void {
  vi.stubEnv('DSH_CLIENT_VERSION', '1.2.3')
  vi.stubEnv('DSH_DESKTOP_DEV_PROJECT_DIR', '/development-profile')
  vi.stubEnv('DSH_DESKTOP_NODE_BINARY', '/runtime/node')
  vi.stubEnv('DSH_DESKTOP_PNPM_ENTRY', '/runtime/pnpm')
  vi.stubEnv('DSH_DESKTOP_DSH_DIR', '/runtime/dsh')
  vi.stubEnv('DSH_DESKTOP_PRIMARY_RUNTIME_DIR', '/runtime/primary-runtime')
  vi.stubEnv('DSH_DESKTOP_HOST_INSPECT_PORT', undefined)
  vi.stubEnv('DSH_DESKTOP_OPEN_DEVTOOLS', '0')
  vi.stubEnv('DSH_DESKTOP_MANDATORY_UPDATE_CONFIG', undefined)
  vi.stubEnv('DSH_DESKTOP_UPDATE_JOURNAL_DIR', undefined)
}

async function launch(): Promise<void> {
  vi.resetModules()
  vi.clearAllMocks()
  state.operations = undefined
  state.hasTimeGleamToken = false
  state.preference = 'zh'
  stubEnvironment()
  const reading = Promise.withResolvers<undefined>()
  const loading = Promise.withResolvers<undefined>()
  state.beforeRead.mockReturnValueOnce(reading.promise)
  state.beforeWelcome.mockReturnValueOnce(loading.promise)
  await import('../src/main.ts')
  await vi.waitFor(() => { expect(state.beforeRead).toHaveBeenCalledOnce() })
  reading.resolve(undefined)
  await vi.waitFor(() => { expect(state.beforeWelcome).toHaveBeenCalledOnce() })
  loading.resolve(undefined)
  await vi.waitFor(() => { expect(state.operations).toBeDefined() })
}

it('connects the TimeGleam workspace with one validated access key', async () => {
  await launch()
  expect(state.startHost).toHaveBeenCalledOnce()
  expect(state.loadWorkspace).toHaveBeenCalledExactlyOnceWith('dsh-app://app/')
  expect(state.showWorkspace).not.toHaveBeenCalled()
  expect(state.welcomeLocale).toMatchObject({ id: 'zh-CN' })
  expect(state.dialogLocale!().id).toBe('zh-CN')
  const operations = state.operations!
  expect(await operations.takeNotice()).toBeUndefined()

  await operations.openConsole()
  expect(state.openExternal).toHaveBeenCalledExactlyOnceWith('https://timegleam.com/?account=security')
  await operations.openConsole()
  expect(state.openExternal).toHaveBeenCalledTimes(2)

  expect(await operations.saveApiKey('sk-not-a-key')).toEqual({ ok: false, reason: 'format' })
  expect(state.netFetch).not.toHaveBeenCalled()

  state.netFetch.mockResolvedValueOnce(new Response('{"error":"invalid_token"}', { status: 401 }))
  expect(await operations.saveApiKey('tmg_revoked')).toEqual({ ok: false, reason: 'invalid' })
  expect(state.storeTimeGleamToken).not.toHaveBeenCalled()
  expect(state.showWorkspace).not.toHaveBeenCalled()

  state.netFetch.mockRejectedValueOnce(new Error('offline'))
  expect(await operations.saveApiKey('tmg_offline')).toEqual({ ok: false, reason: 'unreachable' })
  expect(state.storeTimeGleamToken).not.toHaveBeenCalled()

  state.netFetch.mockResolvedValueOnce(Response.json({ jsonrpc: '2.0', id: 1, result: {} }))
  expect(await operations.saveApiKey('tmg_live-key')).toEqual({ ok: true })
  expect(state.netFetch).toHaveBeenLastCalledWith('https://timegleam.com/mcp', expect.objectContaining({ method: 'POST' }))
  expect(state.storeTimeGleamToken).toHaveBeenCalledExactlyOnceWith('tmg_live-key')
  expect(state.showWorkspace).toHaveBeenCalledOnce()
  expect(state.closeWelcome).toHaveBeenCalledOnce()

  const contents = state.contents as { mainFrame: { url: string }; send: ReturnType<typeof vi.fn> }
  expect(contents.send).toHaveBeenCalledWith(DESKTOP_IPC.enterWorkspace)
  const event = { sender: contents, senderFrame: contents.mainFrame }
  const bootstrap = state.handlers.get(DESKTOP_IPC.localeBootstrap)!
  expect(await bootstrap(event)).toEqual({ languages: ['en-US'], preference: 'zh' })
  state.preference = 'en'
  expect(await bootstrap(event)).toEqual({ languages: ['en-US'], preference: 'en' })
  const changed = state.listeners.get(DESKTOP_IPC.localeChanged)!
  const initialMenus = state.menu.mock.calls.length
  changed({ ...event, senderFrame: {} }, 'en')
  changed(event, 42)
  expect(state.menu).toHaveBeenCalledTimes(initialMenus)
  changed(event, 'en')
  expect(state.dialogLocale!().id).toBe('en')
  expect(state.menu).toHaveBeenCalledTimes(initialMenus + 1)
})

it('lets the user defer access-key setup and still enter the local workspace', async () => {
  await launch()
  await state.operations!.skip()
  expect(state.storeTimeGleamToken).not.toHaveBeenCalled()
  expect(state.loadWorkspace).toHaveBeenCalledExactlyOnceWith('dsh-app://app/')
  expect(state.showWorkspace).toHaveBeenCalledOnce()
  expect(state.closeWelcome).toHaveBeenCalledOnce()
})

it('signs in through timegleam.com, stores the issued key, and seeds its models', async () => {
  await launch()
  const operations = state.operations!
  state.netFetch
    .mockResolvedValueOnce(Response.json({ token: '0123456789abcdef0123456789abcdef', expires_in: 600 }))
    .mockResolvedValueOnce(Response.json({ status: 'done', key: 'tmg_browser-issued', workspace_id: 'ws-1' }))
    .mockResolvedValueOnce(Response.json({ jsonrpc: '2.0', id: 1, result: {} }))
    .mockResolvedValueOnce(Response.json({ object: 'list', data: [{ id: 'deepseek-chat', owned_by: 'DeepSeek' }] }))
  await expect(operations.signIn()).resolves.toEqual({ ok: true })
  const urls = state.netFetch.mock.calls.map(([input]) => input)
  expect(urls).toEqual([
    'https://timegleam.com/api/desktop/login/start',
    'https://timegleam.com/api/desktop/login/poll',
    'https://timegleam.com/mcp',
    'https://timegleam.com/api/llm/v1/models',
  ])
  const pollBody = state.netFetch.mock.calls[1]?.[1]?.body
  if (typeof pollBody !== 'string') throw new Error('the poll request must send a JSON string body')
  expect(JSON.parse(pollBody)).toEqual({ token: '0123456789abcdef0123456789abcdef' })
  expect(state.openExternal).toHaveBeenCalledWith('https://timegleam.com/?desktop_login=0123456789abcdef0123456789abcdef')
  expect(state.storeTimeGleamToken).toHaveBeenCalledExactlyOnceWith('tmg_browser-issued')
  expect(state.ensureTimeGleamModels)
    .toHaveBeenCalledExactlyOnceWith([{ id: 'deepseek-chat', name: 'DeepSeek' }], TIMEGLEAM_DEFAULT_MODEL)
  expect(state.showWorkspace).toHaveBeenCalledOnce()
})

it('keeps the stored key usable when the model list cannot be read', async () => {
  await launch()
  const operations = state.operations!
  state.netFetch
    .mockResolvedValueOnce(Response.json({ token: '0123456789abcdef0123456789abcdef', expires_in: 600 }))
    .mockResolvedValueOnce(Response.json({ status: 'done', key: 'tmg_browser-issued', workspace_id: 'ws-1' }))
    .mockResolvedValueOnce(Response.json({ jsonrpc: '2.0', id: 1, result: {} }))
    .mockRejectedValueOnce(new Error('proxy unavailable'))
  await expect(operations.signIn()).resolves.toEqual({ ok: true })
  expect(state.storeTimeGleamToken).toHaveBeenCalledExactlyOnceWith('tmg_browser-issued')
  expect(state.ensureTimeGleamModels).not.toHaveBeenCalled()
  expect(state.showWorkspace).toHaveBeenCalledOnce()
})

it('reports a refused sign-in without storing a key', async () => {
  await launch()
  const operations = state.operations!
  state.netFetch
    .mockResolvedValueOnce(Response.json({ token: '0123456789abcdef0123456789abcdef', expires_in: 600 }))
    .mockResolvedValueOnce(Response.json({ status: 'done', key: 'tmg_revoked', workspace_id: 'ws-1' }))
    .mockResolvedValueOnce(new Response('{}', { status: 401 }))
  await expect(operations.signIn()).resolves.toEqual({ ok: false, reason: 'invalid' })
  expect(state.storeTimeGleamToken).not.toHaveBeenCalled()
  expect(state.showWorkspace).not.toHaveBeenCalled()
})

it('reports a failed sign-in start and a cancelled wait', async () => {
  await launch()
  const operations = state.operations!
  state.netFetch.mockResolvedValueOnce(new Response(null, { status: 502 }))
  await expect(operations.signIn()).resolves.toEqual({ ok: false, reason: 'network' })
  expect(state.storeTimeGleamToken).not.toHaveBeenCalled()
  expect(state.ensureTimeGleamModels).not.toHaveBeenCalled()
})

it('refuses to copy a sign-in link when no attempt is waiting', async () => {
  await launch()
  await expect(state.operations!.copySignInLink()).rejects.toThrow('no pending sign-in')
})

it('skips onboarding when a TimeGleam access key is already stored', async () => {
  vi.resetModules()
  vi.clearAllMocks()
  state.preference = 'en'
  state.hasTimeGleamToken = true
  stubEnvironment()
  await import('../src/main.ts')
  await vi.waitFor(() => { expect(state.showWorkspace).toHaveBeenCalledOnce() })
  expect(state.beforeWelcome).not.toHaveBeenCalled()
  expect(state.storeTimeGleamToken).not.toHaveBeenCalled()
})

it('routes only TimeGleam deep links without trusting arbitrary URLs', async () => {
  await launch()
  state.openExternal.mockClear()
  state.focusWelcome.mockClear()
  state.appListeners.get('open-url')!({ preventDefault: vi.fn() }, 'timegleam://open')
  expect(state.focusWelcome).toHaveBeenCalledOnce()
  state.appListeners.get('open-url')!({ preventDefault: vi.fn() }, 'dsh://open')
  expect(state.focusWelcome).toHaveBeenCalledTimes(2)
  state.appListeners.get('open-url')!({ preventDefault: vi.fn() }, 'timegleam://project/p-1')
  await vi.waitFor(() => {
    expect(state.openExternal).toHaveBeenCalledExactlyOnceWith('https://timegleam.com/?project=p-1')
  })
  for (const link of [
    'timegleam://project/', 'timegleam://project/bad%20id', 'timegleam://open?x=1',
    'timegleam://project/p-1/extra', 'https://timegleam.com/?project=p-1', 'timegleam://project/../../etc',
  ]) {
    state.appListeners.get('open-url')!({ preventDefault: vi.fn() }, link)
  }
  await Promise.resolve()
  expect(state.openExternal).toHaveBeenCalledOnce()
})

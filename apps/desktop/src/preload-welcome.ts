/** Localized welcome copy and write-only credential actions. */

import { contextBridge, ipcRenderer } from 'electron'
import { resolveDesktopLocale } from './locale.ts'
import {
  WELCOME_IPC, type WelcomeApi, type WelcomeLoginState, type WelcomeNotice, type WelcomeSaveResult,
  type WelcomeSignInResult,
} from './welcome-api.ts'

const prefix = '--dsh-welcome-locale='
const locale = process.argv.find(argument => argument.startsWith(prefix))?.slice(prefix.length)
if (locale === undefined) throw new Error('desktop welcome: missing window locale')
const enterprise = process.argv.includes('--dsh-welcome-enterprise=1')
const api: WelcomeApi = {
  ...resolveDesktopLocale(locale),
  enterprise,
  analytics: async (eventName, attributes) => {
    if (await api.analyticsEnabled()) await ipcRenderer.invoke(WELCOME_IPC.analytics, eventName, attributes)
  },
  analyticsEnabled: () => ipcRenderer.invoke(WELCOME_IPC.analyticsEnabled) as Promise<boolean>,
  takeNotice: () => ipcRenderer.invoke(WELCOME_IPC.takeNotice) as Promise<WelcomeNotice | undefined>,
  saveApiKey: (value: string) => ipcRenderer.invoke(WELCOME_IPC.saveApiKey, value) as Promise<WelcomeSaveResult>,
  openConsole: () => ipcRenderer.invoke(WELCOME_IPC.openConsole) as Promise<void>,
  signIn: () => ipcRenderer.invoke(WELCOME_IPC.signIn) as Promise<WelcomeSignInResult>,
  cancelSignIn: () => ipcRenderer.invoke(WELCOME_IPC.cancelSignIn) as Promise<void>,
  copySignInLink: () => ipcRenderer.invoke(WELCOME_IPC.copySignInLink) as Promise<void>,
  onLoginState: (listener) => {
    const receive = (_event: Electron.IpcRendererEvent, state: WelcomeLoginState): void => { listener(state) }
    ipcRenderer.on(WELCOME_IPC.loginState, receive)
    return () => { ipcRenderer.removeListener(WELCOME_IPC.loginState, receive) }
  },
  skip: () => ipcRenderer.invoke(WELCOME_IPC.skip) as Promise<void>,
}
contextBridge.exposeInMainWorld('dshWelcome', api)

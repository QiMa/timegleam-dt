import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DESKTOP_USER_DATA_DIR_ENV,
  DESKTOP_USER_DATA_DIR_NAME,
  installDesktopUserDataRoot,
  resolveDesktopPaths,
  type DesktopUserDataPaths,
} from '../src/paths.ts'

afterEach(() => {
  vi.unstubAllEnvs()
})

function electronPaths(appData: string, userData: string): DesktopUserDataPaths & { readonly writes: [string, string][] } {
  const writes: [string, string][] = []
  return {
    name: '@hy/dsh-desktop',
    writes,
    getPath: (name: 'appData' | 'userData') => name === 'appData' ? appData : userData,
    setPath: (name: 'userData' | 'sessionData', path: string) => { writes.push([name, path]) },
  }
}

describe('desktop user data root', () => {
  it('moves the package-name default under the product directory', () => {
    const appData = join('C:', 'Users', 'a', 'AppData', 'Roaming')
    const app = electronPaths(appData, join(appData, '@hy', 'dsh-desktop'))

    expect(installDesktopUserDataRoot(app)).toBe(join(appData, DESKTOP_USER_DATA_DIR_NAME))
    expect(app.writes).toEqual([
      ['userData', join(appData, DESKTOP_USER_DATA_DIR_NAME)],
      ['sessionData', join(appData, DESKTOP_USER_DATA_DIR_NAME)],
    ])
  })

  it('keeps a root that a bootstrap already redirected', () => {
    const app = electronPaths(join('C:', 'AppData'), join('C:', 'qualification', 'user-data'))

    expect(installDesktopUserDataRoot(app)).toBe(join('C:', 'qualification', 'user-data'))
    expect(app.writes).toEqual([])
  })

  it('honours an explicit user-data directory and ignores a blank one', () => {
    const appData = join('C:', 'AppData')
    const configured = electronPaths(appData, join(appData, '@hy', 'dsh-desktop'))
    vi.stubEnv(DESKTOP_USER_DATA_DIR_ENV, join('D:', 'TimeGleam Data'))
    expect(installDesktopUserDataRoot(configured)).toBe(resolve(join('D:', 'TimeGleam Data')))

    vi.stubEnv(DESKTOP_USER_DATA_DIR_ENV, '   ')
    const blank = electronPaths(appData, join(appData, '@hy', 'dsh-desktop'))
    expect(installDesktopUserDataRoot(blank)).toBe(join(appData, DESKTOP_USER_DATA_DIR_NAME))
  })
})

describe('resolveDesktopPaths', () => {
  it('derives the desktop profile from the TimeGleam home', () => {
    expect(resolveDesktopPaths(join('C:', 'home'))).toEqual({
      profile: join('C:', 'home', 'profiles', 'desktop'),
      lock: join('C:', 'home', 'profiles', 'desktop', 'lock'),
    })
  })
})

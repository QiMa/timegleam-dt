/** Filesystem ownership for the Electron-managed desktop installation. */

import { join, resolve } from 'node:path'
import { resolveDshHome } from '@hy/dsh-home-paths'

/** Directory name of the Electron user-data root under the platform application-data directory. */
export const DESKTOP_USER_DATA_DIR_NAME = 'timegleam'

/** Environment variable that relocates the Electron user-data root; qualification runs pin it. */
export const DESKTOP_USER_DATA_DIR_ENV = 'DSH_DESKTOP_USER_DATA_DIR'

/** Subset of Electron's path API needed to relocate user data before app readiness. */
export interface DesktopUserDataPaths {
  readonly name: string
  getPath(name: 'appData' | 'userData'): string
  setPath(name: 'userData' | 'sessionData', path: string): void
}

/**
 * Move Electron user data from the package-name default to {@link DESKTOP_USER_DATA_DIR_NAME}.
 *
 * Electron derives `userData` from the package name, which is `@hy/dsh-desktop`.
 * A caller that already redirected it — an installed-update qualification
 * bootstrap or `--user-data-dir` — keeps that root, and
 * {@link DESKTOP_USER_DATA_DIR_ENV} relocates it for isolation.
 * @param app - Electron path API, before app readiness.
 * @returns the user-data root in effect.
 */
export function installDesktopUserDataRoot(app: DesktopUserDataPaths): string {
  const current = app.getPath('userData')
  const defaultRoot = join(app.getPath('appData'), app.name)
  if (resolve(current) !== resolve(defaultRoot)) return current
  const configured = process.env[DESKTOP_USER_DATA_DIR_ENV]?.trim()
  const root = resolve(configured === undefined || configured === ''
    ? join(app.getPath('appData'), DESKTOP_USER_DATA_DIR_NAME)
    : configured)
  app.setPath('userData', root)
  app.setPath('sessionData', root)
  return root
}

/** Stable desktop installation paths under the shared Harness home. */
export interface DesktopPaths {
  readonly profile: string
  readonly lock: string
}

/**
 * Resolve every Electron-owned path without changing the data roots.
 * @param dshHome - TimeGleam home shared with the CLI runtime.
 * @returns immutable desktop path set.
 */
export function resolveDesktopPaths(dshHome: string = resolveDshHome()): DesktopPaths {
  return {
    profile: join(dshHome, 'profiles', 'desktop'),
    lock: join(dshHome, 'profiles', 'desktop', 'lock'),
  }
}

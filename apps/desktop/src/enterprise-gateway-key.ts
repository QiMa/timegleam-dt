/** Optional AirGap-issued provider key stored beside the installed application. */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join, normalize } from 'node:path'

/** Basename the install scripts write beside the packaged manifest. */
export const AIRGAP_GATEWAY_KEY_FILENAME = '.airgap-gateway-key'

/**
 * A key is ASCII printable text with no whitespace, mirroring the credential
 * validation used by the welcome form and the credential seam.
 * @param value - candidate provider key.
 * @returns whether the value can be stored and submitted.
 */
export function validGatewayKey(value: string): boolean {
  return value.length > 0 && /^[\x21-\x7e]+$/u.test(value)
}

/**
 * Read an install-script-written key from the application install directory.
 * Development launches have no installer beside them, so they never read one.
 * @param installDir - Installer root beside the application executable.
 * @returns the validated key, or undefined when absent or malformed.
 */
export async function readGatewayKey(installDir: string): Promise<string | undefined> {
  const path = join(installDir, AIRGAP_GATEWAY_KEY_FILENAME)
  if (!existsSync(path)) return undefined
  try {
    const value = (await readFile(path, 'utf8')).trim()
    return validGatewayKey(value) ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Directories that may hold the installer-written key, most specific first.
 *
 * A packed app normally keeps it one level above `resources/`. An AppImage is
 * the exception: that directory is the read-only squashfs mount, so the key an
 * installer writes beside the `.AppImage` file is invisible from there. The
 * launcher exports `APPIMAGE` with the real path, which is what an installer
 * actually targets.
 * @param appImage - Value of `process.env.APPIMAGE`, when the runtime sets it.
 * @param resourcesPath - `process.resourcesPath` of the running app.
 * @returns Candidate directories in lookup order.
 */
export function gatewayKeyDirectories(appImage: string | undefined, resourcesPath: string): string[] {
  const packaged = normalize(join(resourcesPath, '..'))
  const fromImage = appImage === undefined || appImage === '' ? undefined : dirname(appImage)
  return fromImage === undefined || fromImage === packaged ? [packaged] : [fromImage, packaged]
}

/**
 * Read the first valid key from the candidate install directories.
 * @param directories - Directories from `gatewayKeyDirectories`.
 * @returns the validated key, or undefined when none exists.
 */
export async function readInstalledGatewayKey(directories: readonly string[]): Promise<string | undefined> {
  for (const directory of directories) {
    const value = await readGatewayKey(directory)
    if (value !== undefined) return value
  }
  return undefined
}

/**
 * Write an AirGap-issued key beside the installed application. A failed write
 * rejects instead of reporting a credential the workspace never received.
 * @param installDir - Installer root beside the application executable.
 * @param value - provider key to persist.
 */
export async function writeGatewayKey(appPath: string, value: string): Promise<void> {
  if (!validGatewayKey(value)) throw new Error('desktop enterprise gateway: invalid API key')
  await writeFile(join(appPath, AIRGAP_GATEWAY_KEY_FILENAME), `${value}\n`, { encoding: 'utf8', mode: 0o600 })
}

/** Optional AirGap-issued provider key stored beside the installed application. */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

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
 * Write an AirGap-issued key beside the installed application. A failed write
 * rejects instead of reporting a credential the workspace never received.
 * @param installDir - Installer root beside the application executable.
 * @param value - provider key to persist.
 */
export async function writeGatewayKey(appPath: string, value: string): Promise<void> {
  if (!validGatewayKey(value)) throw new Error('desktop enterprise gateway: invalid API key')
  await writeFile(join(appPath, AIRGAP_GATEWAY_KEY_FILENAME), `${value}\n`, { encoding: 'utf8', mode: 0o600 })
}

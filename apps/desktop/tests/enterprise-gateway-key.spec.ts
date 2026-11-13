import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, normalize } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  AIRGAP_GATEWAY_KEY_FILENAME,
  gatewayKeyDirectories,
  readInstalledGatewayKey,
} from '../src/enterprise-gateway-key.ts'

const created: string[] = []

async function scratch(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'airgap-key-'))
  created.push(dir)
  return dir
}

afterEach(async () => {
  for (const dir of created.splice(0)) await rm(dir, { recursive: true, force: true })
})

describe('installer gateway key lookup', () => {
  it('reads the key beside the packaged resources', async () => {
    const root = await scratch()
    const resources = join(root, 'resources')
    await mkdir(resources, { recursive: true })
    await writeFile(join(root, AIRGAP_GATEWAY_KEY_FILENAME), 'ag-install-dir\n')
    expect(await readInstalledGatewayKey(gatewayKeyDirectories(undefined, resources))).toBe('ag-install-dir')
  })

  it('prefers the AppImage directory because the squashfs mount is read-only', async () => {
    const root = await scratch()
    const resources = join(root, 'resources')
    await mkdir(resources, { recursive: true })
    const appImage = join(root, 'timegleam.AppImage')
    await writeFile(appImage, '')
    await writeFile(join(root, AIRGAP_GATEWAY_KEY_FILENAME), 'ag-beside-appimage\n')
    const directories = gatewayKeyDirectories(appImage, resources)
    expect(directories[0]).toBe(root)
    expect(directories).toEqual([root])
  })

  it('ignores a malformed key and reports undefined when nothing is readable', async () => {
    const root = await scratch()
    const resources = join(root, 'resources')
    await mkdir(resources, { recursive: true })
    await writeFile(join(root, AIRGAP_GATEWAY_KEY_FILENAME), 'has space inside\n')
    expect(await readInstalledGatewayKey(gatewayKeyDirectories('', resources))).toBeUndefined()
    expect(gatewayKeyDirectories('', resources)).toEqual([root])
  })

  it('keeps the AppImage directory even when it is not above resources', () => {
    const resources = join(tmpdir(), 'mount', 'resources')
    expect(gatewayKeyDirectories(join(tmpdir(), 'timegleam', 'timegleam.AppImage'), resources))
      .toEqual([join(tmpdir(), 'timegleam'), normalize(join(resources, '..'))])
  })
})

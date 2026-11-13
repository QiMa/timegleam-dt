import { Buffer } from 'node:buffer'
import { Context } from '@hy/cordis'
import AttachmentStore, {
  AttachmentError,
  AttachmentId,
  type ImageAttachmentLimits,
  type ImageAttachmentRef,
  type SaveImageAttachment,
  type StoredImageAttachment,
} from '@hy/dsh-attachment'
import { CredentialProvider } from '@hy/dsh-credentials'
import ToolRuntime from '@hy/dsh-tools'
import SystemPrompt from '@hy/dsh-system-prompt'
import type {
  CredentialInfo,
  CredentialKey,
  CredentialRecord,
  CredentialRecordEntry,
  CredentialRecordInfo,
  CredentialRef,
  ResolvedCredential,
} from '@hy/dsh-credentials'
import { describe, expect, it, vi } from 'vitest'
import {
  applyTimeGleamImageTools,
  generateTimeGleamImage,
  listTimeGleamImageModels,
} from '../src/image-tool.ts'
import { IMAGE_MODELS_URL, IMAGE_URL, PNG_1X1 } from './image-fixtures.ts'

/** One-key credential provider: the stored TimeGleam access key. */
class KeyStore extends CredentialProvider {
  private readonly key: string | undefined

  constructor(ctx: Context, key: string | undefined) {
    super(ctx)
    this.key = key
  }

  override resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    void ref
    return Promise.resolve(this.key === undefined ? undefined : { value: this.key, source: 'test' })
  }

  override describe(_ref: CredentialRef): Promise<CredentialInfo> {
    return Promise.resolve({ configured: this.key !== undefined, writable: true })
  }

  override set(_ref: CredentialRef, _value: string): Promise<void> {
    return Promise.resolve()
  }

  override unset(_ref: CredentialRef): Promise<void> {
    return Promise.resolve()
  }

  override readRecord(_key: CredentialKey): Promise<CredentialRecord | undefined> {
    return Promise.resolve(undefined)
  }

  override describeRecord(_key: CredentialKey): Promise<CredentialRecordInfo> {
    return Promise.resolve({ configured: false, writable: true })
  }

  override listRecords(): Promise<readonly CredentialRecordEntry[]> {
    return Promise.resolve([])
  }

  override modifyRecord(
    _key: CredentialKey,
    _mutate: (current: CredentialRecord | undefined) => Promise<CredentialRecord | undefined>,
  ): Promise<CredentialRecord | undefined> {
    return Promise.resolve(undefined)
  }

  override deleteRecord(_key: CredentialKey): Promise<void> {
    return Promise.resolve()
  }
}

/** Attachment store that records what the tool saved. */
class RecordingImages extends AttachmentStore {
  readonly saved: SaveImageAttachment[] = []
  readonly imageLimits: ImageAttachmentLimits = Object.freeze({
    maxImageBytes: 4096,
    maxImagesPerMessage: 4,
    maxMessageImageBytes: 16_384,
    maxImagePixels: 4_000_000,
    maxImageDimension: 4096,
    mediaTypes: Object.freeze(['image/png', 'image/jpeg'] as const),
  })

  validateImage(): Promise<void> {
    return Promise.resolve()
  }

  saveImage(input: SaveImageAttachment): Promise<ImageAttachmentRef> {
    if (input.data.byteLength > this.imageLimits.maxImageBytes) {
      return Promise.reject(new AttachmentError('too large', 'IMAGE_TOO_LARGE'))
    }
    this.saved.push(input)
    return Promise.resolve({
      attachmentId: AttachmentId(`sha256:${String(this.saved.length).padStart(64, '0')}`),
      mediaType: input.mediaType,
      bytes: input.data.byteLength,
      width: 1,
      height: 1,
      ...input.name === undefined ? {} : { name: input.name },
    })
  }

  readImage(_ref: ImageAttachmentRef): Promise<StoredImageAttachment> {
    throw new Error('not used')
  }
}

async function bench(key: string | null = 'tmg_test') {
  const ctx = new Context()
  await ctx.plugin(KeyStore, key === null ? undefined : key)
  await ctx.plugin(RecordingImages)
  const images = ctx.get('attachments') as RecordingImages
  return { ctx, images }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
}

/** Absolute URL a recorded request went to. */
function requestedUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

/** JSON body of a recorded request, after proving the tool sent a string. */
function requestedJson(init: RequestInit | undefined): unknown {
  const body = init?.body
  if (typeof body !== 'string') throw new Error('the tool must send a JSON string body')
  return JSON.parse(body)
}

const signal = new AbortController().signal

describe('timegleam image catalog', () => {
  it('lists granted models with the stored key and deduplicates ids', async () => {
    const { ctx } = await bench()
    const send = vi.fn<typeof fetch>(async () => json({
      data: [
        { id: 'alias-a::doubao-seedream-5-0-pro', owned_by: 'Ark A' },
        { id: 'alias-a::doubao-seedream-5-0-pro', owned_by: 'Ark A' },
        { id: 'doubao-seedream-5-0-flash', owned_by: 'Ark T' },
      ],
    }))
    const value = await listTimeGleamImageModels(ctx, signal, { fetch: send })
    expect(value.models).toEqual([
      { id: 'alias-a::doubao-seedream-5-0-pro', name: 'Ark A' },
      { id: 'doubao-seedream-5-0-flash', name: 'Ark T' },
    ])
    const [url, init] = send.mock.calls[0]!
    expect(url).toBe(IMAGE_MODELS_URL)
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer tmg_test')
  })

  it('asks the user to sign in again when the key is refused', async () => {
    const { ctx } = await bench()
    const send = vi.fn<typeof fetch>(async () => json({ detail: '连接已过期' }, 401))
    await expect(listTimeGleamImageModels(ctx, signal, { fetch: send }))
      .rejects.toThrow(/sign in to timegleam\.com again/u)
  })

  it('refuses without a connected account and sends no request', async () => {
    const { ctx } = await bench(null)
    const send = vi.fn<typeof fetch>()
    await expect(listTimeGleamImageModels(ctx, signal, { fetch: send }))
      .rejects.toThrow(/no TimeGleam account is connected/u)
    expect(send).not.toHaveBeenCalled()
  })
})

describe('timegleam image generation', () => {
  it('downloads a returned URL, stores it, and reports the reference', async () => {
    const { ctx, images } = await bench()
    const send = vi.fn<typeof fetch>(async input => requestedUrl(input) === IMAGE_URL
      ? json({ data: [{ url: 'https://cdn.example.invalid/generated.png' }] })
      : new Response(PNG_1X1, { status: 200, headers: { 'content-type': 'image/png' } }))
    const value = await generateTimeGleamImage(ctx, {
      model: 'doubao-seedream-5-0-flash', prompt: 'a red apple', size: '1K',
    }, signal, { fetch: send })
    expect(value.model).toBe('doubao-seedream-5-0-flash')
    expect(value.notes).toEqual([])
    expect(value.images).toHaveLength(1)
    expect(value.images[0]).toMatchObject({ mediaType: 'image/png', bytes: PNG_1X1.byteLength, width: 1, height: 1 })
    expect(images.saved).toHaveLength(1)
    expect(images.saved[0]?.name).toBe('timegleam-image.png')

    const [url, init] = send.mock.calls[0]!
    expect(url).toBe(IMAGE_URL)
    expect(init?.method).toBe('POST')
    expect(requestedJson(init)).toEqual({
      model: 'doubao-seedream-5-0-flash', prompt: 'a red apple', size: '1K', response_format: 'url',
    })
  })

  it('decodes base64 results and numbers multiple files', async () => {
    const { ctx, images } = await bench()
    const encoded = Buffer.from(PNG_1X1).toString('base64')
    const send = vi.fn<typeof fetch>(async () => json({ data: [{ b64_json: encoded }, { b64_json: encoded }] }))
    const value = await generateTimeGleamImage(ctx, {
      model: 'openai-image', prompt: 'two apples', n: 2, filename: 'apple',
    }, signal, { fetch: send })
    expect(value.images).toHaveLength(2)
    expect(images.saved.map(entry => entry.name)).toEqual(['apple-1.png', 'apple-2.png'])
  })

  it('keeps good results and notes a result it cannot store', async () => {
    const { ctx } = await bench()
    const send = vi.fn<typeof fetch>(async input => requestedUrl(input) === IMAGE_URL
      ? json({ data: [{ url: 'https://cdn.example.invalid/a.png' }, { url: 'https://cdn.example.invalid/b.png' }] })
      : requestedUrl(input) === 'https://cdn.example.invalid/b.png'
        ? new Response(PNG_1X1, { status: 200 })
        : new Response('not found', { status: 404 }))
    const value = await generateTimeGleamImage(ctx, { model: 'm', prompt: 'p' }, signal, { fetch: send })
    expect(value.images).toHaveLength(1)
    expect(value.notes[0]).toMatch(/result 1 could not be stored/u)
  })

  it('fails loudly when no result can be stored', async () => {
    const { ctx } = await bench()
    const send = vi.fn<typeof fetch>(async () => json({ data: [] }))
    await expect(generateTimeGleamImage(ctx, { model: 'm', prompt: 'p' }, signal, { fetch: send }))
      .rejects.toThrow(/returned no image results/u)
  })

  it('refuses unsupported bytes instead of storing them', async () => {
    const { ctx, images } = await bench()
    const send = vi.fn<typeof fetch>(async input => requestedUrl(input) === IMAGE_URL
      ? json({ data: [{ url: 'https://cdn.example.invalid/notes.txt' }] })
      : new Response('plain text', { status: 200 }))
    await expect(generateTimeGleamImage(ctx, { model: 'm', prompt: 'p' }, signal, { fetch: send }))
      .rejects.toThrow(/unsupported image format/u)
    expect(images.saved).toHaveLength(0)
  })

  it('registers both tools with model and prompt required', async () => {
    const { ctx } = await bench()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    applyTimeGleamImageTools(ctx)
    const schemas = ctx.tools.schemas()
    expect(schemas.map(schema => schema.name)).toEqual(['timegleam_image_models', 'timegleam_image'])
    const generate = schemas[1]!.parameters
    expect(generate.required).toEqual(['model', 'prompt'])
  })
})

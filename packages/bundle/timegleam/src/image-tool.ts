/**
 * Model-facing image tools over the TimeGleam proxy.
 *
 * The desktop shell already forwards chat through `llm-pi-ai`; images are not
 * part of the OpenAI chat protocol, so the workbench contributes the two
 * routes the proxy exposes: `GET /image-models` for the granted catalog and
 * `POST /images/generations` for one synchronous generation. The access key is
 * resolved from the credential seam per call, and every returned image is
 * committed to the attachment store before the tool result is appended. The
 * proxy settles each request against the workspace point ledger.
 *
 * @module @hy/dsh-timegleam/image-tool
 */

import { Buffer } from 'node:buffer'
import type { Context } from '@hy/cordis'
import { AttachmentError, AttachmentId } from '@hy/dsh-attachment'
import type { ImageAttachmentRef, ImageMediaType } from '@hy/dsh-attachment'
import { credentialRef } from '@hy/dsh-credentials'
import type { ContentBlock } from '@hy/dsh-llm'
import { defineTool } from '@hy/dsh-tools'
import type { GenericCallView } from '@hy/dsh-tools'
import {
  TIMEGLEAM_CREDENTIAL_REF,
  TIMEGLEAM_IMAGE_GENERATION_URL,
  TIMEGLEAM_IMAGE_MODELS_URL,
} from './endpoints.ts'

/** Tool name that lists the image models this workspace may call. */
export const IMAGE_MODELS_TOOL = 'timegleam_image_models'

/** Tool name that generates one image through the TimeGleam proxy. */
export const IMAGE_TOOL = 'timegleam_image'

/** One image model as the proxy reports it. */
export interface TimeGleamImageModel {
  /** Identifier accepted by `timegleam_image`, possibly `service::model`. */
  id: string
  /** Provider label the workspace uses for this model. */
  name: string
}

/** Canonical value of `timegleam_image_models`. */
export interface TimeGleamImageModelsValue {
  models: TimeGleamImageModel[]
}

/** Canonical value of `timegleam_image`. */
export interface TimeGleamImageValue {
  /** Model identifier the proxy resolved. */
  model: string
  /** Durable images in the order the proxy returned them. */
  images: TimeGleamImageRef[]
  /** Bounded, client-safe explanations for images that could not be stored. */
  notes: string[]
}

/** One stored image in the canonical output. */
export interface TimeGleamImageRef {
  attachmentId: string
  mediaType: ImageMediaType
  bytes: number
  width: number
  height: number
  name?: string
}

/** Arguments accepted by `timegleam_image`. */
export interface GenerateImageArgs {
  model: string
  prompt: string
  size?: string
  n?: number
  filename?: string
}

/** Injectable HTTP client; tests pass a stub instead of touching the network. */
export interface ImageToolDependencies {
  readonly fetch: typeof fetch
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const

/** Whether `data` starts with `expected` at `offset`. */
function matchesBytes(data: Uint8Array, offset: number, expected: readonly number[]): boolean {
  if (data.byteLength < offset + expected.length) return false
  return expected.every((byte, index) => data[offset + index] === byte)
}

/** Whether `data` carries `value` as ASCII at `offset`. */
function matchesAscii(data: Uint8Array, offset: number, value: string): boolean {
  if (data.byteLength < offset + value.length) return false
  for (let index = 0; index < value.length; index += 1) {
    if (data[offset + index] !== value.charCodeAt(index)) return false
  }
  return true
}

/**
 * Identify a returned raster by its signature.
 * @param data - decoded image bytes.
 * @returns the supported media type, or undefined for anything else.
 */
export function sniffImageMediaType(data: Uint8Array): ImageMediaType | undefined {
  if (matchesBytes(data, 0, PNG_SIGNATURE)) return 'image/png'
  if (matchesBytes(data, 0, JPEG_SIGNATURE)) return 'image/jpeg'
  if (matchesAscii(data, 0, 'GIF87a') || matchesAscii(data, 0, 'GIF89a')) return 'image/gif'
  if (matchesAscii(data, 0, 'RIFF') && matchesAscii(data, 8, 'WEBP')) return 'image/webp'
  return undefined
}

/** Filename extension for one accepted media type. */
function extensionFor(mediaType: ImageMediaType): string {
  switch (mediaType) {
    case 'image/png': return '.png'
    case 'image/jpeg': return '.jpg'
    case 'image/webp': return '.webp'
    case 'image/gif': return '.gif'
  }
}

/** Strip path material and control characters from a caller-supplied name. */
function safeBaseName(value: string): string {
  const leaf = value.replace(/\\/gu, '/').split('/').at(-1) ?? ''
  const cleaned = leaf.replace(/[\u0000-\u001f\u007f]/gu, '').trim()
  return cleaned.slice(0, 80)
}

/** Read one proxied error body without trusting it. */
async function refusal(response: Response, action: string): Promise<Error> {
  const parsed: unknown = await response.json().catch(() => undefined)
  const detail = typeof parsed === 'object' && parsed !== null
    ? (parsed as { detail?: unknown }).detail
    : undefined
  if (response.status === 401) {
    return new Error('TimeGleam access key is missing, expired, or revoked; sign in to timegleam.com again')
  }
  if (typeof detail === 'string' && detail.length > 0 && detail.length <= 300) {
    return new Error(`TimeGleam ${action} refused the request (${response.status}): ${detail}`)
  }
  if (response.status === 403) {
    return new Error(`TimeGleam ${action} is not authorized for this workspace; check the granted models in the online console`)
  }
  return new Error(`TimeGleam ${action} failed with HTTP ${response.status}; try again later`)
}

/** Resolve the stored TimeGleam access key for one call. */
async function accessKey(ctx: Context): Promise<string> {
  const resolved = await ctx.credentials.resolve(credentialRef(TIMEGLEAM_CREDENTIAL_REF))
  if (resolved === undefined || resolved.value.length === 0) {
    throw new Error('no TimeGleam account is connected; sign in to timegleam.com from the desktop welcome page or paste an access key')
  }
  return resolved.value
}

/**
 * Read one image body without exceeding the deployment's per-image byte cap.
 * @param response - successful download response.
 * @param limit - maximum accepted encoded bytes.
 * @returns the complete encoded image.
 */
async function readBounded(response: Response, limit: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > limit) {
    throw new Error(`the returned image is ${declared} bytes, above this deployment's ${limit}-byte limit`)
  }
  const body = response.body
  if (body === null) return new Uint8Array(await response.arrayBuffer())
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > limit) {
        await reader.cancel()
        throw new Error(`the returned image exceeds this deployment's ${limit}-byte limit`)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

/** Decode, verify, and durably store one generated result. */
async function storeOne(
  ctx: Context,
  data: Uint8Array,
  name: string,
): Promise<ImageAttachmentRef> {
  const attachments = ctx.get('attachments')
  if (attachments === undefined) throw new Error('generated images require a mounted attachment store')
  const mediaType = sniffImageMediaType(data)
  if (mediaType === undefined) throw new Error('the proxy returned bytes in an unsupported image format')
  if (!attachments.imageLimits.mediaTypes.includes(mediaType)) {
    throw new Error(`${mediaType} images are not accepted by this deployment`)
  }
  try {
    return await attachments.saveImage({ data, mediaType, name: `${name}${extensionFor(mediaType)}` })
  } catch (error: unknown) {
    if (error instanceof AttachmentError && error.code === 'IMAGE_TOO_LARGE') {
      throw new Error(`the generated image exceeds this deployment's ${attachments.imageLimits.maxImageBytes}-byte limit`)
    }
    throw error
  }
}

/** Materialize one `data[]` entry, either by downloading its URL or decoding base64. */
async function materialize(
  item: Record<string, unknown>,
  index: number,
  args: GenerateImageArgs,
  ctx: Context,
  signal: AbortSignal,
  deps: ImageToolDependencies,
): Promise<ImageAttachmentRef> {
  const attachments = ctx.get('attachments')
  if (attachments === undefined) throw new Error('generated images require a mounted attachment store')
  const limit = attachments.imageLimits.maxImageBytes
  const base = safeBaseName(args.filename ?? 'timegleam-image')
  const name = (args.n === undefined || args.n === 1) ? base : `${base}-${index + 1}`
  const url = item.url
  if (typeof url === 'string' && url.length > 0) {
    const response = await deps.fetch(url, {
      method: 'GET', redirect: 'follow', signal,
    })
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined)
      throw new Error(`downloading the returned image failed with HTTP ${response.status}`)
    }
    const data = await readBounded(response, limit)
    return storeOne(ctx, data, name)
  }
  const encoded = item.b64_json
  if (typeof encoded === 'string' && encoded.length > 0) {
    const data = new Uint8Array(Buffer.from(encoded, 'base64'))
    if (data.byteLength > limit) {
      throw new Error(`the returned image is ${data.byteLength} bytes, above this deployment's ${limit}-byte limit`)
    }
    return storeOne(ctx, data, name)
  }
  throw new Error('the proxy returned an image entry with neither url nor b64_json')
}

/**
 * List the image models granted to the connected workspace.
 * @param ctx - Host context providing the credential seam.
 * @param signal - caller cancellation.
 * @param deps - in-process HTTP client.
 * @returns the granted models in proxy order.
 */
export async function listTimeGleamImageModels(
  ctx: Context,
  signal: AbortSignal,
  deps: ImageToolDependencies = { fetch: globalThis.fetch },
): Promise<TimeGleamImageModelsValue> {
  const token = await accessKey(ctx)
  const response = await deps.fetch(TIMEGLEAM_IMAGE_MODELS_URL, {
    method: 'GET', redirect: 'error', signal,
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  if (!response.ok) throw await refusal(response, 'image catalog')
  const payload: unknown = await response.json()
  const data = typeof payload === 'object' && payload !== null
    ? (payload as { data?: unknown }).data
    : undefined
  if (!Array.isArray(data)) throw new Error('the TimeGleam image catalog response is not a model list')
  const seen = new Set<string>()
  const models: TimeGleamImageModel[] = []
  for (const entry of data) {
    if (typeof entry !== 'object' || entry === null) continue
    const id = (entry as { id?: unknown }).id
    if (typeof id !== 'string' || id.length === 0 || id.length > 200 || seen.has(id)) continue
    seen.add(id)
    const owned = (entry as { owned_by?: unknown }).owned_by
    models.push({ id, name: typeof owned === 'string' && owned.length > 0 ? owned : id })
  }
  if (models.length === 0) throw new Error('this workspace has no granted image model')
  return { models }
}

/**
 * Generate one image through the TimeGleam proxy and store every returned result.
 * @param ctx - Host context providing credentials and the attachment store.
 * @param args - model, prompt, and optional size/count/filename.
 * @param signal - caller cancellation, forwarded to both requests.
 * @param deps - in-process HTTP client.
 * @returns the stored images plus bounded notes for failed results.
 */
export async function generateTimeGleamImage(
  ctx: Context,
  args: GenerateImageArgs,
  signal: AbortSignal,
  deps: ImageToolDependencies = { fetch: globalThis.fetch },
): Promise<TimeGleamImageValue> {
  const token = await accessKey(ctx)
  const body: Record<string, unknown> = {
    model: args.model, prompt: args.prompt, response_format: 'url',
  }
  if (args.size !== undefined) body.size = args.size
  if (args.n !== undefined) body.n = args.n
  const response = await deps.fetch(TIMEGLEAM_IMAGE_GENERATION_URL, {
    method: 'POST', redirect: 'error', signal,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw await refusal(response, 'image generation')
  const payload: unknown = await response.json()
  const data = typeof payload === 'object' && payload !== null
    ? (payload as { data?: unknown }).data
    : undefined
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('the TimeGleam image proxy returned no image results; no points were settled for an output it could not confirm')
  }
  const images: TimeGleamImageRef[] = []
  const notes: string[] = []
  for (const [index, entry] of data.entries()) {
    if (typeof entry !== 'object' || entry === null) {
      notes.push(`result ${index + 1} was unreadable and was skipped`)
      continue
    }
    try {
      const ref = await materialize(entry as Record<string, unknown>, index, args, ctx, signal, deps)
      images.push({
        attachmentId: ref.attachmentId,
        mediaType: ref.mediaType,
        bytes: ref.bytes,
        width: ref.width,
        height: ref.height,
        ...ref.name === undefined ? {} : { name: ref.name },
      })
    } catch (error: unknown) {
      // A single unreadable result must not hide the images that did arrive;
      // the note stays bounded and never echoes a provider URL or body.
      const reason = error instanceof Error ? error.message : 'an unknown error occurred'
      notes.push(`result ${index + 1} could not be stored: ${reason.slice(0, 200)}`)
    }
  }
  if (images.length === 0) throw new Error(`no generated image could be stored: ${notes.join('; ')}`)
  return { model: args.model, images, notes }
}

/** Model-facing envelope plus one image block per stored result. */
function imageContent(value: TimeGleamImageValue): ContentBlock[] {
  const lines = [
    `Generated ${value.images.length} image${value.images.length === 1 ? '' : 's'} with ${value.model}.`,
  ]
  for (const image of value.images) {
    lines.push(`${image.name ?? image.attachmentId}: ${image.mediaType}, ${image.width}x${image.height} px, ${image.bytes} bytes`)
  }
  for (const note of value.notes) lines.push(`Note: ${note}`)
  const blocks: ContentBlock[] = [{ type: 'text', text: lines.join('\n') }]
  for (const image of value.images) {
    blocks.push({
      type: 'image',
      attachment: {
        attachmentId: AttachmentId(image.attachmentId),
        mediaType: image.mediaType,
        bytes: image.bytes,
        width: image.width,
        height: image.height,
        ...image.name === undefined ? {} : { name: image.name },
      },
    })
  }
  return blocks
}

/** Project one catalog into a compact model-facing list. */
function listContent(value: TimeGleamImageModelsValue): ContentBlock[] {
  return [{
    type: 'text',
    text: [
      'Image models granted to this TimeGleam workspace:',
      ...value.models.map(model => `- ${model.id} (${model.name})`),
      'Call timegleam_image with one of these ids. The online workspace settles points for each returned image.',
    ].join('\n'),
  }]
}

const IMAGE_REF_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    attachmentId: { type: 'string', required: true },
    mediaType: { type: 'string', enum: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'], required: true },
    bytes: { type: 'integer', required: true },
    width: { type: 'integer', required: true },
    height: { type: 'integer', required: true },
    name: { type: 'string' },
  },
} as const

/**
 * Register both image tools when the Host provides their services.
 * @param ctx - context with `tools`, `credentials`, and `attachments`.
 */
export function applyTimeGleamImageTools(ctx: Context): void {
  ctx.tools.register(defineTool({
    name: IMAGE_MODELS_TOOL,
    description: 'List the image models the connected TimeGleam workspace may call. '
      + 'Call this before timegleam_image when the model id is unknown.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          models: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                name: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => listContent(value),
    },
    isConcurrencySafe: () => true,
    execute: (_args, exec) => listTimeGleamImageModels(ctx, exec.signal),
    presentCall: (): GenericCallView => ({ card: 'generic', title: 'List TimeGleam image models', kind: 'read' }),
  }))

  ctx.tools.register(defineTool({
    name: IMAGE_TOOL,
    description: 'Generate one image with a TimeGleam image model through timegleam.com and show the result. '
      + 'The request is billed to the signed-in workspace point ledger; the returned image is stored locally. '
      + 'Use timegleam_image_models to discover model ids. Ark-backed models return one image per call.',
    parameters: {
      model: { type: 'string', required: true, description: 'Image model id from timegleam_image_models.' },
      prompt: { type: 'string', required: true, description: 'What to draw. Describe subject, style, lighting, and composition.' },
      size: { type: 'string', description: 'Provider size such as 1K, 2K, or 1024x1024; omit to use the service default.' },
      n: { type: 'integer', description: 'Number of images (1-16); Ark-backed services accept only 1.' },
      filename: { type: 'string', description: 'Optional local display name for the stored image, without a path.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          model: { type: 'string', required: true },
          images: { type: 'array', required: true, items: IMAGE_REF_SCHEMA },
          notes: { type: 'array', required: true, items: { type: 'string' } },
        },
      },
      render: (_args, value) => imageContent(value),
      presentationMeta: (_args, value) => ({ model: value.model, images: value.images.length }),
    },
    timeoutMs: 600_000,
    isConcurrencySafe: () => true,
    execute: (args, exec) => generateTimeGleamImage(ctx, args, exec.signal),
    presentCall: (args): GenericCallView => ({
      card: 'generic', title: `Generate image with ${args.model}`, kind: 'other', rawInput: args.prompt,
    }),
  }))
}

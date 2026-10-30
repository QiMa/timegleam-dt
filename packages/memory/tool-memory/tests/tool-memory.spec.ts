import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Context } from '@hy/cordis'
import * as NativeToolExecutor from '@hy/dsh-tool-executor-native'
import { ToolCallId } from '@hy/dsh-llm'
import SystemPrompt from '@hy/dsh-system-prompt'
import { executeModelToolFixture } from '@hy/dsh-tool-testkit'
import ToolRuntime from '@hy/dsh-tools'

import * as tool from '../src/index.ts'

const signal = new AbortController().signal

/** Requests seen by the fake huayu-memory service, in arrival order. */
interface SeenRequest {
  method: string
  url: string
  body: string
}

let seen: SeenRequest[] = []
let server: ReturnType<typeof createServer> | undefined

function respondJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(value))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk as Buffer))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function startServer(): Promise<string> {
  seen = []
  server = createServer((req, res) => {
    void (async () => {
      const body = await readBody(req)
      const url = req.url ?? '/'
      seen.push({ method: req.method ?? 'GET', url, body })
      if (url.startsWith('/v1/search')) {
        const q = new URL(url, 'http://x').searchParams.get('q') ?? ''
        respondJson(res, 200, {
          results: q
            ? [{ id: 'm1', namespace: 'global', type: 'preference', content: `remembered: ${q}`, score: 0.9 }]
            : [],
        })
        return
      }
      if (url === '/v1/memories' && (req.method ?? 'GET') === 'POST') {
        respondJson(res, 201, { id: 'm2', created: true, updated: false })
        return
      }
      respondJson(res, 404, { error: 'not found' })
    })().catch(() => respondJson(res, 500, { error: 'boom' }))
  })
  await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return `http://127.0.0.1:${port}`
}

async function setup(endpoint: string): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(NativeToolExecutor)
  await ctx.plugin(tool, { endpoint, apiKey: '', enabled: true })
  return ctx
}

describe('dsh-tool-memory', () => {
  beforeEach(async () => {
    const endpoint = await startServer()
    Object.assign(globalThis, { __memoryEndpoint: endpoint })
  })
  afterEach(() => {
    const close = new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve())
    server = undefined
    return close
  })

  it('registers memory_search and memory_save with declared schemas', async () => {
    const ctx = await setup((globalThis as unknown as { __memoryEndpoint: string }).__memoryEndpoint)
    const names = ctx.tools.schemas().map(s => s.name)
    expect(names).toContain('memory_search')
    expect(names).toContain('memory_save')
    const search = ctx.tools.schemas().find(s => s.name === 'memory_search')!
    const props = (search.parameters as { properties?: Record<string, unknown> }).properties ?? {}
    expect(Object.keys(props).sort()).toEqual(['limit', 'namespace', 'query'])
  })

  it('memory_search hits the configured endpoint with the query', async () => {
    const ctx = await setup((globalThis as unknown as { __memoryEndpoint: string }).__memoryEndpoint)
    const result = await executeModelToolFixture(ctx, {
      callId: ToolCallId('call-search'),
      name: 'memory_search',
      arguments: { query: 'brand voice', limit: 3 },
      signal,
    })
    expect(result.isError).toBe(false)
    expect(result.content.some(b => 'text' in b && String(b.text).includes('remembered: brand voice'))).toBe(true)
    expect(seen.some(r => r.url.startsWith('/v1/search') && r.url.includes('q=brand+voice'))).toBe(true)
  })

  it('memory_save POSTs the memory to the service', async () => {
    const ctx = await setup((globalThis as unknown as { __memoryEndpoint: string }).__memoryEndpoint)
    const result = await executeModelToolFixture(ctx, {
      callId: ToolCallId('call-save'),
      name: 'memory_save',
      arguments: { namespace: 'global', type: 'preference', content: 'always answer in Chinese' },
      signal,
    })
    expect(result.isError).toBe(false)
    const post = seen.find(r => r.method === 'POST' && r.url === '/v1/memories')
    expect(post).toBeDefined()
    expect(JSON.parse(post!.body)).toMatchObject({
      namespace: 'global',
      type: 'preference',
      content: 'always answer in Chinese',
    })
  })

  it('clamps the limit argument into the service range', async () => {
    const ctx = await setup((globalThis as unknown as { __memoryEndpoint: string }).__memoryEndpoint)
    await executeModelToolFixture(ctx, {
      callId: ToolCallId('call-limit'),
      name: 'memory_search',
      arguments: { query: 'limit', limit: 999 },
      signal,
    })
    expect(seen.some(r => r.url.startsWith('/v1/search') && r.url.includes('limit=16'))).toBe(true)
  })

  it('passes the optional namespace filter to the service', async () => {
    const ctx = await setup((globalThis as unknown as { __memoryEndpoint: string }).__memoryEndpoint)
    await executeModelToolFixture(ctx, {
      callId: ToolCallId('call-namespace'),
      name: 'memory_search',
      arguments: { query: 'ns', namespace: 'project:huayu' },
      signal,
    })
    expect(seen.some(r => r.url.startsWith('/v1/search') && r.url.includes('namespace=project%3Ahuayu'))).toBe(true)
  })
  it('an unreachable service surfaces as a failed tool call', async () => {
    const ctx = await setup('http://127.0.0.1:1')
    const result = await executeModelToolFixture(ctx, {
      callId: ToolCallId('call-down'),
      name: 'memory_search',
      arguments: { query: 'x' },
      signal,
    })
    expect(result.isError).toBe(true)
  })
})

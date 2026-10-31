import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@hy/cordis'
import { Session, SessionId } from '@hy/dsh-session'
import AgentRegistry, { agentEvents, type Agent } from '@hy/dsh-agent'
import AgentLoop from '@hy/dsh-agent-loop'
import TypertRegistry from '@hy/dsh-typert-registry'
import SessionProjectionRegistry from '@hy/dsh-session-projection'
import { createUserMessage } from '@hy/dsh-llm'
import { unsupportedModel, unsupportedInbox, mountAgentLoopTestDependencies } from '@hy/dsh-agent-loop-testkit'

import * as memoryContext from '../src/index.ts'
import { MockAdapter, textResponse } from '../../../core/agent-loop/tests/mock-adapter.ts'

const signal = new AbortController().signal

interface SeenRequest { method: string; url: string; body: string }

let seen: SeenRequest[] = []
let server: ReturnType<typeof createServer> | undefined
let endpoint = ''

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

async function startServer(): Promise<void> {
  seen = []
  server = createServer((req, res) => {
    void (async () => {
      const body = await readBody(req)
      const url = req.url ?? '/'
      seen.push({ method: req.method ?? 'GET', url, body })
      if (url.startsWith('/v1/search')) {
        const q = new URL(url, 'http://x').searchParams.get('q') ?? ''
        if (q.includes('unreachable')) {
          respondJson(res, 500, { error: 'boom' })
          return
        }
        respondJson(res, 200, {
          results: q
            ? [{ id: 'm1', namespace: 'global', type: 'preference', content: `remembered: ${q}`, score: 0.9 }]
            : [],
        })
        return
      }
      if (url === '/v1/refine') {
        const parsed = JSON.parse(body) as { text: string; namespace: string }
        respondJson(res, 200, {
          candidates: parsed.text.includes('unreachable')
            ? []
            : [{
              namespace: parsed.namespace,
              type: 'decision',
              content: 'refined decision from session',
              summary: 'refined decision',
              confidence: 0.6,
              fingerprint: 'fp1',
            }],
          count: 1,
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
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

async function mount(config: Partial<memoryContext.Config> = {}): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(memoryContext, {
    endpoint,
    apiKey: '',
    enabled: true,
    maxInjected: 8,
    threshold: 0.25,
    refineOnDispose: true,
    refineMinChars: 160,
    ...config,
  })
  return ctx
}

function sessionAgent(session: Session, id = 'agent'): Agent {
  return {
    id: SessionId(id),
    options: {},
    session,
    model: unsupportedModel(),
    inbox: unsupportedInbox(),
    status: 'running',
    ctx: new Context(),
    send: () => {},
    followup: () => {},
    steer: () => {},
    inject: () => { throw new Error('memory-context must append directly to the open step') },
    cancel() {},
    runMaintenance: task => task(new AbortController().signal),
    whenIdle: () => Promise.resolve(),
  }
}

function openMessageTurn(session: Session, turn: number, text = `turn ${turn}: remember my preference`): void {
  session.append('turn/start', { turn })
  session.append('user/message', createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }), { surfaceOp: 'append' })
}

function contextTexts(session: Session): string[] {
  const texts: string[] = []
  for (const event of session.snapshotEvents()) {
    if (event.type === 'user/message'
      && event.data.source.kind === 'memory-context') {
      texts.push(event.data.content.find(block => block.type === 'text')?.text ?? '')
    }
  }
  return texts
}

async function fire(
  ctx: Context,
  agent: Agent,
  turn: number,
  step: number,
  messages: ReturnType<typeof createUserMessage>[] = [],
): Promise<void> {
  const decision = await agentEvents(ctx, agent).waterfall(
    'agent/pre-step',
    { modelSelection: { provider: 'mock', model: 'mock' }, messages, turn, step, signal },
    () => Promise.resolve({ kind: 'enter' as const, messages }),
  )
  if (decision.kind === 'enter') {
    for (const message of decision.messages) {
      agent.session.append('user/message', message, { surfaceOp: 'append' })
    }
  }
}

describe('dsh-memory-context', () => {
  beforeEach(async () => {
    await startServer()
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (server === undefined) { resolve(); return }
      server.close(error => error ? reject(error) : resolve())
      server = undefined
    })
  })

  it('injects recalled memories on the first step of a turn', async () => {
    const ctx = await mount()
    const session = Session.create(SessionId('first'))
    openMessageTurn(session, 1)
    const turnMessage = createUserMessage({
      content: [{ type: 'text', text: 'turn 1: remember my preference' }],
      source: { kind: 'user' },
    })

    await fire(ctx, sessionAgent(session), 1, 1, [turnMessage])

    const texts = contextTexts(session)
    expect(texts).toHaveLength(1)
    expect(texts[0]).toContain('remembered:')
    expect(texts[0]).toContain('[记忆 global/preference]')
    const event = session.snapshotEvents()
      .toReversed()
      .find(entry => entry.type === 'user/message' && entry.data.source.kind === 'memory-context')
    if (event?.type !== 'user/message') throw new Error('missing memory context')
    expect(event.data.source).toMatchObject({
      kind: 'memory-context',
      form: 'snapshot',
      sections: [{ name: 'memory-context' }],
    })
  })

  it('searches with the human message only, not producer context snapshots', async () => {
    const ctx = await mount()
    const session = Session.create(SessionId('user-only'))
    openMessageTurn(session, 1, 'how do we deploy')
    const runtimeContext = createUserMessage({
      content: [{ type: 'text', text: 'Current runtime context. This snapshot supersedes earlier snapshots.' }],
      source: { kind: 'runtime-context', form: 'snapshot', sections: [] },
    })
    const human = createUserMessage({
      content: [{ type: 'text', text: 'how do we deploy' }],
      source: { kind: 'user' },
    })

    await fire(ctx, sessionAgent(session), 1, 1, [runtimeContext, human])

    const search = seen.find(entry => entry.url.startsWith('/v1/search'))
    if (search === undefined) throw new Error('missing search request')
    const query = new URL(search.url, 'http://x').searchParams.get('q') ?? ''
    expect(query).toBe('how do we deploy')
  })
  it('skips injection on later steps of a turn', async () => {
    const ctx = await mount()
    const session = Session.create(SessionId('second'))
    openMessageTurn(session, 1)

    await fire(ctx, sessionAgent(session), 1, 2)

    expect(contextTexts(session)).toHaveLength(0)
  })

  it('refines collected conversation when a session is disposed', async () => {
    const ctx = new Context()
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(TypertRegistry)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(memoryContext, {
      endpoint,
      apiKey: '',
      enabled: true,
      maxInjected: 8,
      threshold: 0.25,
      refineOnDispose: true,
      refineMinChars: 1,
    })
    const adapter = new MockAdapter([textResponse('ok')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const handle = await ctx.agents.create({
      sessionId: SessionId('refine-session'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    const agent = handle.agent
    const lifecycle: string[] = []
    ctx.on('session/event', (_session, event) => { lifecycle.push(`event:${event.type}`) })
    ctx.on('session/disposed', (session) => { lifecycle.push(`disposed:${session.id}`) })
    const testAgent = agent
    agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'please remember this decision: always use huayu- prefix' }],
      source: { kind: 'user' },
    }))
    await agent.whenIdle()

    // Dispose the agent handle so the session leaves the store and
    // session/disposed fires.
    await handle.dispose()

    // refine runs fire-and-forget after session/disposed; wait for the HTTP
    // calls to land before asserting.
    await vi.waitFor(() => {
      const refineSeen = seen.filter(request => request.url === '/v1/refine')
      const saveSeen = seen.filter(request => request.url === '/v1/memories' && request.method === 'POST')
      expect(refineSeen.length).toBeGreaterThan(0)
      expect(saveSeen.length).toBeGreaterThan(0)
    }, { timeout: 3000 }).catch((error: unknown) => {
      console.error('LIFECYCLE:', JSON.stringify(lifecycle))
      console.error('ALL SEEN:', JSON.stringify(seen))
      throw error
    })
    void testAgent
  })

  it('degrades silently when the memory service is unreachable', async () => {
    const ctx = await mount()
    const session = Session.create(SessionId('unreachable'))
    openMessageTurn(session, 1, 'unreachable query')
    const turnMessage = createUserMessage({
      content: [{ type: 'text', text: 'unreachable query' }],
      source: { kind: 'user' },
    })
    const warn = vi.spyOn(ctx.logger, 'warn').mockImplementation(() => {})

    await fire(ctx, sessionAgent(session), 1, 1, [turnMessage])

    expect(contextTexts(session)).toHaveLength(0)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('excludes injected memory-context messages from the refine log (no echo loop)', async () => {
    const ctx = new Context()
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(TypertRegistry)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(memoryContext, {
      endpoint,
      apiKey: '',
      enabled: true,
      maxInjected: 8,
      threshold: 0.25,
      refineOnDispose: true,
      refineMinChars: 1,
    })
    const adapter = new MockAdapter([textResponse('ok')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const handle = await ctx.agents.create({
      sessionId: SessionId('no-echo'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    handle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'user says hi' }],
      source: { kind: 'user' },
    }))
    await handle.agent.whenIdle()
    await handle.dispose()
    await vi.waitFor(() => {
      const refineSeen = seen.find(request => request.url === '/v1/refine')
      expect(refineSeen).toBeDefined()
      expect(refineSeen!.body).toContain('user says hi')
      expect(refineSeen!.body).not.toContain('remembered:')
    }, { timeout: 3000 })
  })

  it('does not refine below the configured character floor', async () => {
    const ctx = new Context()
    await mountAgentLoopTestDependencies(ctx)
    await ctx.plugin(TypertRegistry)
    await ctx.plugin(AgentLoop, { agents: [] })
    await ctx.plugin(memoryContext, {
      endpoint,
      apiKey: '',
      enabled: true,
      maxInjected: 8,
      threshold: 0.25,
      refineOnDispose: true,
      refineMinChars: 1000,
    })
    const adapter = new MockAdapter([textResponse('ok')])
    ctx.llm.registerAdapter(['mock'], adapter)
    const handle = await ctx.agents.create({
      sessionId: SessionId('below-floor'),
      agentOptions: { provider: 'mock', model: 'mock' },
    })
    handle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: 'short' }],
      source: { kind: 'user' },
    }))
    await handle.agent.whenIdle()
    await handle.dispose()
    await new Promise(resolve => setTimeout(resolve, 400))
    expect(seen.some(request => request.url === '/v1/refine')).toBe(false)
  })

  it('stays silent when disabled', async () => {
    const ctx = await mount({ enabled: false })
    const session = Session.create(SessionId('disabled'))
    openMessageTurn(session, 1)
    const turnMessage = createUserMessage({
      content: [{ type: 'text', text: 'turn 1: remember my preference' }],
      source: { kind: 'user' },
    })
    await fire(ctx, sessionAgent(session), 1, 1, [turnMessage])
    expect(contextTexts(session)).toHaveLength(0)
    expect(seen).toHaveLength(0)
  })

})

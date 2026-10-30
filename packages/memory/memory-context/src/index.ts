/**
 * Session-lifecycle memory for Huayu AI: inject recalled memories into the
 * first step of every turn (injection point A) and refine/merge the turn's
 * conversation into the huayu-memory service when a session is disposed
 * (injection point C). Failure is always silent degradation: the memory
 * service being unreachable never affects conversation flow.
 *
 * @module @hy/dsh-memory-context
 */

import { basename } from 'node:path'
import type { Context } from '@hy/cordis'
import z from '@hy/schemastery'
import type { PreStepDecision } from '@hy/dsh-agent'
import { createUserMessage } from '@hy/dsh-llm'
import type { ContextFormed } from '@hy/dsh-llm'
import type { Session, UserMessage } from '@hy/dsh-session'
import { MemoryClient, MemoryServiceError } from '@hy/dsh-tool-memory'

declare module '@hy/dsh-llm' {
  interface MessageSourceMap {
    'memory-context': { kind: 'memory-context' } & ContextFormed
  }
}

export const name = 'memory-context'
export const inject = ['agents']

/** Configuration for huayu-memory lifecycle hooks. */
export interface Config {
  /** Base URL of the huayu-memory service. */
  endpoint: string
  /** Optional bearer token sent to the service. */
  apiKey: string
  /** Whether the lifecycle hooks are mounted at all. */
  enabled: boolean
  /** Maximum memories injected into the first step of a turn. */
  maxInjected: number
  /** Minimum search score for injection. */
  threshold: number
  /** Turn-end refinement: merge extracted candidates into the store. */
  refineOnDispose: boolean
  /** Minimum collected conversation characters before refine runs. */
  refineMinChars: number
}

export const Config: z<Config> = z.object({
  endpoint: z.string().default('http://192.168.100.196:8780'),
  apiKey: z.string().default(''),
  enabled: z.boolean().default(true),
  maxInjected: z.number().min(1).max(16).default(8),
  threshold: z.number().min(0).max(1).default(0.25),
  refineOnDispose: z.boolean().default(true),
  refineMinChars: z.number().min(1).default(160),
})

function textOf(content: readonly { type: string }[]): string {
  return content
    .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
    .map(block => block.text)
    .join('\n')
}

function projectNamespace(cwd: string | undefined): string {
  if (cwd === undefined) return 'global'
  const name = basename(cwd)
  if (name === '' || name === '.' || name === '/') return 'global'
  return `project:${name}`
}

/** Aggregated turn log for end-of-session refinement (injection point C). */
interface RefineLog {
  characters: number
  chunks: string[]
}

export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  const client = new MemoryClient(config.endpoint, config.apiKey)
  const refineLogs = new WeakMap<Session, RefineLog>()

  const sessionLog = (session: Session): RefineLog => {
    let log = refineLogs.get(session)
    if (log === undefined) {
      log = { characters: 0, chunks: [] }
      refineLogs.set(session, log)
    }
    return log
  }

  /** Injection point C: feed one durable conversation event into the refine log. */
  ctx.on('session/event', (session, event) => {
    if (!config.refineOnDispose) return
    if (event.type === 'user/message' && event.data.source.kind === 'memory-context') return
    if (event.type !== 'user/message' && event.type !== 'assistant/message') return
    const message = event.data as UserMessage | { content: readonly { type: string }[] }
    const text = textOf(message.content).trim()
    if (text.length === 0) return
    const log = sessionLog(session)
    log.characters += text.length
    log.chunks.push(text)
  })

  /** Injection point A: prepend recalled memories to the first step of a turn. */
  ctx.on('agent/pre-step', async (
    { agent, step, signal },
    next,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted || step !== 1) return decision
    const query = [
      ...decision.messages.flatMap(message => textOf(message.content)),
    ].join(' ').trim().slice(0, 500)
    if (query === '') return decision
    let results: Awaited<ReturnType<typeof client.search>>['results']
    try {
      results = (await client.search(query, projectNamespace(agent.session.header.cwd), config.maxInjected)).results
    } catch (error) {
      ctx.logger.warn(`huayu-memory: pre-step search failed: ${error instanceof Error ? error.message : String(error)}`)
      return decision
    }
    const typedResults: typeof results = results
    const hits = typedResults.filter(hit => hit.score >= config.threshold)
    if (hits.length === 0) return decision
    const text = '先前会话中与此任务相关的持久记忆：\n'
      + hits.map(hit => `[记忆 ${hit.namespace}/${hit.type}] ${hit.content}`).join('\n')
    return {
      ...decision,
      messages: [
        createUserMessage({
          content: [{ type: 'text', text }],
          source: { kind: name, form: 'snapshot', sections: [{ name, text }] },
        }),
        ...decision.messages,
      ],
    }
  }, { prepend: true })

  /** Injection point C: merge refined candidates when a session leaves the store. */
  ctx.on('session/disposed', (session) => {
    if (!config.refineOnDispose) return
    const log = refineLogs.get(session)
    refineLogs.delete(session)
    if (log === undefined || log.characters < config.refineMinChars) return
    void (async () => {
      try {
        const namespace = projectNamespace(session.header.cwd)
        const { candidates } = await client.refine(log.chunks.join('\n'), namespace)
        for (const candidate of candidates) {
          await client.save(candidate.summary !== undefined
            ? {
              namespace: candidate.namespace,
              type: candidate.type,
              content: candidate.content,
              summary: candidate.summary,
            }
            : {
              namespace: candidate.namespace,
              type: candidate.type,
              content: candidate.content,
            })
        }
        ctx.logger.info(`huayu-memory: session "${session.id}" refined ${candidates.length} candidates into "${namespace}"`)
      } catch (error) {
        const message = error instanceof MemoryServiceError ? error.message : String(error)
        ctx.logger.warn(`huayu-memory: refine on dispose failed: ${message}`)
      }
    })()
  })

}

export type { MemoryHit, RefineCandidate, RefineResponse } from '@hy/dsh-tool-memory'

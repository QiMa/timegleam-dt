/**
 * Model-facing persistent-memory tools backed by the huayu-memory service.
 * memory_search recalls cross-session memories; memory_save records one.
 * Failures surface as failed tool calls; the service being unreachable never
 * breaks the conversation (the model can simply continue without memory).
 * @module @hy/dsh-tool-memory
 */

import type { Context } from '@hy/cordis'
import z from '@hy/schemastery'
import { defineTool } from '@hy/dsh-tools'
import { MemoryClient } from './client.ts'

export { MemoryClient, MemoryServiceError } from './client.ts'
export type {
  MemoryHit,
  RefineCandidate,
  RefineResponse,
  SaveRequest,
  SaveResponse,
  SearchResponse,
} from './client.ts'

export const name = 'tool-memory'
export const inject = ['tools']

/** Plugin configuration for the huayu-memory endpoint. */
export interface Config {
  /** Base URL of the huayu-memory service. */
  endpoint: string
  /** Optional bearer token sent to the service. */
  apiKey: string
  /** Whether the tools are registered at all. */
  enabled: boolean
}

export const Config: z<Config> = z.object({
  endpoint: z.string().default('http://192.168.100.196:8780'),
  apiKey: z.string().default(''),
  enabled: z.boolean().default(true),
})

const MEMORY_TYPES = ['preference', 'fact', 'decision', 'convention', 'corpus'] as const

export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  const client = new MemoryClient(config.endpoint, config.apiKey)

  ctx.tools.register(defineTool({
    name: 'memory_search',
    description:
      'Search persistent memories that survive across sessions: user preferences, project decisions, '
      + 'naming conventions, verified facts. Use before guessing an established preference.',
    parameters: {
      query: { type: 'string', required: true, description: 'Search query; short natural-language phrase.' },
      namespace: { type: 'string', description: 'Optional namespace filter (e.g. project:<repo> or global).' },
      limit: { type: 'number', description: 'Maximum results to return (default 8, max 16).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          results: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string', required: true },
                namespace: { type: 'string', required: true },
                type: { type: 'string', required: true },
                content: { type: 'string', required: true },
                score: { type: 'number', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => value.results.length === 0
        ? [{ type: 'text', text: '(no memories found)' }]
        : [{ type: 'text', text: value.results
          .map(r => `[记忆 ${r.namespace}/${r.type}] ${r.content}`).join('\n') }],
    },
    execute: async (args) => {
      const limit = Math.min(Math.max(args.limit ?? 8, 1), 16)
      const res = await client.search(args.query, args.namespace, limit)
      return {
        results: res.results.map(r => ({
          id: r.id, namespace: r.namespace, type: r.type, content: r.content, score: r.score,
        })),
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'memory_save',
    description:
      'Persist one durable memory for future sessions: a user preference, a project decision, a naming '
      + 'convention, or a verified fact. Do not store ephemeral state or secrets.',
    parameters: {
      namespace: {
        type: 'string',
        required: true,
        description: 'Namespace: "global" for cross-project, or "project:<repo>" for the current project.',
      },
      type: {
        type: 'string',
        required: true,
        enum: [...MEMORY_TYPES],
        description: 'Memory kind.',
      },
      content: { type: 'string', required: true, description: 'The memory text; one fact per entry.' },
      summary: { type: 'string', description: 'Optional short retrieval summary (defaults to content).' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', required: true },
          created: { type: 'boolean', required: true },
          updated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{
        type: 'text',
        text: value.created ? `memory saved: ${value.id}` : `memory updated: ${value.id}`,
      }],
    },
    execute: async (args) => {
      return await client.save(args.summary
        ? { namespace: args.namespace, type: args.type, content: args.content, summary: args.summary }
        : { namespace: args.namespace, type: args.type, content: args.content })
    },
  }))
}

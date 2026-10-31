/**
 * Minimal HTTP client for the huayu-memory service.
 * Endpoint and API key come from plugin config; every failure is a thrown
 * Error so tool execution reports it as a failed call (never a silent no-op).
 * @module @hy/dsh-tool-memory/client
 */

/**
 * One persisted memory matched by a search, with its retrieval score.
 */
export interface MemoryHit {
  id: string
  namespace: string
  type: string
  content: string
  score: number
}

/**
 * Search results returned by the service.
 */
export interface SearchResponse {
  results: MemoryHit[]
}

/**
 * One memory to create or update.
 */
export interface SaveRequest {
  namespace: string
  type: 'preference' | 'fact' | 'decision' | 'convention' | 'corpus'
  content: string
  summary?: string
  metadata?: Record<string, unknown>
}

/**
 * Result of a create-or-update save call.
 */
export interface SaveResponse {
  id: string
  created: boolean
  updated: boolean
}

/**
 * One candidate extracted by refinement, ready to merge into the store.
 */
export interface RefineCandidate extends Omit<SaveRequest, 'metadata'> {
  confidence: number
  fingerprint: string
}

/**
 * Refinement output carrying the extracted candidates.
 */
export interface RefineResponse {
  candidates: RefineCandidate[]
  count: number
}

/**
 * Error raised when the huayu-memory service rejects a request.
 */
export class MemoryServiceError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'MemoryServiceError'
  }
}

/**
 * Typed HTTP client for the huayu-memory service routes.
 */
export class MemoryClient {
  constructor(
    readonly endpoint: string,
    readonly apiKey: string = '',
  ) {}

  private headers(): Record<string, string> {
    return this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}
  }

  /**
   * Search memories by natural-language query within an optional namespace.
   * @param query - Search query; a short natural-language phrase.
   * @param namespace - Optional namespace filter, e.g. `project:<repo>` or `global`.
   * @param limit - Maximum results to return.
   * @param threshold - Minimum retrieval score the service should consider.
   * @returns The service search response.
   */
  async search(
    query: string,
    namespace?: string,
    limit = 8,
    threshold?: number,
  ): Promise<SearchResponse> {
    const url = new URL('/v1/search', this.endpoint)
    url.searchParams.set('q', query)
    if (namespace) url.searchParams.set('namespace', namespace)
    url.searchParams.set('limit', String(limit))
    if (threshold !== undefined) url.searchParams.set('threshold', String(threshold))
    const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new MemoryServiceError(`memory search failed: HTTP ${res.status}`, res.status)
    return await res.json() as SearchResponse
  }

  /**
   * Create one memory, or update the matching one when it exists.
   * @param body - The memory to persist.
   * @returns The create-or-update result.
   */
  async save(body: SaveRequest): Promise<SaveResponse> {
    const url = new URL('/v1/memories', this.endpoint)
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new MemoryServiceError(`memory save failed: HTTP ${res.status}`, res.status)
    return await res.json() as SaveResponse
  }

  /**
   * Refine collected conversation text into mergeable memory candidates.
   * @param text - The collected conversation text.
   * @param namespace - The namespace to refine into.
   * @returns The refinement response with candidates.
   */
  async refine(text: string, namespace: string): Promise<RefineResponse> {
    const url = new URL('/v1/refine', this.endpoint)
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.headers(), 'content-type': 'application/json' },
      body: JSON.stringify({ text, namespace }),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new MemoryServiceError(`memory refine failed: HTTP ${res.status}`, res.status)
    return await res.json() as RefineResponse
  }
}

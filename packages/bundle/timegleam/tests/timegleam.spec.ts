import { describe, expect, it, vi } from 'vitest'
import {
  TIMEGLEAM_CREDENTIAL_REF,
  TIMEGLEAM_MCP_URL,
  TIMEGLEAM_SERVER_NAME,
  apply,
  inject,
  name,
  workspacePrompt,
} from '../src/index.ts'

interface Section {
  name: string
  order: number
  text: string
}

function bench() {
  const register = vi.fn()
  const section = vi.fn()
  const ctx = {
    mcpManager: { register },
    systemPrompt: {
      section,
      getSectionOrder: (value: string) => value === 'MCP_SERVERS' ? 3100 : 0,
    },
    inject: (deps: readonly string[], callback: (inner: unknown) => void) => {
      if (deps.length === 1 && deps[0] === 'systemPrompt') callback(ctx)
    },
  }
  apply(ctx as never)
  return { register, section, ctx }
}

describe('timegleam host plugin', () => {
  it('has a loader name and requires only the MCP fleet', () => {
    expect(name).toBe('timegleam')
    expect(inject).toEqual(['mcpManager'])
  })

  it('registers the public streamable-HTTP endpoint under its own name', () => {
    const { register } = bench()
    expect(register).toHaveBeenCalledOnce()
    const [serverName, entry] = register.mock.calls[0] as [string, Record<string, unknown>]
    expect(serverName).toBe(TIMEGLEAM_SERVER_NAME)
    expect(entry).toMatchObject({ transport: 'streamable-http', url: TIMEGLEAM_MCP_URL })
    expect(TIMEGLEAM_MCP_URL).toBe('https://timegleam.com/mcp')
  })

  it('resolves the bearer token through the credential seam instead of a literal', () => {
    const { register } = bench()
    const [, entry] = register.mock.calls[0] as [string, { headers: Record<string, string> }]
    expect(entry.headers.Authorization).toBe(`Bearer \${credential:${TIMEGLEAM_CREDENTIAL_REF}}`)
    expect(TIMEGLEAM_CREDENTIAL_REF).toBe('TIMEGLEAM_TOKEN')
    expect(entry.headers.Authorization).not.toMatch(/tmg_|aym_/u)
  })

  it('places one workspace section ahead of the MCP server roster', () => {
    const { section } = bench()
    expect(section).toHaveBeenCalledOnce()
    const [value] = section.mock.calls[0] as [Section]
    expect(value.name).toBe('timegleam:workspace')
    expect(value.order).toBe(3000)
    expect(value.text).toBe(workspacePrompt())
  })

  it('states the quote, identifier, revision, and untrusted-data rules', () => {
    const text = workspacePrompt()
    expect(text).toContain('project_context_get')
    expect(text).toContain('film_quote')
    expect(text).toContain('film_confirm')
    expect(text).toContain('explicitly consents')
    expect(text).toContain('request_id / submission_id')
    expect(text).toContain('untrusted creative data')
    expect(text).toContain('document revision')
  })
})

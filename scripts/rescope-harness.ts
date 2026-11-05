/**
 * Rescope harness package names from the upstream `@deepseek-ai` scope back to
 * this repository's `@hy` scope after an upstream merge. Upstream rewrites every
 * file it touches to its own package names, so a merge leaves thousands of stale
 * specifiers that nothing else catches early; this codemod is the mechanical
 * half of the merge ([name mapping](../docs/rescope.md)).
 *
 * The name set is derived from the workspace manifests rather than hardcoded:
 * every workspace package named `@hy/<rest>` also exists upstream as
 * `@deepseek-ai/<rest>`. Third-party packages that genuinely live under the
 * upstream scope, such as `@deepseek-ai/libreoffice-kit`, are not workspace
 * members and therefore keep their names. The vendored Cordis foundation
 * libraries carry upstream names without that scope at all, so they belong to
 * `rescope-vendor.ts` instead.
 *
 * A match must end on a package-name boundary, so `@deepseek-ai/dsh-foo` never
 * matches inside `@deepseek-ai/dsh-foo-bar`, and a second run is a no-op. Agent
 * Notes record what was true when written and stay untouched.
 *
 * Usage: `pnpm run rescope-harness [--apply|--check]`. Without a mode it reports
 * what would change. `--check` asserts the post-state: no residue outside the
 * excluded paths.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

const root = resolve(import.meta.dirname, '..')

/** Scope every workspace package was published under before this repository rescoped it. */
const UPSTREAM_SCOPE = '@deepseek-ai/'

/** This repository's scope. */
const LOCAL_SCOPE = '@hy/'

/** Workspace roots whose children are enumerated for package manifests. */
const WORKSPACE_GLOBS = ['vendor/*', 'packages/*/*', 'native/system', 'native/system/packages/*', 'apps/*'] as const

/** Path prefixes that keep their text: frozen records and files about the upstream names themselves. */
const EXCLUDED_PREFIXES = ['.agents/', 'patches/', 'vendor/'] as const

/** Files whose subject is the upstream names, so rewriting them would destroy the mapping. */
const EXCLUDED_FILES = ['docs/rescope.md', 'docs/rescope.zh.md'] as const

/** Text extensions the pass reads; binary assets never carry package specifiers. */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yml', '.yaml', '.md', '.py', '.mts', '.tpl', '.txt', '.ps1', '.sh'] as const

/** A package name this pass rewrites. */
interface Rename {
  readonly upstream: string
  readonly local: string
}

/**
 * Enumerate the directories matched by one workspace glob.
 * @param glob - workspace pattern with `*` segments only.
 * @returns absolute directory paths that exist.
 */
function expandGlob(glob: string): string[] {
  let paths = [root]
  for (const segment of glob.split('/')) {
    const next: string[] = []
    for (const path of paths) {
      if (segment !== '*') {
        next.push(join(path, segment))
        continue
      }
      let entries: readonly import('node:fs').Dirent[]
      try {
        entries = readdirSync(path, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) if (entry.isDirectory()) next.push(join(path, entry.name))
    }
    paths = next
  }
  return paths
}

/**
 * Read the workspace package names that need rescoping.
 * @returns renames ordered longest upstream name first, so no shorter name matches inside a longer one.
 */
function readRenames(): Rename[] {
  const renames: Rename[] = []
  for (const glob of WORKSPACE_GLOBS) {
    for (const directory of expandGlob(glob)) {
      let manifest: { name?: unknown }
      try {
        manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8')) as { name?: unknown }
      } catch {
        continue
      }
      const name = manifest.name
      if (typeof name !== 'string' || !name.startsWith(LOCAL_SCOPE)) continue
      renames.push({ upstream: UPSTREAM_SCOPE + name.slice(LOCAL_SCOPE.length), local: name })
    }
  }
  return renames.sort((left, right) => right.upstream.length - left.upstream.length)
}

/** Package names this pass rewrites. */
const RENAMES = readRenames()

/** Continuation characters of an npm package name; a match must not be followed by one. */
const NAME_CONTINUATION = /[a-z0-9-]/u

/**
 * Rewrite one file body.
 * @param text - file contents to rewrite.
 * @returns the rewritten contents; equal to `text` when nothing matched.
 */
export function rescopeText(text: string): string {
  let result = text
  for (const { upstream, local } of RENAMES) {
    let from = result.indexOf(upstream)
    if (from < 0) continue
    let out = ''
    let cursor = 0
    while (from >= 0) {
      const end = from + upstream.length
      if (NAME_CONTINUATION.test(result.charAt(end))) {
        from = result.indexOf(upstream, end)
        continue
      }
      out += result.slice(cursor, from) + local
      cursor = end
      from = result.indexOf(upstream, end)
    }
    result = out + result.slice(cursor)
  }
  return result
}

/** GitHub heading slug of a package name: Markdown drops punctuation and turns spaces into hyphens. */
function anchorSlug(name: string): string {
  return name.toLowerCase().replace(/[^\p{L}\p{N}_ -]/gu, '').replaceAll(' ', '-')
}

/**
 * Rewrite Markdown fragments that name a rescoped package's generated heading.
 *
 * A catalog heading naming the package slugs to the scope-free form, which `rescopeText`
 * cannot reach because the scope punctuation is gone. A link into such a heading
 * therefore needs its fragment rewritten to the local equivalent.
 * @param text - file contents to rewrite.
 * @returns the rewritten contents; equal to `text` when nothing matched.
 */
export function rescopeFragments(text: string): string {
  let result = text
  for (const { upstream, local } of RENAMES) {
    const from = '#' + anchorSlug(upstream)
    const to = '#' + anchorSlug(local)
    if (!result.includes(from)) continue
    let out = ''
    let cursor = 0
    let at = result.indexOf(from)
    while (at >= 0) {
      const end = at + from.length
      if (NAME_CONTINUATION.test(result.charAt(end))) {
        at = result.indexOf(from, end)
        continue
      }
      out += result.slice(cursor, at) + to
      cursor = end
      at = result.indexOf(from, end)
    }
    result = out + result.slice(cursor)
  }
  return result
}

/** One tracked file this pass would rewrite. */
interface RescopeHit {
  readonly file: string
  readonly occurrences: number
}

/**
 * List tracked files that still carry an upstream package name.
 * @returns hit files with the number of renamed occurrences each.
 */
function findHits(): RescopeHit[] {
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, maxBuffer: 1 << 30, encoding: 'utf8' }).split('\0').filter(Boolean)
  const hits: RescopeHit[] = []
  for (const file of tracked) {
    if (EXCLUDED_PREFIXES.some(prefix => file.startsWith(prefix))) continue
    if ((EXCLUDED_FILES as readonly string[]).includes(file)) continue
    if (!EXTENSIONS.some(extension => file.endsWith(extension))) continue
    const text = readFileSync(join(root, file), 'utf8')
    const rewritten = rescopeFragments(rescopeText(text))
    if (rewritten === text) continue
    const occurrences = RENAMES.reduce(
      (total, { upstream }) =>
        total + text.split(upstream).length - 1 + text.split('#' + anchorSlug(upstream)).length - 1,
      0,
    )
    hits.push({ file, occurrences })
  }
  return hits
}

const { values } = parseArgs({ options: { apply: { type: 'boolean' }, check: { type: 'boolean' } }, allowPositionals: false })
const hits = findHits()
if (values.apply === true) {
  for (const hit of hits) {
    const path = join(root, hit.file)
    const text = readFileSync(path, 'utf8')
    writeFileSync(path, rescopeFragments(rescopeText(text)))
  }
  console.log(`rescope-harness: rewrote ${String(hits.length)} files`)
} else if (values.check === true) {
  if (hits.length > 0) {
    for (const hit of hits.slice(0, 40)) console.error(`${hit.file} (${String(hit.occurrences)})`)
    throw new Error(`rescope-harness: ${String(hits.length)} files still use upstream package names`)
  }
  console.log('rescope-harness: clean')
} else {
  for (const hit of hits) console.log(`${hit.file} (${String(hit.occurrences)})`)
  console.log(`rescope-harness: ${String(hits.length)} files would change`)
}

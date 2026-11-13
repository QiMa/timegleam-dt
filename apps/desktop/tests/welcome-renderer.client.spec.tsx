// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Welcome } from '../src/client/WelcomePage.tsx'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveDesktopLocale } from '../src/locale.ts'
import type { WelcomeSaveResult, WelcomeNotice, WelcomeLoginState, WelcomeSignInResult } from '../src/welcome-api.ts'

const html = readFileSync(join(import.meta.dirname, '../renderer/welcome.html'), 'utf8')
afterEach(cleanup)

function mount(
  language = 'zh-CN',
  takeNotice = vi.fn<() => Promise<WelcomeNotice | undefined>>().mockResolvedValue(undefined),
  enterprise = false,
) {
  cleanup()
  const api = {
    enterprise,
    takeNotice,
    analytics: vi.fn(async (_event: string, _attributes: object) => {}),
    analyticsEnabled: async () => true,
    ...resolveDesktopLocale(language),
    saveApiKey: vi.fn<(value: string) => Promise<WelcomeSaveResult>>().mockResolvedValue({ ok: true }),
    openConsole: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    signIn: vi.fn<() => Promise<WelcomeSignInResult>>().mockResolvedValue({ ok: true }),
    cancelSignIn: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    copySignInLink: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    onLoginState: vi.fn<(listener: (state: WelcomeLoginState) => void) => () => void>().mockReturnValue(() => {}),
    skip: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  }
  const mounted = render(<Welcome api={api} />)
  const input = document.querySelector('input')!
  const button = (id: string) => document.querySelector<HTMLButtonElement>(id)!
  const enterKey = (value: string) => { fireEvent.change(input, { target: { value } }) }
  const submit = () => fireEvent.submit(document.querySelector('form')!)
  const copy = () => {
    const heading = document.querySelector('main')!.getAttribute('aria-labelledby')!
    return [
      document.title, document.querySelector('img')!.alt, document.getElementById(heading)!.textContent,
      ...heading === 'welcome-heading' ? [document.querySelector('#welcome-description')!.textContent] : [],
      ...heading === 'key-title' ? [
        document.querySelector('#key-description')!.textContent,
        document.querySelector('#key-hint')!.textContent,
        `${input.placeholder} [password]`,
      ] : [],
      ...[...document.querySelectorAll('button')].filter(item => item.closest('[hidden]') === null)
        .map(item => `${item.textContent || item.getAttribute('aria-label')}${item.disabled ? ' [disabled]' : ''}`),
      '',
    ].join('\n')
  }
  return { document, api, input, button, enterKey, submit, copy, unmount: mounted.unmount }
}

describe('desktop welcome presentation', () => {
  it.each(['zh-CN', 'en'])('renders the %s entry and access-key step', async (language) => {
    const view = mount(language)
    expect(view.document.documentElement.lang).toBe(language)
    expect(view.document.querySelector('img')!.getAttribute('src')).toBe('assets/welcome-brand.svg')
    await expect(view.copy()).toMatchFileSnapshot(`./expected/welcome/${language}.expected.txt`)
    fireEvent.click(view.button('#api-key'))
    expect(view.document.activeElement).toBe(view.input)
    expect(view.input.type).toBe('password')
    await expect(view.copy()).toMatchFileSnapshot(`./expected/welcome/${language}-api-key.expected.txt`)
  })

  it('sends one trimmed key, prevents competing actions, and clears it after saving', async () => {
    const view = mount()
    const saved = Promise.withResolvers<WelcomeSaveResult>()
    view.api.saveApiKey.mockReturnValue(saved.promise)
    fireEvent.click(view.button('#api-key'))
    view.enterKey('  tmg_desktop-example  ')
    view.submit()
    view.submit()
    fireEvent.click(view.button('#skip-key'))
    fireEvent.click(view.button('#back-to-login'))
    expect(view.api.saveApiKey).toHaveBeenCalledExactlyOnceWith('tmg_desktop-example')
    expect(view.api.skip).not.toHaveBeenCalled()
    expect(view.button('#save-key').disabled).toBe(true)
    expect(view.button('#save-key').textContent).toBe('')
    expect(view.button('#back-to-login').disabled).toBe(true)
    expect(view.document.querySelector<HTMLElement>('#key-form')!.hidden).toBe(false)
    saved.resolve({ ok: true })
    await vi.waitFor(() => { expect(view.input.value).toBe('') })
    expect(view.document.body.textContent).not.toContain('tmg_desktop-example')
  })

  it.each(['', 'bad key', '密钥', 'DEEPSEEK_API_KEY=sk-example', 'sk-example', '"tmg_example"', 'tmg_exa mple'])(
    'rejects input that is not an access key before sending it: %s', (value) => {
      const view = mount()
      fireEvent.click(view.button('#api-key'))
      view.enterKey(value)
      view.submit()
      expect(view.api.saveApiKey).not.toHaveBeenCalled()
      expect(view.document.querySelector<HTMLElement>('#key-error')!.hidden).toBe(false)
      expect(view.input.getAttribute('aria-invalid')).toBe('true')
    },
  )

  it.each([
    ['invalid', 'welcomeKeyRejected'],
    ['unreachable', 'welcomeKeyUnreachable'],
    ['store', 'welcomeKeyFailed'],
    [undefined, 'welcomeKeyFailed'],
  ] as const)('keeps the draft and explains a %s failure', async (reason, message) => {
    const view = mount()
    view.api.saveApiKey.mockResolvedValue(reason === undefined ? { ok: false } : { ok: false, reason })
    fireEvent.click(view.button('#api-key'))
    view.enterKey('tmg_retry')
    view.submit()
    await vi.waitFor(() => { expect(view.button('#save-key').disabled).toBe(false) })
    expect(view.input.value).toBe('tmg_retry')
    expect(view.document.querySelector('#key-error')!.textContent).toBe(view.api.messages[message])
    view.api.saveApiKey.mockResolvedValue({ ok: true })
    view.submit()
    await vi.waitFor(() => { expect(view.input.value).toBe('') })
  })

  it('opens the console page from the access-key step', async () => {
    const view = mount()
    fireEvent.click(view.button('#api-key'))
    fireEvent.click(view.button('#open-console'))
    await vi.waitFor(() => { expect(view.api.openConsole).toHaveBeenCalledOnce() })
    expect(view.document.querySelector<HTMLElement>('#key-form')!.hidden).toBe(false)
    view.api.openConsole.mockRejectedValueOnce(new Error('no browser'))
    fireEvent.click(view.button('#open-console'))
    await vi.waitFor(() => {
      expect(view.document.querySelector('#key-error')!.textContent).toBe(view.api.messages.welcomeConsoleFailed)
    })
  })

  it('skips without saving and starts a fresh renderer at the entry again', async () => {
    const view = mount()
    const skipped = Promise.withResolvers<undefined>()
    view.api.skip.mockReturnValue(skipped.promise)
    fireEvent.click(view.button('#api-key'))
    view.enterKey('tmg-not-saved')
    fireEvent.click(view.button('#skip-key'))
    try {
      expect(view.button('#save-key').textContent).toBe('')
      expect(view.button('#skip-key').textContent).toBe(view.api.messages.welcomeKeyLater)
      expect(view.button('#save-key').disabled).toBe(true)
      expect(view.button('#skip-key').disabled).toBe(true)
      expect(view.button('#back-to-login').disabled).toBe(true)
      fireEvent.click(view.button('#skip-key'))
      view.submit()
      expect(view.api.skip).toHaveBeenCalledOnce()
      expect(view.api.saveApiKey).not.toHaveBeenCalled()
    } finally {
      skipped.resolve(undefined)
    }
    await vi.waitFor(() => { expect(view.input.value).toBe('') })
    expect(view.api.skip).toHaveBeenCalledOnce()
    expect(view.api.saveApiKey).not.toHaveBeenCalled()
    expect(mount().document.querySelector<HTMLElement>('#key-form')!.hidden).toBe(true)
  })

  it('returns to the entry without saving and clears the draft and validation error', () => {
    const view = mount()
    fireEvent.click(view.button('#api-key'))
    view.enterKey('not-a-key')
    view.submit()
    fireEvent.click(view.button('#back-to-login'))
    expect(view.document.querySelector<HTMLElement>('#key-form')!.hidden).toBe(true)
    expect(view.document.activeElement).toBe(view.button('#api-key'))
    expect(view.input.value).toBe('')
    expect(view.api.saveApiKey).not.toHaveBeenCalled()
    expect(view.api.skip).not.toHaveBeenCalled()
    fireEvent.click(view.button('#api-key'))
    expect(view.input.value).toBe('')
    expect(view.document.querySelector<HTMLElement>('#key-error')!.hidden).toBe(true)
    expect(view.button('#save-key').disabled).toBe(true)
  })

  it('uses the enterprise gateway copy without the TimeGleam console', () => {
    const view = mount('zh-CN', undefined, true)
    expect(view.button('#open-console')).toBeNull()
    fireEvent.click(view.button('#api-key'))
    expect(view.document.querySelector('#key-description')!.textContent)
      .toBe(view.api.messages.welcomeKeyEnterpriseDescription)
    view.enterKey('ag_gateway_example')
    view.submit()
    expect(view.api.saveApiKey).toHaveBeenCalledExactlyOnceWith('ag_gateway_example')
  })

  it('keeps visible copy in the shell dictionaries and denies network access', () => {
    expect([...html.matchAll(/>([^<]*\p{L}[^<]*)</gu)]).toEqual([])
    expect(html).toContain("default-src 'none'")
    expect(html).toContain("form-action 'none'")
  })
})

it.each(['zh-CN', 'en'])('keeps the expiry notice visible above %s entry: %s', async (language) => {
  vi.useFakeTimers()
  try {
    const takeNotice = vi.fn<() => Promise<WelcomeNotice | undefined>>().mockResolvedValue(undefined).mockResolvedValueOnce('session-expired')
    const view = mount(language, takeNotice)
    await act(async () => {})
    const notice = screen.getByRole('alert')
    expect(notice.textContent).toBe(view.api.messages.welcomeSessionExpired)
    await expect(`${notice.textContent}\n`).toMatchFileSnapshot(`./expected/welcome/${language}-expired.expected.txt`)
    expect(view.button('#api-key').closest('[hidden]')).toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(screen.queryByRole('alert')).toBeNull()
    view.unmount()
    mount(language, takeNotice)
    await act(async () => {})
    expect(screen.queryByRole('alert')).toBeNull()
  } finally { cleanup(); vi.useRealTimers() }
})

it('keeps the entry usable when notification IPC fails', async () => {
  const view = mount('en', vi.fn<() => Promise<WelcomeNotice | undefined>>().mockRejectedValue(new Error('closed')))
  await act(async () => {})
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.click(view.button('#api-key'))
  expect(view.input.closest('[hidden]')).toBeNull()
})

it('ignores a notification received after its renderer unmounts', async () => {
  const pending = Promise.withResolvers<WelcomeNotice | undefined>()
  const view = mount('en', vi.fn<() => Promise<WelcomeNotice | undefined>>().mockReturnValue(pending.promise))
  view.unmount()
  mount('en')
  await act(async () => { pending.resolve('session-expired') })
  expect(screen.queryByRole('alert')).toBeNull()
})

it('reports the page once per display and each explicit action', () => {
  const view = mount()
  expect(view.api.analytics).not.toHaveBeenCalled()
  fireEvent.click(view.button('#api-key'))
  expect(view.api.analytics).toHaveBeenCalledExactlyOnceWith('auth_page_click', { button_name: 'sign_in' })
  fireEvent.click(view.button('#back-to-login'))
  expect(view.api.analytics.mock.calls.map(([action]) => action)).toEqual(['auth_page_click', 'auth_page_view'])
  fireEvent.click(view.button('#sign-in'))
  expect(view.api.analytics).toHaveBeenLastCalledWith('auth_page_click', { button_name: 'sign_in' })
})

describe('desktop welcome browser sign-in', () => {
  const state = (overrides: Partial<WelcomeLoginState> = {}): WelcomeLoginState => ({
    phase: 'waiting',
    authorizeUrl: 'https://timegleam.com/?desktop_login=0123456789abcdef0123456789abcdef',
    expiresAt: 1_700_000_000_000,
    ...overrides,
  })

  it('waits for browser approval with the copied link as the fallback', async () => {
    const view = mount('en')
    const attempt = Promise.withResolvers<WelcomeSignInResult>()
    view.api.signIn.mockReturnValue(attempt.promise)
    fireEvent.click(view.button('#sign-in'))
    expect(view.api.signIn).toHaveBeenCalledOnce()
    expect(view.document.querySelector<HTMLElement>('#key-form')!.hidden).toBe(true)
    expect(view.document.querySelector('#auth-status')!.textContent).toBe(view.api.messages.welcomeAuthStarting)
    const listener = view.api.onLoginState.mock.calls[0]![0]
    act(() => { listener(state()) })
    expect(view.document.querySelector('#auth-status')!.textContent).toBe(view.api.messages.welcomeAuthWaiting)
    expect(view.document.querySelector('#auth-description')!.textContent).toBe(view.api.messages.welcomeAuthWaitingDescription)
    expect(view.button('#auth-copy').textContent).toBe(view.api.messages.welcomeAuthCopyLink)
    expect(view.button('#auth-cancel').textContent).toBe(view.api.messages.welcomeAuthCancel)
    fireEvent.click(view.button('#auth-copy'))
    await vi.waitFor(() => { expect(view.button('#auth-copy').textContent).toBe(view.api.messages.welcomeAuthCopied) })
    expect(view.api.copySignInLink).toHaveBeenCalledOnce()
    attempt.resolve({ ok: false, reason: 'cancelled' })
  })

  it('hides the copy link until the Host reports an approval page', () => {
    const view = mount('en')
    view.api.signIn.mockReturnValue(Promise.withResolvers<WelcomeSignInResult>().promise)
    fireEvent.click(view.button('#sign-in'))
    expect(view.button('#auth-copy').closest('[hidden]')).not.toBeNull()
    expect(view.button('#auth-cancel').closest('[hidden]')).toBeNull()
  })

  it('reports a copy failure in place without leaving the wait', async () => {
    const view = mount('en')
    view.api.signIn.mockReturnValue(Promise.withResolvers<WelcomeSignInResult>().promise)
    view.api.copySignInLink.mockRejectedValueOnce(new Error('no attempt'))
    fireEvent.click(view.button('#sign-in'))
    act(() => { view.api.onLoginState.mock.calls[0]![0](state()) })
    fireEvent.click(view.button('#auth-copy'))
    await vi.waitFor(() => { expect(view.button('#auth-copy').textContent).toBe(view.api.messages.welcomeAuthCopyFailed) })
    expect(view.document.querySelector<HTMLElement>('#auth-page')!.hidden).toBe(false)
  })

  it('cancels back to the entry and drops the attempt', async () => {
    const view = mount('en')
    view.api.signIn.mockReturnValue(Promise.withResolvers<WelcomeSignInResult>().promise)
    fireEvent.click(view.button('#sign-in'))
    fireEvent.click(view.button('#auth-cancel'))
    await vi.waitFor(() => { expect(view.api.cancelSignIn).toHaveBeenCalledOnce() })
    await vi.waitFor(() => { expect(view.document.querySelector<HTMLElement>('#auth-page')!.hidden).toBe(true) })
    expect(view.button('#sign-in').closest('[hidden]')).toBeNull()
  })

  it.each([
    ['expired', 'welcomeAuthExpired'],
    ['network', 'welcomeAuthFailed'],
    ['unreachable', 'welcomeKeyUnreachable'],
    ['invalid', 'welcomeKeyRejected'],
    ['store', 'welcomeAuthFailed'],
  ] as const)('offers a retry after a %s failure', async (reason, message) => {
    const view = mount('en')
    view.api.signIn.mockResolvedValue({ ok: false, reason })
    fireEvent.click(view.button('#sign-in'))
    await vi.waitFor(() => { expect(view.button('#auth-retry').closest('[hidden]')).toBeNull() })
    expect(view.document.querySelector('#auth-status')!.textContent)
      .toBe(reason === 'expired' ? view.api.messages.welcomeAuthExpired : view.api.messages.welcomeAuthFailed)
    expect(view.document.querySelector('#auth-error')!.textContent)
      .toBe(reason === 'expired' ? '' : view.api.messages[message])
    expect(view.button('#auth-api-key').closest('[hidden]')).toBeNull()
    fireEvent.click(view.button('#auth-retry'))
    expect(view.api.signIn).toHaveBeenCalledTimes(2)
  })

  it('returns to the entry after a cancelled attempt', async () => {
    const view = mount('en')
    view.api.signIn.mockResolvedValue({ ok: false, reason: 'cancelled' })
    fireEvent.click(view.button('#sign-in'))
    await vi.waitFor(() => { expect(view.button('#sign-in').closest('[hidden]')).toBeNull() })
    expect(view.document.querySelector<HTMLElement>('#auth-page')!.hidden).toBe(true)
    expect(view.document.querySelector('#auth-error')!.textContent).toBe('')
  })
})

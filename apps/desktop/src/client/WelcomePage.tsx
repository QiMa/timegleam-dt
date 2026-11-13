/** Desktop welcome presentation; account and credential operations stay in the preload. */
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Toast } from '@hy/dsh-client-ui-primitives/src/Toast.tsx'
import { StateDot } from '@hy/dsh-client-ui-primitives/src/StateDot.tsx'
import type { WelcomeApi, WelcomeLoginState, WelcomeSignInResult } from '../welcome-api.ts'
import { TIMEGLEAM_TOKEN_PATTERN } from '../timegleam.ts'

type Page = 'entry' | 'key' | 'account'

/** Approval status the account page renders. */
type SignInPhase = 'starting' | 'waiting' | 'failed' | 'expired'

/** Human-readable reason a failed attempt stopped. */
function failureCopy(api: WelcomeApi, reason: Extract<WelcomeSignInResult, { ok: false }>['reason']): string {
  const m = api.messages
  return reason === 'invalid' ? m.welcomeKeyRejected
    : reason === 'unreachable' ? m.welcomeKeyUnreachable
      : m.welcomeAuthFailed
}

/**
 * Render the standalone TimeGleam welcome flow using shell-owned operations
 * and localized copy. No credential value ever reaches the renderer's state
 * after the write completes.
 * @param props.api - isolated preload API; the key is write-only.
 * @returns welcome pages with fixed bottom actions.
 */
export function Welcome({ api }: { api: WelcomeApi }) {
  const { messages: m } = api
  const [expiryNotice, setExpiryNotice] = useState(false)
  const [page, setPage] = useState<Page>('entry')
  const [phase, setPhase] = useState<SignInPhase>('starting')
  const [login, setLogin] = useState<WelcomeLoginState | undefined>(undefined)
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [draft, setDraft] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mounted = useRef(true)
  const signInRun = useRef(0)
  const input = useRef<HTMLInputElement>(null)
  const keyButton = useRef<HTMLButtonElement>(null)
  const focusEntry = useRef(false)

  useEffect(() => {
    mounted.current = true
    document.documentElement.lang = api.id
    document.title = m.welcomeTitle
    void api.takeNotice().then((notice) => {
      if (mounted.current && notice === 'session-expired') setExpiryNotice(true)
    }).catch((_closedChannel: unknown) => {
      // A closed Welcome IPC channel must not interrupt the form.
    })
    const stop = api.onLoginState((state) => {
      if (!mounted.current) return
      setLogin(state)
      setPhase('waiting')
    })
    return () => { mounted.current = false; stop() }
  }, [api, m.welcomeTitle])

  useEffect(() => {
    if (page === 'key') input.current?.focus()
    else if (focusEntry.current) {
      focusEntry.current = false
      keyButton.current?.focus()
    }
  }, [page, api])

  async function saveKey(event: FormEvent) {
    event.preventDefault()
    if (busyRef.current) return
    void api.analytics?.('api_key_save_click', {})
    const value = draft.trim()
    if (value === '') {
      setError(m.welcomeKeyBlank)
      input.current?.focus()
      return
    }
    if (api.enterprise ? !/^[\x21-\x7e]+$/.test(value) : !TIMEGLEAM_TOKEN_PATTERN.test(value)) {
      setError(m.welcomeKeyInvalid)
      input.current?.focus()
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const result = await api.saveApiKey(value)
      if (!mounted.current) return
      if (result.ok) setDraft('')
      else setError(result.reason === 'invalid' ? m.welcomeKeyRejected
        : result.reason === 'unreachable' ? m.welcomeKeyUnreachable : m.welcomeKeyFailed)
    } catch {
      if (mounted.current) setError(m.welcomeKeyFailed)
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }
  async function openConsole() {
    try {
      await api.openConsole()
    } catch {
      if (mounted.current) setError(m.welcomeConsoleFailed)
    }
  }
  async function signIn() {
    const run = ++signInRun.current
    setLogin(undefined)
    setCopy('idle')
    setError('')
    setPhase('starting')
    setPage('account')
    try {
      const result = await api.signIn()
      if (!mounted.current || signInRun.current !== run) return
      if (result.ok) return
      if (result.reason === 'cancelled') {
        setPage('entry')
        return
      }
      // An expired attempt already reads as a timeout; the description carries
      // the next step, so repeating it as an error would say it twice.
      setPhase(result.reason === 'expired' ? 'expired' : 'failed')
      setError(result.reason === 'expired' ? '' : failureCopy(api, result.reason))
    } catch {
      if (mounted.current && signInRun.current === run) {
        setPhase('failed')
        setError(m.welcomeAuthFailed)
      }
    }
  }
  async function cancelSignIn() {
    signInRun.current++
    try {
      await api.cancelSignIn()
    } catch {
      // The Host drops the attempt when the window closes anyway.
    }
    if (!mounted.current) return
    setLogin(undefined)
    setCopy('idle')
    setPage('entry')
  }
  async function copyLink() {
    try {
      await api.copySignInLink()
      if (mounted.current) setCopy('copied')
    } catch {
      if (mounted.current) setCopy('failed')
    }
  }
  async function skip() {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await api.skip()
      if (mounted.current) setDraft('')
    } catch {
      if (mounted.current) setError(m.welcomeContinueFailed)
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }

  const heading = page === 'entry' ? 'welcome-heading' : page === 'key' ? 'key-title' : 'auth-status'
  const waiting = page === 'account' && (phase === 'starting' || phase === 'waiting')
  const retryable = page === 'account' && (phase === 'failed' || phase === 'expired')
  const title = phase === 'starting' ? m.welcomeAuthStarting
    : phase === 'waiting' ? m.welcomeAuthWaiting
      : phase === 'expired' ? m.welcomeAuthExpired : m.welcomeAuthFailed

  return <>
    {expiryNotice && <Toast text={m.welcomeSessionExpired} onDone={() => { setExpiryNotice(false) }} />}
    <div className="titlebar" aria-hidden="true" />
    <main className="welcome" aria-labelledby={heading}>
      <img className="brand" src="assets/welcome-brand.svg" alt={m.welcomeBrand} width="472" height="40" />
      <div id="tagline" className="tagline" hidden={page !== 'entry'}>
        <h1 id="welcome-heading"><span>{m.welcomeTaglineBefore}</span><em>{m.welcomeTaglineBrand}</em><span>{m.welcomeTaglineAfter}</span></h1>
        <p id="welcome-description">{m.welcomeDescription}</p>
      </div>
      <form id="key-form" className="key-form" hidden={page !== 'key'} noValidate onSubmit={(event) => { void saveKey(event) }} aria-busy={busy}>
        <header className="key-heading">
          <h1 id="key-title">{m.welcomeKeyTitle}</h1>
          <p id="key-description">{api.enterprise ? m.welcomeKeyEnterpriseDescription : m.welcomeKeyDescription}</p>
          {!api.enterprise && <button id="open-console" className="copy-link" type="button" onClick={() => { void openConsole() }}>{m.welcomeOpenConsole}</button>}
        </header>
        <div className="key-field">
          <label className="visually-hidden" htmlFor="key-input">{m.welcomeKeyPlaceholder}</label>
          <input ref={input} id="key-input" type="password" autoComplete="new-password" autoCapitalize="off" spellCheck={false} required
            aria-describedby="key-description key-hint key-error" aria-invalid={error !== ''} placeholder={m.welcomeKeyPlaceholder}
            value={draft} disabled={busy} onChange={(event) => { setDraft(event.target.value); setError('') }} />
          <p id="key-hint" className="key-hint">{m.welcomeKeyModelHint}</p>
          <p id="key-error" className="key-error" role="alert" hidden={error === ''}>{error}</p>
        </div>
      </form>
      <section id="auth-page" className={`key-heading ${phase === 'waiting' ? 'auth-waiting' : phase === 'expired' ? 'auth-expired' : ''}`}
        hidden={page !== 'account'} aria-live="polite">
        <h1 id="auth-status">{title}</h1>
        <p id="auth-description" hidden={!waiting && phase !== 'expired'}>{phase === 'expired' ? m.welcomeAuthExpiredDescription : m.welcomeAuthWaitingDescription}</p>
        <button id="auth-copy" className="copy-link" type="button" hidden={!waiting || login === undefined} onClick={() => { void copyLink() }}>
          {copy === 'copied' ? m.welcomeAuthCopied : copy === 'failed' ? m.welcomeAuthCopyFailed : m.welcomeAuthCopyLink}
        </button>
        <p id="auth-error" className="key-error" role="alert" hidden={error === ''}>{error}</p>
      </section>
      <div id="entry-actions" className="actions" hidden={page !== 'entry'}>
        {!api.enterprise && <button id="sign-in" className="primary" type="button" onClick={() => {
          void api.analytics?.('auth_page_click', { button_name: 'sign_in' })
          void signIn()
        }}>{m.welcomeSignIn}</button>}
        <button ref={keyButton} id="api-key" className={api.enterprise ? 'primary' : 'secondary'} type="button" onClick={() => {
          void api.analytics?.('auth_page_click', { button_name: api.enterprise ? 'api-key' : 'sign_in' })
          setError('')
          setPage('key')
        }}>{m.welcomeApiKey}</button>
      </div>
      <div id="auth-actions" className="actions" hidden={page !== 'account'}>
        <button id="auth-loading" className="primary" type="button" hidden={!waiting} disabled aria-label={phase === 'starting' ? m.welcomeAuthStarting : m.welcomeAuthExchanging}>
          <StateDot state="ongoing" size={16} className="welcome-loading" />
        </button>
        <button id="auth-retry" className="primary" type="button" hidden={!retryable} onClick={() => { void signIn() }}>{m.welcomeAuthRetry}</button>
        <button id="auth-api-key" className="secondary" type="button" hidden={!retryable} onClick={() => {
          setError(''); setPage('key')
        }}>{m.welcomeApiKey}</button>
        <button id="auth-cancel" className="secondary" type="button" hidden={!waiting} onClick={() => { void cancelSignIn() }}>{m.welcomeAuthCancel}</button>
        <button id="auth-back" className="back" type="button" hidden={!retryable} onClick={() => {
          setError(''); focusEntry.current = true; setPage('entry')
        }}>{m.welcomeKeyBack}</button>
      </div>
      <div id="key-actions" className="actions" hidden={page !== 'key'}>
        <button id="save-key" className="primary" type="submit" form="key-form" disabled={busy || draft.trim() === ''}>
          {busy ? <StateDot state="ongoing" size={16} className="welcome-loading" /> : m.welcomeKeySave}
        </button>
        <button id="skip-key" className="secondary" type="button" disabled={busy} onClick={() => { void skip() }}>{m.welcomeKeyLater}</button>
        <button id="back-to-login" className="back" type="button" disabled={busy} onClick={() => {
          if (busyRef.current) return
          void api.analytics?.('auth_page_view', {})
          setDraft(''); setError(''); focusEntry.current = true; setPage('entry')
        }}>{m.welcomeKeyBack}</button>
      </div>
    </main>
  </>
}

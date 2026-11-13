/** Operations available to the isolated native welcome renderer. */

import type { ProductEventMap } from '@hy/dsh-client-product-analytics/types'
import type { DesktopLocale } from './locale.ts'

/** Private native welcome channels, installed only while its window exists. */
export const WELCOME_IPC = {
  saveApiKey: 'dsh-welcome:save-api-key',
  openConsole: 'dsh-welcome:open-console',
  signIn: 'dsh-welcome:sign-in',
  cancelSignIn: 'dsh-welcome:cancel-sign-in',
  copySignInLink: 'dsh-welcome:copy-sign-in-link',
  loginState: 'dsh-welcome:login-state',
  analytics: 'dsh-welcome:analytics',
  analyticsEnabled: 'dsh-welcome:analytics-enabled',
  skip: 'dsh-welcome:skip',
  start: 'dsh-welcome:start',
  cancel: 'dsh-welcome:cancel',
  copyLink: 'dsh-welcome:copy-link',
  state: 'dsh-welcome:state',
  takeNotice: 'dsh-welcome:take-notice',
} as const

/** Credential writes return a safe outcome without exposing Host diagnostics. */
export type WelcomeSaveResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason?: 'format' | 'invalid' | 'unreachable' | 'store' }

/** Browser approval facts the Host pushes while the user signs in on timegleam.com. */
export interface WelcomeLoginState {
  readonly phase: 'waiting'
  /** timegleam.com page carrying the one-time approval token. */
  readonly authorizeUrl: string
  /** Unix milliseconds after which the record no longer approves. */
  readonly expiresAt: number
}

/** Outcome of one browser sign-in attempt; the Host stores the key before reporting success. */
export type WelcomeSignInResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'cancelled' | 'expired' | 'network' | 'invalid' | 'unreachable' | 'store' }

/** One-time notification retained by the main process until Welcome receives it. */
export type WelcomeNotice = 'session-expired'

type WelcomeEventName = 'auth_page_view' | 'auth_page_click' | 'api_key_save_click'

/** Host-owned operations used by the welcome window. */
export interface WelcomeOperations {
  /** @param eventName - allowed welcome event. @param attributes - approved fields without credentials. */
  analytics?<K extends WelcomeEventName>(eventName: K, attributes: ProductEventMap[K]): Promise<void>
  /** @returns the Host's current effective collection policy. */
  analyticsEnabled(): Promise<boolean>
  /** @returns the pending notification, clearing it before another renderer can receive it. */
  takeNotice(): Promise<WelcomeNotice | undefined>
  /**
   * Store the TimeGleam access key before entering the workspace.
   * @param value - validated, trimmed access key (tmg_ or legacy aym_ prefix).
   * @returns the write outcome, without private error details or the key.
   */
  saveApiKey(value: string): Promise<WelcomeSaveResult>
  /** Open the TimeGleam console's access-key page in the default browser. */
  openConsole(): Promise<void>
  /**
   * Sign in through timegleam.com and store the key it issues.
   * @returns success once the key is stored, or why approval ended without one.
   */
  signIn(): Promise<WelcomeSignInResult>
  /** Stop waiting for browser approval; a stored key is never withdrawn. */
  cancelSignIn(): Promise<void>
  /** Copy the pending approval page; rejects when no attempt is waiting. */
  copySignInLink(): Promise<void>
  /**
   * Enter the workspace without writing an onboarding-completion setting.
   * @returns completion after the workspace opens.
   */
  skip(): Promise<void>
}

/** The renderer receives localized copy and write-only credential actions. */
export type WelcomeApi = DesktopLocale & WelcomeOperations & {
  /** Enterprise edition describes the organization-issued AirGap gateway. */
  readonly enterprise: boolean
  /**
   * Observe approval pages for the attempt started by {@link WelcomeOperations.signIn}.
   * @param listener - receives each waiting page until the attempt settles.
   * @returns an unsubscribe function; the window unsubscribes when it unmounts.
   */
  onLoginState(listener: (state: WelcomeLoginState) => void): () => void
}

/** Authentication facts supplied at cold start or after a completed sign-out. */
export interface WelcomeAuthentication {
  /** Enterprise profiles still onboard with a model-gateway key. */
  readonly enterprise?: boolean
  /** Standard profiles onboard with a TimeGleam access key. */
  readonly hasTimeGleamToken?: boolean
  /** Enterprise profiles onboard with this gateway key; unused by other editions. */
  readonly hasApiKey?: boolean
}

/**
 * Decide whether a startup or sign-out requires the welcome entry.
 * @param authentication - current profile edition and credential facts.
 * @returns true while the profile has no credential for its edition.
 */
export function needsWelcome(authentication: WelcomeAuthentication): boolean {
  return authentication.enterprise === true
    ? !authentication.hasApiKey
    : authentication.hasTimeGleamToken !== true
}

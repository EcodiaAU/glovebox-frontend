/* ------------------------------------------------------------------ */
/*  Injected third-party in-app-browser noise filter                    */
/*                                                                      */
/*  Pure, dependency-free and side-effect-free on purpose: it imports   */
/*  no Sentry SDK, so it is testable under any runner and safe to pull  */
/*  into both the client init and the instrumentation entry.            */
/* ------------------------------------------------------------------ */

/* Structural shapes. Sentry's own Event/StackFrame satisfy these, so the
 * predicate accepts a real event from @sentry/react, @sentry/nextjs and
 * @sentry/capacitor alike without importing any of them. */
export interface InjectedNoiseFrame {
  function?: string | null
}

export interface InjectedNoiseEvent {
  exception?: {
    values?: Array<{
      stacktrace?: { frames?: InjectedNoiseFrame[] }
    }>
  }
}

/* Function names belonging to the native-bridge script that Meta injects into
 * its iOS in-app WKWebView (Instagram and Facebook both). The injected script
 * reads window.webkit.messageHandlers without feature-detecting it, so it
 * throws on every page it wraps, and our global onerror handler files it as
 * OUR production error. First seen 2026-07-14 as Sentry issue COEXIST-H, from
 * Instagram 437.2.0 on iOS opening app.coexistaus.org; proven not-ours by
 * grepping the source AND every bundle the deployed origin serves.
 *
 * Match on FRAME NAME, never on the message. Inside our own Capacitor native
 * shell window.webkit.messageHandlers MUST exist, so an identical message
 * raised from OUR frames is a real bridge defect: a message-based filter
 * (ignoreErrors: [/window\.webkit\.messageHandlers/]) swallows it silently and
 * trades recurring noise for blindness. Frame-name matching keeps it visible.
 *
 * Doctrine: third-party-inapp-browser-injected-errors-are-not-our-defects-2026-07-14
 */
export const INJECTED_BRIDGE_FRAMES = new Set([
  'sendDataToNative',
  'sendPageHideMessage',
  '_AutofillCallbackHandler',
])

export function isInjectedThirdPartyBridgeError(event: InjectedNoiseEvent): boolean {
  const frames = event.exception?.values?.flatMap(
    (value) => value.stacktrace?.frames ?? [],
  )
  if (!frames?.length) return false
  return frames.some(
    (frame) => !!frame.function && INJECTED_BRIDGE_FRAMES.has(frame.function),
  )
}

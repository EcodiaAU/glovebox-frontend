/* ------------------------------------------------------------------ */
/*  Sentry error monitoring (glovebox-frontend)                                   */
/*                                                                     */
/*  Static import of @sentry/react so Vite ALWAYS bundles it into a    */
/*  resolvable chunk. A dynamic import carrying a vite-ignore pragma    */
/*  leaves a bare import('@sentry/react') in the built bundle that the  */
/*  browser cannot resolve, which throws at runtime and silently       */
/*  disables Sentry even with a valid DSN (the Co-Exist bug, 2026-07). */
/*  This module self-initialises on import; main.tsx just imports it.  */
/* ------------------------------------------------------------------ */

import * as Sentry from '@sentry/react'
import { isInjectedThirdPartyBridgeError } from './sentry-noise'

// Public Sentry client DSN (send-only key - safe to embed; it ships in the
// client bundle regardless). Hardcoded fallback so a build lacking
// VITE_SENTRY_DSN still reports. Env override wins when present.
const FALLBACK_SENTRY_DSN =
  'https://d2d7d4f8415b8302b7ee0568b245aa66@o4511685869305856.ingest.us.sentry.io/4511688181350400'

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN || FALLBACK_SENTRY_DSN
  if (!dsn) {
    console.warn('[sentry] no DSN - error reporting disabled')
    return
  }
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: 'glovebox-frontend@' + (import.meta.env.VITE_APP_VERSION || '1.0.0'),
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    beforeSend(event) {
      // Errors thrown by a script that a third-party in-app browser injected
      // into our page are not Glovebox defects, and they bury real
      // regressions in recurring noise. Matched on frame name, so a real
      // bridge failure carrying the identical message still reports.
      if (isInjectedThirdPartyBridgeError(event)) return null
      return event
    },
  })
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  console.error('[error]', error)
  Sentry.captureException(error, context)
}

// Self-initialise on import.
initSentry()

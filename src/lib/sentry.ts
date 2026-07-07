/* ------------------------------------------------------------------ */
/*  Sentry error monitoring (glovebox-frontend)                         */
/*                                                                     */
/*  @sentry/capacitor wraps the @sentry/react web SDK and drives the    */
/*  NATIVE crash reporters (sentry-cocoa on iOS, sentry-android on      */
/*  Android, incl. NDK / uncaught / tombstone) so native + plugin       */
/*  crashes are captured, not only JS-in-WebView. Sentry.init's SECOND  */
/*  arg is the sibling web init - Capacitor initialises the native      */
/*  layer and delegates the JS layer to it, both reporting into the ONE */
/*  Glovebox project, separated by dist:native vs dist:web. The         */
/*  @sentry/react peer is pinned EXACTLY to @sentry/capacitor's core    */
/*  version (10.60.0) so both layers share a single @sentry/core hub.   */
/*  This module self-initialises on import; main.tsx just imports it.   */
/* ------------------------------------------------------------------ */

import { Capacitor } from '@capacitor/core'
import * as Sentry from '@sentry/capacitor'
import * as SentryReact from '@sentry/react'

// Public Sentry client DSN (send-only key - safe to embed; it ships in the
// client bundle regardless). Hardcoded fallback so a build lacking
// VITE_SENTRY_DSN still reports. Env override wins when present.
const FALLBACK_SENTRY_DSN =
  'https://d2d7d4f8415b8302b7ee0568b245aa66@o4511685869305856.ingest.us.sentry.io/4511688181350400'

let initialised = false

export function initSentry() {
  if (initialised) return
  const dsn = import.meta.env.VITE_SENTRY_DSN || FALLBACK_SENTRY_DSN
  if (!dsn) {
    console.warn('[sentry] no DSN - error reporting disabled')
    return
  }
  const isNative = Capacitor.isNativePlatform()

  Sentry.init(
    {
      dsn,
      environment: import.meta.env.MODE,
      release: 'glovebox-frontend@' + (import.meta.env.VITE_APP_VERSION || '1.0.0'),
      // dist splits the native binary crash surface (dist:native) from the web
      // bundle (dist:web) so native crashes are filterable in the one project.
      dist: isNative ? 'native' : 'web',
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    },
    // Sibling JS init - Capacitor wires the native SDK around it.
    SentryReact.init,
  )

  Sentry.setTag('platform', Capacitor.getPlatform())
  Sentry.setTag('is_native', String(isNative))
  initialised = true

  // NATIVE-crash trigger for the native-capture verify gate and the standing
  // Sentry silent-death canary. Native only, gated OFF unless the dev server is
  // running or the build was stamped with VITE_SENTRY_CANARY=1; a normal
  // production `vite build` omits it so it never ships to end users.
  if (isNative && (import.meta.env.DEV || import.meta.env.VITE_SENTRY_CANARY === '1')) {
    ;(window as unknown as { __eosNativeCrash?: () => void }).__eosNativeCrash =
      () => {
        Sentry.setTag('canary', 'native')
        Sentry.nativeCrash()
      }
  }
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  console.error('[error]', error)
  Sentry.captureException(error, context)
}

// Self-initialise on import.
initSentry()

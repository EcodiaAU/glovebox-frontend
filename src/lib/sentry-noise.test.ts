import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isInjectedThirdPartyBridgeError, type InjectedNoiseEvent } from './sentry-noise.ts'

/*
 * Fixture is the real production event COEXIST-H (Sentry issue 7609288753,
 * 2026-07-14): Instagram 437.2.0 in-app browser on iOS 26.5.2 hitting
 * https://app.coexistaus.org/campouts/outback. Meta's injected bridge script
 * reads window.webkit.messageHandlers without feature-detecting it and throws.
 */
const instagramInjectedEvent: InjectedNoiseEvent = {
  exception: {
    values: [
      {
        stacktrace: {
          frames: [
            { function: 'None' },
            { function: 'sendPageHideMessage' },
            { function: 'sendDataToNative' },
          ],
        },
      },
    ],
  },
}

const metaAutofillEvent: InjectedNoiseEvent = {
  exception: {
    values: [{ stacktrace: { frames: [{ function: '_AutofillCallbackHandler' }] } }],
  },
}

/* Negative control 1: a genuine application error must survive the filter. */
const genuineAppError: InjectedNoiseEvent = {
  exception: {
    values: [
      {
        stacktrace: {
          frames: [
            { function: 'renderWithHooks' },
            { function: 'ListingDetail' },
          ],
        },
      },
    ],
  },
}

/* Negative control 2: the SAME message as the injected noise, raised from OUR
 * frames. Inside our own native shell window.webkit.messageHandlers must exist,
 * so this is a real bridge defect and must never be swallowed. This is the test
 * a message-based filter fails. */
const realNativeBridgeFailure: InjectedNoiseEvent = {
  exception: {
    values: [{ stacktrace: { frames: [{ function: 'nativeBridgeCall' }] } }],
  },
}

/* Negative control 3: an event with no frames at all. */
const framelessEvent: InjectedNoiseEvent = { exception: { values: [{}] } }

describe('isInjectedThirdPartyBridgeError', () => {
  it('drops the Instagram in-app browser injected bridge error', () => {
    assert.equal(isInjectedThirdPartyBridgeError(instagramInjectedEvent), true)
  })

  it('drops Meta autofill callback handler noise', () => {
    assert.equal(isInjectedThirdPartyBridgeError(metaAutofillEvent), true)
  })

  it('keeps a genuine application error', () => {
    assert.equal(isInjectedThirdPartyBridgeError(genuineAppError), false)
  })

  it('keeps a real native bridge failure carrying the identical message', () => {
    assert.equal(isInjectedThirdPartyBridgeError(realNativeBridgeFailure), false)
  })

  it('keeps an event that carries no stack frames', () => {
    assert.equal(isInjectedThirdPartyBridgeError(framelessEvent), false)
  })
})

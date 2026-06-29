/**
 * Front-door platform routing for the marketing landing.
 *
 * The cream sphere leads to the product's PRIMARY platform for the visitor's
 * device. The stores are not live yet (the App Store id is a placeholder and the
 * native apps are "coming soon"), so every platform routes into the live web app
 * at /trip for now. When the native apps ship, set ios/android to their store
 * URLs with external:true; the sphere will then open the store on those devices
 * and the "Open in browser -> /trip" link lights up automatically beneath it.
 */
export type Platform = 'ios' | 'android' | 'web';

export interface PlatformTarget {
  /** Where the sphere leads on this platform. */
  href: string;
  /** true = a store / off-app URL (leaves the SPA); false = an in-app route. */
  external: boolean;
}

/** The live web app entry, also the "open in browser" fallback on mobile. */
export const WEB_HREF = '/trip';

/** Primary destination per device. All web for now (stores not live). */
export const GLOVEBOX_TARGETS: Record<Platform, PlatformTarget> = {
  web: { href: WEB_HREF, external: false },
  ios: { href: WEB_HREF, external: false }, // TODO: App Store URL + external:true when live
  android: { href: WEB_HREF, external: false }, // TODO: Play URL + external:true when live
};

export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'web';
}

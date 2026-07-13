// src/app/(app)/new/page.tsx
//
// NO AuthGate. Planning a trip is free and needs no account (Tate 2026-07-13).
//
// This page used to be wrapped in AuthGate, and the reason was the trip counter:
// a localStorage free-trip limit is trivially cheatable, so /new forced a sign-in
// to make the SERVER count authoritative (see the anti-cheat note that headed the
// old tripGate.ts). There is no limit and no counter any more, so the only thing
// that wall still did was stop a stranger from trying the app before we had
// earned anything from them. Trips save to IndexedDB locally and sync up if and
// when an account appears.
import NewTripClientPage from "./ClientPage";

export default function Page() {
  return <NewTripClientPage />;
}

import type { EmergencyContact } from "@/lib/types/emergency";

/**
 * The browser's own contact picker, where the browser has one.
 *
 * This is the web peer of what the native apps now do: hand the user the OS
 * address book instead of a form, take back only the person they tapped, and
 * never gain read access to their contacts. The Contact Picker API is
 * out-of-process for exactly the same reason the native pickers are, so it needs
 * no permission and raises no prompt.
 *
 * It is NOT universal. At time of writing it ships in Chromium browsers on
 * Android and nowhere else: not desktop, not iOS Safari (where every browser is
 * WebKit, so no engine on iOS has it). That is why the SOS page keeps a typed
 * form as a fallback rather than replacing it outright. On the surfaces where
 * the picker exists, the web behaves exactly like the apps; everywhere else the
 * user types, which is the best the platform allows.
 *
 * Requires a secure context and a top-level frame, both of which the app has.
 */

type ContactsManager = {
  select: (
    props: string[],
    opts?: { multiple?: boolean },
  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
  getProperties: () => Promise<string[]>;
};

function contactsManager(): ContactsManager | null {
  if (typeof navigator === "undefined" || typeof window === "undefined") return null;
  const nav = navigator as Navigator & { contacts?: ContactsManager };
  // Both checks matter: `navigator.contacts` alone is also present on some
  // non-conforming surfaces, and ContactsManager on window is the spec's own
  // feature-detection hook.
  if (!nav.contacts || !("ContactsManager" in window)) return null;
  return nav.contacts;
}

/** True when this browser can hand us the OS address book. */
export function canPickContacts(): boolean {
  return contactsManager() !== null;
}

/**
 * Open the browser's contact picker and return the chosen person, or null if the
 * user dismissed it or the contact had no number (nobody we can reach).
 *
 * Throws only if the picker itself fails; a dismissal is not an error.
 */
export async function pickContact(): Promise<EmergencyContact | null> {
  const contacts = contactsManager();
  if (!contacts) return null;

  const selected = await contacts.select(["name", "tel"], { multiple: false });
  const person = selected?.[0];
  if (!person) return null; // user dismissed

  const phone = person.tel?.find((t) => t && t.trim().length > 0)?.trim();
  if (!phone) return null; // no number, so not reachable

  const name = person.name?.find((n) => n && n.trim().length > 0)?.trim();

  return {
    // The API gives us no stable contact id (deliberately, for privacy), so key
    // on the number. Re-picking the same person therefore still updates their
    // row rather than duplicating them, which is the behaviour the native apps
    // get from the address-book id.
    id: `tel:${phone}`,
    name: name || phone,
    phone,
  };
}

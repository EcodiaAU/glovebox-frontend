import type { EmergencyContact } from "@/lib/types/emergency";
import { upsertEmergencyContact, deleteEmergencyContact } from "@/lib/offline/emergencyStore";

/**
 * Emergency-contact mutations.
 *
 * These used to be "local-first": write to IndexedDB, enqueue a cloud op, fire a
 * best-effort push, and surface any sync failure in a banner. All of that is
 * gone. The contacts never leave the device, so there is nothing to queue, push,
 * merge or fail, and the functions are now just the store with a name.
 *
 * They stay as a layer because the SOS page calls them and because keeping the
 * seam makes it obvious where a cloud lane WOULD be reintroduced, which is the
 * thing not to do. See lib/types/emergency.ts.
 */

export async function saveEmergencyContact(contact: EmergencyContact) {
  return await upsertEmergencyContact(contact);
}

export async function removeEmergencyContact(id: string) {
  await deleteEmergencyContact(id);
}

import { idbGetAll, idbPut, idbDel, idbGet, idbStores } from "./idb";
import type { EmergencyContact } from "@/lib/types/emergency";

/**
 * The people the user picked for the SOS screen to call or text, held in
 * IndexedDB on this device.
 *
 * Deliberately dumb, and deliberately local. Every read and write works offline,
 * and offline is the case a safety surface has to be right for. There is no
 * cloud mirror: the Supabase table this used to sync to was dropped 2026-07-12
 * because the phone already backs up its own address book, so a second copy
 * bought nothing. `mergeEmergencyFromCloud` is gone with it.
 */

function normalizePhone(raw: string) {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/** Insertion order, which is the order the user picked them in. */
export async function listEmergencyContacts(): Promise<EmergencyContact[]> {
  const items = await idbGetAll<EmergencyContact>(idbStores.emergency);
  return items ?? [];
}

export async function getEmergencyContact(id: string): Promise<EmergencyContact | undefined> {
  return await idbGet<EmergencyContact>(idbStores.emergency, id);
}

/**
 * Save a contact. Keyed on `id`, which is the platform contact identifier when
 * the picker gave us one, so re-picking the same person updates them in place
 * (their number may have changed) rather than listing one human twice.
 */
export async function upsertEmergencyContact(input: EmergencyContact): Promise<EmergencyContact> {
  const next: EmergencyContact = {
    id: input.id,
    name: (input.name ?? "").trim(),
    phone: normalizePhone(input.phone ?? ""),
  };

  if (!next.id) throw new Error("Emergency contact missing id");
  if (!next.phone) throw new Error("A contact with no number cannot be called or texted");
  if (!next.name) next.name = next.phone;

  await idbPut(idbStores.emergency, next);
  return next;
}

export async function deleteEmergencyContact(id: string): Promise<void> {
  await idbDel(idbStores.emergency, id);
}

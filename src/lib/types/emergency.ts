/**
 * An emergency contact: a person the user chose for the SOS screen to call or
 * text.
 *
 * A snapshot of a name and a number, held on this device. There is no server row
 * and no sync. The phone already backs up its own address book, so a second copy
 * of it in our database bought nothing and cost a table, an op queue, a
 * last-write-wins merge and an error banner. All of it was removed 2026-07-12,
 * along with the Supabase table `public.emergency_contacts`, which no longer
 * exists. Do not reintroduce a cloud lane here.
 *
 * `id` is the platform contact identifier when the browser's Contact Picker gives
 * us one, otherwise a uuid, so re-picking the same person updates their row
 * rather than listing them twice. Matches the native apps, which key on the
 * address-book row id.
 */
export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
};

import "server-only";
import { notFound } from "next/navigation";
import type { AdminUser } from "@/lib/auth";
import { COLLECTIONS, type CollectionKey } from "@/lib/content/schema";
import { readEntryRow } from "@/lib/content/store";
import { canEditEntry } from "@/lib/rbac";

/**
 * Loads an entry for its editor (draft first). Entries `viewer` may not edit (authors: other
 * people's posts) are a 404, so ids can't be probed.
 */
export async function loadEntry<K extends CollectionKey>(
  collection: K,
  idParam: string,
  viewer: AdminUser,
) {
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const row = await readEntryRow(id);
  if (!row || row.collection !== collection) notFound();
  if (!canEditEntry(viewer, row)) notFound();
  const parsed = COLLECTIONS[collection].safeParse(row.draft ?? row.data);
  if (!parsed.success)
    throw new Error(`Stored ${collection} #${id} is invalid: ${parsed.error.message}`);
  return {
    id,
    data: parsed.data,
    published: row.data !== null,
    hasDraft: row.draft !== null && row.data !== null,
  };
}

import "server-only";
import { inArray, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { deleteObject } from "@/lib/storage";

/** Hard delete: storage object (R2 or local) first, then the row. Only binned files. */
export async function purgeRows(rows: (typeof media.$inferSelect)[]) {
  const gone: number[] = [];
  const failed: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      try {
        await deleteObject(r.key);
        gone.push(r.id);
      } catch (e) {
        // A missing object is fine; anything else keeps the row so it can be retried.
        const code = (e as { name?: string; Code?: string })?.name;
        if (code === "NoSuchKey" || code === "NotFound") gone.push(r.id);
        else failed.push(r.filename);
      }
    }),
  );
  if (gone.length) await db.delete(media).where(inArray(media.id, gone));
  return { purged: gone.length, failed };
}

/** Empty the bin (everything, or only files binned before `olderThan`). Used by the cron too. */
export async function emptyBinNow(olderThan?: Date) {
  const rows = await db
    .select()
    .from(media)
    .where(olderThan ? lt(media.deletedAt, olderThan) : isNotNull(media.deletedAt));
  return purgeRows(rows);
}

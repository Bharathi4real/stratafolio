import { createHash, timingSafeEqual } from "node:crypto";
import { lt } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { media, messages } from "@/db/schema";
import { revalidateMedia } from "@/lib/content/revalidate";
import { readGlobal } from "@/lib/content/store";
import { emptyBinNow } from "@/lib/media-bin";
import { pruneRateLimits } from "@/lib/rate-limit";
import { pruneStats } from "@/lib/stats";
import { APP_KEY, deleteObject, listObjects } from "@/lib/storage";

/** Constant-time comparison (hashing first makes the lengths equal). */
const sameSecret = (a: string, b: string) =>
  timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());

/**
 * Uploads that never got registered (abandoned, or rejected and not cleaned up) are deleted after
 * a day, so nothing unvetted stays on the public bucket.
 */
async function purgeStaleOrphans() {
  const cutoff = Date.now() - 86_400_000;
  const [objects, rows] = await Promise.all([
    listObjects(),
    db.select({ key: media.key }).from(media),
  ]);
  const known = new Set(rows.map((r) => r.key));
  const stale = objects.filter(
    (o) =>
      APP_KEY.test(o.key) &&
      !known.has(o.key) &&
      o.lastModified !== null &&
      o.lastModified.getTime() < cutoff,
  );
  await Promise.all(stale.map((o) => deleteObject(o.key).catch(() => undefined)));
  return stale.length;
}

/**
 * Nightly (Vercel cron): deletes contact messages older than the retention period, stats events
 * past the stats retention (if set), yesterday's visitor-hash salt, and binned media older than
 * the bin period (deleted from R2 too).
 */
export async function GET(req: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    !sameSecret(req.headers.get("authorization") ?? "", `Bearer ${process.env.CRON_SECRET}`)
  ) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { retentionMonths, statsRetentionMonths, binDays } = await readGlobal("privacy");
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - retentionMonths);
  const deleted = await db
    .delete(messages)
    .where(lt(messages.createdAt, cutoff))
    .returning({ id: messages.id });
  await pruneStats(statsRetentionMonths ?? 0);
  await pruneRateLimits();
  const orphans = await purgeStaleOrphans().catch((err) => {
    console.warn("cron: orphan cleanup failed", err);
    return 0;
  });
  let binned = 0;
  if (binDays) {
    const r = await emptyBinNow(new Date(Date.now() - binDays * 86_400_000));
    binned = r.purged;
    if (binned) revalidateMedia();
  }
  return Response.json({ deleted: deleted.length, binned, orphans });
}

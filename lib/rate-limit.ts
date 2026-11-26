import "server-only";
import { randomUUID } from "node:crypto";
import { lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { rateLimit } from "@/db/schema";

/**
 * Fixed-window rate limiter backed by Postgres, so the limit is shared by every serverless
 * instance (an in-memory Map only counts requests that land on the same instance).
 * Returns true when the caller is over the limit.
 */
export async function overLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const start = now - windowMs;
  const k = `app:${key}`.slice(0, 300);
  try {
    const rows = await db.execute<{ count: number }>(sql`
      insert into ${rateLimit} (id, key, count, last_request)
      values (${randomUUID()}, ${k}, 1, ${now})
      on conflict (key) do update set
        count = case when ${rateLimit.lastRequest} < ${start} then 1 else ${rateLimit.count} + 1 end,
        last_request = case when ${rateLimit.lastRequest} < ${start} then ${now} else ${rateLimit.lastRequest} end
      returning count`);
    const count = Number((rows as unknown as { count: number }[])[0]?.count ?? 1);
    return count > max;
  } catch (err) {
    // Fail open: a database hiccup shouldn't block real visitors.
    console.warn("rate-limit: check failed", err);
    return false;
  }
}

/** The client IP as seen by Vercel's edge (it overwrites x-forwarded-for, so it can't be spoofed there). */
export function clientIp(h: Headers) {
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** Deletes counters idle for more than a day (nightly cron). */
export async function pruneRateLimits() {
  await db.delete(rateLimit).where(lt(rateLimit.lastRequest, Date.now() - 86_400_000));
}

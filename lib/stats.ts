import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { statEvents, statSalts } from "@/db/schema";

/**
 * First-party, cookieless stats collector.
 * - Visitor id = sha256(daily random salt + IP + user agent), truncated. The salt lives one day,
 *   so ids can't be linked across days or reversed once it's deleted. IP and UA are never stored.
 * - Bots, prefetches, admin pages and signed-in admins are skipped.
 */

const BOT =
  /bot|crawl|spider|slurp|bing|duckduck|baidu|yandex|facebookexternal|embedly|quora|pinterest|vkshare|w3c_validator|whatsapp|telegram|discord|preview|lighthouse|headless|phantom|puppeteer|playwright|curl|wget|python|axios|node-fetch|go-http/i;

export const isBot = (ua: string) => !ua || BOT.test(ua);

const today = () => new Date().toISOString().slice(0, 10);
let saltCache: { day: string; salt: string } | null = null;

async function dailySalt() {
  const day = today();
  if (saltCache?.day === day) return saltCache.salt;
  const [row] = await db.select().from(statSalts).where(eq(statSalts.day, day)).limit(1);
  if (row) {
    saltCache = row;
    return row.salt;
  }
  const salt = randomBytes(16).toString("hex");
  await db.insert(statSalts).values({ day, salt }).onConflictDoNothing();
  // Another instance may have won the race; read back the stored one.
  const [stored] = await db.select().from(statSalts).where(eq(statSalts.day, day)).limit(1);
  saltCache = stored ?? { day, salt };
  return saltCache.salt;
}

export async function visitorId(ip: string, ua: string) {
  const salt = await dailySalt();
  return createHash("sha256").update(`${salt}|${ip}|${ua}`).digest("hex").slice(0, 20);
}

export function deviceOf(ua: string) {
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

/** Referrer → host, ignoring our own domain. */
export function referrerHost(ref: string | undefined, selfHost: string) {
  if (!ref) return null;
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    return h && h !== selfHost.replace(/^www\./, "") ? h.slice(0, 120) : null;
  } catch {
    return null;
  }
}

/** Only real site pages: no admin, API, files or Next internals. */
export function cleanPath(p: string) {
  const path = p.split(/[?#]/)[0].slice(0, 200) || "/";
  if (!path.startsWith("/")) return null;
  if (/^\/(admin|api|_next|uploads)(\/|$)/.test(path) || /\.[a-z0-9]{2,5}$/i.test(path))
    return null;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export const slugOf = (path: string) => path.match(/^\/blog\/([^/]+)$/)?.[1] ?? null;

export async function record(e: typeof statEvents.$inferInsert) {
  await db.insert(statEvents).values(e);
}

/** Retention, called by the nightly cron. months = 0 keeps events forever; salts always go. */
export async function pruneStats(months = 0) {
  if (months > 0) {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    await db.delete(statEvents).where(lt(statEvents.at, cutoff));
  }
  await db.delete(statSalts).where(lt(statSalts.day, today()));
}

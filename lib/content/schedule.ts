/**
 * Scheduled posts: a post whose stage is "published" and whose publish date is in the future
 * stays off the public site (lists, pages, feeds, sitemap, llms.txt) until that moment.
 * Safe on both server and client (no server-only imports).
 */
type Schedulable = { stage?: string | null; publishedAt?: string | null };

/** When a post goes live. Date-only values ("2026-10-12") mean the start of that day, UTC. */
export function liveAt(p: Schedulable): number | null {
  if (!p.publishedAt) return null;
  const v = /^\d{4}-\d{2}-\d{2}$/.test(p.publishedAt)
    ? `${p.publishedAt}T00:00:00Z`
    : p.publishedAt;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

export function isScheduled(p: Schedulable, now = Date.now()) {
  const t = liveAt(p);
  return p.stage === "published" && t !== null && t > now;
}

/** Seconds until the earliest scheduled post goes live, or null when nothing is queued. */
export function secondsToNextRelease(posts: Schedulable[], now = Date.now()) {
  let next = Number.POSITIVE_INFINITY;
  for (const p of posts) {
    const t = liveAt(p);
    if (p.stage === "published" && t !== null && t > now) next = Math.min(next, t);
  }
  return Number.isFinite(next) ? Math.ceil((next - now) / 1000) : null;
}

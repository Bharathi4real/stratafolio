import "server-only";
import { type SQL, sql } from "drizzle-orm";

/**
 * Postgres full-text search helpers. Queries are stemmed with the `english` config and every
 * word is a prefix match, so "flick" finds "flicker" and "caching" finds "cache". Results are
 * ranked with ts_rank_cd over weighted vectors (title > summary > tags > body).
 */

/** "Cache components!" → "cache:* & components:*" (letters and digits only; null when empty). */
export function prefixQuery(q: string): string | null {
  const words = (q.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, 8);
  return words.length ? words.map((w) => `${w}:*`).join(" & ") : null;
}

export const tsQuery = (q: string) => sql`to_tsquery('english', ${q})`;

/** Search words → ILIKE patterns for the substring fallback (% and _ matched literally). */
export function likeWords(q: string) {
  return q
    .trim()
    .slice(0, 100)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((w) => `%${w.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
}

/** Every word appears somewhere in `hay` (catches code identifiers and partial words). */
export const allLike = (hay: SQL, q: string) => {
  const words = likeWords(q);
  return words.length
    ? sql.join(
        words.map((w) => sql`${hay} ilike ${w}`),
        sql` and `,
      )
    : sql`false`;
};

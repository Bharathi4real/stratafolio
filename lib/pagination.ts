/**
 * Page numbers to show for a pager: always the first and last page, the current page with one
 * neighbour each side, and "gap" markers where pages are skipped. Pages are 1-based.
 *   pageWindow(1, 3)  → [1, 2, 3]
 *   pageWindow(6, 12) → [1, "gap", 5, 6, 7, "gap", 12]
 */
export function pageWindow(current: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "gap")[] = [1];
  let from = Math.max(2, current - 1);
  let to = Math.min(count - 1, current + 1);
  // Keep the strip the same width at the edges (1 2 3 4 … 12 rather than 1 2 … 12).
  if (current <= 3) to = 4;
  if (current >= count - 2) from = count - 3;
  if (from > 2) out.push("gap");
  for (let p = from; p <= to; p++) out.push(p);
  if (to < count - 1) out.push("gap");
  out.push(count);
  return out;
}

/** "11–20 of 34" (1-based, inclusive). */
export function rangeLabel(page: number, pageSize: number, total: number) {
  if (!total) return "0 of 0";
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return start === end ? `${start} of ${total}` : `${start}–${end} of ${total}`;
}

/** Parses ?page= into a 1-based integer (anything invalid → 1). */
export function parsePage(v: string | string[] | undefined) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** Blog archive filters, all in the URL so every view is shareable. */
export type BlogFilters = {
  /** Topic slug (lowercase category). */
  category?: string | null;
  /** Free-text search over title, summary and tags. */
  q?: string | null;
  /** One tag (exact, case-insensitive). */
  tag?: string | null;
  /** "published" = only readable posts; "upcoming" = only "Coming soon". */
  show?: "published" | "upcoming" | null;
  /** "oldest" flips the order; newest first is the default. */
  sort?: "oldest" | null;
};

export const hasFilters = (f: BlogFilters) =>
  Boolean(f.category || f.q || f.tag || f.show || f.sort);

/** /blog URLs: filters as query params, ?page= only from page 2 on. */
export function blogHref(page: number, filters?: BlogFilters | string | null) {
  const f: BlogFilters = typeof filters === "string" ? { category: filters } : (filters ?? {});
  const q = new URLSearchParams();
  if (f.category) q.set("category", f.category);
  if (f.tag) q.set("tag", f.tag);
  if (f.q?.trim()) q.set("q", f.q.trim());
  if (f.show) q.set("show", f.show);
  if (f.sort) q.set("sort", f.sort);
  if (page > 1) q.set("page", String(page));
  const s = q.toString();
  return `/blog${s ? `?${s}` : ""}`;
}

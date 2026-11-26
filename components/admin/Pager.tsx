"use client";

import { Arrow } from "@/components/ui/Arrow";
import { pageWindow, rangeLabel } from "@/lib/pagination";
import { Select } from "./Select";

/**
 * Admin pager: "21–40 of 57", ‹ 1 … 4 5 6 … 12 ›, optional rows-per-page select.
 * `page` is 0-based (TanStack Table / server pages); labels are 1-based.
 */
export function Pager({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  onPageSize,
  sizes = [20, 50, 100],
  label = "Pagination",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  sizes?: number[];
  label?: string;
}) {
  if (!total) return null;
  const current = page + 1;
  const many = pageCount > 1;
  return (
    <nav className="pager" aria-label={label}>
      <span className="mono subtle pager-range">{rangeLabel(current, pageSize, total)}</span>
      {many ? (
        <div className="pager-pages">
          <button
            type="button"
            className="pg"
            aria-label="Previous page"
            disabled={current === 1}
            onClick={() => onPage(page - 1)}
          >
            <Arrow dir="prev" />
          </button>
          {pageWindow(current, pageCount).map((p, i) =>
            p === "gap" ? (
              <span className="pg-gap" key={`gap-${i}`} aria-hidden="true">
                …
              </span>
            ) : (
              <button
                type="button"
                className="pg"
                key={p}
                aria-label={`Page ${p}`}
                aria-current={p === current ? "page" : undefined}
                onClick={() => onPage(p - 1)}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className="pg"
            aria-label="Next page"
            disabled={current === pageCount}
            onClick={() => onPage(page + 1)}
          >
            <Arrow dir="next" />
          </button>
        </div>
      ) : null}
      {onPageSize ? (
        <div className="pager-size">
          <span className="mono subtle">Rows</span>
          <Select
            size="sm"
            label="Rows per page"
            value={String(pageSize)}
            onChange={(v) => onPageSize(Number(v))}
            options={sizes.map((s) => ({ value: String(s), label: String(s) }))}
          />
        </div>
      ) : null}
    </nav>
  );
}

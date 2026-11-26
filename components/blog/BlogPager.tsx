import Link from "next/link";
import { Arrow } from "@/components/ui/Arrow";
import { type BlogFilters, blogHref, pageWindow, rangeLabel } from "@/lib/pagination";

/**
 * Archive pager: real links (crawlable, shareable, Back works, no JS needed).
 * ‹ Newer · 1 … 4 5 6 … 12 · Older ›  with "11–20 of 34 posts" beside it.
 */
export function BlogPager({
  page,
  pageCount,
  total,
  perPage,
  filters,
}: {
  page: number;
  pageCount: number;
  total: number;
  perPage: number;
  filters?: BlogFilters;
}) {
  if (pageCount <= 1) return null;
  const href = (p: number) => `${blogHref(p, filters)}#all-posts`;
  return (
    <nav className="blog-pager" aria-label="Blog pages">
      <p className="bp-range">
        {rangeLabel(page, perPage, total)} <span>posts</span>
      </p>
      <div className="bp-links">
        {page > 1 ? (
          <Link className="bp-step" href={href(page - 1)} rel="prev" scroll={false}>
            <Arrow dir="left" /> Newer
          </Link>
        ) : (
          <span className="bp-step" aria-disabled="true">
            <Arrow dir="left" /> Newer
          </span>
        )}
        <ol className="bp-nums">
          {pageWindow(page, pageCount).map((p, i) =>
            p === "gap" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: gaps have no identity
              <li className="bp-gap" key={`gap-${i}`} aria-hidden="true">
                …
              </li>
            ) : (
              <li key={p}>
                {p === page ? (
                  <span className="bp-num" aria-current="page">
                    <span className="sr-only">Page </span>
                    {String(p).padStart(2, "0")}
                  </span>
                ) : (
                  <Link className="bp-num" href={href(p)} scroll={false}>
                    <span className="sr-only">Page </span>
                    {String(p).padStart(2, "0")}
                  </Link>
                )}
              </li>
            ),
          )}
        </ol>
        {page < pageCount ? (
          <Link className="bp-step" href={href(page + 1)} rel="next" scroll={false}>
            Older <Arrow dir="right" />
          </Link>
        ) : (
          <span className="bp-step" aria-disabled="true">
            Older <Arrow dir="right" />
          </span>
        )}
      </div>
    </nav>
  );
}

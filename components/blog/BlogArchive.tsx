"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { LiquidChips } from "@/components/contact/LiquidChips";
import { track } from "@/lib/analytics";
import { gsap, prefersReducedMotion, ScrollTrigger } from "@/lib/gsap";
import { scrollToTarget } from "@/lib/lenis";
import { useDebouncedCallback } from "@/lib/pacer";
import { type BlogFilters, blogHref, hasFilters } from "@/lib/pagination";

/**
 * "All posts": liquid topic filter, search, status, sort and tag filters + the current page of
 * rows (rendered on the server). Every change navigates to /blog?… (page 1), so filtering and
 * paging always agree and every state has a shareable URL. Rows ease in after each change.
 */
export function BlogArchive({
  heading,
  categories,
  tags,
  filters,
  total,
  pageKey,
  empty,
  emptyText,
  pager,
  children,
}: {
  heading: string;
  categories: string[];
  tags: string[];
  filters: BlogFilters;
  total: number;
  pageKey: string;
  empty: boolean;
  emptyText: string;
  pager: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cat, setCat] = useState(filters.category ?? "all");
  const [q, setQ] = useState(filters.q ?? "");
  const [allTags, setAllTags] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Back/forward or a pager link changed the URL: follow it.
  useEffect(() => setCat(filters.category ?? "all"), [filters.category]);
  useEffect(() => setQ(filters.q ?? ""), [filters.q]);

  // New page or filter rendered: bring the archive into view and ease the rows in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run when the page changes
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = ref.current;
    if (!root) return;
    if (root.getBoundingClientRect().top < 0) scrollToTarget("#all-posts", -110);
    const rows = root.querySelectorAll<HTMLElement>("[data-post-cat]");
    const reduced = prefersReducedMotion();
    gsap.fromTo(
      rows,
      { autoAlpha: 0, y: reduced ? 0 : 14 },
      {
        autoAlpha: 1,
        y: 0,
        duration: reduced ? 0 : 0.6,
        ease: "expo.out",
        stagger: 0.05,
        onComplete: () => ScrollTrigger.refresh(),
      },
    );
  }, [pageKey]);

  const go = (next: Partial<BlogFilters>, replace = false) => {
    const href = blogHref(1, { ...filters, ...next });
    start(() => (replace ? router.replace : router.push)(href, { scroll: false }));
  };
  const apply = (next: string) => {
    setCat(next);
    track("blog_filter", { category: next });
    go({ category: next === "all" ? null : next });
  };
  const search = useDebouncedCallback(
    (v: string) => {
      if (v.trim()) track("blog_search", { length: v.trim().length });
      go({ q: v.trim() || null }, true);
    },
    { wait: 350 },
  );
  const shownTags = allTags ? tags : tags.slice(0, 10);
  const activeTag = filters.tag ?? null;

  return (
    <div ref={ref} id="all-posts" data-pending={pending || undefined}>
      <div className="blog-bar" data-reveal>
        <h2>{heading}</h2>
        <LiquidChips
          name="cat"
          legend="Filter by topic"
          legendClassName=""
          options={[
            { value: "all", label: "All" },
            ...categories.map((c) => ({ value: c.toLowerCase(), label: c })),
          ]}
          value={cat}
          onChange={apply}
        />
      </div>

      <div className="blog-tools" data-reveal>
        <label className="blog-search">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <span className="sr-only">Search posts</span>
          <input
            type="search"
            placeholder="Search posts"
            value={q}
            maxLength={80}
            onChange={(e) => {
              setQ(e.target.value);
              search(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && q) {
                setQ("");
                go({ q: null }, true);
              }
            }}
          />
        </label>
        <fieldset className="blog-seg">
          <legend className="sr-only">Show</legend>
          {(
            [
              [null, "All"],
              ["published", "Published"],
              ["upcoming", "Coming soon"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={(filters.show ?? null) === v}
              onClick={() => go({ show: v })}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <button
          type="button"
          className="blog-sort"
          onClick={() => go({ sort: filters.sort ? null : "oldest" })}
          aria-label={`Sort: ${filters.sort ? "oldest first" : "newest first"}. Click to flip.`}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 4v16M4.5 16.5 8 20l3.5-3.5M16 20V4M12.5 7.5 16 4l3.5 3.5" />
          </svg>
          {filters.sort ? "Oldest first" : "Newest first"}
        </button>
      </div>

      {tags.length ? (
        <div className="blog-tags" data-reveal>
          <span className="eyebrow">Tags</span>
          {shownTags.map((t) => {
            const on = activeTag === t.toLowerCase();
            return (
              <button
                key={t}
                type="button"
                className="tag"
                aria-pressed={on}
                onClick={() => go({ tag: on ? null : t.toLowerCase() })}
              >
                #{t}
              </button>
            );
          })}
          {tags.length > 10 ? (
            <button type="button" className="blog-more" onClick={() => setAllTags((x) => !x)}>
              {allTags ? "Fewer" : `+${tags.length - 10} more`}
            </button>
          ) : null}
        </div>
      ) : null}

      {hasFilters(filters) ? (
        <p className="blog-result" aria-live="polite">
          <span>
            {total} {total === 1 ? "post" : "posts"}
          </span>
          <button
            type="button"
            onClick={() => {
              setQ("");
              setCat("all");
              start(() => router.push("/blog", { scroll: false }));
            }}
          >
            Clear filters
          </button>
        </p>
      ) : null}

      <div className="blog-list" aria-busy={pending}>
        {children}
      </div>
      {empty ? (
        <p className="blog-empty">
          {hasFilters(filters) ? "No posts match these filters." : emptyText}
        </p>
      ) : null}
      {pager}
    </div>
  );
}

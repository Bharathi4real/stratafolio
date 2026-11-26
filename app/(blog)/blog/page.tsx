import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, ViewTransition } from "react";
import { AuthorAvatar } from "@/components/blog/AuthorAvatar";
import { BlogArchive } from "@/components/blog/BlogArchive";
import { BlogPager } from "@/components/blog/BlogPager";
import { NoteFeature, readLabel } from "@/components/blog/NoteFeature";
import { SiteMotion } from "@/components/providers/SiteMotion";
import { blogLd, breadcrumbLd, JsonLd } from "@/components/seo/JsonLd";
import { ArrowRight } from "@/components/ui/Icons";
import { Pill } from "@/components/ui/Pill";
import { Accent, plain } from "@/components/ui/Rich";
import { Sk } from "@/components/ui/Skeleton";
import { CardTopo, StaticTopo } from "@/components/ui/Topo";
import { resolveAuthor } from "@/lib/author";
import type { Post } from "@/lib/content/schema";
import { blogFeedAlternate, noindexFollow } from "@/lib/document";
import { currentYear } from "@/lib/now";
import { type BlogFilters, blogHref, hasFilters, parsePage } from "@/lib/pagination";
import {
  getAuthors,
  getBlogPage,
  getBrand,
  getPosts,
  getSettings,
  getSocials,
  searchPostSlugs,
  splitPosts,
} from "@/lib/queries";
import { fmtDay } from "@/lib/time";

type Param = string | string[] | undefined;
type Search = Promise<{
  page?: Param;
  category?: Param;
  q?: Param;
  tag?: Param;
  show?: Param;
  sort?: Param;
}>;
const one = (v: Param) => (Array.isArray(v) ? v[0] : v)?.trim() || null;

/**
 * Query → the slice of the archive to render:
 * ?category= (topic slug), ?tag=, ?q= (search), ?show=published|upcoming, ?sort=oldest, ?page=.
 */
async function archive(searchParams: Search) {
  const sp = await searchParams;
  const [page, posts] = await Promise.all([getBlogPage(), getPosts()]);
  const { published, upcoming } = splitPosts(posts);
  // Settings order first (only categories in use), then any older ones posts still carry.
  const used = new Set(posts.map((p) => p.category));
  const categories = [
    ...(page.categories ?? []).filter((c) => used.has(c)),
    ...[...used].filter((c) => !(page.categories ?? []).includes(c)).sort(),
  ];
  const tagCount = new Map<string, number>();
  for (const p of posts) for (const t of p.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
  const tags = [...tagCount]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([t]) => t);

  const rawCat = one(sp.category)?.toLowerCase() ?? null;
  const category = rawCat && rawCat !== "all" ? rawCat : null;
  const label = categories.find((c) => c.toLowerCase() === category) ?? null;
  const rawTag = one(sp.tag)?.toLowerCase() ?? null;
  const tag = tags.find((t) => t.toLowerCase() === rawTag) ?? null;
  // A category or tag no post carries is a missing page, not an empty archive (no soft 404s).
  const unknown = Boolean((category && !label) || (rawTag && !tag));
  const q = one(sp.q)?.slice(0, 80) ?? null;
  const showRaw = one(sp.show);
  const show = showRaw === "published" || showRaw === "upcoming" ? showRaw : null;
  const sort = one(sp.sort) === "oldest" ? ("oldest" as const) : null;
  const filters: BlogFilters = { category, tag: tag?.toLowerCase() ?? null, q, show, sort };

  // Search runs in Postgres (stemmed, prefix, ranked); scheduled posts never match because
  // getPosts() has already dropped them.
  const ranks = q ? await searchPostSlugs(q) : null;
  const matches = (p: Post) => {
    if (category && p.category.toLowerCase() !== category) return false;
    if (tag && !p.tags?.some((t) => t.toLowerCase() === tag.toLowerCase())) return false;
    if (ranks && !ranks.has(p.slug)) return false;
    return true;
  };
  const byRank = (a: Post, b: Post) => (ranks?.get(a.slug) ?? 0) - (ranks?.get(b.slug) ?? 0);
  let pub = show === "upcoming" ? [] : published.filter(matches);
  let up = show === "published" ? [] : upcoming.filter(matches);
  // Best matches first while searching, unless the reader picked an order.
  if (ranks && !sort) {
    pub = [...pub].sort(byRank);
    up = [...up].sort(byRank);
  }
  const ordered = sort === "oldest" ? [...pub].reverse().concat(up) : [...pub, ...up];
  const perPage = page.perPage ?? 10;
  const pageCount = Math.max(1, Math.ceil(ordered.length / perPage));
  const current = parsePage(sp.page);
  return {
    page,
    published,
    upcoming,
    categories,
    tags,
    tag,
    filters,
    category,
    label,
    ordered,
    perPage,
    pageCount,
    current,
    unknown,
    slice: ordered.slice((current - 1) * perPage, current * perPage),
  };
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Search;
}): Promise<Metadata> {
  const [{ page, current, pageCount, unknown, label, tag, filters }, brand] = await Promise.all([
    archive(searchParams),
    getBrand(),
  ]);
  // Metadata resolves before the archive streams, so these answer with a real 404 status
  // (Google treats a 200 "nothing here" page as a soft 404).
  if (unknown || current > pageCount) notFound();
  const blogName = page.siteName?.trim() || `${brand.siteName} · Blog`;
  const parts = [
    label ? `${label} posts` : null,
    tag ? `#${tag}` : null,
    current > 1 ? `Page ${current}` : null,
  ].filter(Boolean);
  // The layout's template adds the blog name; the unfiltered archive is the blog's home page.
  const title = parts.length ? parts.join(", ") : null;
  const url = blogHref(current, filters);
  // Search, status, sort and tag views are thin duplicates of the archive (a tag usually holds a
  // post or two): keep them out of the index but let crawlers follow through to the posts.
  const thin = Boolean(filters.q || filters.show || filters.sort || filters.tag);
  const feed = blogFeedAlternate(page.rss === true);
  // Each category page gets its own description, so search results don't show the same snippet.
  const intro = page.intro?.trim() || undefined;
  const description = label
    ? `${label} posts by ${brand.ownerName}${intro ? `. ${intro}` : "."}`
    : intro;
  return {
    // No title on the unfiltered archive: it's the blog's home, titled by the layout (blog name).
    ...(title ? { title } : {}),
    description,
    // Indexable views are self-canonical (each archive page too, as Google recommends). Noindexed
    // views get no canonical: noindex plus a canonical pointing elsewhere is a conflicting signal.
    alternates: {
      ...(thin ? {} : { canonical: url }),
      ...(feed ? { types: feed } : {}),
    },
    ...(thin ? noindexFollow : {}),
    // A page's openGraph replaces the layout's whole object (shallow merge), so repeat siteName.
    openGraph: {
      type: "website",
      siteName: brand.siteName,
      locale: "en_US",
      title: title ? `${title} · ${blogName}` : plain(page.heading) || blogName,
      description,
      url,
    },
  };
}

/**
 * The hero is part of the prerendered shell; the archive depends on ?page= and ?category=,
 * so it streams in behind a skeleton (Cache Components).
 */
export default async function BlogIndex({ searchParams }: { searchParams: Search }) {
  const [page, posts, settings, brand, authors] = await Promise.all([
    getBlogPage(),
    getPosts(),
    getSettings(),
    getBrand(),
    getAuthors(),
  ]);
  const { published } = splitPosts(posts);
  return (
    <>
      <JsonLd
        data={[
          blogLd(
            settings,
            {
              name: page.siteName?.trim() || `${brand.siteName} · Blog`,
              description: page.intro,
            },
            published.filter((p) => !p.meta?.noindex),
            (p) => resolveAuthor(p.authorId, authors, settings),
          ),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
          ]),
        ]}
      />
      <section className="page-hero gutter">
        <StaticTopo seed="blog-hero" cx={1050} cy={160} n={22} />
        <p className="eyebrow" data-reveal>
          {page.eyebrow}
        </p>
        <h1 data-split>
          <Accent text={page.heading} />
        </h1>
        <div className="ph-row">{page.intro ? <p data-reveal>{page.intro}</p> : null}</div>
      </section>
      <Suspense fallback={<ArchiveSkeleton />}>
        <BlogBody searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function ArchiveSkeleton() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading posts">
      <section className="gutter">
        <Sk h="clamp(16rem, 32vw, 24rem)" r="1.25rem" />
      </section>
      <section className="section gutter sk-rows" style={{ paddingTop: "3rem" }}>
        {[0, 1, 2].map((i) => (
          <div className="sk-row" key={i}>
            <Sk w="5rem" h=".7rem" />
            <div className="sk-col">
              <Sk w="min(30rem, 90%)" h="1.6rem" r=".4rem" />
              <Sk w="min(36rem, 100%)" h=".9rem" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

async function BlogBody({ searchParams }: { searchParams: Search }) {
  const [a, settings, authors, socials] = await Promise.all([
    archive(searchParams),
    getSettings(),
    getAuthors(),
    getSocials(),
  ]);
  const authorOf = (p: { authorId?: string | null }) =>
    resolveAuthor(p.authorId, authors, settings);
  const { page, published, categories, tags, filters, ordered, perPage, pageCount, current } = a;
  if (current > pageCount) notFound();
  // The featured card belongs to the unfiltered first page only.
  const latest = !hasFilters(filters) && current === 1 ? published[0] : undefined;

  // Group this page's rows by year (published by date; drafts with the newest year).
  const thisYear = await currentYear();
  const year = (p: Post) => (p.publishedAt ? new Date(p.publishedAt).getUTCFullYear() : thisYear);
  const years = [...new Set(a.slice.map(year))].sort((a, b) => b - a);

  return (
    <>
      {latest ? (
        <section className="blog-featured gutter" aria-label="Latest post">
          <NoteFeature post={latest} number={published.length} author={authorOf(latest)} />
        </section>
      ) : null}

      <section className="section gutter" style={{ paddingTop: 0 }} aria-label="All posts">
        <BlogArchive
          // On a category or tag view the section heading names it, so the page's headings
          // match its title (the h1 above is the blog's own and stays in the static shell).
          heading={
            a.label
              ? `${a.label} posts`
              : a.tag
                ? `Posts tagged #${a.tag}`
                : (page.archiveHeading ?? "All posts")
          }
          categories={categories}
          tags={tags}
          filters={filters}
          total={ordered.length}
          pageKey={`${blogHref(current, filters)}`}
          empty={ordered.length === 0}
          emptyText={page.emptyText ?? ""}
          pager={
            <BlogPager
              page={current}
              pageCount={pageCount}
              total={ordered.length}
              perPage={perPage}
              filters={filters}
            />
          }
        >
          {years.map((y) => (
            <div className="year-group" data-year-group key={y}>
              <span className="yr" aria-hidden="true">
                {y}
              </span>
              <ol>
                {a.slice
                  .filter((p) => year(p) === y)
                  .map((p) =>
                    p.stage === "published" ? (
                      <li className="post-row" data-post-cat={p.category.toLowerCase()} key={p.id}>
                        <CardTopo seed={p.slug} />
                        <Link href={`/blog/${p.slug}`}>
                          <span className="pr-date">
                            {p.publishedAt ? fmtDay(p.publishedAt) : ""}
                          </span>
                          <div className="pr-main">
                            <ViewTransition
                              name={`post-title-${p.slug}`}
                              share="morph"
                              default="none"
                            >
                              <h3>{p.title}</h3>
                            </ViewTransition>
                            <p>{p.excerpt}</p>
                            <div className="tags">
                              {p.tags?.map((t) => (
                                <span className="tag" key={t}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="pr-side">
                            <span className="pr-author">
                              <AuthorAvatar author={authorOf(p)} size="sm" />
                              {authorOf(p).name}
                            </span>
                            <span className="pr-read">{readLabel(p)}</span>
                            <span className="pr-go">
                              <ArrowRight width={1.8} />
                            </span>
                          </div>
                        </Link>
                      </li>
                    ) : (
                      <li
                        className="post-row is-draft"
                        data-post-cat={p.category.toLowerCase()}
                        key={p.id}
                      >
                        <div>
                          <span className="pr-date">Coming soon</span>
                          <div className="pr-main">
                            <h3>{p.title}</h3>
                            <p>{p.excerpt}</p>
                            <div className="tags">
                              {p.tags?.map((t) => (
                                <span className="tag" key={t}>
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="pr-side">
                            <span className={`q-status ${p.stage === "writing" ? "wip" : ""}`}>
                              <i />
                              {p.stage === "writing" ? "Writing" : "Draft"}
                            </span>
                          </div>
                        </div>
                      </li>
                    ),
                  )}
              </ol>
            </div>
          ))}
        </BlogArchive>
        <div className="blog-cta" data-reveal>
          <div>
            <h3>{page.ctaTitle}</h3>
            <p>{page.ctaBody}</p>
          </div>
          <div className="cta-btns">
            {socials
              .filter((l) => l.inContact && /^https?:/.test(l.href))
              .slice(0, 2)
              .map((l, i) => (
                <Pill
                  key={l.id}
                  href={l.href}
                  variant={i === 0 ? "accent" : "ghost"}
                  large
                  external
                >
                  {i === 0 ? `Follow on ${l.name}` : l.name}
                </Pill>
              ))}
          </div>
        </div>
      </section>
      <SiteMotion />
    </>
  );
}

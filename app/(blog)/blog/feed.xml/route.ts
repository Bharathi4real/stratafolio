import { siteUrl } from "@/components/seo/JsonLd";
import { getBlogPage, getPosts, getSeo, getSettings } from "@/lib/queries";

/**
 * /blog/feed.xml: RSS 2.0 feed of published posts, built from live content. Off by default: served
 * only when Blog settings → RSS feed is on (404 otherwise). When on, it ignores Settings → SEO →
 * indexing (feeds are for readers); an empty blog is an empty channel.
 */

const MAX_ITEMS = 50;

/** True for code points allowed in XML 1.0 (tab, LF, CR, U+0020–U+D7FF, U+E000–U+FFFD, astral). */
const xmlChar = (c: number) =>
  c === 0x9 ||
  c === 0xa ||
  c === 0xd ||
  (c >= 0x20 && c <= 0xd7ff) ||
  (c >= 0xe000 && c <= 0xfffd) ||
  (c >= 0x10000 && c <= 0x10ffff);

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escape text for XML content/attributes and drop characters XML 1.0 forbids. */
function xml(s?: string | null) {
  let out = "";
  // for…of walks code points, so lone surrogates (invalid) are dropped, pairs are kept.
  for (const ch of s ?? "") {
    const c = ch.codePointAt(0) ?? 0;
    if (!xmlChar(c)) continue;
    out += ENTITIES[ch] ?? ch;
  }
  return out;
}

/** RFC 822 date for RSS, or null when the input isn't a valid date. */
function rssDate(x?: string | null) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d.toUTCString();
}

const time = (x?: string | null) => {
  const t = x ? new Date(x).getTime() : Number.NaN;
  return Number.isNaN(t) ? 0 : t;
};

export async function GET() {
  const page = await getBlogPage();
  if (page.rss !== true) {
    return new Response("Not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "x-content-type-options": "nosniff",
      },
    });
  }
  const [s, seo, posts] = await Promise.all([getSettings(), getSeo(), getPosts()]);
  const base = siteUrl();
  const published = posts
    .filter((p) => p.stage === "published" && !p.meta?.noindex)
    .sort((a, b) => time(b.publishedAt ?? b.createdAt) - time(a.publishedAt ?? a.createdAt))
    .slice(0, MAX_ITEMS);

  const title = page.siteName?.trim() || `${s.brand} · Blog`;
  const description = page.intro?.trim() || seo.description;
  const newest = published.reduce<string | null>(
    (acc, p) => (time(p.updatedAt) > time(acc) ? p.updatedAt : acc),
    null,
  );
  const lastBuild = rssDate(newest);

  const items = published.map((p) => {
    const link = `${base}/blog/${encodeURIComponent(p.slug)}`;
    const pubDate = rssDate(p.publishedAt ?? p.createdAt);
    const cats = [p.category, ...(p.tags ?? [])].filter((c) => c.trim());
    return [
      "    <item>",
      `      <title>${xml(p.title)}</title>`,
      `      <link>${xml(link)}</link>`,
      `      <guid isPermaLink="true">${xml(link)}</guid>`,
      `      <description>${xml(p.excerpt)}</description>`,
      pubDate ? `      <pubDate>${xml(pubDate)}</pubDate>` : "",
      ...cats.map((c) => `      <category>${xml(c)}</category>`),
      "    </item>",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xml(title)}</title>`,
    `    <link>${xml(`${base}/blog`)}</link>`,
    `    <description>${xml(description)}</description>`,
    "    <language>en</language>",
    lastBuild ? `    <lastBuildDate>${xml(lastBuild)}</lastBuildDate>` : "",
    `    <atom:link href="${xml(`${base}/blog/feed.xml`)}" rel="self" type="application/rss+xml"/>`,
    ...items,
    "  </channel>",
    "</rss>",
  ]
    .filter((l) => l !== "")
    .join("\n");

  // No cache-control of our own: Next.js derives it from the cached data (refreshed when a post
  // is published or unpublished) and marks draft-mode responses private, so an admin's preview
  // of unpublished posts can never be cached by the CDN.
  return new Response(`${body}\n`, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

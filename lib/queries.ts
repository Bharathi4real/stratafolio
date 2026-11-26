import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { draftMode } from "next/headers";
import { db } from "@/db";
import { entries, user } from "@/db/schema";
import type { Brand, Logo } from "./brand";
import { isScheduled, secondsToNextRelease } from "./content/schedule";
import type { GlobalKey } from "./content/schema";
import { GLOBAL_TAG, type Post } from "./content/schema";
import { getMediaByIds, readEntries, readEntryBySlug, readGlobal } from "./content/store";
import { prefixQuery, tsQuery } from "./search";
import { type SocialLink, socialsOf } from "./socials";

/**
 * Cached reads for the public site (Cache Components: `'use cache'`).
 *
 * Every read lives as long as possible (`cacheLife("max")`) and is tagged; publishing in the
 * admin expires the tag (lib/content/revalidate.ts), so the live site updates without a redeploy
 * and pages stay in the prerendered static shell. In Draft Mode (admin live preview) Next.js
 * re-runs these functions on every request without storing them, and `isDraft()` switches the
 * reads to unpublished drafts.
 */
export async function isDraft() {
  return (await draftMode()).isEnabled;
}

async function readGlobalCached<K extends GlobalKey>(key: K) {
  "use cache";
  cacheLife("max");
  cacheTag(GLOBAL_TAG[key]);
  return readGlobal(key, { draft: await isDraft() });
}

export const getSettings = () => readGlobalCached("site-settings");
export const getNavigation = () => readGlobalCached("navigation");
export const getHome = () => readGlobalCached("home-page");
export const getToolkit = () => readGlobalCached("toolkit");
export const getSeo = () => readGlobalCached("seo");
export const getPrivacy = () => readGlobalCached("privacy");
export const getBlogPage = () => readGlobalCached("blog-page");
export const getAppearance = () => readGlobalCached("appearance");

export async function getProjects() {
  "use cache";
  cacheLife("max");
  cacheTag("projects");
  return readEntries("projects", { draft: await isDraft() });
}

export async function getProject(slug: string) {
  "use cache";
  cacheLife("max");
  cacheTag("projects", `projects:${slug}`);
  return readEntryBySlug("projects", slug, { draft: await isDraft() });
}

export async function getExperience() {
  "use cache";
  cacheLife("max");
  cacheTag("experience");
  return (await readEntries("experience", { draft: await isDraft() })).sort((a, b) =>
    b.start.localeCompare(a.start),
  );
}

/**
 * Cache lifetime for post reads. With a post scheduled, the entry revalidates right when it
 * goes live (min 60 s); `expire` stays long so the read remains in the prerendered shell.
 */
function postsLife(rows: { stage?: string | null; publishedAt?: string | null }[], draft: boolean) {
  const secs = draft ? null : secondsToNextRelease(rows);
  if (secs === null) cacheLife("max");
  else
    cacheLife({
      stale: 300,
      revalidate: Math.min(Math.max(secs, 60), 30 * 86_400),
      expire: 365 * 86_400,
    });
}

/** All visible posts (every stage, minus ones scheduled for later), newest first. */
export async function getPosts() {
  "use cache";
  cacheTag("posts");
  const draft = await isDraft();
  const rows = await readEntries("posts", { draft });
  postsLife(rows, draft);
  // Draft Mode (admin preview) shows scheduled posts too, so they can be checked before release.
  return rows
    .filter((p) => draft || !isScheduled(p))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
}

export async function getPost(slug: string) {
  "use cache";
  cacheTag("posts", `posts:${slug}`);
  const draft = await isDraft();
  const post = await readEntryBySlug("posts", slug, { draft });
  postsLife(post ? [post] : [], draft);
  return post && (draft || !isScheduled(post)) ? post : null;
}

export type Author = {
  id: string;
  name: string;
  image: string | null;
  role: string;
  byline: string | null;
  bio: string | null;
};
/** Public author profiles (never emails), keyed by user id. */
export async function getAuthors(): Promise<Map<string, Author>> {
  "use cache";
  cacheLife("max");
  cacheTag("authors");
  const list = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      role: user.role,
      byline: user.byline,
      bio: user.bio,
    })
    .from(user);
  return new Map(list.map((a) => [a.id, a]));
}

/** Public URL of a media item (résumé, covers). */
export async function getMediaUrl(id: number | null | undefined) {
  "use cache";
  cacheLife("max");
  cacheTag("media");
  if (typeof id !== "number") return undefined;
  return (await getMediaByIds([id])).get(id)?.url;
}

/** A cover image's URL, blurred preview and alt text. */
export async function getMediaImage(id: number | null | undefined) {
  "use cache";
  cacheLife("max");
  cacheTag("media");
  if (typeof id !== "number") return undefined;
  const m = (await getMediaByIds([id])).get(id);
  return m ? { url: m.url, blur: m.blur, alt: m.alt } : undefined;
}

/** Media rows for rich text (comma-separated ids, so the cache key stays a plain string). */
export async function getMediaItems(ids: string) {
  "use cache";
  cacheLife("max");
  cacheTag("media");
  const map = await getMediaByIds(ids.split(",").map(Number).filter(Boolean));
  return Object.fromEntries(
    [...map].map(([k, v]) => [
      k,
      { url: v.url, alt: v.alt, width: v.width, height: v.height, blur: v.blur },
    ]),
  );
}

/** Splits posts into published (newest first) and upcoming (writing first, then drafts by age). */
export function splitPosts(posts: Post[]) {
  const published = posts
    .filter((p) => p.stage === "published")
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const rank = (p: Post) => (p.stage === "writing" ? 0 : 1);
  const upcoming = posts
    .filter((p) => p.stage !== "published")
    .sort((a, b) => rank(a) - rank(b) || a.createdAt.localeCompare(b.createdAt));
  return { published, upcoming };
}

/**
 * Public blog search: Postgres full-text search over published content (`search_live`),
 * stemmed, prefix-matched and ranked. Not cached: it depends on the query, and runs inside the
 * /blog archive's Suspense boundary. Returns slug → rank position (0 = best).
 */
export async function searchPostSlugs(q: string): Promise<Map<string, number>> {
  const pq = prefixQuery(q);
  if (!pq) return new Map();
  const tsq = tsQuery(pq);
  const rank = sql<number>`ts_rank_cd(${entries.searchLive}, ${tsq})`;
  const rows = await db
    .select({ slug: entries.slug, rank })
    .from(entries)
    .where(and(eq(entries.collection, "posts"), sql`${entries.searchLive} @@ ${tsq}`))
    .orderBy(desc(rank))
    .limit(200);
  return new Map(rows.map((r, i) => [r.slug, i]));
}

/**
 * Related posts for the end of an article: published posts ranked by shared tags (each shared
 * tag counts 2, rarer tags a little more), then same category (1), then recency.
 */
export function relatedPosts(post: Post, posts: Post[], limit = 3): Post[] {
  const published = posts.filter((p) => p.stage === "published" && p.slug !== post.slug);
  const tagCount = new Map<string, number>();
  for (const p of posts)
    for (const t of p.tags ?? [])
      tagCount.set(t.toLowerCase(), (tagCount.get(t.toLowerCase()) ?? 0) + 1);
  const mine = new Set((post.tags ?? []).map((t) => t.toLowerCase()));
  return published
    .map((p) => {
      let score = 0;
      for (const t of p.tags ?? []) {
        const k = t.toLowerCase();
        if (mine.has(k)) score += 2 + 1 / (tagCount.get(k) ?? 1);
      }
      if (p.category === post.category) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort(
      (a, b) => b.score - a.score || (b.p.publishedAt ?? "").localeCompare(a.p.publishedAt ?? ""),
    )
    .slice(0, limit)
    .map((x) => x.p);
}

/** Logos + favicons from Settings → Appearance, with media ids resolved to URLs. */
export async function getBrand(): Promise<Brand> {
  "use cache";
  cacheLife("max");
  cacheTag(GLOBAL_TAG.appearance, GLOBAL_TAG["site-settings"], "media");
  const draft = await isDraft();
  const [a, s] = await Promise.all([
    readGlobal("appearance", { draft }),
    readGlobal("site-settings", { draft }),
  ]);
  const ids = [a.logoImage, a.logoImageLight, a.favicon, a.adminLogoImage, a.adminFavicon];
  const m = await getMediaByIds(ids);
  const file = (id: number | null | undefined) => (id ? (m.get(id) ?? null) : null);
  const text = a.logoText?.trim() || s.brand;
  const height = a.logoHeight ?? 28;
  const site: Logo =
    a.logoType === "image" && file(a.logoImage)
      ? {
          type: "image",
          text,
          src: file(a.logoImage)?.url ?? "",
          srcLight: file(a.logoImageLight)?.url ?? null,
          height,
        }
      : { type: "text", text };
  const adminText = a.adminLogoText?.trim() || text;
  const admin: Logo =
    a.adminLogo === "same" || !a.adminLogo
      ? site
      : a.adminLogo === "image" && file(a.adminLogoImage)
        ? {
            type: "image",
            text: adminText,
            src: file(a.adminLogoImage)?.url ?? "",
            srcLight: null,
            height: Math.min(height, 32),
          }
        : { type: "text", text: adminText };
  const icon = (id: number | null | undefined) => {
    const f = file(id);
    return f ? { url: f.url, mime: f.mime } : null;
  };
  const favicon = icon(a.favicon);
  return {
    site,
    admin,
    favicon,
    adminFavicon: icon(a.adminFavicon) ?? favicon,
    adminTitle: a.adminTitle?.trim() || `${s.brand} Admin`,
    adminBadge: a.adminBadge?.trim() || "Admin",
    siteName: s.brand,
    ownerName: s.fullName,
  };
}

/** Profile links with custom icons resolved. */
export async function getSocials(): Promise<SocialLink[]> {
  "use cache";
  cacheLife("max");
  cacheTag(GLOBAL_TAG["site-settings"], "media");
  const s = await readGlobal("site-settings", { draft: await isDraft() });
  const ids = (s.socials ?? [])
    .map((x) => x.icon)
    .filter((x): x is number => typeof x === "number");
  const m = await getMediaByIds(ids);
  return socialsOf(s, new Map([...m].map(([id, r]) => [id, r.url])));
}

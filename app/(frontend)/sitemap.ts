import type { MetadataRoute } from "next";
import { absUrl, siteUrl } from "@/components/seo/JsonLd";
import { blogHref } from "@/lib/pagination";
import { getMediaUrl, getPosts, getPrivacy, getProjects, getSeo } from "@/lib/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [posts, projects, seo, privacy] = await Promise.all([
    getPosts(),
    getProjects(),
    getSeo(),
    getPrivacy(),
  ]);
  // Nothing to list when the site asks not to be indexed (robots.txt disallows everything too).
  if (seo.allowIndexing === false) return [];
  const published = posts.filter((p) => p.stage === "published" && !p.meta?.noindex);
  // Category archives are indexable pages of their own (tag views are not; see /blog metadata).
  const categories = new Map<string, string | undefined>();
  for (const p of published) {
    const key = p.category.toLowerCase();
    const prev = categories.get(key);
    if (!prev || p.updatedAt > prev) categories.set(key, p.updatedAt);
  }
  // Image sitemap entries are pictures shown on the page: the cover photo, when a post has one.
  const covers = await Promise.all(published.map((p) => getMediaUrl(p.coverImage)));
  // With a single category its archive is the same list as /blog, so skip it.
  const multiCategory = categories.size > 1;
  return [
    {
      url: `${base}/`,
      changeFrequency: "monthly",
      priority: 1,
      lastModified: [...projects, ...published]
        .map((x) => x.updatedAt)
        .sort()
        .at(-1),
    },
    {
      url: `${base}/blog`,
      changeFrequency: "weekly",
      priority: 0.8,
      lastModified: published
        .map((p) => p.updatedAt)
        .sort()
        .at(-1),
    },
    ...(multiCategory
      ? [...categories].map(([c, lastModified]) => ({
          url: `${base}${blogHref(1, c)}`,
          lastModified,
          changeFrequency: "weekly" as const,
          priority: 0.5,
        }))
      : []),
    ...projects
      .filter((p) => !(p as { meta?: { noindex?: boolean } }).meta?.noindex)
      .map((p) => ({
        url: `${base}/work/${p.slug}`,
        lastModified: p.updatedAt,
        priority: 0.7,
      })),
    ...published.map((p, i) => {
      const cover = absUrl(covers[i]);
      return {
        url: `${base}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        priority: 0.7,
        ...(cover ? { images: [cover] } : {}),
      };
    }),
    {
      url: `${base}/privacy`,
      priority: 0.2,
      ...(privacy.updated ? { lastModified: privacy.updated } : {}),
    },
  ];
}

import type { Experience, Post, Project, SiteSettings } from "@/lib/content/schema";
import { socialsOf } from "@/lib/socials";

export const siteUrl = () =>
  (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function JsonLd({ data }: { data: object | object[] }) {
  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD, escaped below
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

/** Stable ids, so every page's JSON-LD points at the same Person, WebSite and Blog nodes. */
export const personId = () => `${siteUrl()}/#person`;
export const websiteId = () => `${siteUrl()}/#website`;
export const blogId = () => `${siteUrl()}/blog#blog`;
/** The home page URL as Google's site-name and profile docs show it (with the trailing slash). */
export const homeUrl = () => `${siteUrl()}/`;

/** Relative media paths (local uploads) → absolute URLs; structured data needs absolute ones. */
export const absUrl = (u?: string | null) =>
  u ? (/^https?:\/\//.test(u) ? u : `${siteUrl()}${u.startsWith("/") ? "" : "/"}${u}`) : undefined;

const ownerRef = (s: SiteSettings) => ({
  "@type": "Person",
  "@id": personId(),
  name: s.fullName,
  url: homeUrl(),
});

/** BlogPosting.image: the cover photo (if any) plus the 16:9, 4:3 and 1:1 cards Google asks for. */
export const articleImages = (slug: string, cover?: string | null) => [
  ...(cover ? [absUrl(cover) as string] : []),
  ...["16x9", "4x3", "1x1"].map((r) => `${siteUrl()}/blog/${slug}/image/${r}`),
];

export function personLd(
  s: SiteSettings,
  roles: Experience[] = [],
  extra: { description?: string; knowsAbout?: string[]; image?: string | null } = {},
) {
  const current = roles.find((r) => r.type !== "education" && !r.end);
  const school = roles.find((r) => r.type === "education");
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": personId(),
    name: s.fullName,
    alternateName: s.brand,
    givenName: s.firstName || undefined,
    jobTitle: s.role,
    description: extra.description || s.authorBio || undefined,
    url: homeUrl(),
    ...(extra.image ? { image: absUrl(extra.image) } : {}),
    email: s.email,
    address: {
      "@type": "PostalAddress",
      addressLocality: s.city ?? undefined,
      addressCountry: "IN",
    },
    ...(current ? { worksFor: { "@type": "Organization", name: current.company } } : {}),
    ...(school ? { alumniOf: { "@type": "CollegeOrUniversity", name: school.company } } : {}),
    ...(extra.knowsAbout?.length ? { knowsAbout: extra.knowsAbout } : {}),
    sameAs: socialsOf(s)
      .filter((l) => /^https?:/.test(l.href))
      .map((l) => l.href),
  };
}

/** The home page is a profile: Google's ProfilePage rich result wraps the Person. */
export function profilePageLd(
  s: SiteSettings,
  roles: Experience[] = [],
  extra: {
    description?: string;
    knowsAbout?: string[];
    image?: string | null;
    modified?: string;
  } = {},
) {
  const { "@context": _, ...person } = personLd(s, roles, extra);
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "@id": `${siteUrl()}/#profile`,
    url: homeUrl(),
    name: `${s.fullName}, ${s.role}`,
    inLanguage: "en",
    isPartOf: { "@id": websiteId() },
    ...(extra.modified ? { dateModified: extra.modified } : {}),
    mainEntity: person,
  };
}

/**
 * Google takes the site name shown in results from this node on the home page, so `name` is the
 * same short brand used for og:site_name everywhere; the full name is the alternate.
 */
export function websiteLd(s: SiteSettings, description?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": websiteId(),
    url: homeUrl(),
    name: s.brand,
    alternateName: [s.fullName, `${s.fullName}, ${s.role}`],
    description,
    inLanguage: "en",
    author: { "@id": personId() },
    publisher: { "@id": personId() },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${siteUrl()}${it.path}`,
    })),
  };
}

/** The blog as a whole, with its latest posts (the archive's first page). */
export function blogLd(
  s: SiteSettings,
  blog: { name: string; description?: string | null },
  posts: Post[],
  authorOf: (p: Post) => { name: string; image?: string | null },
) {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": blogId(),
    url: `${siteUrl()}/blog`,
    name: blog.name,
    description: blog.description ?? undefined,
    inLanguage: "en",
    author: ownerRef(s),
    publisher: ownerRef(s),
    isPartOf: { "@id": websiteId() },
    // Full enough that Google's Article checks pass on the nested items too.
    blogPost: posts.slice(0, 20).map((p) => ({
      "@type": "BlogPosting",
      "@id": `${siteUrl()}/blog/${p.slug}#article`,
      headline: p.title,
      description: p.meta?.description || p.excerpt || undefined,
      url: `${siteUrl()}/blog/${p.slug}`,
      image: articleImages(p.slug),
      datePublished: p.publishedAt ?? undefined,
      dateModified: p.updatedAt,
      author: authorRef(s, authorOf(p)),
    })),
  };
}

/** The site owner links to the one Person node; guest authors are described inline. */
function authorRef(s: SiteSettings, author?: { name: string; image?: string | null }) {
  const name = author?.name ?? s.fullName;
  return name === s.fullName
    ? ownerRef(s)
    : { "@type": "Person", name, ...(author?.image ? { image: absUrl(author.image) } : {}) };
}

export function postLd(
  p: Post,
  s: SiteSettings,
  author?: { name: string; image?: string | null },
  opts: { cover?: string; blogName?: string } = {},
) {
  const url = `${siteUrl()}/blog/${p.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    headline: p.title,
    description: p.meta?.description || p.excerpt,
    datePublished: p.publishedAt ?? undefined,
    dateModified: p.updatedAt,
    url,
    image: articleImages(p.slug, opts.cover),
    articleSection: p.category,
    keywords: p.tags?.length ? p.tags.join(", ") : undefined,
    inLanguage: "en",
    timeRequired: `PT${p.readMinutes ?? 1}M`,
    author: authorRef(s, author),
    publisher: ownerRef(s),
    isPartOf: { "@type": "Blog", "@id": blogId(), name: opts.blogName },
  };
}

export function projectLd(p: Project, s: SiteSettings) {
  const url = `${siteUrl()}/work/${p.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${url}#work`,
    name: p.title,
    headline: p.title,
    description: p.meta?.description || p.summary,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    dateModified: p.updatedAt,
    genre: p.kind || undefined,
    keywords: p.stack?.length ? p.stack.join(", ") : undefined,
    inLanguage: "en",
    creator: ownerRef(s),
    author: ownerRef(s),
    isPartOf: { "@id": websiteId() },
  };
}

import type { Metadata, Viewport } from "next";

/**
 * Shared by the portfolio and blog root layouts.
 * Runs before paint: stored theme → system preference; motion flag for entrance animations.
 */
export const themeScript = `(function(){try{var d=document.documentElement;d.dataset.b4r="bharathi4real";var s=localStorage.getItem("theme");d.dataset.theme=s||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");if(!matchMedia("(prefers-reduced-motion: reduce)").matches)d.classList.add("js-motion")}catch(e){}})();`;

export const siteViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
    { media: "(prefers-color-scheme: light)", color: "#f5f2eb" },
  ],
  viewportFit: "cover",
};

/**
 * <link rel="alternate"> for the blog's RSS feed (pages that set `alternates` must repeat it), or
 * undefined when the feed is off (Blog settings → RSS feed) so callers omit `types` entirely.
 */
export function blogFeedAlternate(rss: boolean) {
  return rss ? { "application/rss+xml": "/blog/feed.xml" } : undefined;
}

/**
 * Layout-level robots. Indexable pages also allow large image previews and full snippets: Google
 * Discover only shows large cards for pages that opt in with max-image-preview:large.
 * Pages must never set `robots: undefined` (the key alone replaces this); spread it conditionally.
 */
export function siteRobots(index: boolean): Metadata["robots"] {
  return index
    ? {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      }
    : { index: false, follow: false };
}

/** Search Console (Google) and Webmaster Tools (Bing) ownership tags from Settings → SEO. */
export function siteVerification(seo: {
  googleVerification?: string | null;
  bingVerification?: string | null;
}): Metadata["verification"] {
  const google = seo.googleVerification?.trim();
  const bing = seo.bingVerification?.trim();
  if (!google && !bing) return undefined;
  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

/** For a single page that shouldn't be indexed but whose links should still be followed. */
export const noindexFollow = { robots: { index: false, follow: true } } satisfies Metadata;

/** Search engines skip Vercel preview deployments and sites with indexing turned off. */
export function indexable(allowIndexing: boolean | null | undefined) {
  const preview = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
  return allowIndexing !== false && !preview;
}

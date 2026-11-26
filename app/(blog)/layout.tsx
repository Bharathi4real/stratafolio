import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { BlogFooter } from "@/components/blog/BlogFooter";
import { BlogHeader } from "@/components/blog/BlogHeader";
import { siteUrl } from "@/components/seo/JsonLd";
import { SiteServices } from "@/components/site/SiteServices";
import { InlineScript, ReapplyTheme } from "@/components/ui/InlineScript";
import {
  blogFeedAlternate,
  indexable,
  siteRobots,
  siteVerification,
  siteViewport,
  themeScript,
} from "@/lib/document";
import { fontVars } from "@/lib/fonts";
import { paletteCss } from "@/lib/palette";
import {
  getAppearance,
  getBlogPage,
  getBrand,
  getSeo,
  getSettings,
  getSocials,
} from "@/lib/queries";
import "../site.css";
import { GENERATOR } from "@/lib/mark";

/** The blog's own name: Settings → Blog → Blog name, or "<brand> · Blog". */
async function blogIdentity() {
  const [page, brand] = await Promise.all([getBlogPage(), getBrand()]);
  return {
    page,
    brand,
    blogName: page.siteName?.trim() || `${brand.siteName} · Blog`,
    portfolioLabel: page.portfolioLabel?.trim() || "About me",
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const [{ page, brand, blogName }, seo] = await Promise.all([blogIdentity(), getSeo()]);
  const description = page.intro ?? seo.description;
  const index = indexable(seo.allowIndexing);
  const feed = blogFeedAlternate(page.rss === true);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: blogName, template: `%s · ${blogName}` },
    description,
    applicationName: blogName,
    generator: GENERATOR,
    authors: [{ name: brand.ownerName, url: siteUrl() }],
    creator: brand.ownerName,
    robots: siteRobots(index),
    ...(feed ? { alternates: { types: feed } } : {}),
    // og:site_name matches the portfolio and the home page's WebSite data: Google reads one site
    // name per domain, so the blog name stays in titles only.
    openGraph: {
      type: "website",
      siteName: brand.siteName,
      locale: "en_US",
      title: blogName,
      description,
      url: "/blog",
    },
    // Card type only: title, description and image are inherited from each page's openGraph, so
    // a post shared on X shows the post, not the blog name.
    twitter: { card: "summary_large_image" },
    verification: siteVerification(seo),
    icons: brand.favicon
      ? { icon: [{ url: brand.favicon.url, type: brand.favicon.mime }] }
      : { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  };
}

export const viewport: Viewport = siteViewport;

/**
 * Standalone blog: same app, data, admin, theme and privacy settings as the portfolio, but its
 * own reading-first header and a light footer instead of the portfolio chrome.
 */
export default async function BlogLayout({ children }: { children: ReactNode }) {
  const [{ page, brand, blogName, portfolioLabel }, settings, socials, appearance] =
    await Promise.all([blogIdentity(), getSettings(), getSocials(), getAppearance()]);
  const showPortfolioLink = page.showPortfolioLink !== false;
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${fontVars} b4r`}>
      <head>
        <InlineScript html={themeScript} />
        {/* Palette from Settings → Appearance (empty for the default Ink & Ember). */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS built from validated hex values */}
        <style id="palette" dangerouslySetInnerHTML={{ __html: paletteCss(appearance) }} />
      </head>
      <body className="blog-site">
        <ReapplyTheme storageKey="theme" setMotionClass />
        <a href="#main" className="skip-link sr-only">
          Skip to content
        </a>
        <BlogHeader
          logo={brand.site}
          blogName={blogName}
          portfolioLabel={portfolioLabel}
          showPortfolioLink={showPortfolioLink}
          links={page.headerLinks ?? []}
          rss={page.rss === true}
        />
        <main id="main">{children}</main>
        <BlogFooter
          name={page.footerName?.trim() || settings.fullName}
          blogName={blogName}
          links={page.footerLinks ?? []}
          socials={page.showFooterSocials !== false ? socials : []}
          email={settings.email}
          showEmail={page.showFooterEmail === true}
          showPortfolioLink={showPortfolioLink}
          portfolioLabel={portfolioLabel}
          rss={page.rss === true}
          showPrivacy={page.showPrivacyLink !== false}
          privacyChoices={page.showPrivacyChoices !== false}
          backToTop={page.backToTopLabel?.trim() || "Back to top ↑"}
        />
        <SiteServices />
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { type ReactNode, Suspense } from "react";
import { SiteFooter } from "@/components/footer/SiteFooter";
import { SiteHeader } from "@/components/header/SiteHeader";
import { OverlayMenu } from "@/components/menu/OverlayMenu";
import { siteUrl } from "@/components/seo/JsonLd";
import { SiteServices } from "@/components/site/SiteServices";
import { InlineScript, ReapplyTheme } from "@/components/ui/InlineScript";
import { StaticTopo } from "@/components/ui/Topo";
import { indexable, siteRobots, siteVerification, siteViewport, themeScript } from "@/lib/document";
import { fontVars } from "@/lib/fonts";
import { GENERATOR } from "@/lib/mark";
import { getAppearance, getBrand, getSeo, getSocials } from "@/lib/queries";
import { getChrome } from "@/lib/site";
import "../site.css";
import { paletteCss } from "@/lib/palette";

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand] = await Promise.all([getSeo(), getBrand()]);
  const index = indexable(seo.allowIndexing);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: seo.siteTitle, template: seo.titleTemplate ?? "%s" },
    description: seo.description,
    applicationName: brand.siteName,
    generator: GENERATOR,
    authors: [{ name: brand.ownerName, url: siteUrl() }],
    creator: brand.ownerName,
    keywords: seo.keywords ?? undefined,
    robots: siteRobots(index),
    openGraph: {
      type: "website",
      siteName: brand.siteName,
      locale: "en_US",
      title: seo.siteTitle,
      description: seo.description,
      url: "/",
    },
    // Card type only: title, description and image are inherited from each page's openGraph.
    twitter: { card: "summary_large_image" },
    verification: siteVerification(seo),
    icons: brand.favicon
      ? { icon: [{ url: brand.favicon.url, type: brand.favicon.mime }] }
      : { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  };
}

export const viewport: Viewport = siteViewport;

export default async function FrontendLayout({ children }: { children: ReactNode }) {
  const [{ settings, nav, dock, menu, resumeUrl }, appearance, brand, socials] = await Promise.all([
    getChrome(),
    getAppearance(),
    getBrand(),
    getSocials(),
  ]);
  const status = settings.openToWork ? settings.statusShort : null;

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${fontVars} b4r`}>
      <head>
        <InlineScript html={themeScript} />
        {/* Palette from Settings → Appearance (empty for the default Ink & Ember). */}
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS built from validated hex values */}
        <style id="palette" dangerouslySetInnerHTML={{ __html: paletteCss(appearance) }} />
      </head>
      <body>
        <ReapplyTheme storageKey="theme" setMotionClass />
        <a href="#main" className="skip-link sr-only">
          Skip to content
        </a>
        <SiteHeader
          logo={brand.site}
          dock={dock}
          socials={socials}
          resumeUrl={resumeUrl}
          resumeLabel={settings.resumeLabel ?? "Résumé"}
        />
        <Suspense fallback={null}>
          <OverlayMenu
            items={menu}
            email={settings.email}
            city={settings.city ?? ""}
            timeZone={settings.timeZone ?? "Asia/Kolkata"}
            status={status}
            topo={<StaticTopo seed="menu" cx={1148} cy={720} n={26} className="menu-topo" />}
            links={[
              ...socials
                .filter((l) => l.inMenu)
                .map((l) => ({ label: `${l.name} ↗`, href: l.href })),
              ...(resumeUrl
                ? [
                    {
                      label: `${settings.resumeLabel ?? "Résumé"} ↓`,
                      href: resumeUrl,
                      download: true,
                    },
                  ]
                : []),
            ]}
          />
        </Suspense>
        <main id="main">{children}</main>
        <SiteFooter
          brand={nav.footerMark?.trim() || settings.brand}
          name={nav.footerName?.trim() || settings.fullName}
          showMark={nav.showFooterMark !== false}
          links={nav.footerLinks ?? []}
          showEmail={nav.showFooterEmail !== false}
          showPrivacy={nav.showPrivacyLink !== false}
          blogLink={
            nav.showBlogLink !== false ? { label: nav.blogLinkLabel?.trim() || "Blog" } : null
          }
          socials={socials}
          email={settings.email}
          backToTop={nav.backToTopLabel ?? "Back to top ↑"}
          privacyChoices={nav.showPrivacyChoices !== false}
        />
        <SiteServices />
      </body>
    </html>
  );
}

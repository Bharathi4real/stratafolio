import type { Metadata } from "next";
import { InlineScript } from "@/components/ui/InlineScript";
import { LogoMark } from "@/components/ui/LogoMark";
import { Pill } from "@/components/ui/Pill";
import { StaticTopo } from "@/components/ui/Topo";
import { fontVars } from "@/lib/fonts";
import { paletteCss } from "@/lib/palette";
import { getAppearance, getBrand } from "@/lib/queries";
import "./site.css";

/**
 * The 404 for URLs that match no route at all (the app has three root layouts: site, blog and
 * admin, so Next.js can't borrow any of them). It renders its own <html>: fonts, styles, palette
 * and the visitor's theme, matching the site's own 404 in app/(frontend)/not-found.tsx.
 */
export const metadata: Metadata = {
  title: "Page not found",
  description: "This page doesn’t exist, or it moved.",
};

const themeScript = `(function(){try{var d=document.documentElement;var s=localStorage.getItem("theme");d.dataset.theme=s||(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){}})();`;

export default async function GlobalNotFound() {
  const [brand, appearance] = await Promise.all([getBrand(), getAppearance()]);
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${fontVars} b4r`}>
      <head>
        <InlineScript html={themeScript} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS built from validated hex values */}
        <style id="palette" dangerouslySetInnerHTML={{ __html: paletteCss(appearance) }} />
      </head>
      <body>
        <header className="nf-top gutter">
          <a className="brand" href="/" aria-label={`${brand.site.text}, home`}>
            <LogoMark logo={brand.site} />
          </a>
        </header>
        <main id="main">
          <section className="plain-page gutter" style={{ minHeight: "80svh" }}>
            <StaticTopo seed="404" cx={900} cy={360} n={22} />
            <p className="eyebrow">
              <span className="nf-code">404</span> / Page not found
            </p>
            <h1>
              Lost in the <em>strata.</em>
            </h1>
            <p className="lede">
              This page doesn’t exist, or it moved. The surface is a good place to start again.
            </p>
            <div className="plain-actions">
              <Pill href="/" variant="accent" large arrow="↗">
                Back home
              </Pill>
              <Pill href="/blog" variant="ghost" large>
                Read the blog
              </Pill>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}

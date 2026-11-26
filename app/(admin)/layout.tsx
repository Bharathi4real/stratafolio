import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { InlineScript, ReapplyTheme } from "@/components/ui/InlineScript";
import { fontVars } from "@/lib/fonts";
import { GENERATOR } from "@/lib/mark";
import "@/styles/admin.css";
import "@/styles/admin-app.css";
import "@/styles/syntax.css";
import { paletteCss } from "@/lib/palette";
import { getAppearance, getBrand } from "@/lib/queries";

export async function generateMetadata(): Promise<Metadata> {
  const { adminFavicon, adminTitle } = await getBrand();
  return {
    title: { default: adminTitle, template: `%s · ${adminTitle}` },
    robots: { index: false, follow: false },
    generator: GENERATOR,
    icons: adminFavicon
      ? { icon: [{ url: adminFavicon.url, type: adminFavicon.mime }] }
      : { icon: [{ url: "/icon.svg", type: "image/svg+xml" }] },
  };
}
export const viewport: Viewport = { themeColor: "#0b0b0d" };

// Admin theme is separate from the site's: "light" | "dark" | "system" (default, follows the OS).
const themeScript = `(function(){try{var s=localStorage.getItem("admin-theme");var t=s==="light"||s==="dark"?s:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");var r=document.documentElement;r.dataset.b4r="bharathi4real";r.dataset.theme=t;r.style.colorScheme=t}catch(e){}})();`;

export default async function AdminRoot({ children }: { children: ReactNode }) {
  const appearance = await getAppearance();
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${fontVars} b4r`}>
      <head>
        <InlineScript html={themeScript} />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS built from validated hex values */}
        <style id="palette" dangerouslySetInnerHTML={{ __html: paletteCss(appearance) }} />
      </head>
      <body>
        <ReapplyTheme storageKey="admin-theme" />
        {children}
      </body>
    </html>
  );
}

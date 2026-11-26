import { absUrl } from "@/components/seo/JsonLd";
import { ogImage, ogPhoto, ogSize } from "@/lib/og";
import { getHome, getMediaUrl, getSeo, getSettings, getToolkit } from "@/lib/queries";

/** Alt text from Settings → General (og:image:alt). */
export async function generateImageMetadata() {
  const settings = await getSettings();
  return [
    {
      id: "card",
      size: ogSize,
      contentType: "image/png",
      alt: `${settings.fullName}, ${settings.role}`,
    },
  ];
}

export default async function Image() {
  const [settings, home, seo, toolkit] = await Promise.all([
    getSettings(),
    getHome(),
    getSeo(),
    getToolkit(),
  ]);
  // Settings → SEO → Share image wins over the generated card when one is uploaded.
  const custom = absUrl(await getMediaUrl(seo.ogImage));
  if (custom) return ogPhoto(custom);
  const hero = home.sections?.find((s) => s.blockType === "hero");
  return ogImage({
    kicker: `${settings.role} · ${settings.locationShort ?? ""}`,
    title: hero?.blockType === "hero" ? hero.nameLine1 : (settings.firstName ?? settings.fullName),
    accent: hero?.blockType === "hero" ? hero.nameLine2 : undefined,
    footer: toolkit?.layers?.[0]?.tools?.slice(0, 4).join(" · ") || settings.brand,
  });
}

import { ogImage, ogSize } from "@/lib/og";
import { getProject, getSettings } from "@/lib/queries";

/** One share card per case study, with alt text naming it (og:image:alt). */
export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params)?.slug;
  const [p, settings] = await Promise.all([slug ? getProject(slug) : null, getSettings()]);
  return [
    {
      id: "card",
      size: ogSize,
      contentType: "image/png",
      alt: p
        ? `${p.title}, a case study by ${settings.fullName}`
        : `Case study by ${settings.fullName}`,
    },
  ];
}

/** Share card for a case study: kind, title and the first few stack items. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params)?.slug;
  const [p, settings] = await Promise.all([slug ? getProject(slug) : null, getSettings()]);
  return ogImage({
    kicker: `Case study · ${p?.kind ?? "Work"}`,
    title: p?.title ?? "Selected work",
    footer: p?.stack?.length ? p.stack.slice(0, 4).join(" · ") : (p?.client ?? settings.brand),
  });
}

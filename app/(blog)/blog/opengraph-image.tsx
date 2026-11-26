import { plain } from "@/components/ui/Rich";
import { ogImage, ogSize } from "@/lib/og";
import { getBlogPage, getBrand, getPosts } from "@/lib/queries";

/** Alt text from Settings → General (og:image:alt). */
export async function generateImageMetadata() {
  const brand = await getBrand();
  return [
    { id: "card", size: ogSize, contentType: "image/png", alt: `Blog by ${brand.ownerName}` },
  ];
}

/** Share card for /blog (the blog is its own root layout, so it can't borrow the portfolio's). */
export default async function Image() {
  const [page, brand, posts] = await Promise.all([getBlogPage(), getBrand(), getPosts()]);
  const count = posts.filter((p) => p.stage === "published").length;
  return ogImage({
    kicker: page.siteName?.trim() || `${brand.siteName} · Blog`,
    title: plain(page.heading) || "Writing & learnings",
    footer: count ? `${count} post${count === 1 ? "" : "s"} · ${brand.ownerName}` : brand.ownerName,
  });
}

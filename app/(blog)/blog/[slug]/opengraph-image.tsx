import { ogImage, ogSize } from "@/lib/og";
import { getPost, getSettings } from "@/lib/queries";
import { fmtDay } from "@/lib/time";

/** One share card per post, with alt text naming the post (og:image:alt). */
export async function generateImageMetadata({ params }: { params: Promise<{ slug: string }> }) {
  // While collecting page data Next.js can call this before the slug is known: no lookup then.
  const slug = (await params)?.slug;
  const [post, settings] = await Promise.all([slug ? getPost(slug) : null, getSettings()]);
  return [
    {
      id: "card",
      size: ogSize,
      contentType: "image/png",
      alt: post ? `${post.title}, a post by ${settings.fullName}` : `Blog by ${settings.fullName}`,
    },
  ];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params)?.slug;
  const [post, settings] = await Promise.all([slug ? getPost(slug) : null, getSettings()]);
  return ogImage({
    kicker: `Blog · ${post?.category ?? "Notes"}`,
    title: post?.title ?? "Writing & learnings",
    footer: post?.publishedAt
      ? `${fmtDay(post.publishedAt)} · ${post.readMinutes ?? 1} min read`
      : settings.brand,
  });
}

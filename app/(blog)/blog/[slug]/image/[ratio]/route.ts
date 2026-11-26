import { type ArticleRatio, articleSizes, ogImage } from "@/lib/og";
import { getPost, getPosts, getSettings } from "@/lib/queries";
import { fmtDay } from "@/lib/time";

/**
 * /blog/<slug>/image/<16x9|4x3|1x1>: the post's card in the aspect ratios Google's Article
 * structured data asks for (BlogPosting.image). Prerendered for every published post.
 */

const ratios = Object.keys(articleSizes) as ArticleRatio[];
const isRatio = (r: string): r is ArticleRatio => (ratios as string[]).includes(r);

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts
    .filter((p) => p.stage === "published")
    .flatMap((p) => ratios.map((ratio) => ({ slug: p.slug, ratio })));
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; ratio: string }> },
) {
  const { slug, ratio } = await params;
  const [post, settings] = await Promise.all([getPost(slug), getSettings()]);
  if (!isRatio(ratio) || !post || post.stage !== "published") {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return ogImage({
    size: articleSizes[ratio],
    kicker: `Blog · ${post.category}`,
    title: post.title,
    footer: post.publishedAt
      ? `${fmtDay(post.publishedAt)} · ${post.readMinutes ?? 1} min read`
      : settings.brand,
  });
}

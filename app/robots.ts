import type { MetadataRoute } from "next";
import { siteUrl } from "@/components/seo/JsonLd";
import { getSeo } from "@/lib/queries";

/** Crawlers that collect text for AI training (not search). Blocked only when Settings → SEO says so. */
const AI_TRAINING = [
  "GPTBot",
  "Google-Extended",
  "CCBot",
  "ClaudeBot",
  "anthropic-ai",
  "Applebot-Extended",
  "meta-externalagent",
  "Bytespider",
  "PerplexityBot",
];

export default async function robots(): Promise<MetadataRoute.Robots> {
  const seo = await getSeo();
  const preview = process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production";
  if (preview || seo.allowIndexing === false) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
      ...(seo.blockAiTraining ? [{ userAgent: AI_TRAINING, disallow: "/" }] : []),
    ],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}

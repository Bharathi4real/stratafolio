import "server-only";
import { createHash } from "node:crypto";
import { after } from "next/server";
import { siteUrl } from "@/components/seo/JsonLd";
import { readGlobal } from "@/lib/content/store";

/**
 * IndexNow (indexnow.org): tells Bing, Yandex, Seznam and others which URLs just changed, so they
 * recrawl now instead of on their own schedule. Google doesn't take part (it reads the sitemap).
 *
 * The key is derived from AUTH_SECRET, so there's nothing to configure; /indexnow.txt serves it
 * so engines can check the submission came from this site. Production only, and only while
 * Settings → SEO allows indexing and "Notify Bing on publish" is on.
 */

export function indexNowKey(): string | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || process.env.VERCEL_ENV !== "production") return null;
  return createHash("sha256").update(`indexnow:${secret}`).digest("hex").slice(0, 32);
}

/** Queue a submission for these paths; it runs after the response, so publishing never waits. */
export function submitToIndexNow(paths: string[]) {
  const key = indexNowKey();
  if (!key || !paths.length) return;
  const base = siteUrl();
  const send = async () => {
    try {
      const seo = await readGlobal("seo");
      if (seo.allowIndexing === false || seo.indexNow === false) return;
      await fetch("https://api.indexnow.org/indexnow", {
        method: "POST",
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: new URL(base).host,
          key,
          keyLocation: `${base}/indexnow.txt`,
          urlList: [...new Set(paths)].map((p) => `${base}${p}`),
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      // Best effort: the sitemap still gets the change picked up.
    }
  };
  try {
    after(send);
  } catch {
    // Outside a request (scripts): send right away.
    void send();
  }
}

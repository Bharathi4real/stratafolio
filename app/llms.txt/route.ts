import { siteUrl } from "@/components/seo/JsonLd";
import { getPosts, getProjects, getSeo, getSettings, getSocials } from "@/lib/queries";

/**
 * /llms.txt (llmstxt.org): a short Markdown map of the site for AI assistants, built from live
 * content. Turn it off in Settings → SEO.
 */

const line = (s?: string | null) => (s ?? "").replace(/\s+/g, " ").trim();

export async function GET() {
  const [seo, s, posts, projects, socials] = await Promise.all([
    getSeo(),
    getSettings(),
    getPosts(),
    getProjects(),
    getSocials(),
  ]);
  if (seo.llmsTxt === false || seo.allowIndexing === false)
    return new Response("Not found", { status: 404 });
  const base = siteUrl();
  const published = posts.filter((p) => p.stage === "published" && !p.meta?.noindex);
  const out = [
    `# ${s.fullName}`,
    "",
    `> ${line(seo.llmsSummary || seo.description)}`,
    "",
    [s.role, s.location].filter(Boolean).join(" · "),
    s.openToWork && s.statusLong ? `Status: ${s.statusLong}.` : "",
    "",
    "## Pages",
    "",
    `- [Home](${base}/): about, selected work, experience, toolkit and contact`,
    `- [Blog](${base}/blog): writing on engineering and building products`,
    `- [Privacy](${base}/privacy): what the site collects and why`,
    "",
  ];
  if (projects.length) {
    out.push("## Case studies", "");
    for (const p of projects)
      out.push(`- [${line(p.title)}](${base}/work/${p.slug}): ${line(p.summary)}`);
    out.push("");
  }
  if (published.length) {
    out.push("## Blog posts", "");
    for (const p of published)
      out.push(`- [${line(p.title)}](${base}/blog/${p.slug}): ${line(p.excerpt)}`);
    out.push("");
  }
  out.push("## Contact", "", `- Email: ${s.email}`);
  for (const l of socials.filter((x) => /^https?:/.test(x.href)))
    out.push(`- [${l.name}](${l.href})${l.handle ? `: ${line(l.handle)}` : ""}`);
  out.push("");
  return new Response(out.join("\n").replace(/\n{3,}/g, "\n\n"), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

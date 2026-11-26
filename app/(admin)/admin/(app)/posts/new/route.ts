import { redirect } from "next/navigation";
import { createEntryAction } from "@/lib/admin/actions";

/**
 * /admin/posts/new → creates a draft post and opens the editor. Only for navigations that start
 * on this site (or a typed URL / bookmark): a link on another site can't create drafts. Browsers
 * that don't send Sec-Fetch-Site fall back to the Referer; with neither, nothing is created.
 */
function sameSite(req: Request) {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";
  const referer = req.headers.get("referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === new URL(req.url).origin;
  } catch {
    return false;
  }
}

/** Link prefetches must never create posts (only a real navigation does). */
const isPrefetch = (req: Request) =>
  req.headers.has("next-router-prefetch") ||
  (req.headers.get("sec-purpose") ?? req.headers.get("purpose") ?? "").includes("prefetch");

export async function GET(req: Request) {
  if (isPrefetch(req)) return new Response(null, { status: 204 });
  if (!sameSite(req)) redirect("/admin/posts");
  const r = await createEntryAction("posts");
  redirect(r.ok && r.data ? `/admin/posts/${r.data.id}` : "/admin/posts");
}

import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { isBlogPath } from "@/lib/preview";
import { can } from "@/lib/rbac";
import { getUser } from "@/lib/session";

/**
 * Live preview entry used by the admin: /api/preview?path=/blog/slug.
 * Draft mode switches every public read to drafts, so it's limited to roles that may publish:
 * admins anywhere, editors only on the blog. proxy.ts re-checks this on every draft request
 * (and ends preview when the session or role no longer allows it).
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") ?? "/";
  const user = await getUser();
  if (!user) return new Response("Sign in to preview drafts", { status: 401 });
  if (!can(user.role, "posts.manage"))
    return new Response("Your role can't preview drafts", { status: 403 });
  // Same-site paths only. Browsers treat a backslash like "/", so "/\evil.com" would leave the site;
  // resolving against a dummy origin catches that and any other off-site form.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: rejecting control characters is the point
  if (!path.startsWith("/") || /[\\\u0000-\u001f]/.test(path))
    return new Response("Bad path", { status: 400 });
  const target = new URL(path, "http://preview.invalid");
  if (target.origin !== "http://preview.invalid") return new Response("Bad path", { status: 400 });
  if (!can(user.role, "site.manage") && !isBlogPath(target.pathname))
    return new Response("Your role can only preview the blog", { status: 403 });
  (await draftMode()).enable();
  redirect(`${target.pathname}${target.search}${target.hash}`);
}

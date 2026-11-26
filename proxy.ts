import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DRAFT_COOKIE, isBlogPath } from "@/lib/preview";
import { can, toRole } from "@/lib/rbac";

/**
 * Draft Mode guard. The Draft Mode cookie isn't tied to the login session, and while it's set
 * every public read returns drafts. So on each request that carries it, check the session again:
 * admins may preview anywhere, editors only the blog; anyone else (signed out, removed, author,
 * or an editor who wandered onto the portfolio) gets the cookie cleared and the published page.
 * Requests without the cookie (every normal visitor) skip this entirely.
 */
export async function proxy(req: NextRequest) {
  if (!req.cookies.has(DRAFT_COOKIE)) return NextResponse.next();
  const session = await auth.api.getSession({ headers: req.headers }).catch(() => null);
  const role = toRole((session?.user as { role?: unknown } | undefined)?.role);
  const allowed =
    Boolean(session) &&
    (can(role, "site.manage") || (can(role, "posts.manage") && isBlogPath(req.nextUrl.pathname)));
  if (allowed) return NextResponse.next();
  const res = NextResponse.redirect(req.nextUrl);
  res.cookies.delete(DRAFT_COOKIE);
  return res;
}

export const config = {
  // Public pages, plus the content routes that have an extension (they read drafts too). Not the
  // admin, API routes, Next.js assets or static files.
  matcher: [
    "/((?!admin|api|_next/|.*\\.[a-zA-Z0-9]+$).*)",
    "/blog/feed.xml",
    "/llms.txt",
    "/sitemap.xml",
  ],
};

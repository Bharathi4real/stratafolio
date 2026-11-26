/** Paths that belong to the standalone blog (the only place editors may preview drafts). */
export const isBlogPath = (pathname: string) =>
  pathname === "/blog" || pathname.startsWith("/blog/");

/** Next.js's Draft Mode cookie. */
export const DRAFT_COOKIE = "__prerender_bypass";

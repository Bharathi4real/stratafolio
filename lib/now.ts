import "server-only";
import { cacheLife } from "next/cache";

/**
 * The current year for server-rendered text (footer ©, undated drafts). Cache Components
 * won't prerender a raw `new Date()`, so the value is cached and refreshed daily instead.
 */
export async function currentYear() {
  "use cache";
  cacheLife("days");
  return new Date().getUTCFullYear();
}

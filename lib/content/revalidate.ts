import "server-only";
import { revalidatePath, revalidateTag, updateTag } from "next/cache";
import { submitToIndexNow } from "@/lib/indexnow";
import { type CollectionKey, GLOBAL_TAG, type GlobalKey } from "./schema";

/**
 * Expire a cache tag after a change.
 *
 * From the admin (Server Actions) this is `updateTag`: the next request waits for fresh data,
 * so whoever just published sees it straight away. `updateTag` only works inside Server
 * Actions, so elsewhere (the nightly cron, a webhook) it falls back to
 * `revalidateTag(tag, "max")`: serve the old version once while the new one renders.
 */
function expire(tag: string) {
  try {
    updateTag(tag);
  } catch {
    revalidateTag(tag, "max");
  }
}

/** Called after publishing from the admin. */
export function revalidateGlobal(key: GlobalKey) {
  expire(GLOBAL_TAG[key]);
  // The public page each settings document mostly shows up on.
  submitToIndexNow([key === "blog-page" ? "/blog" : key === "privacy" ? "/privacy" : "/"]);
}

export function revalidateCollection(
  collection: CollectionKey,
  slugs: (string | null | undefined)[] = [],
) {
  expire(collection);
  const changed: string[] = [collection === "posts" ? "/blog" : "/"];
  for (const s of slugs) {
    if (!s) continue;
    expire(`${collection}:${s}`);
    if (collection === "posts") revalidatePath(`/blog/${s}`);
    if (collection === "projects") revalidatePath(`/work/${s}`);
    if (collection === "posts") changed.push(`/blog/${s}`);
    if (collection === "projects") changed.push(`/work/${s}`);
  }
  // Published, updated, unpublished or deleted: engines recrawl and pick up the change (or 404).
  submitToIndexNow(changed);
}

export function revalidateMedia() {
  expire("media");
}

export function revalidateAuthors() {
  expire("authors");
  revalidatePath("/blog", "layout");
}

import "server-only";
import { db } from "@/db";
import { user } from "@/db/schema";
import type { AdminUser } from "@/lib/auth";
import { isScheduled, liveAt } from "@/lib/content/schedule";
import type { CollectionKey } from "@/lib/content/schema";
import { listEntryRows } from "@/lib/content/store";
import { can, canEditEntry } from "@/lib/rbac";

export type Row = {
  id: number;
  slug: string;
  title: string;
  sub: string;
  state: "published" | "changed" | "unpublished";
  stage?: string;
  category?: string;
  /** Posts only: author display name. */
  author?: string;
  /** Posts only: the publish date as edited (draft first), for sorting. */
  publishedAt?: string;
  /** Posts only: ISO time a published post goes live, when that's still in the future. */
  scheduledFor?: string;
  updatedAt: string;
};

/**
 * List rows for admin tables (draft values when present). With `viewer`, posts are limited to
 * what they may open: authors only see posts they own (draft and live copy).
 */
export async function adminRows(collection: CollectionKey, viewer?: AdminUser): Promise<Row[]> {
  const [all, people] = await Promise.all([
    listEntryRows(collection),
    collection === "posts"
      ? db.select({ id: user.id, name: user.name }).from(user)
      : Promise.resolve([]),
  ]);
  const rows =
    viewer && collection === "posts" && !can(viewer.role, "posts.manage")
      ? all.filter((r) => canEditEntry(viewer, r))
      : all;
  const names = new Map(people.map((p) => [p.id, p.name]));
  const now = Date.now();
  return rows.map((r) => {
    const d = (r.draft ?? r.data ?? {}) as Record<string, unknown>;
    const state = r.data === null ? "unpublished" : r.draft ? "changed" : "published";
    const title = String(d.title ?? d.company ?? r.slug);
    let sub = "";
    if (collection === "posts")
      sub = `/blog/${d.slug ?? r.slug}${d.stage === "published" ? ` · ${d.readMinutes ?? 1} min read` : ""}`;
    if (collection === "projects") sub = `${d.client ?? ""} · /work/${d.slug ?? r.slug}`;
    if (collection === "experience")
      sub = `${d.title ?? ""} · ${String(d.start ?? "").slice(0, 7)} → ${d.end ? String(d.end).slice(0, 7) : "now"}`;
    // Scheduling follows what's live, not the unpublished draft.
    const live = (r.data ?? {}) as { stage?: string; publishedAt?: string };
    const scheduledFor =
      collection === "posts" && isScheduled(live, now)
        ? new Date(liveAt(live) ?? now).toISOString()
        : undefined;
    return {
      id: r.id,
      scheduledFor,
      publishedAt:
        collection === "posts" ? ((d.publishedAt as string | undefined) ?? undefined) : undefined,
      slug: r.slug,
      title,
      sub,
      state,
      stage: d.stage as string | undefined,
      category: (d.category ?? d.kind ?? d.type) as string | undefined,
      author:
        collection === "posts"
          ? (names.get(String(d.authorId ?? "")) ?? (d.authorId ? "Removed user" : "Site owner"))
          : undefined,
      updatedAt: r.updatedAt.toISOString(),
    };
  });
}

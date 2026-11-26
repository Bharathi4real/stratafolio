import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { entries, messages } from "@/db/schema";
import type { AdminUser } from "@/lib/auth";
import { readGlobal } from "@/lib/content/store";
import { can } from "@/lib/rbac";

/** Posts an author may see: they own the draft (or live copy) and the live copy. */
const ownPosts = (userId: string) =>
  and(
    eq(entries.collection, "posts"),
    sql`coalesce(${entries.draft}, ${entries.data})->>'authorId' = ${userId}`,
    sql`(${entries.data} is null or ${entries.data}->>'authorId' = ${userId})`,
  );

export type NavCounts = {
  home: number;
  projects: number;
  experience: number;
  toolkit: number;
  posts: number;
  unread: number;
};
export type NavSearchItem = { label: string; href: string; group: string };

/**
 * Sidebar counts + the ⌘K search index (draft titles, so new entries show up straight away),
 * limited to what `user` may open: admins everything, editors posts, authors their own posts.
 */
export async function loadAdminNav(
  user: AdminUser,
): Promise<{ counts: NavCounts; search: NavSearchItem[] }> {
  const site = can(user.role, "site.manage");
  const scope = site
    ? undefined
    : can(user.role, "posts.manage")
      ? eq(entries.collection, "posts")
      : can(user.role, "posts.write")
        ? ownPosts(user.id)
        : sql`false`;
  const [home, toolkit, counts, unread, list] = await Promise.all([
    site ? readGlobal("home-page", { draft: true }) : null,
    site ? readGlobal("toolkit", { draft: true }) : null,
    db
      .select({ collection: entries.collection, n: count() })
      .from(entries)
      .where(scope)
      .groupBy(entries.collection),
    site
      ? db.select({ n: count() }).from(messages).where(eq(messages.read, false))
      : Promise.resolve([{ n: 0 }]),
    db
      .select({
        id: entries.id,
        collection: entries.collection,
        slug: entries.slug,
        data: entries.data,
        draft: entries.draft,
      })
      .from(entries)
      .where(scope),
  ]);
  const c = Object.fromEntries(counts.map((r) => [r.collection, r.n]));
  return {
    counts: {
      home: home?.sections.length ?? 0,
      projects: c.projects ?? 0,
      experience: c.experience ?? 0,
      toolkit: toolkit?.layers.length ?? 0,
      posts: c.posts ?? 0,
      unread: unread[0]?.n ?? 0,
    },
    search: list.map((e) => {
      const d = (e.draft ?? e.data) as { title?: string; company?: string } | null;
      return {
        label: d?.title ?? d?.company ?? e.slug,
        href: `/admin/${e.collection}/${e.id}`,
        group: e.collection,
      };
    }),
  };
}

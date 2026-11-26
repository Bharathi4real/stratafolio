/**
 * Roles and permissions for the admin. Pure data and functions (no server imports), so the
 * admin UI can hide what a role can't do; every Server Action and admin page still enforces
 * the same rules on the server.
 *
 * - admin  — everything: portfolio content, site settings, messages, users, all posts.
 * - editor — the blog: every post (write, publish, delete), blog settings, media, stats.
 * - author — their own posts only, as drafts; an editor or admin publishes them.
 */
export const ROLES = ["admin", "editor", "author"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  editor: "Editor",
  author: "Author",
};

/** Stored role → Role. Anything unknown gets the least privilege. */
export function toRole(v: unknown): Role {
  return v === "admin" || v === "editor" ? v : "author";
}

const RANK: Record<Role, number> = { author: 1, editor: 2, admin: 3 };
/** True when `role` is `min` or above (admin > editor > author). */
export const atLeast = (role: Role, min: Role) => RANK[role] >= RANK[min];

export type Permission =
  /** Portfolio content (home, case studies, experience, toolkit), site settings, messages, users. */
  | "site.manage"
  /** Blog settings: name, page copy, categories, RSS. */
  | "blog.settings"
  /** Edit, publish, unpublish and delete any post. */
  | "posts.manage"
  /** Write posts (authors: only their own, never publish). */
  | "posts.write"
  /** Upload files (needed for covers and images in posts). */
  | "media.upload"
  /** Rename files and edit alt text/captions in the shared library. */
  | "media.edit"
  /** Bin, restore and permanently delete files. */
  | "media.delete"
  /** Site and post stats. */
  | "stats.view";

const MIN_ROLE: Record<Permission, Role> = {
  "site.manage": "admin",
  "media.delete": "admin",
  "blog.settings": "editor",
  "posts.manage": "editor",
  "media.edit": "editor",
  "stats.view": "editor",
  "posts.write": "author",
  "media.upload": "author",
};

export const can = (role: Role, perm: Permission) => atLeast(role, MIN_ROLE[perm]);

/** Whether this user may open/edit a post with the given author (authors: only their own). */
export function canEditPost(user: { id: string; role: Role }, authorId: unknown) {
  return can(user.role, "posts.manage") || (can(user.role, "posts.write") && authorId === user.id);
}

const authorIdOf = (doc: unknown) =>
  doc && typeof doc === "object" ? (doc as { authorId?: unknown }).authorId : undefined;

/**
 * Whether this user may open/edit a collection entry (a stored row: `data` is the live copy,
 * `draft` the unpublished one). Posts: editors and admins any post; authors only when they own
 * the draft (or live copy) and, if the post is live, the live copy too. Everything else is
 * portfolio content (site.manage).
 */
export function canEditEntry(
  user: { id: string; role: Role },
  row: { collection: string; data: unknown; draft: unknown },
) {
  if (row.collection !== "posts") return can(user.role, "site.manage");
  if (!canEditPost(user, authorIdOf(row.draft ?? row.data))) return false;
  return row.data == null || canEditPost(user, authorIdOf(row.data));
}

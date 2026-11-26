"use server";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { db } from "@/db";
import { account, entries, globals, media, messages, user, versions } from "@/db/schema";
import type { AdminUser } from "@/lib/auth";
import { isBlurDataUrl } from "@/lib/blur";
import { GLOBAL_DEFAULTS } from "@/lib/content/defaults";
import { type Change, diffDocs } from "@/lib/content/diff";
import { markdownToPost } from "@/lib/content/markdown";
import {
  revalidateAuthors,
  revalidateCollection,
  revalidateGlobal,
  revalidateMedia,
} from "@/lib/content/revalidate";
import { readingMinutes, slugifyHeading } from "@/lib/content/rich";
import {
  COLLECTIONS,
  type CollectionKey,
  GLOBALS,
  type GlobalKey,
  type PostData,
} from "@/lib/content/schema";
import * as store from "@/lib/content/store";
import { DEMO, DEMO_MESSAGE } from "@/lib/demo";
import { humanizeError } from "@/lib/errors";
import { emptyBinNow, purgeRows } from "@/lib/media-bin";
import { can, canEditEntry, type Permission, ROLES, type Role, toRole } from "@/lib/rbac";
import { allLike, likeWords, prefixQuery, tsQuery } from "@/lib/search";
import { assertPermission, assertUser } from "@/lib/session";
import {
  ALLOWED_MIME,
  APP_KEY,
  deleteObject,
  headObject,
  isSafeSvg,
  listObjects,
  MAX_UPLOAD_BYTES,
  makeKey,
  presignUpload,
  publicUrl,
  readObject,
} from "@/lib/storage";
import { loadAdminNav } from "./nav";

/**
 * Admin Server Actions. Every action checks the session and the role's permissions first
 * (lib/rbac.ts); the admin UI hiding things is only a convenience.
 *
 * - Portfolio content, settings, messages and users: site.manage (admins).
 * - Blog settings (the `blog-page` global): blog.settings (editors and admins).
 * - Posts: posts.write to create/edit, plus ownership for authors (their own posts only);
 *   publishing, unpublishing, deleting live posts and reordering need posts.manage.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
/** Expected, user-facing problems (bad input). Returned to the form without logging a stack. */
class Invalid extends Error {}
const fail = (e: unknown): { ok: false; error: string } => {
  if (e instanceof Invalid) return { ok: false, error: e.message };
  if (process.env.NODE_ENV !== "production") console.error("[admin action]", e);
  return { ok: false, error: humanizeError(e) };
};

const DENIED = "You don’t have access to that.";

function assertWritable() {
  if (DEMO) throw new Invalid(DEMO_MESSAGE);
}

const isCollection = (c: unknown): c is CollectionKey =>
  typeof c === "string" && Object.hasOwn(COLLECTIONS, c);
const isGlobalKey = (k: unknown): k is GlobalKey =>
  typeof k === "string" && Object.hasOwn(GLOBALS, k);

/** Writing to a collection: posts.write for posts (authors: own posts), else site.manage. */
const writePerm = (c: CollectionKey): Permission => (c === "posts" ? "posts.write" : "site.manage");
/** Publishing, unpublishing, deleting live entries and reordering a collection. */
const managePerm = (c: CollectionKey): Permission =>
  c === "posts" ? "posts.manage" : "site.manage";
/** The `blog-page` global is blog settings; every other global is site settings. */
const globalPerm = (key: GlobalKey): Permission =>
  key === "blog-page" ? "blog.settings" : "site.manage";
const canGlobal = (u: AdminUser, key: GlobalKey) => can(u.role, globalPerm(key));

/** Collection-level guard (create, reorder, search). Validates the collection name too. */
async function guardFor(collection: unknown) {
  if (!isCollection(collection)) throw new Invalid("Unknown collection.");
  return assertPermission(writePerm(collection));
}

/** Guard for one settings document: validates the key, then checks the role. */
async function guardGlobal(key: unknown) {
  if (!isGlobalKey(key)) throw new Invalid("Unknown settings document.");
  const u = await assertUser();
  if (!canGlobal(u, key)) throw new Error(DENIED);
  return u;
}

type EntryAccess = { collection: string; data: unknown; draft: unknown };

/**
 * Whether `u` may open/edit this entry (see canEditEntry): editors and admins any post, authors
 * only posts they own (draft and live copy); other collections need site.manage.
 */
const canEntry = (u: AdminUser, row: EntryAccess) =>
  isCollection(row.collection) && canEditEntry(u, row);

function guardEntry(row: EntryAccess, u: AdminUser) {
  if (!canEntry(u, row)) throw new Error(DENIED);
}

/** SQL filter for posts an author may see (the same rule as canEntry, in the database). */
const ownPostsSql = (userId: string) =>
  sql`(coalesce(${entries.draft}, ${entries.data})->>'authorId' = ${userId}
    and (${entries.data} is null or ${entries.data}->>'authorId' = ${userId}))`;

/* ───────── Globals ───────── */

/** Autosave. `draft: false` means the edits match what's live, so there's nothing to publish. */
export async function saveGlobal(
  key: GlobalKey,
  data: unknown,
): Promise<Result<{ draft: boolean }>> {
  try {
    assertWritable();
    const u = await guardGlobal(key);
    const r = await store.saveGlobalDraft(key, data, u.id);
    return { ok: true, data: { draft: r.draft } };
  } catch (e) {
    return fail(e);
  }
}

export async function publishGlobal(key: GlobalKey, data?: unknown): Promise<Result> {
  try {
    assertWritable();
    const u = await guardGlobal(key);
    if (data !== undefined) await store.saveGlobalDraft(key, data, u.id);
    await store.publishGlobal(key, u.id);
    revalidateGlobal(key);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function discardGlobal(key: GlobalKey): Promise<Result> {
  try {
    assertWritable();
    await guardGlobal(key);
    await store.discardGlobalDraft(key);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────── Entries ───────── */

function prepare(collection: CollectionKey, input: unknown) {
  const data = COLLECTIONS[collection].parse(input);
  if (collection === "posts") {
    const p = data as PostData;
    p.readMinutes = p.readOverride ?? readingMinutes(p.content);
    if (p.stage === "published" && !p.publishedAt) p.publishedAt = new Date().toISOString();
  }
  return data;
}

const blank: Record<CollectionKey, () => unknown> = {
  posts: () => ({
    title: "Untitled post",
    slug: `untitled-${Date.now().toString(36)}`,
    excerpt: "",
    stage: "draft",
  }),
  projects: () => ({
    title: "New case study",
    slug: `case-${Date.now().toString(36)}`,
    client: "Client",
    kind: "Category",
    summary: "One-line summary.",
    context: "Context paragraph.",
  }),
  experience: () => ({
    company: "Company",
    title: "Role",
    start: new Date().toISOString().slice(0, 10),
  }),
};

export async function createEntryAction(
  collection: CollectionKey,
): Promise<Result<{ id: number }>> {
  try {
    assertWritable();
    const u = await guardFor(collection);
    const [{ n }] = await db
      .select({ n: count() })
      .from(entries)
      .where(eq(entries.collection, collection));
    const data = blank[collection]() as Record<string, unknown>;
    if (collection === "posts") data.authorId = u.id;
    const row = await store.createEntry(collection, data, {
      userId: u.id,
      sort: n + 1,
    });
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    return fail(e);
  }
}

const MAX_MARKDOWN = 500_000;

/** Blog → Import .md: turns a Markdown file into a new draft post (never published directly). */
export async function importMarkdownPostAction(
  markdown: unknown,
): Promise<Result<{ id: number; warnings: string[] }>> {
  try {
    assertWritable();
    const u = await guardFor("posts");
    if (typeof markdown !== "string" || !markdown.trim()) throw new Invalid("The file is empty.");
    if (markdown.length > MAX_MARKDOWN) throw new Invalid("The file is too large (500 KB max).");
    let parsed: ReturnType<typeof markdownToPost>;
    try {
      parsed = markdownToPost(markdown);
    } catch {
      throw new Invalid("Couldn't read the file. Check the front matter between the --- lines.");
    }
    const { fields, content, warnings } = parsed;
    const title = fields.title?.trim() || "Untitled post";
    if (!fields.title) warnings.unshift("No title found: add one in the editor.");
    const base = slugifyHeading(fields.slug || title) || `post-${Date.now().toString(36)}`;
    let slug = base;
    for (let i = 2; ; i++) {
      const [clash] = await db
        .select({ id: entries.id })
        .from(entries)
        .where(and(eq(entries.collection, "posts"), eq(entries.slug, slug)))
        .limit(1);
      if (!clash) break;
      slug = `${base}-${i}`;
    }
    if (fields.slug && slug !== slugifyHeading(fields.slug))
      warnings.unshift(`The slug was taken, so this draft uses “${slug}”.`);
    const [{ n }] = await db
      .select({ n: count() })
      .from(entries)
      .where(eq(entries.collection, "posts"));
    const data = prepare("posts", {
      ...fields,
      title,
      slug,
      content,
      stage: "draft",
      authorId: u.id,
    });
    const row = await store.createEntry("posts", data, { userId: u.id, sort: n + 1 });
    return { ok: true, data: { id: row.id, warnings } };
  } catch (e) {
    return fail(e);
  }
}

/** Signed-in user + the entry they asked for, once they're allowed to edit it (guardEntry). */
async function entryFor(id: unknown) {
  const u = await assertUser();
  if (!Number.isInteger(id) || (id as number) <= 0) throw new Error("Not found");
  const row = await store.readEntryRow(id as number);
  if (!row) throw new Error("Not found");
  guardEntry(row, u);
  return { u, row, collection: row.collection as CollectionKey };
}

/** Throws unless the user may publish/unpublish/delete/reorder in this collection. */
function guardManage(u: AdminUser, collection: CollectionKey) {
  if (!can(u.role, managePerm(collection))) throw new Error(DENIED);
}

/**
 * Guard for anything addressed by a version ref ("global:<key>" or "entry:<id>"): globals by
 * their permission, entries by guardEntry (authors: their own posts only).
 */
async function guardRef(ref: unknown) {
  const m = /^(global|entry):([^:]+)$/.exec(String(ref));
  if (m?.[1] === "global") return guardGlobal(m[2]);
  if (m?.[1] === "entry" && /^\d+$/.test(m[2])) return (await entryFor(Number(m[2]))).u;
  await assertUser();
  throw new Error("Not found");
}

async function slugClash(row: { id: number; collection: string; slug: string }, data: unknown) {
  const slug = (data as { slug?: string }).slug;
  if (!slug || slug === row.slug) return null;
  const [clash] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.collection, row.collection), eq(entries.slug, slug)))
    .limit(1);
  return clash && clash.id !== row.id ? `The slug “${slug}” is already used.` : null;
}

export async function saveEntry(id: number, data: unknown): Promise<Result<{ draft: boolean }>> {
  try {
    assertWritable();
    const { u, row, collection } = await entryFor(id);
    const clean = prepare(collection, data);
    // Authors always write as themselves; editors and admins may pick any author.
    if (collection === "posts" && !can(u.role, "posts.manage")) (clean as PostData).authorId = u.id;
    const clash = await slugClash(row, clean);
    if (clash) return { ok: false, error: clash };
    const r = await store.saveEntryDraft(id, clean, u.id);
    // A never-published entry always has something to publish.
    return { ok: true, data: { draft: r.hasDraft || !row.data } };
  } catch (e) {
    return fail(e);
  }
}

export async function publishEntryAction(id: number, data?: unknown): Promise<Result> {
  try {
    assertWritable();
    const { u, row, collection } = await entryFor(id);
    guardManage(u, collection);
    if (data !== undefined) {
      const r = await saveEntry(id, data);
      if (!r.ok) return r;
    }
    const published = await store.publishEntry(id, u.id);
    const slugNow = (published.data as { slug?: string }).slug ?? published.slug;
    revalidateCollection(collection, [row.slug, slugNow]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function unpublishEntryAction(id: number): Promise<Result> {
  try {
    assertWritable();
    const { u, row, collection } = await entryFor(id);
    guardManage(u, collection);
    await store.unpublishEntry(id);
    revalidateCollection(row.collection as CollectionKey, [row.slug]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function discardEntryDraftAction(id: number): Promise<Result> {
  try {
    assertWritable();
    await entryFor(id);
    await store.discardEntryDraft(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEntryAction(id: number): Promise<Result> {
  try {
    assertWritable();
    const { u, row, collection } = await entryFor(id);
    // Authors may delete their own post only while it has never been published.
    if (!(collection === "posts" && row.data === null)) guardManage(u, collection);
    await store.deleteEntry(id);
    revalidateCollection(collection, [row.slug]);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * "Cancel" on a brand-new entry: deletes it (and its versions) so it doesn't linger as a draft.
 * Refuses once the entry has ever been published; use Unpublish/Delete for those.
 */
export async function cancelNewEntryAction(id: number): Promise<Result> {
  try {
    assertWritable();
    const { row } = await entryFor(id);
    if (row.data !== null)
      throw new Invalid("This entry is live. Use Delete from the list instead.");
    await store.deleteEntry(id);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function reorderEntriesAction(
  collection: CollectionKey,
  ids: number[],
): Promise<Result> {
  try {
    assertWritable();
    const u = await guardFor(collection);
    guardManage(u, collection);
    if (!Array.isArray(ids)) throw new Invalid("Nothing to reorder.");
    await store.reorderEntries(
      collection,
      ids.filter((i) => Number.isInteger(i) && i > 0),
    );
    revalidateCollection(collection);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Restores a version into the draft (it still needs publishing). */
export async function restoreVersionAction(
  versionId: number,
): Promise<Result<{ data: unknown; draft: boolean }>> {
  try {
    assertWritable();
    await assertUser();
    const v = await store.readVersion(versionId);
    if (!v) throw new Error("Version not found");
    const [kind, ref] = v.ref.split(":");
    let data = v.data;
    let draft: boolean;
    if (kind === "global") {
      const u = await guardGlobal(ref);
      const r = await store.saveGlobalDraft(ref as GlobalKey, data, u.id, "Restored");
      data = r.data;
      draft = r.draft;
    } else if (kind === "entry") {
      const { u, row, collection } = await entryFor(Number(ref));
      data = prepare(collection, data);
      // An old version may name another author; an author's restore keeps the post theirs.
      if (collection === "posts" && !can(u.role, "posts.manage"))
        (data as PostData).authorId = u.id;
      const clash = await slugClash(row, data);
      if (clash) return { ok: false, error: `${clash} Change it in the current draft first.` };
      const r = await store.saveEntryDraft(row.id, data, u.id, "Restored");
      draft = r.hasDraft || !row.data;
    } else throw new Error("Version not found");
    return { ok: true, data: { data, draft } };
  } catch (e) {
    return fail(e);
  }
}

export async function listVersionsAction(ref: string) {
  await guardRef(ref);
  const rows = await store.listVersions(ref);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

const GLOBAL_HREF: Record<GlobalKey, string> = {
  "site-settings": "/admin/settings/general",
  navigation: "/admin/settings/navigation",
  "home-page": "/admin/home",
  "blog-page": "/admin/blog-settings",
  toolkit: "/admin/toolkit",
  seo: "/admin/settings/seo",
  privacy: "/admin/settings/privacy",
  appearance: "/admin/settings/appearance",
};

export type PendingRef = { kind: "global"; key: GlobalKey } | { kind: "entry"; id: number };

/** What an unpublished draft changes compared with the live version. */
export async function pendingDiff(ref: PendingRef): Promise<Change[]> {
  await guardRef(ref.kind === "global" ? `global:${ref.key}` : `entry:${ref.id}`);
  const row =
    ref.kind === "global" ? await store.readGlobalRow(ref.key) : await store.readEntryRow(ref.id);
  if (!row?.draft) return [];
  return diffDocs(row.data ?? null, row.draft);
}

/** Publish or discard one pending item (used by the Review panel). */
export async function publishPending(ref: PendingRef): Promise<Result> {
  return ref.kind === "global" ? publishGlobal(ref.key) : publishEntryAction(ref.id);
}
export async function discardPending(ref: PendingRef): Promise<Result> {
  return ref.kind === "global" ? discardGlobal(ref.key) : discardEntryDraftAction(ref.id);
}

/**
 * What a saved version changed: against the version saved just before it (default),
 * or against what's live right now.
 */
export async function versionDiff(
  versionId: number,
  against: "previous" | "live" = "previous",
): Promise<{ changes: Change[]; baseline: string }> {
  await assertUser();
  const v = await store.readVersion(versionId);
  if (!v) throw new Error("Version not found");
  await guardRef(v.ref); // throws unless the user may see this document's versions
  if (against === "live") {
    const [kind, ref] = v.ref.split(":");
    const row =
      kind === "global"
        ? await store.readGlobalRow(ref as GlobalKey)
        : await store.readEntryRow(Number(ref));
    return {
      changes: diffDocs(row?.data ?? null, v.data),
      baseline: row?.data ? "the live version" : "nothing (never published)",
    };
  }
  const [prev] = await db
    .select({ data: versions.data, label: versions.label, createdAt: versions.createdAt })
    .from(versions)
    .where(and(eq(versions.ref, v.ref), lt(versions.id, v.id)))
    .orderBy(desc(versions.id))
    .limit(1);
  return {
    changes: diffDocs(prev?.data ?? null, v.data),
    baseline: prev ? `the previous version (${prev.label.toLowerCase()})` : "an empty document",
  };
}

/** Every unpublished change, for the dashboard bar and the top “Publish changes” button. */
export async function pendingChanges() {
  const me = await assertUser();
  // Drafts that ended up identical to the live copy aren't changes: clear them (self-healing
  // for drafts saved before no-op detection existed).
  const gAll = await db
    .select({ key: globals.key, draft: globals.draft, data: globals.data })
    .from(globals)
    .where(isNotNull(globals.draft));
  const noop = gAll.filter((r) => r.data && store.stableJson(r.draft) === store.stableJson(r.data));
  if (noop.length)
    await db
      .update(globals)
      .set({ draft: null })
      .where(
        inArray(
          globals.key,
          noop.map((r) => r.key),
        ),
      );
  // Everyone only sees (and can act on) what their role allows: editors get posts and blog
  // settings; authors only their own posts.
  const g = gAll.filter((r) => !noop.includes(r) && canGlobal(me, r.key as GlobalKey));
  const eAll = await db
    .select({
      id: entries.id,
      collection: entries.collection,
      slug: entries.slug,
      draft: entries.draft,
      data: entries.data,
    })
    .from(entries)
    .where(isNotNull(entries.draft));
  const eNoop = eAll.filter(
    (r) => r.data && store.stableJson(r.draft) === store.stableJson(r.data),
  );
  if (eNoop.length)
    await db
      .update(entries)
      .set({ draft: null })
      .where(
        inArray(
          entries.id,
          eNoop.map((r) => r.id),
        ),
      );
  const e = eAll.filter((r) => !eNoop.includes(r) && canEntry(me, r));
  return [
    ...g.map((r) => ({
      kind: "global" as const,
      key: r.key as GlobalKey,
      label: GLOBAL_LABEL[r.key as GlobalKey],
      href: GLOBAL_HREF[r.key as GlobalKey],
    })),
    ...e.map((r) => ({
      kind: "entry" as const,
      id: r.id,
      collection: r.collection as CollectionKey,
      isNew: r.data === null,
      href: `/admin/${r.collection}/${r.id}`,
      label: `${COLLECTION_LABEL[r.collection as CollectionKey]} → “${(r.draft as { title?: string; company?: string }).title ?? (r.draft as { company?: string }).company ?? r.slug}”`,
    })),
  ];
}

export async function publishAll(): Promise<Result<{ published: number }>> {
  try {
    assertWritable();
    // Editors and admins only (authors never publish); each item is checked again below.
    const u = await assertPermission("posts.manage");
    const items = await pendingChanges();
    let n = 0;
    for (const it of items) {
      if (it.kind === "global") {
        if (!canGlobal(u, it.key)) continue;
        await store.publishGlobal(it.key, u.id);
        revalidateGlobal(it.key);
        n++;
      } else if (!it.isNew && can(u.role, managePerm(it.collection))) {
        // New, never-published entries stay drafts until published from their own editor.
        const row = await store.publishEntry(it.id, u.id);
        revalidateCollection(it.collection, [row.slug, (row.data as { slug?: string }).slug]);
        n++;
      }
    }
    return { ok: true, data: { published: n } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Delete autosave versions: one document's (from its Versions panel) or every document's
 * (Settings → Analytics & privacy). Drafts themselves and published versions are kept.
 */
export async function clearAutosaves(ref?: string): Promise<Result<{ cleared: number }>> {
  try {
    assertWritable();
    // Every document's autosaves (Settings → Analytics & privacy) is a site setting.
    if (!ref) await assertPermission("site.manage");
    else await guardRef(ref);
    return { ok: true, data: { cleared: await store.clearAutosaves(ref) } };
  } catch (e) {
    return fail(e);
  }
}

export async function versionStorage() {
  await assertPermission("site.manage");
  return store.versionStats();
}

/** Throw away every draft that has a live version (new, never-published entries are kept). */
export async function discardAll(): Promise<Result<{ discarded: number }>> {
  try {
    assertWritable();
    const u = await assertUser();
    const items = await pendingChanges(); // only what this user may act on
    let n = 0;
    for (const it of items) {
      if (it.kind === "global") {
        if (!canGlobal(u, it.key)) continue;
        await store.discardGlobalDraft(it.key);
        n++;
      } else if (!it.isNew) {
        const r = await discardEntryDraftAction(it.id);
        if (r.ok) n++;
      }
    }
    return { ok: true, data: { discarded: n } };
  } catch (e) {
    return fail(e);
  }
}

/**
 * The starter content for a settings document, ready to load into its editor (it becomes a
 * draft through autosave, so the site only changes when you publish). Links to other records
 * (the résumé file, featured projects) keep their current values.
 */
export async function globalDefaults(key: GlobalKey): Promise<Result<unknown>> {
  try {
    await guardGlobal(key);
    const [settings, home] = await Promise.all([
      store.readGlobal("site-settings", { draft: true }),
      store.readGlobal("home-page", { draft: true }),
    ]);
    const work = home.sections.find((s) => s.blockType === "work") as
      | { projects?: number[] }
      | undefined;
    const raw = GLOBAL_DEFAULTS[key]({
      resumeId: settings.resume ?? null,
      projectIds: work?.projects ?? [],
    });
    return { ok: true, data: GLOBALS[key].parse(raw) };
  } catch (e) {
    return fail(e);
  }
}

const GLOBAL_LABEL: Record<GlobalKey, string> = {
  "site-settings": "Settings → General",
  navigation: "Portfolio → Header & footer",
  "home-page": "Portfolio → Home page",
  "blog-page": "Blog settings",
  toolkit: "Toolkit strata",
  seo: "Settings → SEO",
  privacy: "Settings → Analytics & privacy",
  appearance: "Settings → Appearance",
};
const COLLECTION_LABEL: Record<CollectionKey, string> = {
  posts: "Blog",
  projects: "Case studies",
  experience: "Experience",
};

/* ───────── Media ───────── */

/** Extension stored with each allowed type, so a key's extension always matches its content. */
const MIME_EXT: Record<(typeof ALLOWED_MIME)[number], string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "image/x-icon": ".ico",
  "image/vnd.microsoft.icon": ".ico",
  "application/pdf": ".pdf",
};

/**
 * Upload tickets. createUpload signs {key, mime, user, expiry} with AUTH_SECRET; registerUpload
 * only accepts a key and type that come with a valid ticket, so the browser can't register (or
 * get the server to delete) arbitrary storage objects, or swap the declared type to skip the
 * SVG check.
 */
type Ticket = { k: string; m: string; u: string; e: number };
const TICKET_TTL_MS = 30 * 60 * 1000;
function ticketSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return s;
}
function signTicket(t: Ticket) {
  const body = Buffer.from(JSON.stringify(t)).toString("base64url");
  const mac = createHmac("sha256", ticketSecret()).update(`upload:${body}`).digest("base64url");
  return `${body}.${mac}`;
}
function readTicket(token: unknown): Ticket | null {
  if (typeof token !== "string") return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", ticketSecret()).update(`upload:${body}`).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const t = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Ticket;
    return t.e > Date.now() ? t : null;
  } catch {
    return null;
  }
}

export async function createUpload(file: {
  name: string;
  type: string;
  size: number;
}): Promise<Result<{ key: string; url: string; token: string }>> {
  try {
    assertWritable();
    const u = await assertPermission("media.upload");
    const mime = file.type as (typeof ALLOWED_MIME)[number];
    if (!ALLOWED_MIME.includes(mime)) throw new Error("That file type isn’t allowed.");
    if (!(file.size > 0) || file.size > MAX_UPLOAD_BYTES)
      throw new Error("Files must be 10 MB or smaller.");
    const name = String(file.name ?? "file").slice(0, 200);
    const base = name.replace(/\.[^.]*$/, "");
    const key = makeKey(`${base || "file"}${MIME_EXT[mime]}`);
    if (!APP_KEY.test(key)) throw new Error("Could not name that file.");
    const { url } = await presignUpload(key, mime);
    const token = signTicket({ k: key, m: mime, u: u.id, e: Date.now() + TICKET_TTL_MS });
    return { ok: true, data: { key, url, token } };
  } catch (e) {
    return fail(e);
  }
}

export async function registerUpload(input: {
  key: string;
  token: string;
  filename: string;
  size?: number;
  width?: number | null;
  height?: number | null;
  alt?: string;
  blur?: string | null;
}): Promise<Result<{ id: number; url: string }>> {
  // Set once the ticket checks out: only then may a failure delete the stored object.
  let issuedKey: string | null = null;
  try {
    assertWritable();
    const u = await assertPermission("media.upload");
    const t = readTicket(input.token);
    if (!t || t.k !== input.key || t.u !== u.id || !APP_KEY.test(t.k))
      throw new Invalid("This upload has expired. Please try again.");
    issuedKey = t.k;
    const [already] = await db
      .select({ id: media.id })
      .from(media)
      .where(eq(media.key, t.k))
      .limit(1);
    if (already) {
      issuedKey = null; // registered already; never delete a file that's in the library
      throw new Invalid("This file is already in the library.");
    }
    // Trust what storage holds, not what the browser says.
    const stored = await headObject(t.k);
    if (!stored) throw new Invalid("The upload didn’t reach storage. Please try again.");
    if (stored.size === 0 || stored.size > MAX_UPLOAD_BYTES)
      throw new Invalid("Files must be 10 MB or smaller.");
    if (stored.contentType && stored.contentType.split(";")[0].trim() !== t.m)
      throw new Invalid("The uploaded file doesn’t match its declared type.");
    if (t.m === "image/svg+xml") {
      const svg = (await readObject(t.k)).toString("utf8");
      if (!isSafeSvg(svg))
        throw new Invalid("This SVG contains scripts or external references and was rejected.");
    }
    const filename =
      String(input.filename ?? "")
        // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
        .replace(/[\\/\u0000-\u001f]/g, "")
        .trim()
        .slice(0, 160) ||
      t.k.split("/").pop() ||
      "file";
    const [row] = await db
      .insert(media)
      .values({
        key: t.k,
        url: publicUrl(t.k),
        filename,
        mime: t.m,
        size: stored.size,
        width: Number.isFinite(input.width) ? Math.round(Number(input.width)) : null,
        height: Number.isFinite(input.height) ? Math.round(Number(input.height)) : null,
        alt: String(input.alt ?? "")
          .trim()
          .slice(0, 300),
        blur: isBlurDataUrl(input.blur) ? input.blur : null,
      })
      .returning();
    revalidateMedia();
    return { ok: true, data: { id: row.id, url: row.url } };
  } catch (e) {
    // The file already reached storage; don't leave an orphan behind when registering fails.
    // Only keys issued to this user by createUpload are ever deleted here.
    if (issuedKey) await deleteObject(issuedKey).catch(() => undefined);
    return fail(e);
  }
}

/** Saves a blurred preview made in the browser (backfill for images uploaded before previews). */
export async function setMediaBlur(id: number, blur: string): Promise<Result> {
  try {
    assertWritable();
    await assertPermission("media.edit");
    if (!isBlurDataUrl(blur)) throw new Invalid("Not a preview image.");
    await db
      .update(media)
      .set({ blur })
      .where(and(eq(media.id, id), isNull(media.blur)));
    revalidateMedia();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const mediaOut = (r: typeof media.$inferSelect) => ({
  ...r,
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
  deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
});
type MediaItemOut = ReturnType<typeof mediaOut>;
export type MediaKind = "all" | "image" | "pdf" | "noalt" | "bin";
const MEDIA_PAGE = 40;

/** One page of the media library, newest first (keyset on id, so new uploads never shift pages). */
export async function listMedia({
  cursor,
  kind = "all",
  q = "",
  limit = MEDIA_PAGE,
}: {
  cursor?: number | null;
  kind?: MediaKind;
  q?: string;
  limit?: number;
} = {}) {
  // The bin is part of deleting files; everyone who can upload can browse the library.
  await assertPermission(kind === "bin" ? "media.delete" : "media.upload");
  const where: SQL[] = [kind === "bin" ? isNotNull(media.deletedAt) : isNull(media.deletedAt)];
  if (kind === "image") where.push(like(media.mime, "image/%"));
  if (kind === "pdf") where.push(eq(media.mime, "application/pdf"));
  if (kind === "noalt") where.push(like(media.mime, "image/%"), eq(media.alt, ""));
  const term = q
    .trim()
    .slice(0, 100)
    .replace(/[%_\\]/g, "\\$&");
  if (term) {
    const cond = or(ilike(media.filename, `%${term}%`), ilike(media.alt, `%${term}%`));
    if (cond) where.push(cond);
  }
  const base = where.length ? and(...where) : undefined;
  const size = Math.min(Math.max(1, limit), 100);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(media)
      .where(cursor ? and(base, lt(media.id, cursor)) : base)
      .orderBy(desc(media.id))
      .limit(size + 1),
    db.select({ n: count() }).from(media).where(base),
  ]);
  const more = rows.length > size;
  const items = rows.slice(0, size).map(mediaOut);
  return { items, total: n, nextCursor: more ? (items.at(-1)?.id ?? null) : null };
}

/** Specific media rows by id (fields and image blocks show their file without loading the library). */
export async function getMediaItems(ids: number[]) {
  await assertPermission("media.upload");
  const clean = [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))].slice(0, 100);
  if (!clean.length) return [];
  const rows = await db
    .select()
    .from(media)
    .where(and(inArray(media.id, clean), isNull(media.deletedAt)));
  return rows.map(mediaOut);
}

/** Edit a file's details. The storage key/URL never changes, so renaming can't break pages. */
export async function updateMedia(
  id: number,
  patch: { filename?: string; alt?: string; caption?: string },
): Promise<Result<MediaItemOut>> {
  try {
    assertWritable();
    await assertPermission("media.edit");
    const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
    if (!row) throw new Error("That file no longer exists.");
    const set: Partial<typeof media.$inferInsert> = { updatedAt: new Date() };
    if (patch.filename !== undefined) {
      // Keep the original extension; strip path separators and control characters.
      const ext = row.filename.match(/\.[a-z0-9]+$/i)?.[0] ?? "";
      const base = patch.filename
        // biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
        .replace(/[\\/\u0000-\u001f]/g, "")
        .replace(/\.[a-z0-9]+$/i, "")
        .trim()
        .slice(0, 120);
      if (!base) throw new Error("The file name can’t be empty.");
      set.filename = `${base}${ext}`;
    }
    if (patch.alt !== undefined) set.alt = patch.alt.trim().slice(0, 300);
    if (patch.caption !== undefined) set.caption = patch.caption.trim().slice(0, 500);
    const [next] = await db.update(media).set(set).where(eq(media.id, id)).returning();
    revalidateMedia();
    return { ok: true, data: mediaOut(next) };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Where files are used: settings (résumé, OG image), post covers and images inside rich text.
 * Scans published data and drafts, so a file only used by an unpublished draft still shows up.
 */
export async function mediaUsage(ids: number[]): Promise<Record<number, string[]>> {
  const u = await assertPermission("media.upload");
  const want = new Set(ids);
  const out: Record<number, string[]> = {};
  const scan = (doc: unknown, label: string) => {
    if (!doc) return;
    const text = JSON.stringify(doc);
    for (const m of text.matchAll(/"(resume|ogImage|coverImage|mediaId)":(\d+)/g)) {
      const id = Number(m[2]);
      if (!want.has(id)) continue;
      const where = {
        resume: `${label} (résumé)`,
        ogImage: `${label} (share image)`,
        coverImage: `${label} (cover)`,
        mediaId: `${label} (image in text)`,
      }[m[1] as "resume"];
      out[id] = [...new Set([...(out[id] ?? []), where])];
    }
  };
  const [gs, es] = await Promise.all([
    db.select({ key: globals.key, data: globals.data, draft: globals.draft }).from(globals),
    db
      .select({
        collection: entries.collection,
        slug: entries.slug,
        data: entries.data,
        draft: entries.draft,
      })
      .from(entries),
  ]);
  // Places the user can't open are counted but not named, so draft titles never leak.
  for (const g of gs) {
    const label =
      isGlobalKey(g.key) && canGlobal(u, g.key) ? GLOBAL_LABEL[g.key] : "A settings page";
    scan(g.data, label);
    scan(g.draft, `${label} draft`);
  }
  for (const e of es) {
    const kind =
      e.collection === "posts" ? "Post" : e.collection === "projects" ? "Case study" : "Experience";
    if (!canEntry(u, e)) {
      scan(e.data, `Another ${kind.toLowerCase()}`);
      scan(e.draft, `Another ${kind.toLowerCase()}`);
      continue;
    }
    const title = ((e.draft ?? e.data) as { title?: string } | null)?.title ?? e.slug ?? "Untitled";
    const label = `${kind} “${title}”`;
    scan(e.data, label);
    scan(e.draft, label);
  }
  return out;
}

const cleanIds = (ids: number[]) =>
  [...new Set(ids.filter((i) => Number.isInteger(i) && i > 0))].slice(0, 200);

/** Move files to the bin. Pages stop showing them; the storage object stays until the bin is emptied. */
export async function deleteMediaMany(ids: number[]): Promise<Result<{ deleted: number }>> {
  try {
    assertWritable();
    await assertPermission("media.delete");
    const clean = cleanIds(ids);
    if (!clean.length) return { ok: true, data: { deleted: 0 } };
    const r = await db
      .update(media)
      .set({ deletedAt: new Date() })
      .where(and(inArray(media.id, clean), isNull(media.deletedAt)))
      .returning({ id: media.id });
    revalidateMedia();
    return { ok: true, data: { deleted: r.length } };
  } catch (e) {
    return fail(e);
  }
}

/** Take files back out of the bin. */
export async function restoreMedia(ids: number[]): Promise<Result<{ restored: number }>> {
  try {
    assertWritable();
    await assertPermission("media.delete");
    const clean = cleanIds(ids);
    if (!clean.length) return { ok: true, data: { restored: 0 } };
    const r = await db
      .update(media)
      .set({ deletedAt: null })
      .where(and(inArray(media.id, clean), isNotNull(media.deletedAt)))
      .returning({ id: media.id });
    revalidateMedia();
    return { ok: true, data: { restored: r.length } };
  } catch (e) {
    return fail(e);
  }
}

export async function purgeMedia(
  ids: number[],
): Promise<Result<{ purged: number; failed: string[] }>> {
  try {
    assertWritable();
    await assertPermission("media.delete");
    const clean = cleanIds(ids);
    if (!clean.length) return { ok: true, data: { purged: 0, failed: [] } };
    const rows = await db
      .select()
      .from(media)
      .where(and(inArray(media.id, clean), isNotNull(media.deletedAt)));
    const out = await purgeRows(rows);
    revalidateMedia();
    return { ok: true, data: out };
  } catch (e) {
    return fail(e);
  }
}

export async function emptyBin(): Promise<Result<{ purged: number; failed: string[] }>> {
  try {
    assertWritable();
    await assertPermission("media.delete");
    const out = await emptyBinNow();
    revalidateMedia();
    return { ok: true, data: out };
  } catch (e) {
    return fail(e);
  }
}

export async function binCount() {
  const u = await assertUser();
  if (!can(u.role, "media.delete")) return 0;
  const [{ n }] = await db.select({ n: count() }).from(media).where(isNotNull(media.deletedAt));
  return n;
}

/** Objects in storage that no library row points at (left by failed uploads or old deletes). */
export async function scanOrphans(): Promise<
  Result<{ items: { key: string; size: number }[]; scanned: number }>
> {
  try {
    await assertPermission("media.delete");
    const [objects, rows] = await Promise.all([
      listObjects(),
      db.select({ key: media.key }).from(media),
    ]);
    const known = new Set(rows.map((r) => r.key));
    // Only keys this app writes (YYYY-MM/name-xxxxxx.ext), never other files in the bucket.
    const items = objects.filter((o) => APP_KEY.test(o.key) && !known.has(o.key));
    return { ok: true, data: { items, scanned: objects.length } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteOrphans(keys: string[]): Promise<Result<{ deleted: number }>> {
  try {
    assertWritable();
    await assertPermission("media.delete");
    const want = [...new Set(keys)].filter((k) => APP_KEY.test(k)).slice(0, 500);
    const known = new Set(
      (await db.select({ key: media.key }).from(media).where(inArray(media.key, want))).map(
        (r) => r.key,
      ),
    );
    const del = want.filter((k) => !known.has(k));
    await Promise.all(del.map((k) => deleteObject(k).catch(() => undefined)));
    return { ok: true, data: { deleted: del.length } };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMediaAction(id: number): Promise<Result> {
  const r = await deleteMediaMany([id]);
  return r.ok ? { ok: true } : r;
}

/* ───────── Messages ───────── */

export type MessageFilter = "all" | "unread";

/** One page of the inbox, newest first, with totals for the pager and filter chips. */
export async function listMessages({
  page = 0,
  pageSize = 25,
  filter = "all",
  q = "",
}: {
  page?: number;
  pageSize?: number;
  filter?: MessageFilter;
  /** Searches name, email, topic and message text across every message, not just this page. */
  q?: string;
} = {}) {
  await assertPermission("site.manage");
  const size = Math.min(Math.max(5, pageSize), 100);
  const pq = prefixQuery(q);
  const text = sql`(${messages.name} || ' ' || ${messages.email} || ' ' || ${messages.topic} || ' ' || ${messages.message})`;
  const vec = sql`to_tsvector('english', ${text})`;
  const tsq = pq ? tsQuery(pq) : null;
  const searching = Boolean(q.trim());
  const where = and(
    filter === "unread" ? eq(messages.read, false) : undefined,
    searching ? (tsq ? or(sql`${vec} @@ ${tsq}`, allLike(text, q)) : allLike(text, q)) : undefined,
  );
  const rank = tsq ? sql`ts_rank_cd(${vec}, ${tsq})` : sql`0`;
  const [[{ total }], [{ unread }]] = await Promise.all([
    db.select({ total: count() }).from(messages).where(where),
    db.select({ unread: count() }).from(messages).where(eq(messages.read, false)),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(0, Math.floor(page)), pageCount - 1);
  const rows = await db
    .select()
    .from(messages)
    .where(where)
    .orderBy(...(searching ? [desc(rank)] : []), desc(messages.createdAt), desc(messages.id))
    .limit(size)
    .offset(current * size);
  return {
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    total,
    unread,
    page: current,
    pageSize: size,
    pageCount,
  };
}

export async function unreadCount() {
  const u = await assertUser();
  if (!can(u.role, "site.manage")) return 0;
  const [{ n }] = await db.select({ n: count() }).from(messages).where(eq(messages.read, false));
  return n;
}

export async function setMessageRead(id: number, read: boolean): Promise<Result> {
  try {
    assertWritable();
    await assertPermission("site.manage");
    await db.update(messages).set({ read }).where(eq(messages.id, id));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMessage(id: number): Promise<Result> {
  try {
    assertWritable();
    await assertPermission("site.manage");
    await db.delete(messages).where(eq(messages.id, id));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────── Users ───────── */

export async function listUsers() {
  await assertPermission("site.manage");
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      image: user.image,
      byline: user.byline,
      bio: user.bio,
    })
    .from(user)
    .orderBy(user.createdAt);
  return rows.map((r) => ({ ...r, role: toRole(r.role) }));
}

/** Everyone who can be picked as a post's author (any signed-in user may list them). */
export async function listAuthors() {
  await assertUser();
  return db
    .select({ id: user.id, name: user.name, image: user.image, role: user.role })
    .from(user)
    .orderBy(user.createdAt);
}

/** Public author profile (name, byline, bio) shown on posts. Your own, or anyone's for admins. */
export async function updateProfile(
  input: { name: string; byline: string; bio: string },
  userId?: string,
): Promise<Result> {
  try {
    assertWritable();
    const me = await assertUser();
    const target = userId ?? me.id;
    if (target !== me.id && !can(me.role, "site.manage"))
      throw new Error("Only admins can edit others.");
    const name = input.name.trim().slice(0, 80);
    if (!name) throw new Error("Add your name.");
    await db
      .update(user)
      .set({
        name,
        byline: input.byline.trim().slice(0, 120) || null,
        bio: input.bio.trim().slice(0, 600) || null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, target));
    revalidateAuthors();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Creates an admin, editor or author with a one-time password shown to the inviting admin. */
export async function inviteUser(input: {
  name: string;
  email: string;
  role: Role;
}): Promise<Result<{ password: string }>> {
  try {
    assertWritable();
    await assertPermission("site.manage");
    // Never trust the role from the browser: only the known roles can be stored.
    const role = input.role;
    if (!(ROLES as readonly unknown[]).includes(role)) throw new Invalid("Pick a valid role.");
    const email = String(input.email ?? "")
      .trim()
      .toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Invalid("Enter a valid email.");
    const [exists] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, email))
      .limit(1);
    if (exists) throw new Invalid("That person already has access.");
    const id = randomUUID();
    const password = randomUUID().replace(/-/g, "").slice(0, 16);
    await db.insert(user).values({
      id,
      name: String(input.name ?? "").trim() || email,
      email,
      emailVerified: true,
      role,
    });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(password),
    });
    return { ok: true, data: { password } };
  } catch (e) {
    return fail(e);
  }
}

export async function removeUser(id: string): Promise<Result> {
  try {
    assertWritable();
    const me = await assertPermission("site.manage");
    if (me.id === id) throw new Error("You can’t remove yourself.");
    const [{ n }] = await db.select({ n: count() }).from(user).where(eq(user.role, "admin"));
    const [target] = await db.select().from(user).where(eq(user.id, id)).limit(1);
    if (target?.role === "admin" && n <= 1) throw new Error("Keep at least one admin.");
    await db.delete(user).where(eq(user.id, id));
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/* ───────── Dashboard ───────── */

/**
 * Recent activity a user may open: admins everything; editors posts and blog settings;
 * authors only versions of their own posts.
 */
function activityScope(u: AdminUser): SQL | undefined {
  if (can(u.role, "site.manage")) return undefined;
  const postRefs = (own: boolean) =>
    sql`${versions.ref} in (select 'entry:' || ${entries.id} from ${entries}
      where ${entries.collection} = 'posts' ${own ? sql`and ${ownPostsSql(u.id)}` : sql``})`;
  if (can(u.role, "posts.manage"))
    return or(
      postRefs(false),
      ...(can(u.role, "blog.settings") ? [eq(versions.ref, "global:blog-page")] : []),
    );
  return can(u.role, "posts.write") ? postRefs(true) : sql`false`;
}

export async function dashboardStats() {
  const u = await assertUser();
  const seesMessages = can(u.role, "site.manage");
  const [posts, unread, mediaSize, dbSize, activity] = await Promise.all([
    db
      .select({ stage: sql<string>`${entries.data}->>'stage'`, n: count() })
      .from(entries)
      .where(and(eq(entries.collection, "posts"), isNotNull(entries.data)))
      .groupBy(sql`${entries.data}->>'stage'`),
    seesMessages
      ? db.select({ n: count() }).from(messages).where(eq(messages.read, false))
      : Promise.resolve([{ n: 0 }]),
    db.select({ bytes: sql<number>`coalesce(sum(${media.size}),0)::bigint` }).from(media),
    db.execute<{ size: string }>(sql`select pg_database_size(current_database())::text as size`),
    db
      .select({
        id: versions.id,
        ref: versions.ref,
        label: versions.label,
        createdAt: versions.createdAt,
        data: versions.data,
      })
      .from(versions)
      .where(activityScope(u))
      .orderBy(desc(versions.createdAt))
      .limit(8),
  ]);
  const byStage = Object.fromEntries(posts.map((p) => [p.stage, p.n]));
  return {
    published: byStage.published ?? 0,
    upcoming: (byStage.writing ?? 0) + (byStage.draft ?? 0),
    unread: unread[0]?.n ?? 0,
    mediaBytes: Number(mediaSize[0]?.bytes ?? 0),
    dbBytes: Number((dbSize as unknown as { size: string }[])[0]?.size ?? 0),
    activity: activity.map((a) => {
      const d = a.data as { title?: string; company?: string };
      const [kind, ref] = a.ref.split(":");
      return {
        id: a.id,
        label: a.label,
        what: kind === "global" ? GLOBAL_LABEL[ref as GlobalKey] : (d.title ?? d.company ?? "Item"),
        href: kind === "global" ? globalHref(ref as GlobalKey) : `/admin/edit/${ref}`,
        at: a.createdAt.toISOString(),
      };
    }),
  };
}

function globalHref(key: GlobalKey) {
  return GLOBAL_HREF[key];
}

/** Sidebar counts + ⌘K index, refetched by the admin shell after navigation and changes. */
export async function adminNavAction() {
  return loadAdminNav(await assertUser());
}

/**
 * Admin list search across the whole collection in the database (draft values first).
 * Postgres full-text search over the generated `search_draft` vector (stemmed, prefix, ranked),
 * plus a substring fallback for code identifiers and partial words. Returns ids, best first.
 */
export async function searchEntriesAction(collection: CollectionKey, q: string): Promise<number[]> {
  const u = await guardFor(collection);
  const pq = prefixQuery(q);
  if (!pq && !likeWords(q).length) return [];
  const d = sql`coalesce(${entries.draft}, ${entries.data})`;
  // Fallback haystack: the same fields as the vector (not raw JSON, so node types like
  // "paragraph" never match).
  const hay = sql`concat_ws(' ', ${entries.slug}, ${d}->>'title', ${d}->>'excerpt', ${d}->>'summary',
    ${d}->>'client', ${d}->>'company', ${d}->>'role', ${d}->>'kind', ${d}->>'type',
    ${d}->>'category', ${d}->>'location', ${d}->>'listLabel', (${d}->'tags')::text,
    jsonb_path_query_array(${d}, 'lax $.**.text')::text,
    jsonb_path_query_array(${d}, 'lax $.**.attrs')::text)`;
  const tsq = pq ? tsQuery(pq) : null;
  const rank = tsq ? sql<number>`ts_rank_cd(${entries.searchDraft}, ${tsq})` : sql<number>`0`;
  const rows = await db
    .select({ id: entries.id, rank })
    .from(entries)
    .where(
      and(
        eq(entries.collection, collection),
        // Authors only find their own posts (never other people's drafts).
        collection === "posts" && !can(u.role, "posts.manage") ? ownPostsSql(u.id) : undefined,
        tsq ? or(sql`${entries.searchDraft} @@ ${tsq}`, allLike(hay, q)) : allLike(hay, q),
      ),
    )
    .orderBy(desc(rank), desc(entries.updatedAt))
    .limit(500);
  return rows.map((r) => r.id);
}

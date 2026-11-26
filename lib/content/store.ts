import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { entries, globals, media, versions } from "@/db/schema";
import {
  COLLECTIONS,
  type CollectionData,
  type CollectionKey,
  GLOBALS,
  type GlobalData,
  type GlobalKey,
} from "./schema";

/**
 * Content storage on Postgres (Drizzle). `data` = published, `draft` = unpublished edits.
 * Pure data functions: no auth and no cache handling here (callers do that).
 */

const MAX_VERSIONS = 40;
/** Autosaves kept per document (publishes and restores are kept up to MAX_VERSIONS). */
const MAX_AUTOSAVES = 10;
/** Autosaves by the same person within this window update one version instead of adding more. */
const SESSION_MS = 30 * 60_000;

/** JSON with sorted keys: Postgres jsonb reorders keys, so plain stringify can't compare. */
export function stableJson(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b)))
      : x,
  );
}
const same = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

export async function readGlobal<K extends GlobalKey>(
  key: K,
  opts: { draft?: boolean } = {},
): Promise<GlobalData<K>> {
  const [row] = await db.select().from(globals).where(eq(globals.key, key)).limit(1);
  const raw = (opts.draft ? (row?.draft ?? row?.data) : row?.data) ?? {};
  const parsed = GLOBALS[key].safeParse(raw);
  if (parsed.success) return parsed.data as GlobalData<K>;
  // Never break the site on bad stored data: fall back to the published copy, then to defaults.
  const fallback = GLOBALS[key].safeParse(row?.data ?? {});
  if (fallback.success) return fallback.data as GlobalData<K>;
  throw new Error(`Global "${key}" is missing or invalid. Run \`bun run seed\`.`);
}

export async function readGlobalRow(key: GlobalKey) {
  const [row] = await db.select().from(globals).where(eq(globals.key, key)).limit(1);
  return row ?? null;
}

type DocMeta = { id: number; createdAt: string; updatedAt: string };

function toDoc<K extends CollectionKey>(
  collection: K,
  row: typeof entries.$inferSelect,
  draft: boolean,
): (CollectionData<K> & DocMeta) | null {
  const raw = draft ? (row.draft ?? row.data) : row.data;
  if (!raw) return null;
  const parsed = COLLECTIONS[collection].safeParse(raw);
  if (!parsed.success) return null;
  return {
    ...(parsed.data as CollectionData<K>),
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function readEntries<K extends CollectionKey>(
  collection: K,
  opts: { draft?: boolean } = {},
) {
  const rows = await db
    .select()
    .from(entries)
    .where(
      opts.draft
        ? eq(entries.collection, collection)
        : and(eq(entries.collection, collection), isNotNull(entries.data)),
    )
    .orderBy(asc(entries.sort), desc(entries.createdAt));
  return rows
    .map((r) => toDoc(collection, r, Boolean(opts.draft)))
    .filter((d): d is CollectionData<K> & DocMeta => d !== null);
}

export async function readEntryBySlug<K extends CollectionKey>(
  collection: K,
  slug: string,
  opts: { draft?: boolean } = {},
) {
  const [row] = await db
    .select()
    .from(entries)
    .where(and(eq(entries.collection, collection), eq(entries.slug, slug)))
    .limit(1);
  return row ? toDoc(collection, row, Boolean(opts.draft)) : null;
}

export async function readEntryRow(id: number) {
  const [row] = await db.select().from(entries).where(eq(entries.id, id)).limit(1);
  return row ?? null;
}

export async function listEntryRows(collection: CollectionKey) {
  return db
    .select()
    .from(entries)
    .where(eq(entries.collection, collection))
    .orderBy(asc(entries.sort), desc(entries.updatedAt));
}

/* ───────── Writes ───────── */

async function addVersion(ref: string, label: string, data: unknown, userId?: string | null) {
  if (label === "Autosave") {
    const [latest] = await db
      .select()
      .from(versions)
      .where(eq(versions.ref, ref))
      .orderBy(desc(versions.createdAt))
      .limit(1);
    // Nothing new since the last version: keep history as it is.
    if (latest && same(latest.data, data)) return;
    // Still the same editing session: move that autosave forward instead of adding another.
    if (
      latest?.label === "Autosave" &&
      (latest.userId ?? null) === (userId ?? null) &&
      Date.now() - latest.createdAt.getTime() < SESSION_MS
    ) {
      await db
        .update(versions)
        .set({ data, createdAt: new Date() })
        .where(eq(versions.id, latest.id));
      return;
    }
  }
  await db.insert(versions).values({ ref, label, data, userId: userId ?? null });
  // Keep the newest MAX_AUTOSAVES autosaves and MAX_VERSIONS versions overall per document.
  await db.execute(
    sql`delete from versions where ref = ${ref} and label = 'Autosave' and id not in (select id from versions where ref = ${ref} and label = 'Autosave' order by created_at desc limit ${MAX_AUTOSAVES})`,
  );
  await db.execute(
    sql`delete from versions where ref = ${ref} and id not in (select id from versions where ref = ${ref} order by created_at desc limit ${MAX_VERSIONS})`,
  );
}

/** Delete autosave versions (one document, or all). Drafts themselves are untouched. */
export async function clearAutosaves(ref?: string) {
  const r = await db
    .delete(versions)
    .where(
      ref
        ? and(eq(versions.ref, ref), eq(versions.label, "Autosave"))
        : eq(versions.label, "Autosave"),
    )
    .returning({ id: versions.id });
  return r.length;
}

/** Version history size, for Settings → Analytics & privacy. */
export async function versionStats() {
  const [r] = (await db.execute(sql`
    select
      count(*) filter (where label = 'Autosave')::int as autosaves,
      count(*)::int as total,
      coalesce(sum(pg_column_size(data)), 0)::bigint as bytes,
      count(distinct ref)::int as docs
    from versions`)) as unknown as {
    autosaves: number;
    total: number;
    bytes: string;
    docs: number;
  }[];
  return {
    autosaves: r?.autosaves ?? 0,
    total: r?.total ?? 0,
    bytes: Number(r?.bytes ?? 0),
    docs: r?.docs ?? 0,
  };
}

export async function saveGlobalDraft<K extends GlobalKey>(
  key: K,
  input: unknown,
  userId?: string | null,
  label: "Autosave" | "Restored" = "Autosave",
) {
  const data = GLOBALS[key].parse(input);
  const existing = await readGlobalRow(key);
  if (!existing) {
    await db.insert(globals).values({ key, data, draft: data, updatedBy: userId ?? null });
  } else if (existing.data && same(existing.data, data)) {
    // Edited back to exactly what's live: there's nothing to publish, so drop the draft.
    if (existing.draft) await db.update(globals).set({ draft: null }).where(eq(globals.key, key));
    return { data, draft: false };
  } else {
    await db
      .update(globals)
      .set({ draft: data, updatedAt: new Date(), updatedBy: userId ?? null })
      .where(eq(globals.key, key));
  }
  await addVersion(`global:${key}`, label, data, userId);
  return { data, draft: true };
}

export async function publishGlobal(key: GlobalKey, userId?: string | null) {
  const row = await readGlobalRow(key);
  if (!row) throw new Error(`Global "${key}" not found`);
  // Nothing unpublished: don't rewrite the live copy or add a "Published" version.
  if (!row.draft && row.data) return GLOBALS[key].parse(row.data);
  const data = GLOBALS[key].parse(row.draft ?? row.data);
  await db
    .update(globals)
    .set({
      data,
      draft: null,
      publishedAt: new Date(),
      updatedAt: new Date(),
      updatedBy: userId ?? null,
    })
    .where(eq(globals.key, key));
  await addVersion(`global:${key}`, "Published", data, userId);
  return data;
}

/** Writes straight to the published copy (seed, small toggles). */
export async function setGlobal<K extends GlobalKey>(
  key: K,
  input: unknown,
  userId?: string | null,
) {
  const data = GLOBALS[key].parse(input);
  await db
    .insert(globals)
    .values({ key, data, draft: null, publishedAt: new Date(), updatedBy: userId ?? null })
    .onConflictDoUpdate({
      target: globals.key,
      set: { data, draft: null, publishedAt: new Date(), updatedAt: new Date() },
    });
  return data;
}

export async function discardGlobalDraft(key: GlobalKey) {
  await db.update(globals).set({ draft: null }).where(eq(globals.key, key));
}

export async function createEntry<K extends CollectionKey>(
  collection: K,
  input: unknown,
  opts: { publish?: boolean; userId?: string | null; sort?: number } = {},
) {
  const data = COLLECTIONS[collection].parse(input) as CollectionData<K> & {
    slug?: string;
    company?: string;
    title?: string;
  };
  const slug = data.slug ?? slugify(data.company ?? data.title ?? `item-${Date.now()}`);
  const [row] = await db
    .insert(entries)
    .values({
      collection,
      slug,
      sort: opts.sort ?? 0,
      data: opts.publish ? data : null,
      draft: opts.publish ? null : data,
      publishedAt: opts.publish ? new Date() : null,
      updatedBy: opts.userId ?? null,
    })
    .returning();
  await addVersion(`entry:${row.id}`, opts.publish ? "Published" : "Created", data, opts.userId);
  return row;
}

export async function saveEntryDraft(
  id: number,
  input: unknown,
  userId?: string | null,
  label: "Autosave" | "Restored" = "Autosave",
) {
  const row = await readEntryRow(id);
  if (!row) throw new Error("Not found");
  const data = COLLECTIONS[row.collection as CollectionKey].parse(input) as {
    slug?: string;
    company?: string;
  };
  const slug =
    data.slug ?? (row.collection === "experience" ? slugify(data.company ?? row.slug) : row.slug);
  if (row.data && same(row.data, data)) {
    // Back to exactly what's live: no draft to publish.
    if (row.draft) await db.update(entries).set({ draft: null }).where(eq(entries.id, id));
    return { ...row, draft: null, slug, hasDraft: false };
  }
  await db
    .update(entries)
    .set({ draft: data, slug, updatedAt: new Date(), updatedBy: userId ?? null })
    .where(eq(entries.id, id));
  await addVersion(`entry:${id}`, label, data, userId);
  return { ...row, draft: data, slug, hasDraft: true };
}

export async function publishEntry(id: number, userId?: string | null) {
  const row = await readEntryRow(id);
  if (!row) throw new Error("Not found");
  if (!row.draft && row.data) return { ...row, data: row.data };
  const data = COLLECTIONS[row.collection as CollectionKey].parse(row.draft ?? row.data);
  await db
    .update(entries)
    .set({
      data,
      draft: null,
      publishedAt: row.publishedAt ?? new Date(),
      updatedAt: new Date(),
      updatedBy: userId ?? null,
    })
    .where(eq(entries.id, id));
  await addVersion(`entry:${id}`, "Published", data, userId);
  return { ...row, data };
}

export async function unpublishEntry(id: number) {
  const row = await readEntryRow(id);
  if (!row) return null;
  await db
    .update(entries)
    .set({ draft: row.draft ?? row.data, data: null })
    .where(eq(entries.id, id));
  return row;
}

export async function discardEntryDraft(id: number) {
  await db
    .update(entries)
    .set({ draft: null })
    .where(and(eq(entries.id, id), isNotNull(entries.data)));
}

export async function deleteEntry(id: number) {
  const row = await readEntryRow(id);
  await db.delete(entries).where(eq(entries.id, id));
  await db.delete(versions).where(eq(versions.ref, `entry:${id}`));
  return row;
}

/** Re-sorts entries of one collection; ids from any other collection are ignored. */
export async function reorderEntries(collection: CollectionKey, ids: number[]) {
  await db.transaction(async (tx) => {
    for (const [i, id] of ids.entries())
      await tx
        .update(entries)
        .set({ sort: i + 1 })
        .where(and(eq(entries.id, id), eq(entries.collection, collection)));
  });
}

export async function listVersions(ref: string, limit = 12) {
  return db
    .select({
      id: versions.id,
      label: versions.label,
      createdAt: versions.createdAt,
      userId: versions.userId,
    })
    .from(versions)
    .where(eq(versions.ref, ref))
    .orderBy(desc(versions.createdAt))
    .limit(limit);
}

export async function readVersion(id: number) {
  const [row] = await db.select().from(versions).where(eq(versions.id, id)).limit(1);
  return row ?? null;
}

/* ───────── Media ───────── */

export async function getMediaByIds(ids: (number | null | undefined)[]) {
  const clean = [...new Set(ids.filter((n): n is number => typeof n === "number"))];
  if (!clean.length) return new Map<number, typeof media.$inferSelect>();
  const rows = await db
    .select()
    .from(media)
    .where(and(inArray(media.id, clean), isNull(media.deletedAt)));
  return new Map(rows.map((r) => [r.id, r]));
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

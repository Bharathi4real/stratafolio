import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ───────── Auth (Better Auth) ───────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("author"), // "admin" | "editor" | "author" (lib/rbac.ts)
  /** Shown under the author's name on posts, e.g. "Frontend engineer · Chennai". */
  byline: text("byline"),
  /** Author card at the end of their posts. */
  bio: text("bio"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/**
 * Shared rate-limit counters. Better Auth stores its sign-in limits here (rateLimit.storage =
 * "database"), and lib/rate-limit.ts uses it for the contact form and stats beacon, so limits
 * hold across serverless instances. Old rows are pruned by the nightly cron.
 */
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ───────── Content ───────── */

/**
 * One row per global (site settings, navigation, home page, …).
 * `data` is what visitors see; `draft` holds unpublished edits (null when there are none).
 */
export const globals = pgTable("globals", {
  key: text("key").primaryKey(),
  data: jsonb("data").notNull(),
  draft: jsonb("draft"),
  publishedAt: timestamp("published_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

/**
 * Weighted full-text document for an entry body (`doc` is a SQL expression for the jsonb):
 * A = title / company, B = summaries and roles, C = category, tags, slug, D = rich-text body.
 * Every function here is IMMUTABLE so it can back a stored generated column.
 */
const ftsDoc = (doc: string) => `
  setweight(to_tsvector('english', coalesce(${doc}->>'title', '') || ' ' || coalesce(${doc}->>'company', '')), 'A') ||
  setweight(to_tsvector('english', coalesce(${doc}->>'excerpt', '') || ' ' || coalesce(${doc}->>'summary', '') || ' ' || coalesce(${doc}->>'role', '') || ' ' || coalesce(${doc}->>'client', '') || ' ' || coalesce(${doc}->>'listLabel', '')), 'B') ||
  setweight(to_tsvector('english', coalesce(${doc}->>'category', '') || ' ' || coalesce(${doc}->>'kind', '') || ' ' || coalesce(${doc}->>'type', '') || ' ' || coalesce(${doc}->>'location', '') || ' ' || coalesce((${doc}->'tags')::text, '') || ' ' || replace(slug, '-', ' ')), 'C') ||
  setweight(to_tsvector('english', coalesce(jsonb_path_query_array(${doc}, 'lax $.**.text')::text, '') || ' ' || coalesce(jsonb_path_query_array(${doc}, 'lax $.**.attrs')::text, '')), 'D')`;

/**
 * Collection documents (posts, projects, experience). `data` is null until first published.
 * `search_draft` (what the admin sees) and `search_live` (published) are generated full-text
 * vectors with GIN indexes, used by admin list search and the public blog search.
 */
export const entries = pgTable(
  "entries",
  {
    id: serial("id").primaryKey(),
    collection: text("collection").notNull(), // "posts" | "projects" | "experience"
    slug: text("slug").notNull(),
    sort: integer("sort").notNull().default(0),
    data: jsonb("data"),
    draft: jsonb("draft"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: text("updated_by"),
    searchDraft: tsvector("search_draft").generatedAlwaysAs(
      sql.raw(ftsDoc("coalesce(draft, data)")),
    ),
    searchLive: tsvector("search_live").generatedAlwaysAs(sql.raw(ftsDoc("data"))),
  },
  (t) => [
    uniqueIndex("entries_collection_slug").on(t.collection, t.slug),
    index("entries_collection").on(t.collection),
    index("entries_search_draft").using("gin", t.searchDraft),
    index("entries_search_live").using("gin", t.searchLive),
  ],
);

/** Version history for globals and entries (autosaves, publishes, restores). */
export const versions = pgTable(
  "versions",
  {
    id: serial("id").primaryKey(),
    ref: text("ref").notNull(), // "global:home" | "entry:12"
    label: text("label").notNull(), // "Autosave" | "Published" | "Restored" | "Created"
    data: jsonb("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    userId: text("user_id"),
  },
  (t) => [index("versions_ref").on(t.ref, t.createdAt)],
);

export const media = pgTable("media", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // storage key (R2 object key or local path)
  url: text("url").notNull(),
  filename: text("filename").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt").notNull().default(""),
  /** Tiny blurred preview (data: URL, ~1 KB) shown while the image loads. Images only. */
  blur: text("blur"),
  caption: text("caption").notNull().default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  /** Set when moved to the bin; the file is removed from storage when the bin is emptied. */
  deletedAt: timestamp("deleted_at"),
});

export const messages = pgTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    topic: text("topic").notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    message: text("message").notNull(),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("messages_created").on(t.createdAt),
    index("messages_unread").on(t.read).where(sql`${t.read} = false`),
  ],
);

/**
 * First-party, cookieless site stats. One row per event; no IPs or user agents are stored.
 * `visitor` is a hash of (daily random salt + IP + user agent), so it can't be linked across
 * days or back to a person once the salt is deleted (the cron job removes salts after a day).
 */
export const statEvents = pgTable(
  "stat_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    /** view = page loaded · read = blog post read (60% + 30s) · leave = left a post (depth/time) */
    type: text("type").notNull(),
    path: text("path").notNull(),
    /** Blog post slug when the path is /blog/[slug]. */
    slug: text("slug"),
    visitor: text("visitor").notNull(),
    referrer: text("referrer"),
    country: text("country"),
    device: text("device"),
    /** leave/read: max scroll depth through the article (0–100). */
    depth: integer("depth"),
    /** leave/read: active seconds on the page. */
    seconds: integer("seconds"),
  },
  (t) => [
    index("stat_events_at").on(t.at),
    index("stat_events_slug_at").on(t.slug, t.at),
    index("stat_events_type_at").on(t.type, t.at),
  ],
);

/** Daily random salts for the visitor hash; rows older than a day are deleted by the cron job. */
export const statSalts = pgTable("stat_salts", {
  day: text("day").primaryKey(),
  salt: text("salt").notNull(),
});

export type MediaRow = typeof media.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type EntryRow = typeof entries.$inferSelect;

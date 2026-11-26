/**
 * Applies the keyword-targeted SEO copy (see the "Stratafolio SEO keywords & copy" doc) to the
 * database as DRAFTS, using the same functions the admin uses. Nothing changes on the live site
 * until you review and press "Publish all" in the admin, which also refreshes the cache and keeps
 * version history (any draft can be discarded there).
 *
 * Run:  bun run seo:apply            (writes drafts)
 *       bun run seo:apply --dry      (only prints what would change)
 *
 * Only SEO fields are touched; any unpublished edits you already have are kept and built upon.
 */
import { GLOBAL_DEFAULTS } from "../lib/content/defaults";
import type { CollectionKey } from "../lib/content/schema";
import {
  listEntryRows,
  readGlobalRow,
  saveEntryDraft,
  saveGlobalDraft,
} from "../lib/content/store";

const dry = process.argv.includes("--dry");

/** `match`: other names the item may go by (its title), when its slug was changed in the admin. */
type Meta = { title: string; description: string; match?: string[] };

const PROJECT_META: Record<string, Meta> = {
  "oap-security-hardening": {
    match: ["OAP Multi-Brand Security Hardening", "security-hardening", "security hardening"],
    title: "Securing a Multi-Brand NestJS Backend on AWS · Case Study",
    description:
      "How I hardened a NestJS and AWS Lambda backend serving many university brands: brand-validation middleware on 16+ routes, 38 tests, locked-down S3 APIs.",
  },
  "oap-pdf-generation": {
    match: ["OAP PDF Generation Lambda", "pdf-generation", "pdf generation"],
    title: "Multi-Language PDF Generation on AWS Lambda · Case Study",
    description:
      "Adding French to a Node.js AWS Lambda that generates application PDFs, with a translation-map engine, DynamoDB localization data and locale-aware dates.",
  },
  "flinkk-projects": {
    match: ["Flinkk Projects", "flinkk"],
    title: "AI-Assisted Kanban App in Next.js · Case Study",
    description:
      "AI issue summaries with the Vercel AI SDK and OpenAI, a freeze-free drag-and-drop Kanban board and native S3 uploads in a multi-tenant Next.js app.",
  },
};

const POST_META: Record<string, Meta> = {
  "nextjs-security-mistakes": {
    match: ["12 security mistakes hiding in your Next.js app"],
    title: "12 Next.js Security Mistakes (and How to Fix Each One)",
    description:
      "12 real security holes from auditing a Next.js App Router app: uploads, rate limits, open redirects, XSS links, clickjacking and more, with code fixes.",
  },
  "how-this-site-is-built": {
    match: ["How this site is built"],
    title: "How This Site Is Built: Next.js 16, Cache Components & Postgres",
    description:
      "How I built a fast, free portfolio on Next.js 16 Cache Components with a custom Postgres admin, a three.js shader and plain CSS, and what I’d change.",
  },
};

const seoCopy = GLOBAL_DEFAULTS.seo({}) as {
  siteTitle: string;
  description: string;
  keywords: string[];
  llmsSummary: string;
};
const blogCopy = GLOBAL_DEFAULTS["blog-page"]({}) as { intro: string };

let changed = 0;
const show = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v ?? "—"));

/** Prints field changes; returns true when anything differs. */
function report(label: string, before: Record<string, unknown>, after: Record<string, unknown>) {
  const diffs = Object.keys(after).filter(
    (k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null),
  );
  if (!diffs.length) {
    console.log(`= ${label}: already up to date`);
    return false;
  }
  console.log(`~ ${label}`);
  for (const k of diffs) {
    console.log(`    ${k}:\n      - ${show(before[k])}\n      + ${show(after[k])}`);
  }
  changed++;
  return true;
}

async function global(
  key: "seo" | "blog-page",
  patch: Record<string, unknown>,
  label: string,
): Promise<void> {
  const row = await readGlobalRow(key);
  const current = (row?.draft ?? row?.data ?? {}) as Record<string, unknown>;
  if (!row) {
    console.log(`! ${label}: not found (run the seed first)`);
    return;
  }
  if (report(label, current, patch) && !dry) await saveGlobalDraft(key, { ...current, ...patch });
}

async function entries(collection: CollectionKey, metas: Record<string, Meta>, label: string) {
  const rows = await listEntryRows(collection);
  const titleOf = (r: (typeof rows)[number]) =>
    String(((r.draft ?? r.data) as { title?: string } | null)?.title ?? "");
  const norm = (x: string) =>
    x
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const used = new Set<number>();
  for (const [slug, { match = [], ...meta }] of Object.entries(metas)) {
    // Exact slug first, then the title or a slug containing one of the known names.
    const names = match.map(norm);
    const row =
      rows.find((r) => r.slug === slug) ??
      rows.find((r) => names.includes(norm(titleOf(r)))) ??
      rows.find((r) => names.some((n) => norm(r.slug).includes(n) || norm(titleOf(r)).includes(n)));
    if (!row || used.has(row.id)) {
      console.log(`! ${label} "${slug}": not found, skipped`);
      continue;
    }
    used.add(row.id);
    if (row.slug !== slug) console.log(`  (matched "${slug}" to "${row.slug}" by name)`);
    const current = (row.draft ?? row.data ?? {}) as Record<string, unknown> & {
      meta?: Record<string, unknown>;
    };
    const before = current.meta ?? {};
    const after = { ...before, ...meta, noindex: before.noindex ?? false };
    if (report(`${label} "${slug}" → SEO`, before, after) && !dry) {
      await saveEntryDraft(row.id, { ...current, meta: after });
    }
  }
  // Anything this script has no copy for: listed so you can fill its SEO fields in the admin.
  const rest = rows.filter((r) => !used.has(r.id));
  if (rest.length) {
    console.log(`  Other ${label.toLowerCase()}s in the database (no copy for these yet):`);
    for (const r of rest) console.log(`    - ${r.slug}  "${titleOf(r)}"`);
  }
}

async function main() {
  console.log(dry ? "Dry run: nothing will be written.\n" : "Saving drafts…\n");
  await global(
    "seo",
    {
      siteTitle: seoCopy.siteTitle,
      description: seoCopy.description,
      keywords: seoCopy.keywords,
      llmsSummary: seoCopy.llmsSummary,
    },
    "Settings → SEO",
  );
  await global("blog-page", { intro: blogCopy.intro }, "Settings → Blog");
  await entries("projects", PROJECT_META, "Project");
  await entries("posts", POST_META, "Post");
  console.log(
    `\n${changed} item(s) ${dry ? "would change" : "saved as drafts"}.` +
      (changed && !dry ? " Open the admin and press “Publish all” to make them live." : ""),
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

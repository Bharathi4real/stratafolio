/**
 * Seeds the database with sample content (a fictional "Alex Morgan" portfolio) to edit in the
 * admin. Safe to re-run: globals are overwritten (published), documents are upserted by slug.
 *
 *   bun run db:migrate && bun run seed
 *
 * Admin user: SEED_ADMIN_EMAIL (required), SEED_ADMIN_PASSWORD (a random one is printed if unset),
 * SEED_ADMIN_NAME. Résumé: optional PDF at seed/assets/resume.pdf.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { account, entries, media, user } from "../db/schema";
import { GLOBAL_DEFAULTS } from "../lib/content/defaults";
import { readingMinutes } from "../lib/content/rich";
import { COLLECTIONS, type CollectionKey, type RichDoc } from "../lib/content/schema";
import { setGlobal, slugify } from "../lib/content/store";
import { makeKey, publicUrl, writeObject } from "../lib/storage";
import { howItsBuilt, howItsBuiltMeta } from "./posts/how-its-built";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const log = (m: string) => console.log(`seed: ${m}`);

async function upsert(collection: CollectionKey, slug: string, input: unknown, sort = 0) {
  const data = COLLECTIONS[collection].parse(input);
  const [found] = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.collection, collection), eq(entries.slug, slug)))
    .limit(1);
  if (found) {
    await db
      .update(entries)
      .set({ data, draft: null, sort, updatedAt: new Date() })
      .where(eq(entries.id, found.id));
    return found.id;
  }
  const [row] = await db
    .insert(entries)
    .values({ collection, slug, sort, data, publishedAt: new Date() })
    .returning({ id: entries.id });
  return row.id;
}

async function seed() {
  // ── Admin user ──
  const email = process.env.SEED_ADMIN_EMAIL;
  if (!email) throw new Error("Set SEED_ADMIN_EMAIL (the admin account's email) in .env first.");
  const [existing] = await db.select().from(user).where(eq(user.email, email)).limit(1);
  if (!existing) {
    const password = process.env.SEED_ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    const id = randomUUID();
    const name = process.env.SEED_ADMIN_NAME || "Admin";
    await db.insert(user).values({ id, name, email, emailVerified: true, role: "admin" });
    await db.insert(account).values({
      id: randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: await hashPassword(password),
    });
    log(
      `created admin ${email}${process.env.SEED_ADMIN_PASSWORD ? "" : ` with password: ${password}`}`,
    );
  }

  // ── Résumé (optional): put your PDF at seed/assets/resume.pdf ──
  const resumeName = "resume.pdf";
  const resumePath = path.join(dirname, "assets", resumeName);
  let resumeId: number | null = null;
  if (existsSync(resumePath)) {
    let [resume] = await db.select().from(media).where(eq(media.filename, resumeName)).limit(1);
    if (!resume) {
      const body = readFileSync(resumePath);
      const key = makeKey(resumeName);
      await writeObject(key, body, "application/pdf");
      [resume] = await db
        .insert(media)
        .values({
          key,
          url: publicUrl(key),
          filename: resumeName,
          mime: "application/pdf",
          size: body.length,
          alt: "Résumé (PDF)",
        })
        .returning();
      log("uploaded résumé");
    }
    resumeId = resume.id;
  } else log("no seed/assets/resume.pdf: skipping the résumé (upload one later in Media)");

  // ── Settings ──
  await setGlobal("site-settings", GLOBAL_DEFAULTS["site-settings"]({ resumeId }));

  await setGlobal("navigation", GLOBAL_DEFAULTS.navigation({}));

  await setGlobal("seo", GLOBAL_DEFAULTS.seo({}));

  await setGlobal("privacy", GLOBAL_DEFAULTS.privacy({}));

  await setGlobal("blog-page", GLOBAL_DEFAULTS["blog-page"]({}));

  await setGlobal("toolkit", GLOBAL_DEFAULTS.toolkit({}));

  // ── Projects (sample content: replace in the admin) ──
  const projects = [
    {
      title: "Booking Platform Rebuild",
      slug: "booking-platform-rebuild",
      client: "Northwind Labs",
      kind: "Product · Performance",
      listLabel: "Product · Next.js",
      summary:
        "Moving a booking product used by thousands of small businesses from a legacy SPA to Next.js, without downtime.",
      stack: ["Next.js", "React", "Node.js", "PostgreSQL"],
      meta: {
        title: "Rebuilding a Booking Platform in Next.js · Case Study",
        description:
          "An incremental migration from a legacy SPA to Next.js: route-by-route rollout, a faster first load and a calmer on-call rotation.",
        noindex: false,
      },
      listTags: ["Next.js", "PostgreSQL", "Migration"],
      previewLabel: "Impact",
      metrics: [
        { value: "52%", label: "Faster first load", short: "Load time", inline: true },
        { value: "0", label: "Minutes of downtime", short: "Downtime", inline: true },
        { value: "3", label: "Months, route by route", short: "Timeline" },
      ],
      context:
        "The booking app was a single-page app that had grown for six years. First loads were slow on mobile, and every release touched everything.",
      sections: [
        {
          heading: "Route by route, not big bang",
          points: [
            "Put Next.js in front of the old app and moved one route at a time behind a feature flag.",
            "Kept both apps on the same session and API, so users never noticed the switch.",
          ],
        },
        {
          heading: "Faster where it matters",
          points: [
            "Server-rendered the booking flow and cut the JavaScript on the first page by half.",
            "Moved slow availability queries to indexed Postgres views.",
          ],
        },
      ],
    },
    {
      title: "Accessible Design System",
      slug: "accessible-design-system",
      client: "Northwind Labs",
      kind: "Design system · Accessibility",
      listLabel: "Accessibility · UI",
      summary:
        "A small React component library that made accessible patterns the default for five product teams.",
      stack: ["React", "TypeScript", "Storybook", "Playwright"],
      meta: {
        title: "Building an Accessible React Design System · Case Study",
        description:
          "Twenty components with keyboard support, focus management and screen-reader tests built in, adopted by five teams.",
        noindex: false,
      },
      listTags: ["React", "Accessibility", "Storybook"],
      previewLabel: "Impact",
      metrics: [
        { value: "20", label: "Components", short: "Components", inline: true },
        { value: "5", label: "Teams adopted it", short: "Teams", inline: true },
      ],
      context:
        "Each team built its own dialogs, menus and forms, and each had its own accessibility bugs.",
      sections: [
        {
          heading: "Accessible by default",
          points: [
            "Built keyboard support, focus management and ARIA wiring into every component.",
            "Added automated screen-reader and keyboard tests with Playwright.",
          ],
        },
      ],
    },
    {
      title: "Studio Client Sites",
      slug: "studio-client-sites",
      client: "Pine & Pixel Studio",
      kind: "Client work · Web",
      listLabel: "Client work",
      summary: "Fast, easy-to-edit marketing sites for retail, media and education clients.",
      stack: ["Next.js", "Headless CMS", "Vercel"],
      meta: {
        title: "Fast Marketing Sites for Studio Clients · Case Study",
        description:
          "A reusable Next.js starter that let a small studio ship client sites with strong Core Web Vitals in weeks.",
        noindex: false,
      },
      listTags: ["Next.js", "CMS", "SEO"],
      previewLabel: "Highlights",
      metrics: [
        { value: "15+", label: "Sites shipped", short: "Sites", inline: true },
        { value: "95+", label: "Lighthouse performance", short: "Lighthouse" },
      ],
      context:
        "A small studio needed to ship client sites quickly without each one becoming a maintenance burden.",
      sections: [
        {
          heading: "One starter, many sites",
          points: [
            "Built a shared Next.js starter with content modelling, image handling and SEO defaults.",
          ],
        },
      ],
    },
  ];
  const projectIds: number[] = [];
  for (const pr of projects) {
    const id = await upsert("projects", pr.slug, pr, projects.indexOf(pr) + 1);
    projectIds.push(id);
  }
  log(`projects: ${projectIds.length}`);

  // ── Experience (sample content: replace in the admin) ──
  const roles = [
    {
      type: "role",
      company: "Northwind Labs",
      logo: "NL",
      location: "Lisbon, Portugal",
      title: "Senior Full-stack Engineer",
      start: "2023-02-01",
      kpis: [
        { value: "52", suffix: "%", label: "Faster first load" },
        { value: "5", label: "Teams on the design system" },
      ],
      bullets: [
        "Lead the **web platform** for a booking product: Next.js front end, Node.js API and Postgres schema.",
        "Migrated the legacy single-page app to **Next.js** route by route, with zero downtime.",
        "Built an **accessible design system** now used by five product teams.",
      ],
      tags: ["Next.js", "React", "Node.js", "PostgreSQL", "Playwright"],
    },
    {
      type: "role",
      company: "Pine & Pixel Studio",
      logo: "PP",
      location: "Porto, Portugal",
      title: "Web Developer",
      start: "2021-01-01",
      end: "2023-01-01",
      kpis: [{ value: "15", suffix: "+", label: "Client sites shipped" }],
      bullets: [
        "Shipped **15+ client sites** across retail, media and education.",
        "Built the studio's shared **Next.js starter**, cutting setup for each new site to a day.",
      ],
      tags: ["Next.js", "React", "Headless CMS", "Vercel"],
    },
    {
      type: "education",
      company: "University of Example",
      location: "Lisbon, Portugal",
      title: "B.Sc., Computer Science",
      start: "2017-09-01",
      end: "2020-07-01",
    },
  ];
  for (const r of roles) {
    await upsert("experience", slugify(r.company), r);
  }
  log(`experience: ${roles.length}`);

  // ── Posts ──
  const posts = [
    {
      ...howItsBuiltMeta,
      stage: "published",
      publishedAt: "2026-10-05T09:00:00.000Z",
      content: howItsBuilt,
    },
    {
      title: "Migrating to Next.js one route at a time",
      slug: "nextjs-route-by-route",
      stage: "writing",
      category: "Engineering",
      tags: ["Next.js"],
      excerpt: "How to move a legacy single-page app to Next.js without a big-bang rewrite.",
    },
    {
      title: "Accessible dialogs, menus and forms by default",
      slug: "accessible-by-default",
      stage: "draft",
      category: "Frontend",
      tags: ["Accessibility"],
      excerpt: "Building accessibility into a component library so teams get it for free.",
    },
  ];
  for (const post of posts) {
    const extra = post as { readOverride?: number; content?: RichDoc };
    await upsert("posts", post.slug, {
      ...post,
      readMinutes: extra.readOverride ?? (extra.content ? readingMinutes(extra.content) : 1),
    });
  }
  log(`posts: ${posts.length}`);

  // ── Home page ──
  await setGlobal("home-page", GLOBAL_DEFAULTS["home-page"]({ projectIds }));
  log("home page");
  log("done ✓");
  process.exit(0);
}

await seed();

import { callout, codeFigure, doc, h2, p, quote, ul } from "../../lib/content/rich";

/** "How this site is built": the first post, used by the seed. */
export const howItsBuiltMeta = {
  title: "How this site is built",
  slug: "how-this-site-is-built",
  category: "Engineering" as const,
  excerpt:
    "Next.js 16 with Cache Components, a custom admin with drafts, versions, scheduling and database-wide search, one three.js shader, plain CSS, and a Biome-only toolchain, all on free tiers. What worked, and what I’d change.",
  tags: ["Next.js", "Cache Components", "Postgres", "three.js", "GSAP", "Biome"],
  meta: {
    title: "How This Site Is Built: Next.js 16, Cache Components & Postgres",
    description:
      "How I built a fast, free portfolio on Next.js 16 Cache Components with a custom Postgres admin, a three.js shader and plain CSS, and what I’d change.",
    noindex: false,
  },
  coverLines: [
    { kind: "cmd" as const, text: "next build" },
    { kind: "ok" as const, text: "◐ /blog  partial prerender" },
    { kind: "ok" as const, text: "biome check: 0 issues" },
  ],
};

export const howItsBuilt = doc([
  p(
    "I wanted a portfolio that felt like it was made by an engineer who cares about craft, not one picked from a template gallery. It had to stay fast, cost nothing to run, and let me change any word without a redeploy. This is how it’s built, and the trade-offs I made along the way.",
  ),
  h2("The stack"),
  p(
    "The site runs on **Next.js 16** (App Router) with **React 19** and **TypeScript 7**, installed and run with **Bun**. Content lives in **Postgres** on Neon, read through **Drizzle**. Media goes to **Cloudflare R2**, contact mail goes out through **Resend**, and sign-in is **Better Auth**. Everything sits on free tiers.",
  ),
  p(
    "Styling is plain CSS: a small base reset plus hand-written stylesheets built on design tokens. I started with Tailwind, noticed I hadn’t used a single utility class, and removed it. One less build step, and the CSS reads like the design it describes.",
  ),
  p(
    "For linting and formatting I use **Biome** on its own. One tool, one config file, and it runs fast enough that I never think about it.",
  ),
  codeFigure({
    filename: "biome.json",
    language: "json",
    lineNumbers: true,
    code: '{\n  "linter": { "rules": { "recommended": true } },\n  "formatter": { "indentStyle": "space", "lineWidth": 100 }\n}',
  }),
  h2("Cached by default"),
  p(
    "Next.js 16’s **Cache Components** changed how I think about data. Every public read is a `'use cache'` function with the longest lifetime and a tag. Pages are prerendered into a static shell, and only the parts that really depend on the request, like the search filters on this blog, stream in behind a skeleton.",
  ),
  codeFigure({
    filename: "lib/queries.ts",
    language: "ts",
    lineNumbers: true,
    highlight: "2-4",
    code: 'export async function getProjects() {\n  "use cache";\n  cacheLife("max");\n  cacheTag("projects");\n  return readEntries("projects");\n}',
  }),
  p(
    'Publishing from the admin calls `updateTag("projects")`, so the next visitor gets fresh content straight away and nothing else is rebuilt. No redeploys, no time-based revalidation guessing.',
  ),
  callout(
    "Gotcha",
    "Anything that changes per request, like `Date.now()`, cookies or the session, has to live behind a Suspense boundary or after `connection()`. The dev overlay flags it as a “blocking route”, which is a useful nudge rather than a nuisance.",
  ),
  h2("A small CMS of my own"),
  p(
    "Every section, post, project and setting is edited in an admin built into the same app with **Tiptap** for rich text and the **TanStack** libraries (Form, Query, Table, Store, Pacer, Hotkeys) for the rest. A few things made it pleasant to use rather than just possible:",
  ),
  ul([
    "**Drafts and autosave.** Edits save as a draft about a second after you stop typing; visitors keep seeing the live version until you publish. The Publish button stays disabled until something actually changed.",
    "**Versions without the bloat.** Autosaves from one editing session merge into a single version, identical saves are skipped, and each document keeps a capped history, so the database doesn’t fill up with near-duplicates.",
    "**Live preview** through Draft Mode, which re-runs the cached reads with unpublished content for the editor only.",
    "**A media bin.** Deleting a file moves it to the bin first; a nightly job empties it and removes the object from R2.",
    "**No stray drafts.** Cancel on a post that was never published deletes it, so trying out “New post” doesn’t leave an “Untitled post” behind.",
    "**Editable everything,** blog categories included: they live in the blog settings, so adding a topic is a settings change, not a code change.",
    "**Controls that match the site.** The date picker, selects, toasts and dialogs are built in the same Ink & Ember style instead of the browser’s defaults, with full keyboard support. Times use a 12-hour clock you type into.",
  ]),
  h2("Finding things"),
  p(
    "Search had to work on the data, not on whatever happens to be on screen. It runs on **Postgres full-text search**: each entry has two generated, weighted `tsvector` columns (one for drafts, one for what’s live), indexed with GIN. Titles weigh most, then summaries, then tags, then the post body, words are stemmed so “caching” finds “cache”, every word is a prefix so results appear while you type, and matches come back ranked.",
  ),
  codeFigure({
    filename: "db/schema.ts",
    language: "ts",
    lineNumbers: true,
    highlight: "2-3",
    code: "searchDraft: tsvector(\"search_draft\").generatedAlwaysAs(\n  sql.raw(`setweight(to_tsvector('english', title), 'A') ||\n    setweight(to_tsvector('english', body), 'D')`),\n),\nindex(\"entries_search_draft\").using(\"gin\", t.searchDraft),",
  }),
  p(
    "The admin lists, the inbox and the public blog all use it, with a plain substring match as a fallback for code identifiers. Category, author and sort filters sit next to the search box.",
  ),
  p(
    "On the public blog, readers get the same idea in a lighter form: topics, a search box, tag chips, a Published / Coming soon switch and newest or oldest first. Every combination is a plain URL, so a filtered view can be shared, while search and sort views stay out of search engines. At the end of each article, related posts are picked by shared tags (rarer tags count a little more), then by category.",
  ),
  callout(
    "Bug I’m glad I caught",
    "A list copied its rows into local state once and never looked again, so after creating a post the sidebar said 5 while the table showed 4. Layouts also don’t re-render on client navigation, so the sidebar could drift the other way. Now the table follows the server’s rows and the sidebar counts refetch after every navigation and change.",
  ),
  h2("Scheduled posts"),
  p(
    "Publishing and scheduling are separate on purpose. **Publish** makes a post live now. **Schedule** opens a calendar, you pick a day and type a time, and the post stays off the site, the sitemap and llms.txt until that moment. A scheduled post can be moved, published early or unscheduled back to a draft.",
  ),
  p(
    "There’s no queue or worker behind it. The cached read works out when the next post is due and sets its own lifetime to match:",
  ),
  codeFigure({
    filename: "lib/queries.ts",
    language: "ts",
    lineNumbers: true,
    highlight: "5-6",
    code: 'export async function getPosts() {\n  "use cache";\n  cacheTag("posts");\n  const rows = await readEntries("posts");\n  const secs = secondsToNextRelease(rows);\n  cacheLife(secs ? { revalidate: Math.max(secs, 60), expire: YEAR } : "max");\n  return rows.filter((p) => !isScheduled(p));\n}',
  }),
  h2("One shader, used once"),
  p(
    "The molten background in the hero is a single **three.js** plane running a fragment shader: domain-warped noise, topographic contour lines, and a soft lens that follows the cursor. It’s the one place on the site that uses WebGL.",
  ),
  p(
    "Early on I reused it behind the contact panel and the footer. It looked great and cost too much, so every other “ember” surface is static SVG contour art with a CSS gradient. You can’t tell the difference at a glance, and the GPU can.",
  ),
  p(
    "The static art isn’t an imitation, either. The shader’s simplex noise and domain warp are ported line for line to TypeScript, and the server traces contour lines through that same field with marching squares while the page prerenders. Every card, cover, footer and Open Graph image is a different patch of the exact terrain the hero animates, frozen at the hero’s still frame, and it ships as plain SVG with no JavaScript.",
  ),
  codeFigure({
    filename: "ember.ts",
    language: "ts",
    lineNumbers: true,
    highlight: "9",
    code: "// Stop rendering the moment the hero leaves the screen\nconst io = new IntersectionObserver(([entry]) => {\n  visible = entry.isIntersecting;\n});\nio.observe(canvas);\n\nconst tick = () => {\n  raf = requestAnimationFrame(tick);\n  if (!visible || document.hidden) return;\n  renderer.render(scene, camera);\n};",
  }),
  p(
    "Two more guards keep it cheap: the pixel ratio is capped at 1.5, and visitors who prefer reduced motion get a single still frame instead of an animation loop.",
  ),
  h2("Motion with GSAP and Lenis"),
  p(
    "**GSAP** handles the name reveal, the line-by-line headings and the scroll-driven pieces like the experience timeline. **Lenis** smooths the scroll. The only trick is keeping them on the same clock, so ScrollTrigger never reads a stale position:",
  ),
  codeFigure({
    filename: "smooth-scroll.ts",
    language: "ts",
    lineNumbers: true,
    highlight: "2-3",
    code: 'const lenis = new Lenis({ lerp: 0.1 });\nlenis.on("scroll", ScrollTrigger.update);\ngsap.ticker.add((t) => lenis.raf(t * 1000));\ngsap.ticker.lagSmoothing(0);',
  }),
  h2("Hovers that don’t flicker"),
  p(
    "My first menu hover swapped the link to a lighter font weight. It flickered. A lighter weight is narrower, so the word shrank, the pointer fell off its edge, the hover ended, the word grew back, and the loop repeated.",
  ),
  callout(
    "Rule I follow now",
    "Never change font weight, size, letter-spacing or padding on hover, and never move the element you’re hovering. Animate colour, opacity, or a *child* of the element instead.",
  ),
  h2("Typography"),
  p(
    "Headings use **Bricolage Grotesque**, squeezed narrow and heavy. Body text is **Hanken Grotesk**, and the small labels are **Martian Mono**. All three are variable fonts, self-hosted through `next/font`, so there’s no layout shift while they load.",
  ),
  quote(
    "Pick one place to be loud. Here it’s the hero; everything else stays quiet so it can be read.",
  ),
  h2("Made for crawlers too"),
  p(
    "The sitemap, robots.txt and an **llms.txt** summary are generated from the same content as the pages. Every post gets its own Open Graph image, and there’s a switch in the admin to ask AI crawlers not to train on the site.",
  ),
  p("If you’re building something similar and want to compare notes, [get in touch](/#contact)."),
]);

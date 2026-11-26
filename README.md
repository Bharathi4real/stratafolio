# Stratafolio

**A portfolio with its own CMS: drafts, version history, scheduling and Markdown import, built on Next.js 16 Cache Components. Free to host.**

[![CI](https://github.com/Bharathi4real/stratafolio/actions/workflows/ci.yml/badge.svg)](https://github.com/Bharathi4real/stratafolio/actions/workflows/ci.yml)
[![MIT licence](https://img.shields.io/badge/licence-MIT-orange)](LICENSE)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![React 19](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)

One App Router app serves the public site at `/` and a custom admin at `/admin`. Every text, section, post, project and setting is edited in the admin, and publishing refreshes the live site on the next request, without a redeploy. It runs on free tiers: Vercel, Neon, Cloudflare R2 and Resend.

Built by [Kaviyabharathi Gopalakrishnan](https://github.com/Bharathi4real) as a personal portfolio, and open source under the [MIT licence](LICENSE): use it for yours.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FBharathi4real%2Fstratafolio&env=DATABASE_URL,AUTH_SECRET,NEXT_PUBLIC_SITE_URL,CRON_SECRET&envDescription=Postgres%20connection%20string%2C%20a%20random%20auth%20secret%2C%20your%20site%20URL%20and%20a%20random%20cron%20secret&envLink=https%3A%2F%2Fgithub.com%2FBharathi4real%2Fstratafolio%2Fblob%2Fmain%2F.env.example&project-name=stratafolio&repository-name=stratafolio)

**Live demo:** [kaviyabharathi.vercel.app](https://kaviyabharathi.vercel.app)

![The portfolio home page: name reveal over the ember shader](docs/screenshots/home.webp)

## Screenshots

| Case studies                                                                    | Blog                                                                                          |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| ![Case studies section with metrics and stack tags](docs/screenshots/work.webp) | ![Blog section with the latest post on a generated contour cover](docs/screenshots/blog.webp) |

| Admin dashboard                                                                                           | Post editor                                                                    |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| ![Admin dashboard with stats, recent activity and free-tier usage](docs/screenshots/admin-dashboard.webp) | ![Post editor with the publishing sidebar](docs/screenshots/admin-editor.webp) |

| Home page builder                                                                              | Blog settings                                                                        |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| ![Home page section builder with live draft preview](docs/screenshots/admin-home-builder.webp) | ![Blog settings: header, footer and feed](docs/screenshots/admin-blog-settings.webp) |

## Features

Everything below is edited in the admin and goes live on publish, with no redeploy. For how it works under the hood, see **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

### Portfolio

- **Home page builder:** hero, marquee, about, case studies, experience, toolkit, blog teaser and contact sections; drag to reorder, hide any section, edit every word, with a live desktop/mobile draft preview.
- **Hero:** letter-by-letter name reveal over a three.js ember shader (loaded after first paint, with a static fallback), "Open to work" status, location with a live local clock, and social links.
- **Case studies** at `/work/[slug]` with metrics, stack tags and sections; **experience** timeline with KPIs and live tenure; **toolkit** shown as a layered "strata" cross-section.
- **Contact form:** topic chips, slide-to-send button, validation shared by the browser and the server, honeypot, rate limits, saved to the inbox and emailed through Resend.
- **Header and footer:** dock navigation, full-screen menu, profile links, résumé download, light/dark theme switch, back to top.

### Blog

- **A standalone blog** at `/blog`, with its own header and footer: featured latest post, topic filter, search, tag filters, sort and pagination.
- **Reading experience:** table of contents with the active heading, a progress bar with "N min left", related posts by shared tags, copy-code buttons, share links, and view transitions from the list into a post.
- **Rich content:** syntax-highlighted code blocks (file name, highlighted, added and removed lines), callouts, pull quotes and images with captions and blurred placeholders.
- **Generated covers:** contour-art cover cards with terminal-style lines, plus share images for every post.
- **Scheduling:** set a future date and the post goes live on its own, with no queue or worker; Draft and Writing stages show as "Coming soon".
- **Optional RSS feed** at `/blog/feed.xml`.

### Writing and publishing

- **Rich-text editor** (Tiptap) with a slash menu for headings, code, callouts, images, quotes and lists.
- **Markdown import:** download a template from **Blog → Template ↓**, fill it in, and **Import .md** turns it into a draft (front matter, code fences, callouts; it lists anything it skipped).
- **Autosave** while you type; visitors keep seeing the published version until you publish.
- **Review panel:** every unpublished change across the site in one place, with field-by-field diffs; publish or discard one item or all of them.
- **Version history:** autosaves, publishes and restores per document, with diffs against the previous version or the live one; restore any version into the draft.
- **Draft preview** of the real site before publishing.
- **Command palette** (⌘K) to search and jump across all content.

### Media

- Direct browser uploads to Cloudflare R2 with an upload queue, signed upload tickets, and size and type checks against what was actually stored.
- Alt text and captions, blurred previews, usage checks before deleting, a bin with restore, and "Find stray files" for orphaned storage.

### Team and access

- **Roles:** admins edit everything, editors manage the blog and media, authors write their own posts for an editor to publish.
- **Invite-only sign-in:** email and password, magic links, and Google or GitHub once their keys are set.
- **Author profiles** with byline, bio and photo on each post.

### SEO and sharing

- Per-page titles and descriptions, a title template, canonical URLs, JSON-LD structured data (Person, WebSite, BlogPosting), sitemap and robots.txt.
- Open Graph images generated for every page, case study and post, plus article images in the 16:9, 4:3 and 1:1 ratios Google asks for.
- `llms.txt`, IndexNow pings to Bing and other engines on publish, search-engine verification tokens, and an opt-out for AI-training crawlers.

### Privacy and analytics

- **First-party, cookieless stats:** visitors, page views, blog reads, referrers, countries and devices, in the admin's **Stats** page.
- **Consent banner** for optional analytics (Vercel Analytics, Speed Insights, Google Analytics), honouring Global Privacy Control.
- Editable privacy policy, and automatic retention: a nightly job deletes old messages, stats and binned media.

### Look and feel

- Palettes and custom accent colours, logos, favicon and admin branding in **Settings → Appearance**; separate light/dark modes for the site and the admin.
- Contour art traced from the shader's own noise field, used on cards, covers, the footer and share images.
- GSAP reveals and Lenis smooth scrolling, all with a `prefers-reduced-motion` path; content is visible without JavaScript.

### Performance and security

- Public pages prerender into a static shell (Next.js **Cache Components**); publishing expires only the cache tags that changed.
- About 104 KB of compressed JavaScript on the home page; heavy libraries load only in the admin.
- Content Security Policy, security headers, an admin that other sites can't frame, database-backed rate limits, safe link schemes in rich text, and roles checked in every page and Server Action.
- Runs on free tiers: Vercel, Neon, Cloudflare R2 and Resend.

## Stack

|           |                                                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16.4 (App Router, Cache Components, Partial Prefetching), React 19.3, TypeScript 7                                |
| Data      | Postgres (Neon) via Drizzle ORM; JSON documents validated with Zod; generated `tsvector` columns + GIN indexes for search |
| Auth      | Better Auth: email + password, optional Google/GitHub and magic link, invite-only, admin/editor roles                     |
| Editor    | Tiptap rich text (code, callout, quote and image blocks, slash menu)                                                      |
| UI state  | TanStack Form, Query, Table, Store, Pacer, Hotkeys; TanStack Highlight for code blocks (server-side)                      |
| Media     | Cloudflare R2 (presigned uploads from the browser), local `public/uploads` in development                                 |
| Email     | Resend (contact form, magic links)                                                                                        |
| Motion    | GSAP (ScrollTrigger, SplitText), Lenis, one three.js shader, React `<ViewTransition>`                                     |
| Styling   | Plain CSS (`styles/`), no CSS framework                                                                                   |
| Tooling   | Bun, Biome (lint + format), drizzle-kit                                                                                   |
| Hosting   | Vercel Hobby · Neon · Cloudflare R2 · Resend (all free tiers)                                                             |

## Use it for your own site

1. Fork or clone the repo and follow **Run it locally** below.
2. The seed fills the site with sample content for a fictional engineer, Alex Morgan. Sign in at `/admin` and replace it: **Settings → General** (name, brand, email, socials), **Home page**, **Case studies**, **Experience** and **Blog**.
3. To seed your résumé, put the PDF at `seed/assets/resume.pdf` before running `bun run seed`, or upload it later in **Media**.
4. Write posts in the editor, or download the Markdown template from **Blog → Template ↓** and import the file with **Import .md**.
5. Pick a palette in **Settings → Appearance** and deploy (see **Deploy** below).

Credit is appreciated but not required beyond the licence: the `generator` meta tag ("Stratafolio by Bharathi4real") is a nice way to keep it.

## Run it locally

```bash
bun install
docker compose up -d          # optional: local Postgres (see docker-compose.yml)
cp .env.example .env          # set DATABASE_URL, AUTH_SECRET and SEED_ADMIN_EMAIL at minimum
bun run db:migrate            # creates the tables
bun run seed                  # sample content + admin user (prints the password if SEED_ADMIN_PASSWORD is unset)
bun run dev                   # http://localhost:3000 and http://localhost:3000/admin
```

With the bundled Docker Postgres, use `DATABASE_URL=postgres://stratafolio:stratafolio@127.0.0.1:5432/stratafolio`; any other Postgres works too. Without R2 credentials, uploads are stored in `public/uploads` (development only).

## Scripts

| Script                            | What it does                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `bun run dev` / `build` / `start` | Next.js                                                                         |
| `bun run check`                   | `biome check` + `tsc --noEmit`                                                  |
| `bun run format`                  | Biome fix + format                                                              |
| `bun run db:generate`             | New SQL migration in `drizzle/` after changing `db/schema.ts`                   |
| `bun run db:migrate`              | Applies migrations (production runs this in `vercel-build`)                     |
| `bun run db:studio`               | Drizzle Studio, a raw table browser                                             |
| `bun run seed`                    | Upserts the admin user and starter content (safe to re-run; overwrites globals) |
| `bun run syntax:css`              | Regenerates `styles/syntax.css` from the TanStack Highlight theme               |
| `bun run r2:check`                | Uploads, reads and deletes a test object to prove the R2 settings work          |

## Deploy (all free plans)

The quickest start is the **Deploy with Vercel** button at the top, which clones the repo and asks for the four required variables. Then set up the services below and seed the database (step 5).

1. **Neon**: create a project and copy the **pooled** connection string → `DATABASE_URL`.
2. **Cloudflare R2**: create a bucket and an API token (Object Read & Write), enable public access (r2.dev or a custom domain), and add a CORS rule allowing `PUT` and `GET` from your site → `R2_*` variables. (`GET` lets the media library make blurred previews for existing images.)
3. **Resend**: API key and a verified domain (SPF, DKIM, DMARC) → `RESEND_API_KEY`, `CONTACT_FROM_EMAIL`. This also turns on magic-link sign-in.
4. **Vercel**: import the repo and add every variable from `.env.example`. The `vercel-build` script runs `drizzle-kit migrate` before `next build`.
5. Seed Neon once: `DATABASE_URL=<neon> SEED_ADMIN_EMAIL=<you> SEED_ADMIN_PASSWORD=<strong> bun run seed`, then sign in at `/admin` and change the password.
6. Search Console: add the verification token in **Settings → SEO**, then submit `/sitemap.xml`.

A Vercel cron (`vercel.json` → `/api/cron/retention`) runs nightly. It deletes contact messages older than the retention period, prunes stats when a stats retention is set, and empties media that has sat in the bin longer than the bin period (all in **Settings → Analytics & privacy**).

## Run a public demo

Set `DEMO_MODE=1` to turn a deployment into a read-only demo anyone can explore:

- The sign-in screen shows the demo login (`DEMO_EMAIL` / `DEMO_PASSWORD`) with a **Fill in** button. Seed that account with `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`.
- Every change in the admin is refused with a clear message, and a banner says it's a demo.
- Only signing in and out reach the auth API, so the demo password and email can't be changed.
- The contact form doesn't save or send messages.

Use a separate database for the demo, seeded with the sample content.

## Architecture

Diagrams of the request flow, publishing and caching, the content lifecycle and the data model, plus search, the contour art, the project structure and the rules contributors should keep: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Licence

[MIT](LICENSE) © Kaviyabharathi Gopalakrishnan

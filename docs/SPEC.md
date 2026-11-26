# Stratafolio · Product spec and quality checklist

What the site and admin must do, the rules every change follows, and the checks a release has to pass. The README covers setup, scripts and deployment; this file is the standard to build and review against.

## 1. Principles

1. **Everything is content.** Every visible text, link, image, section order and visibility comes from the database and is edited in `/admin`. Components receive content as props; nothing user-facing is hard-coded.
2. **Publishing is instant and safe.** Edits autosave as drafts. Visitors only ever see published content, and Publish updates the live site on the next request, with no redeploy.
3. **Fast by default.** Public pages prerender into a static shell (Cache Components). Only what depends on the request streams in.
4. **Free tiers only.** Vercel Hobby, Neon Postgres, Cloudflare R2, Resend.
5. **Open-source friendly.** No personal names in code, file or package names; personal content lives in the seed and the database.
6. **Fewest dependencies.** Plain CSS, Biome only, and no package that isn't imported.

## 2. Design rules (a violation is a bug)

1. **One WebGL canvas**, in the hero only. Every other "ember" surface uses static SVG contour art plus CSS gradients (`lib/topo.ts`).
2. **Smooth hovers.** Never change `font-weight`, `font-size`, `letter-spacing` or `padding` on hover, and never transform the hovered element itself. Animate colour, opacity, borders or a child. Text must stay readable on hover, including on disabled buttons.
3. **No magnetic buttons, no cursor-following glows. RSS off by default (opt-in in Blog settings).**
4. **Every section has its own concept.** No generic bento grids, plain chip lists or plain index rows.
5. **Ember is an accent**, roughly 5% of a screen. Status dots are ember; teal is only for code/tech tags and success.
6. **Reduced motion:** every animation has a `prefers-reduced-motion` path (a still frame for the shader, instant states elsewhere).
7. **Icons, not text arrows**, and no em dashes in UI copy.
8. **Reuse the theme's components.** New UI uses the existing pills, cards, `.btn`, `Select`, `DatePicker`, toasts and dialogs, never native or one-off styles.

### Ink & Ember tokens

| Token          | Values                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Ink (neutrals) | 950 `#0B0B0D` bg · 900 `#141417` cards · 800 `#1E1E23` elevated · 700 `#2A2A31` borders · 500 `#7A776F` subtle |
| Paper          | 50 `#F5F2EB` · 100 `#EBE7DE` · 300 `#A8A49B` · 600 `#5C5952`                                                   |
| Ember          | 300 `#FF9466` · 500 `#FF5A1F` (dark) · 700 `#C2410C` (light)                                                   |
| Signal teal    | 400 `#3DDBB4` · 700 `#0F766E`                                                                                  |
| Fonts          | Bricolage Grotesque (display) · Hanken Grotesk (body) · Martian Mono (labels), self-hosted variable fonts      |

Palettes in **Settings → Appearance** override the accent variables; the default must always be restorable.

## 3. Content and publishing

- **Documents:** singletons in `globals`, collections (posts, projects, experience) in `entries`, history in `versions`. `data` is live, `draft` holds unpublished edits. Every read and write goes through the Zod schemas in `lib/content/schema.ts`.
- **Autosave:** about a second after typing stops. Autosaves from one 30-minute session merge into one version, identical saves are skipped, and each document keeps at most 10 autosaves and 40 versions.
- **Publish** is enabled only when something changed. **Discard** returns to the live version. **Reset to default** loads the starter content as a draft.
- **New entries:** Cancel on a never-published post, case study or experience item deletes it instead of leaving a draft.
- **Scheduled posts:** a published post with a future publish time stays off every list, page, the sitemap and llms.txt until then. The cached read expires at the release time, so no queue or worker is needed.
- **Preview:** Draft Mode shows drafts and scheduled posts to signed-in users only.
- **Roles:** admins edit everything; editors edit blog posts and media.
- **Media:** deleting moves a file to the bin; purging (manual or the nightly cron) removes it from R2.

### Caching rules (Cache Components)

- Public reads are `'use cache'` functions with `cacheLife` and `cacheTag` in `lib/queries.ts`. Server Actions expire tags with `updateTag`; the cron uses `revalidateTag(tag, "max")`.
- No `export const dynamic` or `revalidate` on routes.
- Request data (`cookies()`, `headers()`, `searchParams`, the session) only inside `<Suspense>` or after `await connection()`.
- No `new Date()`, `Date.now()` or `Math.random()` during a prerender outside `'use cache'` (use `lib/now.ts`).
- Unknown slugs return a real 404 status (`ensureStatic = "navigation"` + `notFound()`).

## 4. Images

| Where           | Recommended size                   | Notes                                                                                                        |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Post cover      | 2100 × 800 px (21:8)               | Phones crop to 4:3, cards to about 2:1: keep text and faces in the middle 1050 × 800. JPG/WebP under 400 KB. |
| Image in a post | 1600 px wide (2400 px when "Wide") | Any height; 16:9 or 3:2 read well. PNG/SVG for screenshots and diagrams.                                     |
| Open Graph      | 1200 × 630 px                      | Generated automatically per page and post.                                                                   |

Every meaningful image needs alt text (set in Media).

## 5. SEO and crawlers

- Title, description, canonical and Open Graph on every page; per-post `article` metadata with published and modified times and tags.
- Generated: `sitemap.xml` (published, indexable content only), `robots.txt` (optional AI-training block), `llms.txt`, web manifest, OG images.
- JSON-LD: `Person` and `WebSite` on home, `BlogPosting` on posts, `BreadcrumbList` on blog and case-study pages.
- Blog archive: topic and tag views are indexable; search, status and sort views are `noindex` with a canonical to the base view.
- One `<h1>` per page, no skipped heading levels, descriptive link text.
- Core Web Vitals budget: LCP < 2.5 s (hero text, not the canvas), CLS < 0.05, INP < 200 ms. The three.js chunk loads after first paint.

## 6. Analytics, privacy and consent

> Not legal advice. Confirm current requirements (India's DPDP Act and Rules, GDPR/ePrivacy, CCPA/CPRA) before launch.

- **Default stats are first-party and cookieless:** daily-rotating hashed visitor id, no IPs stored. Bots, Do Not Track, Global Privacy Control and signed-in admins are skipped. Vercel Analytics and Speed Insights are cookieless too.
- **Optional trackers** (GA4 and similar) load only after opt-in. Consent Mode defaults to denied; GPC/DNT count as "reject".
- **Consent card:** non-modal, bottom corner, equal-weight Accept and Reject, a "Choose" layer with switches, re-openable from "Privacy choices" in the footer. It only appears when an optional tool is enabled.
- **Events** never carry names, emails, message text or URLs with query strings.
- **Data kept:** contact messages are deleted after the retention period; stats and the media bin follow their own retention settings (Settings → Analytics & privacy).
- `/privacy` lists what is collected, why, processors (Vercel, Neon, Cloudflare R2, Resend, any analytics), retention, rights and a contact; it is linked from the footer and the contact form.

## 7. Accessibility (target WCAG 2.2 AA)

- Text contrast ≥ 4.5:1 in both themes; ember text only at large sizes or on ink.
- Skip link, landmarks and one `h1` per page.
- Everything operable by keyboard: dock, theme switch, menu, chips, slide-to-send, TOC, blog filters, consent card, and every admin control (Select, DatePicker, dialogs).
- Visible focus everywhere; focus returns to the trigger when menus and dialogs close.
- `aria-live` for form status, toasts and "Copied" messages.
- Decorative SVG and canvas are `aria-hidden`; content is visible without JavaScript.

## 8. Security

- Security headers in `next.config.ts`: CSP on the site, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, frame protection.
- Contact action: Zod validation, honeypot, length limits, rate limiting, no HTML in emails.
- Admin: strong `AUTH_SECRET`, invite-only sign-in, roles checked in every page and Server Action, `/admin` and `/api` kept out of the sitemap and index.
- Secrets stay server-only (no `NEXT_PUBLIC_` keys). Never export unauthenticated helpers from a `"use server"` file.
- Back up the database regularly (for example a weekly `pg_dump` to R2) and keep dependencies updated.

## 9. Release checklist

- [ ] `bun run check` (Biome + `tsc --noEmit`) and `bun run build` pass with zero errors
- [ ] No console errors and no Next.js dev-overlay issues on the site or in the admin
- [ ] Both themes look right at 360, 768 and 1440 px, with no horizontal scroll
- [ ] Exactly one WebGL canvas (hero); no hover changes font metrics or moves the hovered element
- [ ] All animations respect `prefers-reduced-motion`; content is visible without JavaScript
- [ ] Every visible text, section order/visibility, post, project, image and setting is editable in `/admin`, and Publish updates the live site without a redeploy
- [ ] Visitors never see drafts or scheduled posts; preview shows them to signed-in users
- [ ] Unknown URLs and slugs return a branded 404 with a 404 status
- [ ] Latest published post is featured on home and `/blog`; blog filters and pagination keep their state in the URL
- [ ] Contact form validates, sends via Resend and stores the message in the inbox
- [ ] Every page has a title, description, canonical and OG image; sitemap, robots and llms.txt are live; JSON-LD validates
- [ ] No optional tracker loads before consent; GPC is honoured; "Privacy choices" re-opens the card
- [ ] Security headers present; Lighthouse accessibility ≥ 95, performance ≥ 90 on mobile
- [ ] Admin lists, counts and badges agree after every create, cancel, delete and publish
- [ ] Database migrations applied (`bun run db:migrate`) on every environment

## 10. Launch tasks

- [ ] Accounts and env vars: Neon, Cloudflare R2 (bucket, token, public access, CORS for `PUT`), Resend (verified domain: SPF, DKIM, DMARC), Vercel
- [ ] Migrate and seed the production database, then sign in and change the seeded password
- [ ] Optional Google/GitHub sign-in apps
- [ ] Domain, Search Console verification, sitemap submission
- [ ] Weekly database backup
- [ ] Content review: case studies, posts, résumé PDF, privacy policy
- [ ] Before open-sourcing: a licence, generic sample seed content, and no personal details in defaults

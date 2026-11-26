import { z } from "zod";

/**
 * Content model. Every global and collection document is stored as JSON and validated with
 * these schemas on save (admin) and on read (site). Types are inferred from the schemas.
 */

const str = z.string();
const optStr = z.string().nullish();
const bool = (d: boolean) => z.boolean().default(d);
const mediaRef = z.number().int().nullish(); // media.id

/** Tiptap / ProseMirror JSON document. */
export type RichDoc = { type: "doc"; content?: RichNode[] };
export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};
/** Structural check for stored rich text: well-formed nodes only, bounded depth and size. */
function isRichNode(v: unknown, depth: number): boolean {
  if (depth > 40 || typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const n = v as RichNode;
  if (typeof n.type !== "string") return false;
  if (n.text !== undefined && typeof n.text !== "string") return false;
  if (n.attrs !== undefined && (typeof n.attrs !== "object" || n.attrs === null)) return false;
  if (
    n.marks !== undefined &&
    (!Array.isArray(n.marks) ||
      !n.marks.every((m) => typeof m === "object" && m !== null && typeof m.type === "string"))
  )
    return false;
  if (n.content !== undefined)
    return Array.isArray(n.content) && n.content.every((c) => isRichNode(c, depth + 1));
  return true;
}
const richDoc = z.custom<RichDoc>(
  (v) => isRichNode(v, 0) && (v as RichDoc).type === "doc" && JSON.stringify(v).length <= 2_000_000,
);

/* ───────── Globals ───────── */

export const SOCIAL_NETWORKS = [
  "github",
  "linkedin",
  "x",
  "instagram",
  "youtube",
  "facebook",
  "bluesky",
  "dribbble",
  "medium",
  "devto",
  "dailydev",
  "stackoverflow",
  "email",
  "phone",
  "website",
  "custom",
] as const;
export const socialSchema = z.object({
  id: str,
  network: z.enum(SOCIAL_NETWORKS).default("website"),
  /** Shown on cards and in menus; empty = the network's name. */
  label: optStr,
  handle: optStr,
  caption: optStr,
  url: str,
  /** Custom icon (any network); otherwise the built-in one. */
  icon: mediaRef,
  /** Where it appears. */
  inHeader: bool(true),
  inHero: bool(true),
  inContact: bool(true),
  inMenu: bool(true),
  inFooter: bool(true),
});
export type Social = z.infer<typeof socialSchema>;

export const siteSettingsSchema = z.object({
  fullName: str,
  initials: str.default("KG"),
  firstName: str,
  brand: str,
  role: str,
  byline: optStr,
  authorBio: optStr,
  email: z.email(),
  phone: optStr,
  showPhone: bool(false),
  location: optStr,
  locationShort: optStr,
  city: optStr,
  coords: optStr,
  timeZone: str.default("Asia/Kolkata"),
  /** Profile links (header, hero, contact cards, menu, footer). Old github/linkedin fields are
   * read as a fallback until this list is saved once. */
  socials: z.array(socialSchema).default([]),
  githubUrl: optStr,
  githubHandle: optStr,
  githubCaption: optStr,
  linkedinUrl: optStr,
  linkedinHandle: optStr,
  linkedinCaption: optStr,
  resume: mediaRef,
  resumeLabel: str.default("Résumé"),
  openToWork: bool(true),
  statusShort: optStr,
  statusLong: optStr,
  statusOff: optStr,
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const link = z.object({ label: str, href: str });
export const navigationSchema = z.object({
  dock: z.array(link).default([]),
  menu: z.array(link).default([]),
  showPrivacyChoices: bool(true),
  backToTopLabel: str.default("Back to top ↑"),
  /* Footer */
  /** The giant word at the bottom of every page; empty = the brand from General. */
  showFooterMark: bool(true),
  footerMark: optStr,
  /** "© 2026 <name>"; empty = full name from General. */
  footerName: optStr,
  /** Extra links in the footer row (before Privacy). Profiles come from General → Profiles & links. */
  footerLinks: z.array(link).default([]),
  showFooterEmail: bool(true),
  showPrivacyLink: bool(true),
  /** "Blog" link in the portfolio footer row. */
  showBlogLink: bool(true),
  blogLinkLabel: str.default("Blog"),
});
export type Navigation = z.infer<typeof navigationSchema>;

const blockBase = { id: str, hidden: bool(false), name: optStr };
const sectionBase = { ...blockBase, label: str, anchor: str };

export const heroBlock = z.object({
  ...blockBase,
  blockType: z.literal("hero"),
  eyebrow: str,
  showCoords: bool(true),
  nameLine1: str,
  nameLine2: str,
  tagline: str,
  currentlyLabel: str.default("Currently"),
  currently: str,
  showSocials: bool(true),
  primaryLabel: optStr,
  primaryHref: optStr,
  secondaryLabel: optStr,
  secondaryHref: optStr,
  shader: bool(true),
  nameReveal: bool(true),
});
export const marqueeBlock = z.object({
  ...blockBase,
  blockType: z.literal("marquee"),
  items: z.array(str).default([]),
});
export const aboutBlock = z.object({
  ...sectionBase,
  blockType: z.literal("about"),
  facts: z.array(z.object({ label: str, value: str })).default([]),
  lead: str,
  paragraphs: z.array(z.object({ text: str })).default([]),
  stats: z.array(z.object({ value: z.number(), suffix: optStr, label: str })).default([]),
});
export const workBlock = z.object({
  ...sectionBase,
  blockType: z.literal("work"),
  heading: str,
  projects: z.array(z.number()).default([]), // entry ids, in order; empty = all
});
export const experienceBlock = z.object({
  ...sectionBase,
  blockType: z.literal("experience"),
  heading: str,
  intro: optStr,
  summary: z.array(z.object({ value: optStr, label: str, liveTenure: bool(false) })).default([]),
});
export const toolkitBlock = z.object({
  ...sectionBase,
  blockType: z.literal("toolkit"),
  heading: str,
  legendLabel: optStr,
  note: optStr,
  scaleTop: str.default("Surface"),
  scaleBottom: str.default("Core"),
});
export const blogTeaserBlock = z.object({
  ...sectionBase,
  blockType: z.literal("blogTeaser"),
  heading: str,
  /** How many recent posts the side list shows (after the featured latest post). */
  sideCount: z.number().int().min(1).max(8).default(4),
  /** Also list drafts/posts being written as "coming soon" after the published ones. */
  showUpcoming: bool(true),
  allLabel: str.default("All posts"),
});
export const TOPIC_VALUES = ["role", "freelance", "collab", "hi"] as const;
export const contactBlock = z.object({
  ...sectionBase,
  blockType: z.literal("contact"),
  heading: str,
  emailLabel: str.default("Email me"),
  resumeLabel: str.default("Download résumé ↓"),
  formTitle: str.default("Send a message"),
  formNote: optStr,
  topicsLegend: str.default("I’m reaching out about"),
  topics: z.array(z.object({ value: z.enum(TOPIC_VALUES), label: str })).default([]),
  nameLabel: str.default("Your name"),
  emailFieldLabel: str.default("Email"),
  messageLabel: str.default("What are you building?"),
  slideLabel: str.default("Send message"),
  sendingLabel: str.default("Sending"),
  sentLabel: str.default("Delivered"),
  successText: str,
  errorText: str,
  privacyNote: optStr,
});

export const sectionSchema = z.discriminatedUnion("blockType", [
  heroBlock,
  marqueeBlock,
  aboutBlock,
  workBlock,
  experienceBlock,
  toolkitBlock,
  blogTeaserBlock,
  contactBlock,
]);
export type Section = z.infer<typeof sectionSchema>;
export type HeroBlock = z.infer<typeof heroBlock>;
export type MarqueeBlock = z.infer<typeof marqueeBlock>;
export type AboutBlock = z.infer<typeof aboutBlock>;
export type WorkBlock = z.infer<typeof workBlock>;
export type ExperienceBlock = z.infer<typeof experienceBlock>;
export type ToolkitBlock = z.infer<typeof toolkitBlock>;
export type BlogTeaserBlock = z.infer<typeof blogTeaserBlock>;
export type ContactBlock = z.infer<typeof contactBlock>;

export const homePageSchema = z.object({ sections: z.array(sectionSchema).default([]) });
export type HomePage = z.infer<typeof homePageSchema>;

export const blogPageSchema = z.object({
  /** Name in the blog's own header and browser tab (empty = "<brand> · Blog"). */
  siteName: optStr,
  /** Label of the header/footer link back to the portfolio. */
  portfolioLabel: str.default("About me"),
  /** Extra links in the blog header (e.g. categories, About). */
  headerLinks: z.array(link).default([]),
  /** Header pill and footer link back to the portfolio (labelled by portfolioLabel). */
  showPortfolioLink: bool(true),
  /* Blog footer */
  /** "© 2026 <name>"; empty = full name from General. */
  footerName: optStr,
  /** Extra links in the blog footer row. */
  footerLinks: z.array(link).default([]),
  /** Profile links that have the "Footer" switch on in General. */
  showFooterSocials: bool(true),
  showFooterEmail: bool(false),
  showPrivacyLink: bool(true),
  showPrivacyChoices: bool(true),
  backToTopLabel: str.default("Back to top ↑"),
  /** RSS feed at /blog/feed.xml with a header button and footer link. Off by default (SPEC). */
  rss: bool(false),
  eyebrow: str,
  heading: str,
  intro: optStr,
  archiveHeading: str.default("All posts"),
  emptyText: str.default("Nothing here yet. Try another topic."),
  perPage: z.number().int().min(3).max(50).default(10),
  ctaTitle: optStr,
  ctaBody: optStr,
  /** Post categories (topics), in the order the /blog filter shows them. */
  categories: z.array(str).default(["Engineering", "Security", "Serverless", "Frontend", "Career"]),
});
export type BlogPage = z.infer<typeof blogPageSchema>;

export const toolkitSchema = z.object({
  layers: z.array(z.object({ name: str, role: str, tools: z.array(str) })).default([]),
});
export type Toolkit = z.infer<typeof toolkitSchema>;

export const seoSchema = z.object({
  siteTitle: str,
  titleTemplate: str.default("%s"),
  description: str,
  keywords: z.array(str).default([]),
  ogImage: mediaRef,
  allowIndexing: bool(true),
  googleVerification: optStr,
  /** Bing Webmaster Tools: the content of its <meta name="msvalidate.01"> tag. */
  bingVerification: optStr,
  /** Tell Bing (and other IndexNow engines) about published changes right away. */
  indexNow: bool(true),
  /** /llms.txt: a plain-text map of the site for AI assistants. */
  llmsTxt: bool(true),
  /** Intro paragraph at the top of llms.txt; empty = the SEO description. */
  llmsSummary: optStr,
  /** Ask AI-training crawlers (GPTBot, Google-Extended, CCBot…) to stay out via robots.txt. */
  blockAiTraining: bool(false),
});
export type Seo = z.infer<typeof seoSchema>;

export const privacySchema = z.object({
  /** First-party, cookieless stats shown in the admin (Stats page). */
  siteStats: bool(true),
  /** Skip browsers that send Do Not Track or Global Privacy Control (stats are anonymous either way). */
  statsHonorDnt: bool(true),
  vercelAnalytics: bool(true),
  speedInsights: bool(true),
  ga4Enabled: bool(false),
  ga4Id: optStr,
  policyVersion: z.number().int().default(1),
  consentTitle: str.default("Your call"),
  consentBody: str,
  acceptLabel: str.default("Accept optional"),
  rejectLabel: str.default("Reject optional"),
  chooseLabel: str.default("Choose"),
  retentionMonths: z.number().int().min(1).max(36).default(12),
  /** Raw stats events: 0 keeps them forever (complete all-time stats). */
  statsRetentionMonths: z.number().int().min(0).max(120).default(0),
  /** Media bin: files are deleted for good this many days after being binned (0 = never). */
  binDays: z.number().int().min(0).max(365).default(30),
  updated: optStr,
  policy: richDoc.nullish(),
});
export type Privacy = z.infer<typeof privacySchema>;

export const appearanceSchema = z.object({
  /** Preset id from lib/palette.ts ("ember" is the default), or "custom". */
  palette: str.default("ember"),
  /** Custom accent (hex), used when palette is "custom". */
  custom: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullish(),

  /* Logo + favicon. Empty fields fall back to the built-in text logo and /icon.svg. */
  logoType: z.enum(["text", "image"]).default("text"),
  /** Text logo; empty = the brand from Settings → General. */
  logoText: optStr,
  /** Image logo for the dark theme (and light, unless logoImageLight is set). */
  logoImage: mediaRef,
  logoImageLight: mediaRef,
  /** Image logo height in px. */
  logoHeight: z.number().int().min(16).max(72).default(28),
  favicon: mediaRef,
  /** Admin sidebar: same as the site, or its own text/image. */
  adminLogo: z.enum(["same", "text", "image"]).default("same"),
  adminLogoText: optStr,
  adminLogoImage: mediaRef,
  /** Admin tab icon; empty = the site favicon. */
  adminFavicon: mediaRef,
  /** Browser tab title for the admin: "Messages · <adminTitle>". Empty = "<brand> Admin". */
  adminTitle: optStr,
  /** Small tag next to the admin logo. */
  adminBadge: str.default("Admin"),
});
export type AppearanceData = z.infer<typeof appearanceSchema>;

export const GLOBALS = {
  "site-settings": siteSettingsSchema,
  navigation: navigationSchema,
  "home-page": homePageSchema,
  "blog-page": blogPageSchema,
  toolkit: toolkitSchema,
  seo: seoSchema,
  privacy: privacySchema,
  appearance: appearanceSchema,
} as const;
export type GlobalKey = keyof typeof GLOBALS;
export type GlobalData<K extends GlobalKey> = z.infer<(typeof GLOBALS)[K]>;

/** Cache tag busted when a global is published. */
export const GLOBAL_TAG: Record<GlobalKey, string> = {
  "site-settings": "settings",
  navigation: "navigation",
  "home-page": "home",
  "blog-page": "blog-page",
  toolkit: "toolkit",
  seo: "seo",
  privacy: "privacy",
  appearance: "appearance",
};

/* ───────── Collections ───────── */

/** Starter categories; the live list is edited in Settings → Blog page (blog-page.categories). */
export const POST_CATEGORIES = [
  "Engineering",
  "Security",
  "Serverless",
  "Frontend",
  "Career",
] as const;

const seoMeta = z
  .object({ title: optStr, description: optStr, noindex: bool(false) })
  .default({ noindex: false });

export const postSchema = z.object({
  title: str.min(1),
  slug: str.min(1),
  stage: z.enum(["published", "writing", "draft"]).default("draft"),
  publishedAt: optStr,
  /** One of Settings → Blog page → Categories (free text, so renamed or removed ones still load). */
  category: str.min(1).default("Engineering"),
  /** User id of the author (Settings → Users). Empty = the site owner from Settings → General. */
  authorId: optStr,
  tags: z.array(str).default([]),
  excerpt: str.default(""),
  content: richDoc.nullish(),
  coverLines: z.array(z.object({ kind: z.enum(["cmd", "ok", "plain"]), text: str })).default([]),
  coverImage: mediaRef,
  readMinutes: z.number().int().default(1),
  readOverride: z.number().int().nullish(),
  meta: seoMeta,
});
export type PostData = z.infer<typeof postSchema>;

export const projectSchema = z.object({
  title: str.min(1),
  slug: str.min(1),
  client: str,
  kind: str,
  role: str.default("Full-stack engineer"),
  listLabel: optStr,
  summary: str,
  stack: z.array(str).default([]),
  listTags: z.array(str).default([]),
  metrics: z
    .array(z.object({ value: str, label: str, short: optStr, inline: bool(false) }))
    .default([]),
  previewLabel: str.default("Impact"),
  context: str,
  sections: z.array(z.object({ heading: str, points: z.array(str).default([]) })).default([]),
  meta: seoMeta,
});
export type ProjectData = z.infer<typeof projectSchema>;

export const experienceSchema = z.object({
  type: z.enum(["role", "education"]).default("role"),
  company: str,
  logo: optStr,
  location: optStr,
  title: str,
  start: str, // YYYY-MM-DD
  end: optStr,
  score: optStr,
  kpis: z.array(z.object({ value: str, suffix: optStr, label: str })).default([]),
  bullets: z.array(str).default([]),
  tags: z.array(str).default([]),
});
export type ExperienceData = z.infer<typeof experienceSchema>;

export const COLLECTIONS = {
  posts: postSchema,
  projects: projectSchema,
  experience: experienceSchema,
} as const;
export type CollectionKey = keyof typeof COLLECTIONS;
export type CollectionData<K extends CollectionKey> = z.infer<(typeof COLLECTIONS)[K]>;

/** Site-facing documents carry their id and timestamps. */
type Doc<T> = T & { id: number; createdAt: string; updatedAt: string };
export type Post = Doc<PostData>;
export type Project = Doc<ProjectData>;
export type Experience = Doc<ExperienceData>;

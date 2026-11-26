import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { Resend } from "resend";
import { db } from "@/db";
import * as schema from "@/db/schema";
import type { Role } from "./rbac";

/**
 * OAuth providers turn on when their keys are set. `disableImplicitSignUp` keeps sign-in
 * invite-only: a Google/GitHub account can only sign in if its email already belongs to a user
 * (created by the seed or invited from Settings → Users); the account is linked on first use.
 */
const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        disableImplicitSignUp: true,
        prompt: "select_account" as const,
      }
    : undefined;
const github =
  process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        disableImplicitSignUp: true,
      }
    : undefined;

/** Which sign-in methods the login page should offer. */
export const authMethods = {
  google: Boolean(google),
  github: Boolean(github),
  magicLink: Boolean(process.env.RESEND_API_KEY),
};

/**
 * Where the app runs. NEXT_PUBLIC_SITE_URL wins; on Vercel it falls back to the production
 * domain, so a missing variable doesn't leave sign-in pointing at localhost.
 */
const vercelUrl = (host?: string) => (host ? `https://${host}` : undefined);
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  vercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
  vercelUrl(process.env.VERCEL_URL) ||
  "http://localhost:3000";

/**
 * Better Auth only accepts requests from these origins ("Invalid origin" otherwise): the site
 * URL, Vercel's production domain and this deployment's own URL (previews), plus any extra
 * origins listed comma-separated in AUTH_TRUSTED_ORIGINS (e.g. a custom domain).
 */
/**
 * Preview deployments run unreviewed branch code, usually against the production database, so
 * signing in there is off unless AUTH_ALLOW_PREVIEW_SIGNIN=1 (ideally with a separate Neon branch
 * set as DATABASE_URL for the Preview environment in Vercel).
 */
const isPreview = process.env.VERCEL_ENV === "preview";
const previewSignIn = !isPreview || process.env.AUTH_ALLOW_PREVIEW_SIGNIN === "1";
const trustedOrigins = [
  siteUrl,
  vercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL),
  ...(previewSignIn
    ? [vercelUrl(process.env.VERCEL_URL), vercelUrl(process.env.VERCEL_BRANCH_URL)]
    : []),
  ...(process.env.AUTH_TRUSTED_ORIGINS ?? "").split(",").map((s) => s.trim()),
].filter((o): o is string => Boolean(o));

/**
 * Admin sign-in (Better Auth). Invite-only: public sign-up is disabled; the seed creates the
 * first admin and admins invite editors from Settings → Users. Magic links need Resend.
 */
export const auth = betterAuth({
  baseURL: siteUrl,
  trustedOrigins,
  secret: process.env.AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      rateLimit: schema.rateLimit,
    },
  }),
  // Profiles are edited through the admin (validated Server Action), not Better Auth's
  // generic endpoints, which would accept any name/avatar URL or let users change their email.
  disabledPaths: ["/update-user", "/change-email", "/delete-user"],
  emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10 },
  socialProviders: { ...(google ? { google } : {}), ...(github ? { github } : {}) },
  account: {
    accountLinking: {
      enabled: true,
      // Google and GitHub verify the email, and local users are created by an admin
      // (seed or invite), so linking an existing user on first OAuth sign-in is safe.
      trustedProviders: ["google", "github"],
      requireLocalEmailVerified: false,
    },
  },
  user: {
    additionalFields: {
      // Least privilege when a user row is created without an explicit role.
      role: { type: "string", required: false, defaultValue: "author", input: false },
      byline: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // No cookie cache: every request checks the session row, so removing a user or revoking a
    // session takes effect immediately instead of after the cache expires.
    cookieCache: { enabled: false },
  },
  rateLimit: {
    enabled: true,
    // Stored in Postgres so the limit is shared by every serverless instance (the default
    // in-memory store only counts requests that hit the same instance).
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 300, max: 10 },
      "/sign-in/magic-link": { window: 300, max: 5 },
    },
  },
  plugins: [
    magicLink({
      disableSignUp: true,
      sendMagicLink: async ({ email, url }) => {
        if (!process.env.RESEND_API_KEY) throw new Error("Magic links need RESEND_API_KEY.");
        await new Resend(process.env.RESEND_API_KEY).emails.send({
          from: process.env.CONTACT_FROM_EMAIL ?? "Bharathi4real <onboarding@resend.dev>",
          to: email,
          subject: "Your Bharathi4real admin sign-in link",
          text: `Sign in to the Bharathi4real admin:\n\n${url}\n\nThe link expires in 5 minutes. If you didn't ask for it, ignore this email.`,
        });
      },
    }),
    nextCookies(),
  ],
});

export type { Role } from "./rbac";
export type AdminUser = { id: string; name: string; email: string; role: Role };

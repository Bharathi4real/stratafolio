import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const r2 = process.env.R2_PUBLIC_URL ? new URL(process.env.R2_PUBLIC_URL) : null;

// Static pages can't carry per-request nonces (Next's own RSC payload is inline script), so inline
// <script> blocks are allowed; inline event-handler attributes (onclick=…) are not, and everything
// else is locked down.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""} https://va.vercel-scripts.com https://www.googletagmanager.com`,
  "script-src-attr 'none'",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${r2 ? ` ${r2.origin}` : ""} https://www.google-analytics.com`,
  "font-src 'self'",
  "connect-src 'self' https://vitals.vercel-insights.com https://*.google-analytics.com https://*.analytics.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  // Cache Components (Next.js 16.4 default for new apps): data is dynamic unless marked
  // 'use cache'; routes prerender a static shell and stream the rest. See lib/queries.ts.
  cacheComponents: true,
  partialPrefetching: true,
  // app/global-not-found.tsx: a branded 404 for URLs outside both root layouts.
  experimental: { globalNotFound: true },
  images: {
    localPatterns: [{ pathname: "/uploads/**" }],
    remotePatterns: r2
      ? [{ protocol: r2.protocol.replace(":", "") as "https", hostname: r2.hostname }]
      : [],
  },
  // Fonts for the generated images. Keys are globs matched anywhere in the route ("contains"),
  // so "[slug]" can't be written literally (it's a character class): "/opengraph-image" covers
  // every share card (incl. their hashed, per-id routes) and "/blog/*/image/*" the article ratios.
  outputFileTracingIncludes: {
    "/opengraph-image": ["./assets/og/**"],
    "/blog/*/image/*": ["./assets/og/**"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The site (not the admin, which needs its own allowances and is same-origin framed by live preview)
      { source: "/((?!admin|api).*)", headers: [{ key: "Content-Security-Policy", value: csp }] },
      {
        source: "/(admin|api)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      // The admin may only be framed by itself (live preview), never by another site (clickjacking).
      {
        source: "/admin/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; script-src-attr 'none'",
          },
        ],
      },
    ];
  },
  turbopack: { root: path.resolve(dirname) },
};

export default nextConfig;

import { headers } from "next/headers";
import { z } from "zod";
import { getPrivacy } from "@/lib/queries";
import { clientIp, overLimit } from "@/lib/rate-limit";
import { cleanPath, deviceOf, isBot, record, referrerHost, slugOf, visitorId } from "@/lib/stats";

/** Collector for the cookieless site stats beacon (components/stats/StatsBeacon.tsx). */
const body = z.object({
  type: z.enum(["view", "read", "leave"]),
  path: z.string().max(300),
  referrer: z.string().max(500).optional(),
  depth: z.number().int().min(0).max(100).optional(),
  seconds: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 6)
    .optional(),
});

type Skip = "bot" | "prefetch" | "dnt" | "gpc" | "admin" | "disabled" | null;

const REASONS: Record<Exclude<Skip, null>, string> = {
  bot: "This looks like a bot or crawler.",
  prefetch: "Prefetch requests aren't counted.",
  dnt: "This browser sends Do Not Track (Settings → Analytics & privacy can count these).",
  gpc: "This browser sends Global Privacy Control (Settings → Analytics & privacy can count these).",
  admin: "You're signed in to the admin in this browser; your own visits aren't counted.",
  disabled: "Site stats are turned off in Settings → Analytics & privacy.",
};

/** Why this request wouldn't be counted (null = it would be). */
async function skipReason(h: Headers): Promise<Skip> {
  const ua = h.get("user-agent") ?? "";
  if (isBot(ua)) return "bot";
  if (h.get("purpose") === "prefetch" || h.get("sec-purpose")?.includes("prefetch"))
    return "prefetch";
  // Any Better Auth session cookie (plain or __Secure- on HTTPS) = a signed-in admin or editor.
  if ((h.get("cookie") ?? "").includes("better-auth.session_token")) return "admin";
  const privacy = await getPrivacy();
  if (privacy.siteStats === false) return "disabled";
  if (privacy.statsHonorDnt !== false) {
    if (h.get("sec-gpc") === "1") return "gpc";
    if (h.get("dnt") === "1") return "dnt";
  }
  return null;
}

/**
 * Self-check: open /api/e in any browser to see whether its visits are counted, and why not.
 * Nothing is recorded.
 */
export async function GET() {
  const reason = await skipReason(await headers());
  return Response.json(
    {
      counted: reason === null,
      reason: reason ? REASONS[reason] : "Visits from this browser are counted.",
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const h = await headers();
  const ua = h.get("user-agent") ?? "";
  const reason = await skipReason(h);
  if (reason) return new Response(null, { status: 204, headers: { "x-stats-skip": reason } });
  const skip = new Response(null, { status: 204 });

  let parsed: z.infer<typeof body>;
  try {
    parsed = body.parse(JSON.parse(await req.text()));
  } catch {
    return new Response(null, { status: 400 });
  }
  const path = cleanPath(parsed.path);
  if (!path) return skip;
  const ip = clientIp(h);
  // Keyed by IP (not the visitor hash, which changes with the user agent): 120 events / minute.
  if (await overLimit(`stats:${ip}`, 120, 60_000)) return skip;
  const visitor = await visitorId(ip, ua);

  const host = (h.get("host") ?? "").split(":")[0];
  await record({
    type: parsed.type,
    path,
    slug: slugOf(path),
    visitor,
    referrer: parsed.type === "view" ? referrerHost(parsed.referrer, host) : null,
    country: (h.get("x-vercel-ip-country") ?? "").slice(0, 2).toUpperCase() || null,
    device: deviceOf(ua),
    depth: parsed.depth ?? null,
    seconds: parsed.seconds ?? null,
  });
  return skip;
}

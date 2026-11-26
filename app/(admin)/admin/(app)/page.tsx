import type { Metadata } from "next";
import Link from "next/link";
import { PublishBar } from "@/components/admin/PublishBar";
import { Arrow } from "@/components/ui/Arrow";
import { dashboardStats, pendingChanges } from "@/lib/admin/actions";
import { fmtBytes, timeAgo } from "@/lib/admin/format";
import { dashboardStatTile } from "@/lib/admin/stats";
import { can } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

const NEON = 1024 ** 3; // 1 GB
const R2 = 10 * 1024 ** 3; // 10 GB

const pct = (v: number, of: number) => `${Math.max(1, Math.min(100, (v / of) * 100)).toFixed(1)}%`;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  // What this role may open (the actions behind each part enforce the same on the server).
  const site = can(user.role, "site.manage");
  const canPublish = can(user.role, "posts.manage");
  const seesStats = can(user.role, "stats.view");
  const blogSettings = can(user.role, "blog.settings");
  // dashboardStats and pendingChanges only return what this user may see (authors: their own
  // posts, never other people's drafts).
  const [s, pending, sp, week] = await Promise.all([
    dashboardStats(),
    canPublish ? pendingChanges() : Promise.resolve([]),
    searchParams,
    seesStats ? dashboardStatTile() : Promise.resolve(null),
  ]);
  const wow = week?.prevVisitors
    ? Math.round(((week.visitors - week.prevVisitors) / week.prevVisitors) * 100)
    : null;
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    }).format(new Date()),
  );
  const part = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const first = user.name.split(" ")[0];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            Good {part}, <em>{first}</em>
          </h1>
          <p>
            Everything on the site is editable from here: text, sections, case studies, blog posts,
            media and settings.
          </p>
        </div>
      </div>
      {sp.denied ? (
        <div className="callout" style={{ marginBottom: "1rem" }}>
          <b>No access</b>Your role can’t open that page. Ask an admin if you need it.
        </div>
      ) : null}
      {canPublish ? <PublishBar items={pending} /> : null}
      {week ? (
        <Link className="week-strip" href="/admin/stats?range=7">
          <span className="mono subtle">Last 7 days</span>
          <span>
            <b>{week.visitors}</b> visitors
            {wow !== null ? (
              <em className={wow > 0 ? "up" : wow < 0 ? "down" : ""}>
                {wow > 0 ? "▲" : wow < 0 ? "▼" : "•"} {Math.abs(wow)}%
              </em>
            ) : null}
          </span>
          <span>
            <b>{week.views}</b> page views
          </span>
          <span>
            <b>{week.reads}</b> blog reads
          </span>
          <span className="week-go">
            Open stats <Arrow dir="right" />
          </span>
        </Link>
      ) : null}
      <div className="grid stats">
        <div className="card stat">
          <small className="mono">Published posts</small>
          <strong>{String(s.published).padStart(2, "0")}</strong>
          <span>{s.upcoming} coming soon</span>
        </div>
        {site ? (
          <div className="card stat">
            <small className="mono">Unread messages</small>
            <strong>{String(s.unread).padStart(2, "0")}</strong>
            <span>From the contact form</span>
          </div>
        ) : null}
        <div className="card stat">
          <small className="mono">Media · R2</small>
          <strong>{fmtBytes(s.mediaBytes)}</strong>
          <span>of 10 GB free tier</span>
          <div className="meter">
            <i style={{ "--v": pct(s.mediaBytes, R2) } as React.CSSProperties} />
          </div>
        </div>
        <div className="card stat">
          <small className="mono">Database · Neon</small>
          <strong>{fmtBytes(s.dbBytes)}</strong>
          <span>of 1 GB free tier</span>
          <div className="meter">
            <i style={{ "--v": pct(s.dbBytes, NEON) } as React.CSSProperties} />
          </div>
        </div>
      </div>
      <div className="grid dash-cols">
        <div className="card">
          <div className="card-h">
            <h3>Recent activity</h3>
          </div>
          <ul className="activity">
            {s.activity.length === 0 ? (
              <li>
                <div className="muted">No edits yet.</div>
              </li>
            ) : null}
            {s.activity.map((a) => (
              <li key={a.id}>
                <span className="act-ic">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    {a.label === "Published" ? (
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    ) : (
                      <path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z" />
                    )}
                  </svg>
                </span>
                <div>
                  <Link href={a.href}>
                    <b>
                      {a.label === "Autosave" ? "Draft saved" : a.label}: {a.what}
                    </b>
                  </Link>
                </div>
                <time className="mono">{timeAgo(a.at)}</time>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid" style={{ gap: "1rem" }}>
          <div className="card">
            <div className="card-h">
              <h3>Quick actions</h3>
            </div>
            <div className="card-b quick">
              <p className="mono quick-h">Blog</p>
              <Link href="/admin/posts/new">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <b>New blog post</b>
                <span>Opens the editor</span>
              </Link>
              {blogSettings ? (
                <Link href="/admin/blog-settings">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden="true"
                  >
                    <path d="M4 6h16M4 12h16M4 18h10" />
                  </svg>
                  <b>Blog settings</b>
                  <span>Header, footer & page</span>
                </Link>
              ) : null}
              {site ? (
                <>
                  <p className="mono quick-h">Portfolio</p>
                  <Link href="/admin/home">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
                    </svg>
                    <b>Edit home page</b>
                    <span>Sections + live preview</span>
                  </Link>
                  <Link href="/admin/settings/general">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    <b>Update status</b>
                    <span>“Open to work” tag · Settings</span>
                  </Link>
                  <Link href="/admin/settings/general#resume">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      aria-hidden="true"
                    >
                      <path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" />
                    </svg>
                    <b>Replace résumé</b>
                    <span>The PDF behind every button · Settings</span>
                  </Link>
                </>
              ) : null}
            </div>
          </div>
          <div className="card">
            <div className="card-h">
              <h3>Free-tier usage</h3>
              <span className="mono subtle">Storage</span>
            </div>
            <ul className="free">
              <li>
                <div className="row">
                  <span>Neon Postgres · storage</span>
                  <span className="mono">{fmtBytes(s.dbBytes)} / 1 GB</span>
                </div>
                <div className="meter">
                  <i style={{ "--v": pct(s.dbBytes, NEON) } as React.CSSProperties} />
                </div>
              </li>
              <li>
                <div className="row">
                  <span>Cloudflare R2 · storage</span>
                  <span className="mono">{fmtBytes(s.mediaBytes)} / 10 GB</span>
                </div>
                <div className="meter">
                  <i style={{ "--v": pct(s.mediaBytes, R2) } as React.CSSProperties} />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

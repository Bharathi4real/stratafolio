import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatsChart } from "@/components/admin/stats/Chart";
import { Kpi, RangeBar, TopList } from "@/components/admin/stats/StatsView";
import { Btn, PageHead } from "@/components/admin/ui";
import { Arrow } from "@/components/ui/Arrow";
import { parseWindow, singlePostStats } from "@/lib/admin/stats";
import { readEntryBySlug } from "@/lib/content/store";
import { requirePermission } from "@/lib/session";
import { winInfo } from "../win";

export const metadata: Metadata = { title: "Post stats" };

const BUCKETS = ["0–25%", "25–50%", "50–75%", "75–100%"];

export default async function PostStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requirePermission("stats.view");
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const win = await parseWindow(sp);
  const info = winInfo(win);
  const post = await readEntryBySlug("posts", slug, { draft: true });
  if (!post) notFound();
  const s = await singlePostStats(slug, win);
  const t = s.totals;
  const p = s.previous ?? undefined;
  const leaves = s.depth.reduce((a, b) => a + b, 0);
  const maxB = Math.max(1, ...s.depth);
  return (
    <>
      <p className="crumb-back">
        <Link href={`/admin/stats?${win.query}`}>
          <Arrow dir="left" /> All stats
        </Link>
      </p>
      <PageHead title={post.title} desc={`/blog/${slug}`}>
        <Btn href={`/blog/${slug}`} external>
          View post <Arrow dir="out" />
        </Btn>
        <Btn href={`/admin/posts/${post.id}`}>Edit post</Btn>
      </PageHead>
      <div className="stats-bar">
        <RangeBar win={info} base={`/admin/stats/${slug}`} />
      </div>
      <div className="kpi-grid">
        <Kpi label="Views" value={t.views} prev={p?.views} />
        <Kpi label="Readers" value={t.readers} prev={p?.readers} hint="read 60% + 30s" />
        <Kpi
          label="Read rate"
          value={t.views ? Math.round((t.reads / t.views) * 100) : 0}
          format="pct"
        />
        <Kpi label="Avg. time" value={t.avgSeconds} prev={p?.avgSeconds} format="dur" />
      </div>
      <div className="card chart-card">
        <div className="card-h">
          <h3>Views and reads</h3>
        </div>
        <div className="card-b">
          <StatsChart data={s.series} bucket={win.bucket} />
        </div>
      </div>
      <div className="top-grid">
        <div className="card top-list">
          <div className="card-h">
            <h3>How far people read</h3>
            <span className="mono subtle">{leaves} visits</span>
          </div>
          <ol className="depth">
            {s.depth.map((v, i) => (
              <li key={BUCKETS[i]}>
                <span className="tl-bar" style={{ width: `${(v / maxB) * 100}%` }} />
                <span className="tl-key">Stopped at {BUCKETS[i]}</span>
                <b className="mono">{leaves ? Math.round((v / leaves) * 100) : 0}%</b>
              </li>
            ))}
          </ol>
        </div>
        <TopList title="Where readers came from" rows={s.referrers} kind="referrer" />
        <TopList title="Devices" rows={s.devices} kind="device" />
      </div>
    </>
  );
}

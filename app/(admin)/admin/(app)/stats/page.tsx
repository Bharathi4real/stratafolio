import type { Metadata } from "next";
import { StatsOverview } from "@/components/admin/stats/StatsView";
import { PageHead } from "@/components/admin/ui";
import { parseWindow, siteStats } from "@/lib/admin/stats";
import { readGlobal } from "@/lib/content/store";
import { requirePermission } from "@/lib/session";
import { winInfo } from "./win";

export const metadata: Metadata = { title: "Stats" };

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  await requirePermission("stats.view");
  const win = await parseWindow(await searchParams);
  const [data, privacy] = await Promise.all([siteStats(win), readGlobal("privacy")]);
  return (
    <>
      <PageHead
        title="Site"
        accent="stats"
        desc={
          privacy.siteStats !== false
            ? "Visitors, page views and blog reads. No cookies, no IPs stored, and your own visits while signed in aren’t counted."
            : "Site stats are switched off in Settings → Analytics & privacy, so nothing new is being counted."
        }
      />
      <StatsOverview win={winInfo(win)} data={data} />
    </>
  );
}

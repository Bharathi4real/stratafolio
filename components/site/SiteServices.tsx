import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { draftMode } from "next/headers";
import { Suspense } from "react";
import { Consent } from "@/components/consent/Consent";
import { LivePreview } from "@/components/providers/LivePreview";
import { SmoothScroll } from "@/components/providers/SmoothScroll";
import { StatsBeacon } from "@/components/stats/StatsBeacon";
import { StaticTopo } from "@/components/ui/Topo";
import { getPrivacy } from "@/lib/queries";

/**
 * Everything a public page needs besides its own header and footer: cookie consent, site stats,
 * smooth scrolling, live preview (draft mode) and Vercel analytics, all governed by
 * Settings → Analytics & privacy. Used by both the portfolio and the blog layouts.
 */
export async function SiteServices() {
  const [privacy, draft] = await Promise.all([getPrivacy(), draftMode()]);
  const isProd = process.env.NODE_ENV === "production";
  return (
    <>
      {privacy.siteStats !== false && !draft.isEnabled ? (
        <Suspense fallback={null}>
          <StatsBeacon />
        </Suspense>
      ) : null}
      <Consent
        topo={
          <StaticTopo
            seed="consent"
            cx={60}
            cy={20}
            n={12}
            w={420}
            h={320}
            step={22}
            className="consent-topo"
          />
        }
        config={{
          version: privacy.policyVersion ?? 1,
          ga4Id: privacy.ga4Enabled ? privacy.ga4Id : null,
          title: privacy.consentTitle ?? "Your call",
          body: privacy.consentBody ?? "",
          accept: privacy.acceptLabel ?? "Accept optional",
          reject: privacy.rejectLabel ?? "Reject optional",
          choose: privacy.chooseLabel ?? "Choose",
        }}
      />
      <Suspense fallback={null}>
        <SmoothScroll />
      </Suspense>
      {draft.isEnabled ? <LivePreview /> : null}
      {isProd && privacy.vercelAnalytics !== false ? <Analytics /> : null}
      {isProd && privacy.speedInsights !== false ? <SpeedInsights /> : null}
    </>
  );
}

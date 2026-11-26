import type { Metadata } from "next";
import { RichText } from "@/components/blog/RichText";
import { SiteMotion } from "@/components/providers/SiteMotion";
import { StaticTopo } from "@/components/ui/Topo";
import { getPrivacy } from "@/lib/queries";
import { fmtDay } from "@/lib/time";
import { PrivacyChoicesButton } from "./PrivacyChoicesButton";

const description =
  "What this site collects, why, where it’s stored and how to ask for it to be deleted.";

export const metadata: Metadata = {
  title: "Privacy",
  description,
  alternates: { canonical: "/privacy" },
  // Without its own openGraph the page would share the home page's og:url and title.
  openGraph: {
    type: "website",
    title: "Privacy policy",
    description,
    url: "/privacy",
  },
};

export default async function PrivacyPage() {
  const privacy = await getPrivacy();
  return (
    <section className="plain-page gutter">
      <StaticTopo seed="privacy" cx={1050} cy={120} n={20} />
      <p className="eyebrow accent" data-reveal>
        Privacy policy{privacy.updated ? ` · updated ${fmtDay(privacy.updated)}` : ""}
      </p>
      <h1 data-split>
        Your data, <em>kept small.</em>
      </h1>
      <p className="lede" data-reveal>
        No tracking cookies by default, no selling data, and contact messages are deleted after{" "}
        {privacy.retentionMonths ?? 12} months.
      </p>
      <div className="plain-actions" data-reveal>
        <PrivacyChoicesButton />
      </div>
      <RichText data={privacy.policy} />
      <SiteMotion />
    </section>
  );
}

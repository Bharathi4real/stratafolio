import type { Metadata } from "next";
import { SiteMotion } from "@/components/providers/SiteMotion";
import { Pill } from "@/components/ui/Pill";
import { StaticTopo } from "@/components/ui/Topo";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="plain-page gutter" style={{ minHeight: "80svh" }}>
      <StaticTopo seed="404" cx={900} cy={360} n={22} />
      <p className="eyebrow">
        <span className="nf-code">404</span> / Page not found
      </p>
      <h1>
        Lost in the <em>strata.</em>
      </h1>
      <p className="lede">
        This page doesn’t exist, or it moved. The surface is a good place to start again.
      </p>
      <div className="plain-actions">
        <Pill href="/" variant="accent" large arrow="↗">
          Back home
        </Pill>
        <Pill href="/blog" variant="ghost" large>
          Read the blog
        </Pill>
      </div>
      <SiteMotion />
    </section>
  );
}

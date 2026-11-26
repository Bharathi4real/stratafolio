import type { Metadata } from "next";
import { SiteMotion } from "@/components/providers/SiteMotion";
import { Pill } from "@/components/ui/Pill";
import { StaticTopo } from "@/components/ui/Topo";

export const metadata: Metadata = { title: "Post not found" };

export default function BlogNotFound() {
  return (
    <section className="plain-page gutter" style={{ minHeight: "80svh" }}>
      <StaticTopo seed="404" cx={900} cy={360} n={22} />
      <p className="eyebrow">
        <span className="nf-code">404</span> / Post not found
      </p>
      <h1>
        Lost in the <em>strata.</em>
      </h1>
      <p className="lede">
        This post doesn’t exist, or it moved. The archive is a good place to start.
      </p>
      <div className="plain-actions">
        <Pill href="/blog" variant="accent" large arrow="↗">
          All posts
        </Pill>
      </div>
      <SiteMotion />
    </section>
  );
}

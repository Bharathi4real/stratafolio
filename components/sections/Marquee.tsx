import { Fragment } from "react";
import type { MarqueeBlock } from "@/lib/content/schema";

export function Marquee({ block }: { block: MarqueeBlock }) {
  const items = block.items ?? [];
  if (!items.length) return null;
  const run = (copy: number) =>
    items.map((it) => (
      <Fragment key={`${copy}-${it}`}>
        <span>{it}</span>
        <b>✦</b>
      </Fragment>
    ));
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {run(0)}
        {run(1)}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StaticTopo } from "@/components/ui/Topo";

/** Site error screen: same family as the 404, with a retry and a reference for support. */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="plain-page gutter err-page" style={{ minHeight: "80svh" }}>
      <StaticTopo seed="500" cx={900} cy={360} n={22} />
      <p className="eyebrow">
        <span className="nf-code">500</span> / Something broke
      </p>
      <h1>
        Lost the <em>signal.</em>
      </h1>
      <p className="lede">
        This page hit an error while loading. Trying again usually fixes it. If it keeps happening,
        the rest of the site is still here.
      </p>
      <div className="plain-actions">
        <button type="button" className="pill pill-accent pill-lg" onClick={() => reset()}>
          Try again <span aria-hidden="true">↻</span>
        </button>
        <Link href="/" className="pill pill-ghost pill-lg">
          Back home
        </Link>
      </div>
      {error.digest ? <p className="err-ref mono">Reference {error.digest}</p> : null}
    </section>
  );
}

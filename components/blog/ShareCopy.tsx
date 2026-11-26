"use client";

import { useState } from "react";
import { Roll } from "@/components/ui/Pill";

export function ShareCopy() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="pill pill-ghost"
      type="button"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(location.href.split("#")[0]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2200);
        } catch {
          /* clipboard blocked */
        }
      }}
    >
      <Roll key={String(copied)}>{copied ? "Link copied ✓" : "Copy link"}</Roll>
    </button>
  );
}

"use client";

import { ArrowLabel } from "@/components/ui/Arrow";
import { scrollToTarget } from "@/lib/lenis";
import { setUI } from "@/lib/ui-store";

export function BackToTop({ label }: { label: string }) {
  return (
    <button type="button" className="footer-btn" onClick={() => scrollToTarget(0)}>
      <ArrowLabel label={label} />
    </button>
  );
}

export function PrivacyChoicesLink() {
  return (
    <button type="button" className="footer-btn" onClick={() => setUI({ consentOpen: true })}>
      Privacy choices
    </button>
  );
}

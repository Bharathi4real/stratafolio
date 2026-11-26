"use client";

import { Pill } from "@/components/ui/Pill";
import { setUI } from "@/lib/ui-store";

export function PrivacyChoicesButton() {
  return (
    <Pill variant="ghost" onClick={() => setUI({ consentOpen: true })}>
      Privacy choices
    </Pill>
  );
}

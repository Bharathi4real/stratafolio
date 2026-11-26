"use client";

import { useState } from "react";

export function CopyCode({ text }: { text: string }) {
  const [label, setLabel] = useState("Copy");
  return (
    <button
      type="button"
      aria-live="polite"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setLabel("Copied ✓");
        } catch {
          setLabel("Select & copy");
        }
        setTimeout(() => setLabel("Copy"), 1800);
      }}
    >
      {label}
    </button>
  );
}

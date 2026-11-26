"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * In draft mode the admin's preview iframe posts `b4:refresh` after each autosave;
 * the page re-renders with the new draft without a full reload (scroll position is kept).
 */
export function LivePreview() {
  const router = useRouter();
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin) return;
      if (e.data?.type === "b4:refresh") router.refresh();
      if (e.data?.type === "b4:scroll" && typeof e.data.anchor === "string")
        document
          .getElementById(e.data.anchor)
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);
  return null;
}

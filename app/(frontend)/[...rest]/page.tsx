import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Page not found" };

/**
 * This route only ever renders the 404, so there is nothing to validate for instant
 * navigation (Cache Components); the not-found page itself is prerendered.
 */
export const instant = false;

/** Unmatched URLs render the site's own 404 (with header and footer) instead of the bare default. */
export default function CatchAll() {
  notFound();
}

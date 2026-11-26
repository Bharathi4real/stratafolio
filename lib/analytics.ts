"use client";

import { uiStore } from "./ui-store";

/** Custom events. Never send names, emails, message text or query strings. */
export type EventName =
  | "resume_download"
  | "contact_submit"
  | "contact_error"
  | "email_copy"
  | "social_click"
  | "case_study_open"
  | "blog_post_open"
  | "blog_read_complete"
  | "blog_filter"
  | "blog_search"
  | "theme_toggle"
  | "menu_open";

type Props = Record<string, string | number | boolean>;

export function track(name: EventName, props?: Props) {
  if (typeof window === "undefined") return;
  // Vercel Web Analytics (cookieless). Custom events need a paid plan; the call is a no-op otherwise.
  const va = (window as unknown as { va?: (e: string, p: unknown) => void }).va;
  va?.("event", { name, data: props });
  // GA4 only after opt-in.
  const gtag = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  if (gtag && uiStore.state.consent?.analytics) gtag("event", name, props);
}

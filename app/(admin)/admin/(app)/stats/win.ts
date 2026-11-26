import type { WinInfo } from "@/components/admin/stats/StatsView";
import type { Win } from "@/lib/admin/stats";

/** The serializable bits of a stats window for client components. */
export const winInfo = (w: Win): WinInfo => ({
  key: w.key,
  label: w.label,
  query: w.query,
  fromDay: w.fromDay,
  toDay: w.toDay,
  bucket: w.bucket,
  hasPrevious: Boolean(w.previous),
});

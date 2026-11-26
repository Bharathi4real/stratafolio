/** Months between a start date and an end date (or now), inclusive of the start month. */
export function monthsBetween(start: string | Date, end?: string | Date | null) {
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  return Math.max(
    1,
    (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + (end ? 0 : 1),
  );
}

export function fmtDuration(mos: number) {
  const y = Math.floor(mos / 12);
  const r = mos % 12;
  return (
    [y ? `${y} yr${y > 1 ? "s" : ""}` : "", r ? `${r} mo${r > 1 ? "s" : ""}` : ""]
      .filter(Boolean)
      .join(" ") || "New"
  );
}

export function fmtTenure(mos: number) {
  return `${Math.floor(mos / 12)}y${mos % 12 ? ` ${mos % 12}m` : ""}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const fmtMonth = (d: string | Date) => {
  const x = new Date(d);
  return `${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};
export const fmtDay = (d: string | Date) => {
  const x = new Date(d);
  return `${MONTHS[x.getUTCMonth()]} ${String(x.getUTCDate()).padStart(2, "0")}, ${x.getUTCFullYear()}`;
};

/** Formatting helpers shared by server and client admin code. */

export const timeAgo = (iso: string | Date) => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  if (s < 172800) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export const fmtBytes = (b: number) =>
  b < 1024
    ? `${b} B`
    : b < 1024 ** 2
      ? `${(b / 1024).toFixed(0)} KB`
      : b < 1024 ** 3
        ? `${(b / 1024 ** 2).toFixed(1)} MB`
        : `${(b / 1024 ** 3).toFixed(2)} GB`;

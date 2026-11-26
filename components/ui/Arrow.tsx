/** Stroke icons used wherever the UI used to print text arrows (→ ↗ ↓ ← ↑ ›). */
export type ArrowDir =
  | "right"
  | "left"
  | "up"
  | "down"
  | "out"
  | "in"
  | "next"
  | "prev"
  | "download";

const PATHS: Record<ArrowDir, string> = {
  right: "M5 12h14M13 6l6 6-6 6",
  left: "M19 12H5M11 6l-6 6 6 6",
  up: "M12 19V5M6 11l6-6 6 6",
  down: "M12 5v14M6 13l6 6 6-6",
  out: "M7 17 17 7M8 7h9v9",
  in: "M7 7l10 10M17 8v9H8",
  next: "m9 6 6 6-6 6",
  prev: "m15 6-6 6 6 6",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
};

export function Arrow({ dir = "right", className = "" }: { dir?: ArrowDir; className?: string }) {
  return (
    <svg
      className={`ico-arrow ${className}`.trim()}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[dir]} />
    </svg>
  );
}

const TRAIL: Record<string, ArrowDir> = {
  "→": "right",
  "←": "left",
  "↑": "up",
  "↓": "down",
  "⬇": "download",
  "↗": "out",
  "↘": "in",
  "›": "next",
};

/**
 * Splits a label typed in the admin ("View work →", "Back to top ↑") into its text and an icon,
 * so editors can keep typing arrows while the site renders real icons.
 */
export function splitArrow(label: string): { text: string; dir: ArrowDir | null } {
  const m = label.match(/\s*([→←↑↓⬇↗↘›])\s*$/);
  if (m) return { text: label.slice(0, m.index).trimEnd(), dir: TRAIL[m[1]] };
  const lead = label.match(/^\s*([←])\s*/);
  if (lead) return { text: label.slice(lead[0].length), dir: "left" };
  return { text: label, dir: null };
}

/** An arrow given as a character ("→") or a direction name, as an icon. */
export function toArrowDir(a: string): ArrowDir | null {
  return TRAIL[a] ?? ((a in PATHS ? a : null) as ArrowDir | null);
}

/** A CMS label rendered with its arrow as an icon. */
export function ArrowLabel({ label }: { label: string }) {
  const { text, dir } = splitArrow(label);
  return (
    <>
      {text}
      {dir ? (
        <>
          {" "}
          <Arrow dir={dir} />
        </>
      ) : null}
    </>
  );
}

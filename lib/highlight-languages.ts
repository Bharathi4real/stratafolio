/** Languages registered with TanStack Highlight. Add one here and in lib/highlight.ts. */
export const LANGUAGES = [
  { value: "ts", label: "TypeScript" },
  { value: "tsx", label: "TSX" },
  { value: "css", label: "CSS" },
  { value: "json", label: "JSON" },
  { value: "shell", label: "Shell" },
  { value: "text", label: "Plain text" },
] as const;

export type LanguageId = (typeof LANGUAGES)[number]["value"];

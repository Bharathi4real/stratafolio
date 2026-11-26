import { Fragment } from "react";

/** Renders `*accent*` as a light-weight <em> (the site never uses italics). */
export function Accent({ text, emClassName }: { text?: string | null; emClassName?: string }) {
  if (!text) return null;
  const parts = text.split(/\*(.+?)\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of a string
          <em key={i} className={emClassName}>
            {part}
          </em>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of a string
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** Renders `**phrase**` as <b>. */
export function Bold({ text }: { text?: string | null }) {
  if (!text) return null;
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of a string
          <b key={i}>{part}</b>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: static split of a string
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export const plain = (s?: string | null) => (s ?? "").replace(/\*+/g, "");

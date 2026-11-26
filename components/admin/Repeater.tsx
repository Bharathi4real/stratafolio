"use client";

import type { ReactNode } from "react";
import { Arrow } from "@/components/ui/Arrow";

/** UI shell for array fields: numbered items with move up/down and remove, plus an add button. */
export function Repeater({
  label,
  count,
  onAdd,
  addLabel = "+ Add",
  children,
  max,
}: {
  label: string;
  count: number;
  onAdd: () => void;
  addLabel?: string;
  children: ReactNode;
  max?: number;
}) {
  return (
    <div className="rep">
      <div className="rep-h">
        <span className="rep-label">{label}</span>
        <span className="mono subtle">{String(count).padStart(2, "0")}</span>
      </div>
      <div className="rep-items">{children}</div>
      {max === undefined || count < max ? (
        <button className="btn btn-sm rep-add" type="button" onClick={onAdd}>
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

export function RepItem({
  index,
  total,
  title,
  onMove,
  onRemove,
  children,
}: {
  index: number;
  total: number;
  title?: string;
  onMove: (to: number) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rep-item">
      <div className="rep-item-h">
        <span className="b-n">{String(index + 1).padStart(2, "0")}</span>
        <span className="rep-title">{title}</span>
        <button
          className="icon-btn"
          type="button"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          <Arrow dir="up" />
        </button>
        <button
          className="icon-btn"
          type="button"
          aria-label="Move down"
          disabled={index === total - 1}
          onClick={() => onMove(index + 1)}
        >
          <Arrow dir="down" />
        </button>
        <button className="icon-btn" type="button" aria-label="Remove" onClick={onRemove}>
          ✕
        </button>
      </div>
      <div className="rep-item-b">{children}</div>
    </div>
  );
}

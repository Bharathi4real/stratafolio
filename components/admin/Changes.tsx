"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  discardAll,
  discardPending,
  type PendingRef,
  pendingChanges,
  pendingDiff,
  publishAll,
  publishPending,
} from "@/lib/admin/actions";
import { confirmDialog, flashToast, setAdmin, toast, useAdmin } from "@/lib/admin/store";
import type { Change } from "@/lib/content/diff";
import { type LineOp, lineDiff, type Seg, wordDiff } from "@/lib/content/diff";
import { Modal } from "./media";
import { Spinner } from "./overlays";

const KIND: Record<Change["kind"], string> = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
};

/** Field-by-field changes; long text gets word-level highlights (ins / del). */
export function ChangeList({ changes, empty }: { changes: Change[]; empty?: string }) {
  if (!changes.length) return <p className="muted diff-empty">{empty ?? "No differences."}</p>;
  return (
    <ol className="diff">
      {changes.map((c, i) => (
        <li key={i} className={`diff-row is-${c.kind}`}>
          <div className="diff-h">
            <b>{c.path}</b>
            <span className={`diff-kind is-${c.kind}`}>{KIND[c.kind]}</span>
          </div>
          {c.kind === "changed" && c.before && c.after && (c.before + c.after).includes("\n") ? (
            <LineDiff ops={lineDiff(c.before, c.after)} />
          ) : c.kind === "changed" &&
            c.before &&
            c.after &&
            (c.before.length + c.after.length > 60 || c.before.includes(" ")) ? (
            <p className="diff-words">
              <Segs segs={wordDiff(c.before, c.after)} />
            </p>
          ) : (c.before ?? c.after ?? "").includes("\n") ? (
            <LineDiff
              ops={(c.after ?? c.before ?? "")
                .split("\n")
                .map((s) => ({ t: c.kind === "removed" ? "del" : "add", s }) as LineOp)}
            />
          ) : (
            <div className="diff-vals">
              {c.before ? (
                <p className="diff-before">
                  <del>{c.before}</del>
                </p>
              ) : null}
              {c.after ? (
                <p className="diff-after">
                  <ins>{c.after}</ins>
                </p>
              ) : null}
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

function Segs({ segs }: { segs: Seg[] }) {
  return (
    <>
      {segs.map((s, j) =>
        s.t === "same" ? (
          <span key={j}>{s.s}</span>
        ) : s.t === "add" ? (
          <ins key={j}>{s.s}</ins>
        ) : (
          <del key={j}>{s.s}</del>
        ),
      )}
    </>
  );
}

/** Paragraph-by-paragraph diff for rich text: edited lines show word highlights. */
function LineDiff({ ops }: { ops: LineOp[] }) {
  return (
    <ol className="diff-lines">
      {ops.map((o, k) => {
        const key = `${k}-${o.t}`;
        if (o.t === "skip")
          return (
            <li key={key} className="dl-skip">
              {o.n} unchanged {o.n === 1 ? "paragraph" : "paragraphs"}
            </li>
          );
        if (o.t === "changed")
          return (
            <li key={key} className="dl-changed">
              <span className="dl-mark" aria-hidden="true">
                ~
              </span>
              <span className="sr-only">Edited: </span>
              <p>
                <Segs segs={o.segs} />
              </p>
            </li>
          );
        return (
          <li key={key} className={`dl-${o.t}`}>
            <span className="dl-mark" aria-hidden="true">
              {o.t === "add" ? "+" : o.t === "del" ? "−" : ""}
            </span>
            <p>{o.t === "del" ? <del>{o.s}</del> : o.t === "add" ? <ins>{o.s}</ins> : o.s}</p>
          </li>
        );
      })}
    </ol>
  );
}

type Pending = Awaited<ReturnType<typeof pendingChanges>>[number];
const refOf = (p: Pending): PendingRef =>
  p.kind === "global" ? { kind: "global", key: p.key } : { kind: "entry", id: p.id };
const keyOf = (p: Pending) => (p.kind === "global" ? `g:${p.key}` : `e:${p.id}`);

/** "Review changes" panel: every unpublished draft with its diff, publish/discard per item or all. */
export function ReviewHost({ canPublish }: { canPublish: boolean }) {
  const open = useAdmin((s) => s.reviewOpen);
  const close = () => setAdmin({ reviewOpen: false });
  const router = useRouter();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["pending", "review", open],
    queryFn: () => pendingChanges(),
    enabled: open,
  });
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    await qc.invalidateQueries();
    router.refresh();
  };
  const act = async (p: Pending, what: "publish" | "discard") => {
    setBusy(`${what}:${keyOf(p)}`);
    const r = await (what === "publish" ? publishPending(refOf(p)) : discardPending(refOf(p)));
    setBusy(null);
    if (!r.ok) return toast(r.error, "error");
    toast(what === "publish" ? `${p.label} published.` : `${p.label}: draft discarded.`);
    await refresh();
  };

  return (
    <Modal open={open} onClose={close} title="Review unpublished changes" wide>
      {isLoading ? (
        <p className="muted">
          <Spinner /> Loading changes…
        </p>
      ) : data.length === 0 ? (
        <p className="muted diff-empty">Everything is published. Nothing to review.</p>
      ) : (
        <>
          <p className="hint" style={{ marginBottom: "1rem" }}>
            Each item is a draft that visitors don’t see yet. Open one to see exactly what changed.
          </p>
          <ul className="review">
            {data.map((p) => (
              <ReviewItem
                key={keyOf(p)}
                p={p}
                canPublish={canPublish}
                busy={busy}
                onAct={act}
                onOpen={close}
              />
            ))}
          </ul>
          {canPublish ? (
            <div className="review-foot">
              <span className="muted">
                {data.length} draft{data.length === 1 ? "" : "s"}
              </span>
              <span className="bulk-gap" />
              <button
                type="button"
                className="btn btn-sm btn-ghost-danger"
                disabled={Boolean(busy) || !data.some((p) => !(p.kind === "entry" && p.isNew))}
                onClick={() =>
                  confirmDialog({
                    title: "Discard every draft?",
                    body: "All unpublished changes go back to their live versions. New, never-published posts and projects are kept. Drafts stay in each page’s Versions.",
                    confirmLabel: "Discard all",
                    busyLabel: "Discarding…",
                    tone: "danger",
                    action: async () => {
                      const r = await discardAll();
                      if (!r.ok) throw new Error(r.error);
                      flashToast(`${r.data?.discarded ?? 0} drafts discarded.`);
                      close();
                      location.reload();
                    },
                  })
                }
              >
                Discard all
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={Boolean(busy)}
                onClick={async () => {
                  setBusy("all");
                  const r = await publishAll();
                  setBusy(null);
                  if (!r.ok) return toast(r.error, "error");
                  toast("Everything published and live.");
                  await refresh();
                  close();
                }}
              >
                {busy === "all" ? (
                  <>
                    <Spinner /> Publishing…
                  </>
                ) : (
                  "Publish all"
                )}
              </button>
            </div>
          ) : null}
        </>
      )}
    </Modal>
  );
}

function ReviewItem({
  p,
  canPublish,
  busy,
  onAct,
  onOpen,
}: {
  p: Pending;
  canPublish: boolean;
  busy: string | null;
  onAct: (p: Pending, what: "publish" | "discard") => void;
  onOpen: () => void;
}) {
  const [show, setShow] = useState(false);
  const diff = useQuery({
    queryKey: ["pending", "diff", keyOf(p)],
    queryFn: () => pendingDiff(refOf(p)),
    enabled: show,
  });
  const isNew = p.kind === "entry" && p.isNew;
  return (
    <li className="review-item">
      <div className="review-row">
        <button
          type="button"
          className="review-toggle"
          aria-expanded={show}
          onClick={() => setShow((s) => !s)}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
          <span>
            <b>{p.label}</b>
            <small>{isNew ? "New, never published" : "Draft changes"}</small>
          </span>
        </button>
        <div className="review-acts">
          <Link className="btn btn-sm" href={p.href} onClick={onOpen}>
            Open editor
          </Link>
          {!isNew ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost-danger"
              disabled={Boolean(busy)}
              onClick={() => onAct(p, "discard")}
            >
              {busy === `discard:${keyOf(p)}` ? <Spinner /> : null} Discard
            </button>
          ) : null}
          {canPublish ? (
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={Boolean(busy)}
              onClick={() => onAct(p, "publish")}
            >
              {busy === `publish:${keyOf(p)}` ? <Spinner /> : null} Publish
            </button>
          ) : null}
        </div>
      </div>
      {show ? (
        <div className="review-diff">
          {diff.isLoading ? (
            <p className="muted">
              <Spinner /> Comparing with the live version…
            </p>
          ) : (
            <ChangeList changes={diff.data ?? []} empty="The draft matches the live version." />
          )}
        </div>
      ) : null}
    </li>
  );
}

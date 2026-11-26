"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  clearAutosaves,
  listVersionsAction,
  restoreVersionAction,
  versionDiff,
} from "@/lib/admin/actions";
import { confirmDialog, flashToast, setAdmin, toast, useAdmin } from "@/lib/admin/store";
import { useHotkey } from "@/lib/hotkeys";
import { ChangeList } from "./Changes";
import { Modal } from "./media";
import { Spinner } from "./overlays";
import { Btn, PageHead, Seg, Status, timeAgo } from "./ui";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Page head for any editable document: draft/published status, versions, discard and publish.
 * Mod+S publishes (after flushing the pending autosave).
 */
export function EditorChrome({
  title,
  accent,
  desc,
  published,
  hasDraft,
  versionsRef,
  flush,
  publish,
  discard,
  resetToDefault,
  draft = null,
  onRestored,
  cancel,
  alwaysPublishable = false,
  publishLabel = "Publish",
  canPublish = true,
  publishNote,
  children,
}: {
  title: string;
  accent?: string;
  desc?: ReactNode;
  published: boolean;
  hasDraft: boolean;
  versionsRef: string;
  flush: () => Promise<void>;
  publish: () => Promise<Result>;
  discard?: () => Promise<Result>;
  /** Settings pages: load the starter content as a draft. */
  resetToDefault?: () => Promise<Result>;
  /** Unpublished changes as last reported by autosave (null = as loaded with the page). */
  draft?: boolean | null;
  onRestored?: (data: unknown, draft: boolean) => void;
  /** Collection entries: deletes a never-published entry and returns to the list. */
  cancel?: () => Promise<Result>;
  /** Keep Publish enabled even without edits (e.g. "Publish now" on a scheduled post). */
  alwaysPublishable?: boolean;
  publishLabel?: string;
  /**
   * False for authors: no Publish button (or Mod+S publish), just a note that an editor will
   * publish. UI only; the server refuses the publish anyway.
   */
  canPublish?: boolean;
  /** Shown instead of the Publish button when `canPublish` is false. */
  publishNote?: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  const doPublish = async () => {
    if (!canPublish) return;
    setBusy(true);
    await flush();
    const r = await publish();
    setBusy(false);
    if (r.ok) {
      toast("Published and live.");
      setAdmin({ save: "idle" });
      await qc.invalidateQueries();
      router.refresh();
    } else toast(r.error, "error");
  };

  const askDiscard = async () => {
    if (!discard) return;
    await confirmDialog({
      title: "Discard unpublished changes?",
      body: "The editor goes back to the live version. The draft stays in Versions if you need it later.",
      confirmLabel: "Discard draft",
      busyLabel: "Discarding…",
      tone: "danger",
      action: async () => {
        const r = await discard();
        if (!r.ok) throw new Error(r.error);
        flashToast("Changes discarded. Showing the live version.");
        location.reload();
      },
    });
  };

  // Edits typed but not yet autosaved also count as changes.
  const save = useAdmin((s) => s.save);
  const unsaved = save === "dirty" || save === "saving" || save === "error";
  const hasChanges = alwaysPublishable || !published || (draft ?? hasDraft) || unsaved;
  const canDiscard = Boolean(discard && published && ((draft ?? hasDraft) || unsaved));

  const askReset = async () => {
    if (!resetToDefault) return;
    await confirmDialog({
      title: "Reset this page to default?",
      body: "Every field goes back to the starter content. It saves as a draft, so the live site doesn’t change until you publish, and the current version stays in Versions.",
      confirmLabel: "Reset to default",
      busyLabel: "Resetting…",
      tone: "danger",
      action: async () => {
        const r = await resetToDefault();
        if (!r.ok) throw new Error(r.error);
        // Reload so rich-text editors pick up the new content; the toast survives the reload.
        flashToast("Reset to default. Review it, then publish or discard.");
        location.reload();
      },
    });
  };

  // Cancel a new entry: nothing was ever published, so remove it instead of keeping a draft.
  const canCancel = Boolean(cancel && !published);
  const doCancel = async () => {
    if (!cancel) return;
    const back = pathname.replace(/\/[^/]+$/, "") || "/admin";
    const leave = async () => {
      const r = await cancel();
      if (!r.ok) throw new Error(r.error);
      toast.info("Cancelled. Nothing was saved.");
      void qc.invalidateQueries();
      router.replace(back);
      router.refresh();
    };
    // Untouched since it was created (only the "Created" version, nothing pending): just go.
    const history = await listVersionsAction(versionsRef).catch(() => []);
    const edited = unsaved || history.length > 1 || draft === true;
    if (!edited) {
      try {
        await leave();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Couldn’t cancel.", "error");
      }
      return;
    }
    await confirmDialog({
      title: "Discard this new entry?",
      body: "It has never been published. Cancelling deletes it along with everything typed so far, so it won’t stay behind as a draft.",
      confirmLabel: "Discard and leave",
      busyLabel: "Discarding…",
      tone: "danger",
      action: leave,
    });
  };

  useHotkey(
    "Mod+S",
    (e) => {
      e.preventDefault();
      if (!canPublish) {
        void flush().then(() => toast.info(publishNote ?? "Saved as a draft."));
        return;
      }
      if (hasChanges) void doPublish();
      else toast.info("Nothing to publish. Everything here is live.");
    },
    { ignoreInputs: false },
  );

  return (
    <>
      <PageHead title={title} accent={accent} desc={desc}>
        {!published ? (
          <Status>Not published</Status>
        ) : (draft ?? hasDraft) ? (
          <Status tone="changed">Draft changes</Status>
        ) : (
          <Status tone="pub">Published</Status>
        )}
        <Btn onClick={() => setShowVersions(true)}>Versions</Btn>
        {canDiscard ? <Btn onClick={askDiscard}>Discard changes</Btn> : null}
        {resetToDefault ? <Btn onClick={askReset}>Reset to default</Btn> : null}
        {children}
        {canCancel ? <Btn onClick={doCancel}>Cancel</Btn> : null}
        {canPublish ? (
          <Btn
            primary
            disabled={busy || !hasChanges}
            onClick={doPublish}
            title={hasChanges ? undefined : "No changes to publish"}
          >
            {busy ? "Publishing…" : hasChanges ? publishLabel : "Published"}
          </Btn>
        ) : (
          <span className="mono subtle">{publishNote ?? "Someone else publishes this."}</span>
        )}
      </PageHead>
      <Versions
        open={showVersions}
        refKey={versionsRef}
        canDiscard={canDiscard}
        hasDraft={Boolean(draft ?? hasDraft)}
        onDiscard={async () => {
          setShowVersions(false);
          await askDiscard();
        }}
        onClose={() => setShowVersions(false)}
        flush={flush}
        onRestored={(d, isDraft) => {
          setShowVersions(false);
          onRestored?.(d, isDraft);
        }}
      />
    </>
  );
}

function Versions({
  open,
  refKey,
  canDiscard,
  hasDraft,
  onDiscard,
  onClose,
  flush,
  onRestored,
}: {
  open: boolean;
  refKey: string;
  canDiscard: boolean;
  hasDraft: boolean;
  onDiscard: () => void;
  onClose: () => void;
  flush: () => Promise<void>;
  onRestored: (data: unknown, draft: boolean) => void;
}) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["versions", refKey, open],
    queryFn: () => listVersionsAction(refKey),
    enabled: open,
  });
  const autosaves = data.filter((v) => v.label === "Autosave").length;
  const clear = () =>
    confirmDialog({
      title: `Clear ${autosaves} autosave${autosaves === 1 ? "" : "s"}?`,
      body: hasDraft
        ? "Published versions are kept, and so is your current draft. Only the saved-while-typing snapshots go."
        : "Published versions are kept. Only the saved-while-typing snapshots go.",
      confirmLabel: "Clear autosaves",
      busyLabel: "Clearing…",
      tone: "danger",
      action: async () => {
        const r = await clearAutosaves(refKey);
        if (!r.ok) throw new Error(r.error);
        await qc.invalidateQueries({ queryKey: ["versions", refKey] });
        toast(`${r.data?.cleared ?? 0} autosaves cleared.`);
      },
    });
  return (
    <Modal open={open} onClose={onClose} title="Versions" wide>
      <div className="versions-head">
        <p className="hint">
          Autosaves from one editing session are merged into one, and the last 10 are kept;
          publishes are kept up to 40. Open one to see what it changed. Restoring copies it into the
          draft; publish to make it live.
        </p>
        {autosaves ? (
          <button type="button" className="btn btn-sm" onClick={clear}>
            Clear autosaves
          </button>
        ) : null}
        {canDiscard ? (
          <button type="button" className="btn btn-sm btn-ghost-danger" onClick={onDiscard}>
            Discard current draft
          </button>
        ) : null}
      </div>
      {isLoading ? (
        <p className="muted">
          <Spinner /> Loading versions…
        </p>
      ) : (
        <ul className="versions-list">
          {data.length === 0 ? <li className="muted">No versions yet.</li> : null}
          {data.map((v, i) => (
            <VersionRow key={v.id} v={v} latest={i === 0} flush={flush} onRestored={onRestored} />
          ))}
        </ul>
      )}
    </Modal>
  );
}

function VersionRow({
  v,
  latest,
  flush,
  onRestored,
}: {
  v: { id: number; label: string; createdAt: string };
  latest: boolean;
  flush: () => Promise<void>;
  onRestored: (data: unknown, draft: boolean) => void;
}) {
  const [show, setShow] = useState(false);
  const [against, setAgainst] = useState<"previous" | "live">("previous");
  const [restoring, setRestoring] = useState(false);
  const diff = useQuery({
    queryKey: ["versions", "diff", v.id, against],
    queryFn: () => versionDiff(v.id, against),
    enabled: show,
  });
  const label = v.label === "Autosave" ? "Draft saved" : v.label;
  return (
    <li className={`version${show ? " is-open" : ""}`}>
      <div className="version-row">
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
            <b>
              {label}
              {latest ? <em className="version-tag">Latest</em> : null}
            </b>
            <small>
              {timeAgo(v.createdAt)} ·{" "}
              {new Date(v.createdAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </small>
          </span>
        </button>
        <div className="review-acts">
          <button
            className="btn btn-sm"
            type="button"
            disabled={restoring}
            onClick={async () => {
              setRestoring(true);
              // Pending edits must land first, or a late autosave overwrites the restore.
              const r = await flush()
                .then(() => restoreVersionAction(v.id))
                .catch((e: unknown) => ({ ok: false as const, error: String(e) }));
              setRestoring(false);
              if (r.ok && r.data) {
                toast(
                  r.data.draft
                    ? "Version restored to the draft. Publish to make it live."
                    : "Restored. It matches the live version, so there's nothing to publish.",
                );
                onRestored(r.data.data, r.data.draft);
              } else if (!r.ok) toast(r.error, "error");
            }}
          >
            {restoring ? (
              <>
                <Spinner /> Restoring…
              </>
            ) : (
              "Restore"
            )}
          </button>
        </div>
      </div>
      {show ? (
        <div className="review-diff">
          <div className="diff-against">
            <span className="mono subtle">Compare with</span>
            <Seg
              label="Compare with"
              value={against}
              onChange={setAgainst}
              options={[
                { value: "previous", label: "Previous save" },
                { value: "live", label: "Live site" },
              ]}
            />
          </div>
          {diff.isLoading ? (
            <p className="muted">
              <Spinner /> Comparing…
            </p>
          ) : (
            <>
              <p className="hint">Changes from {diff.data?.baseline} to this version:</p>
              <ChangeList changes={diff.data?.changes ?? []} empty="No differences." />
            </>
          )}
        </div>
      ) : null}
    </li>
  );
}

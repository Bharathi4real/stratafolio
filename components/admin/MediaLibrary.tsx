"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Arrow } from "@/components/ui/Arrow";
import { Sk } from "@/components/ui/Skeleton";
import {
  binCount,
  deleteMediaMany,
  deleteOrphans,
  emptyBin,
  getMediaItems,
  type MediaKind,
  mediaUsage,
  purgeMedia,
  restoreMedia,
  scanOrphans,
  setMediaBlur,
  updateMedia,
} from "@/lib/admin/actions";
import { confirmDialog, toast } from "@/lib/admin/store";
import { makeBlur } from "@/lib/blur";
import {
  Dropzone,
  type MediaItem,
  MediaMore,
  MediaSearch,
  Modal,
  Thumb,
  useMediaPages,
} from "./media";
import { Spinner } from "./overlays";
import { Btn, fmtBytes, PageHead } from "./ui";
import { announce, enqueue, UploadQueue } from "./uploads";

const KINDS: [MediaKind, string][] = [
  ["all", "All"],
  ["image", "Images"],
  ["pdf", "PDFs"],
  ["noalt", "Missing alt"],
];
const ext = (name: string) => name.split(".").pop()?.toUpperCase() ?? "";

const DAY = 86_400_000;
/** "Deletes in 12 days" / "Deletes today" for a binned file. 0 = the bin never auto-empties. */
const binLeft = (deletedAt: string | null, binDays: number) => {
  if (!deletedAt || !binDays) return "Kept until you empty the bin";
  const left = Math.ceil((new Date(deletedAt).getTime() + binDays * DAY - Date.now()) / DAY);
  return left <= 0
    ? "Deletes tonight"
    : left === 1
      ? "Deletes tomorrow"
      : `Deletes in ${left} days`;
};

/**
 * `canDelete` (media.delete): bin, restore, purge, orphans. `canEdit` (media.edit): rename and
 * alt/caption. UI only; the Server Actions check the same permissions.
 */
export function MediaLibrary({
  canDelete,
  canEdit,
  storage,
  binDays,
}: {
  canDelete: boolean;
  canEdit: boolean;
  storage: "r2" | "local";
  binDays: number;
}) {
  const qc = useQueryClient();
  const bin = useQuery({
    queryKey: ["media", "bin-count"],
    queryFn: () => binCount(),
    enabled: canDelete,
  });
  const [kind, setKind] = useState<MediaKind>("all");
  const inBin = kind === "bin";
  const [q, setQ] = useState("");
  const pages = useMediaPages({ kind, q });
  const [open, setOpen] = useState<MediaItem | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState<Set<number>>(new Set());

  const upload = (files: File[]) => {
    if (files.length) void announce(enqueue(files));
  };

  // Paste an image (e.g. a screenshot) anywhere on the page to upload it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: register once
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable]")) return;
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) {
        e.preventDefault();
        upload(files);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  // Backfill blurred previews for images uploaded before they existed (a few at a time, quietly).
  const tried = useRef(new Set<number>());
  useEffect(() => {
    const todo = pages.items
      .filter((m) => m.mime.startsWith("image/") && m.mime !== "image/svg+xml" && !m.blur)
      .filter((m) => !tried.current.has(m.id))
      .slice(0, 6);
    for (const m of todo) {
      tried.current.add(m.id);
      void makeBlur(m.url).then((b) => (b ? setMediaBlur(m.id, b) : undefined));
    }
  }, [pages.items]);

  // Drop selections that are no longer visible (filtered out or deleted).
  const visible = useMemo(() => new Set(pages.items.map((m) => m.id)), [pages.items]);
  useEffect(() => {
    setSelected((s) => {
      const next = new Set([...s].filter((id) => visible.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [visible]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const refresh = () => qc.invalidateQueries({ queryKey: ["media"] });

  /** Single or bulk delete: shows where files are used, then moves them to the bin (Undo in the toast). */
  const remove = async (items: MediaItem[]) => {
    if (!items.length) return;
    const ids = items.map((i) => i.id);
    const usage = await mediaUsage(ids);
    const used = items.filter((i) => usage[i.id]?.length);
    const one = items.length === 1;
    const details = used.flatMap((i) =>
      (usage[i.id] ?? []).map((where) => (one ? `Used in ${where}` : `${i.filename}: ${where}`)),
    );
    const keep = binDays ? `The bin empties itself after ${binDays} days.` : "";
    await confirmDialog({
      title: one
        ? `Move ${items[0].filename} to the bin?`
        : `Move ${items.length} files to the bin?`,
      body: used.length
        ? `${one ? "This file is" : `${used.length} of these files are`} still in use. Those places will show nothing until you restore it or pick another file. ${keep}`
        : `You can restore ${one ? "it" : "them"} from the bin. ${keep}`,
      details: details
        .slice(0, 8)
        .concat(details.length > 8 ? [`…and ${details.length - 8} more`] : []),
      confirmLabel: "Move to bin",
      busyLabel: "Moving…",
      tone: "danger",
      action: async () => {
        setDeleting(new Set(ids));
        try {
          const r = await deleteMediaMany(ids);
          if (!r.ok) throw new Error(r.error);
          await refresh();
          setSelected(new Set());
          setOpen((o) => (o && ids.includes(o.id) ? null : o));
          toast(
            one
              ? `${items[0].filename} moved to the bin.`
              : `${r.data?.deleted ?? ids.length} files moved to the bin.`,
            "ok",
            {
              action: {
                label: "Undo",
                run: async () => {
                  const u = await restoreMedia(ids);
                  if (!u.ok) return toast.error(u.error);
                  await refresh();
                  toast.success(one ? "File restored." : "Files restored.");
                },
              },
            },
          );
        } finally {
          setDeleting(new Set());
        }
      },
    });
  };

  const restore = async (items: MediaItem[]) => {
    const ids = items.map((i) => i.id);
    setDeleting(new Set(ids));
    try {
      const r = await restoreMedia(ids);
      if (!r.ok) return toast.error(r.error);
      await refresh();
      setSelected(new Set());
      toast.success(
        items.length === 1
          ? `${items[0].filename} restored.`
          : `${r.data?.restored} files restored.`,
      );
    } finally {
      setDeleting(new Set());
    }
  };

  const where = storage === "r2" ? "Cloudflare R2" : "public/uploads";
  const purge = async (items: MediaItem[]) => {
    const ids = items.map((i) => i.id);
    const one = items.length === 1;
    await confirmDialog({
      title: one ? `Delete ${items[0].filename} forever?` : `Delete ${items.length} files forever?`,
      body: `The ${one ? "file is" : "files are"} removed from ${where}. This can’t be undone.`,
      confirmLabel: "Delete forever",
      busyLabel: "Deleting…",
      tone: "danger",
      action: async () => {
        setDeleting(new Set(ids));
        try {
          const r = await purgeMedia(ids);
          if (!r.ok) throw new Error(r.error);
          await refresh();
          setSelected(new Set());
          if (r.data?.failed.length)
            toast.warn(`Couldn’t delete ${r.data.failed.join(", ")} from storage. Try again.`);
          else
            toast(
              `${r.data?.purged ?? 0} ${r.data?.purged === 1 ? "file" : "files"} deleted for good.`,
            );
        } finally {
          setDeleting(new Set());
        }
      },
    });
  };

  const empty = () =>
    confirmDialog({
      title: "Empty the bin?",
      body: `All ${bin.data ?? ""} files in the bin are removed from ${where}. This can’t be undone.`,
      confirmLabel: "Empty bin",
      busyLabel: "Emptying…",
      tone: "danger",
      typeToConfirm: (bin.data ?? 0) > 10 ? "empty" : undefined,
      action: async () => {
        const r = await emptyBin();
        if (!r.ok) throw new Error(r.error);
        await refresh();
        if (r.data?.failed.length)
          toast.warn(
            `${r.data.purged} deleted; ${r.data.failed.length} couldn’t be removed from storage.`,
          );
        else toast(`Bin emptied. ${r.data?.purged ?? 0} files deleted for good.`);
      },
    });

  const [scanning, setScanning] = useState(false);
  const orphans = async () => {
    setScanning(true);
    const r = await scanOrphans().finally(() => setScanning(false));
    if (!r.ok) return toast.error(r.error);
    const items = r.data?.items ?? [];
    if (!items.length)
      return toast.success(`Storage is clean. ${r.data?.scanned ?? 0} files checked, none stray.`);
    const total = items.reduce((a, o) => a + o.size, 0);
    await confirmDialog({
      title: `${items.length} stray ${items.length === 1 ? "file" : "files"} in storage`,
      body: `These are in ${where} but not in the library (left by failed uploads or old deletes), using ${fmtBytes(total)}. Delete them?`,
      details: items
        .slice(0, 8)
        .map((o) => `${o.key} · ${fmtBytes(o.size)}`)
        .concat(items.length > 8 ? [`…and ${items.length - 8} more`] : []),
      confirmLabel: "Delete stray files",
      busyLabel: "Deleting…",
      tone: "danger",
      action: async () => {
        const d = await deleteOrphans(items.map((o) => o.key));
        if (!d.ok) throw new Error(d.error);
        toast(`${d.data?.deleted ?? 0} stray files deleted.`);
      },
    });
  };

  const selectedItems = pages.items.filter((m) => selected.has(m.id));
  const allSelected = pages.items.length > 0 && selected.size === pages.items.length;

  return (
    <>
      <PageHead
        title="Media"
        accent="library"
        desc={
          storage === "r2"
            ? "Images, the résumé PDF and post covers. Stored on Cloudflare R2 (10 GB free, no egress fees). Add alt text to every image."
            : "Images, the résumé PDF and post covers. R2 isn’t configured, so files are saved locally in public/uploads (development only)."
        }
      />
      <Dropzone onFiles={upload} />
      <p className="hint drop-hint">Tip: paste a screenshot with ⌘V / Ctrl+V to upload it.</p>
      <UploadQueue
        onOpen={async (id) => {
          const [m] = await getMediaItems([id]);
          if (m) setOpen(m);
        }}
      />

      <div className="toolbar">
        <MediaSearch onSearch={setQ} />
        <div className="chips" role="radiogroup" aria-label="Filter files">
          {(canDelete
            ? [...KINDS, ["bin", `Bin${bin.data ? ` · ${bin.data}` : ""}`] as [MediaKind, string]]
            : KINDS
          ).map(([v, label]) => (
            <label key={v}>
              <input
                type="radio"
                name="mk"
                value={v}
                checked={kind === v}
                onChange={() => setKind(v)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {inBin ? (
        <div className="bin-bar">
          <span>
            {binDays
              ? `Files in the bin are deleted from ${where} after ${binDays} days. Change this in Settings → Analytics & privacy.`
              : "The bin never empties itself (Settings → Analytics & privacy)."}
          </span>
          <span className="bulk-gap" />
          <button type="button" className="btn btn-sm" onClick={orphans} disabled={scanning}>
            {scanning ? (
              <>
                <Spinner /> Checking…
              </>
            ) : (
              "Find stray files"
            )}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-danger"
            onClick={empty}
            disabled={!bin.data}
          >
            Empty bin
          </button>
        </div>
      ) : null}

      {selected.size ? (
        <div className="bulk-bar" role="toolbar" aria-label="Selected files">
          <b>{selected.size} selected</b>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(pages.items.map((m) => m.id)))
            }
          >
            {allSelected ? "Select none" : `Select all ${pages.items.length}`}
          </button>
          <span className="bulk-gap" />
          <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())}>
            Clear
          </button>
          {canDelete && inBin ? (
            <>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => restore(selectedItems)}
                disabled={deleting.size > 0}
              >
                Restore {selected.size}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger"
                onClick={() => purge(selectedItems)}
                disabled={deleting.size > 0}
              >
                Delete {selected.size} forever
              </button>
            </>
          ) : canDelete ? (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => remove(selectedItems)}
              disabled={deleting.size > 0}
            >
              {deleting.size ? (
                <>
                  <Spinner /> Moving…
                </>
              ) : (
                `Move ${selected.size} to bin`
              )}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="media-grid" aria-busy={pages.isFetching}>
        {pages.isLoading
          ? [0, 1, 2, 3, 4, 5].map((i) => (
              <div className="asset-sk" key={i} aria-hidden="true">
                <Sk h="auto" r="0" className="asset-sk-thumb" />
                <span className="asset-sk-meta">
                  <Sk w="70%" h=".8rem" />
                  <Sk w="40%" h=".6rem" />
                </span>
              </div>
            ))
          : null}
        {!pages.isLoading && pages.items.length === 0 ? (
          <p className="muted">
            {kind === "bin"
              ? "The bin is empty."
              : kind === "noalt"
                ? "Every image has alt text."
                : q || kind !== "all"
                  ? "No files match."
                  : "No files yet. Drop some above."}
          </p>
        ) : null}
        {pages.items.map((m) => {
          const isSel = selected.has(m.id);
          const isDel = deleting.has(m.id);
          return (
            <div
              key={m.id}
              className={`asset-card${isSel ? " is-selected" : ""}${isDel ? " is-deleting" : ""}`}
            >
              <button
                className="asset"
                type="button"
                onClick={() => (inBin ? toggle(m.id) : setOpen(m))}
                disabled={isDel}
              >
                <span className="thumb">
                  <Thumb item={m} />
                </span>
                <span className="meta">
                  <b title={m.filename}>{m.filename}</b>
                  <span>
                    {[ext(m.filename), fmtBytes(m.size), m.width ? `${m.width}×${m.height}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {inBin ? (
                    <span className="bin-left">{binLeft(m.deletedAt, binDays)}</span>
                  ) : m.mime.startsWith("image/") && !m.alt ? (
                    <span className="alt-miss">Missing alt text</span>
                  ) : null}
                </span>
              </button>
              <label className="asset-check" title={isSel ? "Deselect" : "Select"}>
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(m.id)}
                  aria-label={`Select ${m.filename}`}
                  disabled={isDel}
                />
                <span aria-hidden="true" />
              </label>
              {canDelete && inBin ? (
                <span className="asset-bin-acts">
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => restore([m])}
                    disabled={isDel}
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    className="asset-del is-static"
                    aria-label={`Delete ${m.filename} forever`}
                    title="Delete forever"
                    onClick={() => purge([m])}
                    disabled={isDel}
                  >
                    <TrashIcon />
                  </button>
                </span>
              ) : canDelete ? (
                <button
                  type="button"
                  className="asset-del"
                  aria-label={`Move ${m.filename} to the bin`}
                  title="Move to bin"
                  onClick={() => remove([m])}
                  disabled={isDel}
                >
                  <TrashIcon />
                </button>
              ) : null}
              {isDel ? (
                <span className="asset-busy" role="status">
                  <Spinner /> Working…
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      <MediaMore
        shown={pages.items.length}
        total={pages.total}
        hasNext={Boolean(pages.hasNextPage)}
        loading={pages.isFetchingNextPage}
        onMore={() => pages.fetchNextPage()}
      />
      <Modal open={Boolean(open)} onClose={() => setOpen(null)} title="File details" wide>
        {open ? (
          <MediaDetail
            key={open.id}
            item={open}
            canDelete={canDelete}
            canEdit={canEdit}
            deleting={deleting.has(open.id)}
            onDelete={() => remove([open])}
            onSaved={(m) => setOpen(m)}
          />
        ) : null}
      </Modal>
    </>
  );
}

export function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

const splitName = (name: string) => {
  const m = name.match(/^(.*?)(\.[a-z0-9]+)?$/i);
  return { base: m?.[1] ?? name, ext: m?.[2] ?? "" };
};

/** Two-column editor: big preview + details (name, alt, caption), metadata and where it's used. */
function MediaDetail({
  item,
  canDelete,
  canEdit,
  deleting,
  onDelete,
  onSaved,
}: {
  item: MediaItem;
  canDelete: boolean;
  canEdit: boolean;
  deleting: boolean;
  onDelete: () => void;
  onSaved: (m: MediaItem) => void;
}) {
  const qc = useQueryClient();
  const { base, ext: dotExt } = splitName(item.filename);
  const [name, setName] = useState(base);
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [saving, setSaving] = useState(false);
  const isImage = item.mime.startsWith("image/");
  const dirty = name !== base || alt !== item.alt || caption !== (item.caption ?? "");
  const usage = useQuery({
    queryKey: ["media", "usage", item.id],
    queryFn: async () => (await mediaUsage([item.id]))[item.id] ?? [],
  });

  const save = async () => {
    if (!canEdit || !dirty || saving) return;
    setSaving(true);
    const r = await updateMedia(item.id, { filename: name, alt, caption });
    setSaving(false);
    if (!r.ok || !r.data) {
      toast(r.ok ? "Couldn’t save." : r.error, "error");
      return;
    }
    await qc.invalidateQueries({ queryKey: ["media"] });
    onSaved(r.data);
    toast("Details saved.");
  };

  return (
    <form
      className="md"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      aria-busy={saving || deleting}
    >
      <div className={`md-preview${isImage ? " is-image" : ""}`}>
        <Thumb item={item} />
      </div>
      <div className="md-side">
        <div className="field">
          <label htmlFor="md-name">File name</label>
          <div className="md-name">
            <input
              id="md-name"
              className="inp"
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={!canEdit}
              spellCheck={false}
              required
            />
            {dotExt ? <span className="mono subtle">{dotExt}</span> : null}
          </div>
          <p className="hint">
            Shown in the library and used as the download name. The URL stays the same.
          </p>
        </div>
        {isImage ? (
          <div className="field">
            <label htmlFor="md-alt">
              Alt text {alt ? null : <span className="alt-miss">· missing</span>}
            </label>
            <textarea
              id="md-alt"
              className="inp"
              rows={3}
              maxLength={300}
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              readOnly={!canEdit}
              placeholder="e.g. Architecture diagram: Salesforce events flow through a queue to the verification worker"
            />
            <p className="hint md-count">
              <span>
                Describe what the image shows and why it matters. Screen readers read this aloud.
              </span>
              <span className="mono">{alt.length}/300</span>
            </p>
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="md-caption">Caption</label>
          <input
            id="md-caption"
            className="inp"
            maxLength={500}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            readOnly={!canEdit}
            placeholder="Optional. Used as the default caption when you insert this image"
          />
        </div>

        <dl className="md-meta">
          <div>
            <dt>Type</dt>
            <dd>{item.mime}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{fmtBytes(item.size)}</dd>
          </div>
          {item.width ? (
            <div>
              <dt>Dimensions</dt>
              <dd>
                {item.width} × {item.height}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Uploaded</dt>
            <dd>
              {new Date(item.createdAt).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
          <div className="md-url">
            <dt>URL</dt>
            <dd>
              <code title={item.url}>{item.url}</code>
              <button
                type="button"
                className="btn btn-sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(item.url);
                    toast("URL copied.");
                  } catch {
                    toast("Couldn’t copy. Select the URL and copy it manually.", "error");
                  }
                }}
              >
                Copy
              </button>
            </dd>
          </div>
          <div>
            <dt>Used in</dt>
            <dd>
              {usage.isLoading ? (
                <span className="subtle">Checking…</span>
              ) : usage.data?.length ? (
                <ul className="md-usage">
                  {usage.data.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              ) : (
                <span className="subtle">Not used anywhere yet</span>
              )}
            </dd>
          </div>
        </dl>

        <div className="md-acts">
          {canDelete ? (
            <button
              type="button"
              className="btn btn-sm btn-ghost-danger"
              onClick={onDelete}
              disabled={deleting || saving}
            >
              {deleting ? (
                <>
                  <Spinner /> Moving…
                </>
              ) : (
                <>
                  <TrashIcon /> Move to bin
                </>
              )}
            </button>
          ) : null}
          <span className="bulk-gap" />
          <Btn href={item.url} external>
            Open <Arrow dir="out" />
          </Btn>
          {canEdit ? (
            <button
              type="submit"
              className="btn btn-sm btn-primary"
              disabled={!dirty || saving || deleting}
            >
              {saving ? (
                <>
                  <Spinner /> Saving…
                </>
              ) : dirty ? (
                "Save changes"
              ) : (
                "Saved"
              )}
            </button>
          ) : null}
        </div>
      </div>
    </form>
  );
}

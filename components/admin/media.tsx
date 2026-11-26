"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Sk } from "@/components/ui/Skeleton";
import { getMediaItems, listMedia, type MediaKind } from "@/lib/admin/actions";
import { ACCEPT_ATTR } from "@/lib/media-rules";
import { useDebouncedCallback } from "@/lib/pacer";
import { useFieldContext } from "./form";
import { fmtBytes } from "./ui";
import { UploadQueue, useUploader } from "./uploads";

export type MediaItem = Awaited<ReturnType<typeof listMedia>>["items"][number];

/** The library, 40 files at a time (TanStack Query infinite query; "Load more" fetches the next page). */
export function useMediaPages({ kind = "all", q = "" }: { kind?: MediaKind; q?: string } = {}) {
  const query = useInfiniteQuery({
    queryKey: ["media", "pages", kind, q],
    queryFn: ({ pageParam }) => listMedia({ cursor: pageParam, kind, q }),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
  });
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  return { ...query, items, total };
}

/** A single file by id, for fields and image blocks (independent of which library pages are loaded). */
export function useMediaItem(id: number | null | undefined) {
  return useQuery({
    queryKey: ["media", "item", id],
    queryFn: async () => (await getMediaItems([id as number]))[0] ?? null,
    enabled: typeof id === "number" && id > 0,
    staleTime: 60_000,
  });
}

/** Debounced search box for the library and picker. */
export function MediaSearch({ onSearch }: { onSearch: (q: string) => void }) {
  return (
    <SearchBox
      onSearch={onSearch}
      placeholder="Search by file name or alt text…"
      label="Search media"
    />
  );
}

/** Debounced search input; the caller queries the server with the value. */
export function SearchBox({
  onSearch,
  placeholder,
  label,
}: {
  onSearch: (q: string) => void;
  placeholder: string;
  label: string;
}) {
  const [v, setV] = useState("");
  const push = useDebouncedCallback(onSearch, { wait: 250 });
  return (
    <input
      className="inp search-inp"
      type="search"
      placeholder={placeholder}
      aria-label={label}
      value={v}
      onChange={(e) => {
        setV(e.target.value);
        push(e.target.value);
      }}
    />
  );
}

/** "Showing 40 of 112" + Load more, under a media grid. */
export function MediaMore({
  shown,
  total,
  hasNext,
  loading,
  onMore,
}: {
  shown: number;
  total: number;
  hasNext: boolean;
  loading: boolean;
  onMore: () => void;
}) {
  if (!total) return null;
  return (
    <div className="load-more">
      <span className="mono subtle">
        Showing {shown} of {total}
      </span>
      {hasNext ? (
        <button className="btn btn-sm" type="button" onClick={onMore} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}

export { useUploader };

export function Dropzone({
  onFiles,
  compact,
}: {
  onFiles: (files: File[]) => void;
  compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  return (
    <label
      className={`dropzone${over ? " over" : ""}${compact ? " is-compact" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles([...e.dataTransfer.files]);
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M12 16V4m0 0-4 4m4-4 4 4M4 20h16" />
      </svg>
      <span>
        <b>Drop files</b> or click to upload · JPG, PNG, WebP, AVIF, SVG (sanitised), ICO, PDF · max
        10 MB
      </span>
      <input
        type="file"
        hidden
        multiple
        accept={ACCEPT_ATTR}
        onChange={(e) => {
          onFiles([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function Thumb({ item }: { item: Pick<MediaItem, "url" | "mime" | "filename" | "alt"> }) {
  if (item.mime.startsWith("image/"))
    // biome-ignore lint/performance/noImgElement: admin thumbnails, any origin
    return <img src={item.url} alt={item.alt || ""} loading="lazy" />;
  return <span className="doc-ic">{item.filename.split(".").pop()?.toUpperCase()}</span>;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  // Navigating keeps the old page alive but hidden; an open modal dialog would leave the whole
  // admin inert, so close it whenever this page is hidden or unmounted.
  useEffect(() => {
    const d = ref.current;
    return () => {
      if (d?.open) d.close();
    };
  }, []);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click; Esc closes via onCancel
    <dialog
      ref={ref}
      className={`modal${wide ? " is-wide" : ""}`}
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // click on the backdrop
      }}
    >
      <div className="modal-h">
        <h3>{title}</h3>
        <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="modal-b">{open ? children : null}</div>
    </dialog>
  );
}

/** Choose (or upload) one media item. */
export function MediaPicker({
  open,
  onClose,
  onPick,
  accept,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (m: MediaItem) => void;
  accept?: "image" | "pdf";
}) {
  const kind: MediaKind = accept ?? "all";
  const [q, setQ] = useState("");
  const pages = useMediaPages({ kind, q });
  const { upload } = useUploader();
  return (
    <Modal open={open} onClose={onClose} title="Choose from media" wide>
      <Dropzone
        compact
        onFiles={async (files) => {
          for (const f of files) {
            const r = await upload(f);
            if (r && files.length === 1) {
              const [fresh] = await getMediaItems([r.id]);
              if (fresh) onPick(fresh);
            }
          }
        }}
      />
      <UploadQueue />
      <div className="toolbar">
        <MediaSearch onSearch={setQ} />
      </div>
      <div className="media-grid">
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
          <p className="muted">{q ? "No files match." : "No files yet. Upload one above."}</p>
        ) : null}
        {pages.items.map((m) => (
          <button className="asset" type="button" key={m.id} onClick={() => onPick(m)}>
            <span className="thumb">
              <Thumb item={m} />
            </span>
            <span className="meta">
              <b>{m.filename}</b>
              <span className={m.alt ? "" : "alt-miss"}>
                {m.alt ? fmtBytes(m.size) : "Missing alt text"}
              </span>
            </span>
          </button>
        ))}
      </div>
      <MediaMore
        shown={pages.items.length}
        total={pages.total}
        hasNext={Boolean(pages.hasNextPage)}
        loading={pages.isFetchingNextPage}
        onMore={() => pages.fetchNextPage()}
      />
    </Modal>
  );
}

/** Form field holding a media id. */
export function MediaField({
  label,
  hint,
  accept,
}: {
  label: string;
  hint?: string;
  accept?: "image" | "pdf";
}) {
  const f = useFieldContext<number | null | undefined>();
  const { data: current } = useMediaItem(f.state.value);
  const [open, setOpen] = useState(false);
  return (
    <div className="field">
      <p className="flabel">{label}</p>
      <div className="media-field">
        {current ? (
          <span className="mf-thumb">
            <Thumb item={current} />
          </span>
        ) : null}
        <span className="mf-name">
          {current ? `${current.filename} · ${fmtBytes(current.size)}` : "None selected"}
        </span>
        <button className="btn btn-sm" type="button" onClick={() => setOpen(true)}>
          {current ? "Replace" : "Choose"}
        </button>
        {current ? (
          <button className="btn btn-sm" type="button" onClick={() => f.handleChange(null)}>
            Remove
          </button>
        ) : null}
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
      <MediaPicker
        open={open}
        accept={accept}
        onClose={() => setOpen(false)}
        onPick={(m) => {
          f.handleChange(m.id);
          setOpen(false);
        }}
      />
    </div>
  );
}

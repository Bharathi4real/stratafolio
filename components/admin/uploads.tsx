"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Store, useSelector } from "@tanstack/react-store";
import { createUpload, registerUpload } from "@/lib/admin/actions";
import { toast } from "@/lib/admin/store";
import { makeBlur } from "@/lib/blur";
import { uploadProblem } from "@/lib/media-rules";
import { fmtBytes } from "./ui";

/**
 * Upload queue (TanStack Store): every file gets a row with a preview, a real progress bar
 * (XHR upload events), and its own status. Three uploads run at once; the rest wait.
 * Flow per file: validate → presign → PUT to R2 (or the local dev endpoint) → register.
 */
export type UploadStatus = "queued" | "uploading" | "processing" | "done" | "error" | "canceled";
export type UploadItem = {
  id: number;
  file: File;
  name: string;
  size: number;
  mime: string;
  preview: string | null;
  progress: number;
  status: UploadStatus;
  error?: string;
  mediaId?: number;
};

const store = new Store<{ items: UploadItem[] }>({ items: [] });
const xhrs = new Map<number, XMLHttpRequest>();
const waiters = new Map<number, (r: { id: number; url: string } | null) => void>();
let seq = 0;
const CONCURRENCY = 3;
let onChange: (() => void) | null = null;

const patch = (id: number, p: Partial<UploadItem>) =>
  store.setState((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));

async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { width: img.naturalWidth, height: img.naturalHeight };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function put(id: number, url: string, file: File) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhrs.set(id, xhr);
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) patch(id, { progress: e.loaded / e.total });
    };
    xhr.onload = () => {
      xhrs.delete(id);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else
        reject(
          new Error(
            xhr.status === 403
              ? "Storage refused the upload (403). Check the R2 token and bucket CORS rules."
              : `Upload failed (${xhr.status}).`,
          ),
        );
    };
    xhr.onerror = () => {
      xhrs.delete(id);
      reject(new Error("Network error. If this is R2, check the bucket CORS rules allow PUT."));
    };
    xhr.onabort = () => {
      xhrs.delete(id);
      reject(new DOMException("Canceled", "AbortError"));
    };
    xhr.send(file);
  });
}

async function run(item: UploadItem) {
  const { id, file } = item;
  patch(id, { status: "uploading", progress: 0, error: undefined });
  try {
    const pre = await createUpload({ name: file.name, type: file.type, size: file.size });
    if (!pre.ok || !pre.data) throw new Error(pre.ok ? "Upload failed." : pre.error);
    await put(id, pre.data.url, file);
    patch(id, { status: "processing", progress: 1 });
    const dims = await imageSize(file);
    const blur =
      file.type.startsWith("image/") && file.type !== "image/svg+xml" ? await makeBlur(file) : null;
    const reg = await registerUpload({
      key: pre.data.key,
      token: pre.data.token,
      filename: file.name,
      width: dims?.width,
      height: dims?.height,
      blur,
    });
    if (!reg.ok || !reg.data) throw new Error(reg.ok ? "Upload failed." : reg.error);
    patch(id, { status: "done", mediaId: reg.data.id });
    waiters.get(id)?.(reg.data);
  } catch (e) {
    const canceled = e instanceof DOMException && e.name === "AbortError";
    patch(id, {
      status: canceled ? "canceled" : "error",
      error: canceled ? undefined : e instanceof Error ? e.message : "Upload failed.",
    });
    waiters.get(id)?.(null);
  } finally {
    waiters.delete(id);
    onChange?.();
    pump();
  }
}

function pump() {
  const items = store.state.items;
  let active = items.filter((i) => i.status === "uploading" || i.status === "processing").length;
  for (const i of items) {
    if (active >= CONCURRENCY) break;
    if (i.status === "queued") {
      active++;
      void run(i);
    }
  }
}

/** Add files to the queue. Resolves per file with the new media row (or null on failure). */
export function enqueue(files: File[]) {
  const added: UploadItem[] = files.map((file) => {
    const problem = uploadProblem(file);
    return {
      id: ++seq,
      file,
      name: file.name || "pasted-image.png",
      size: file.size,
      mime: file.type,
      preview: file.type.startsWith("image/") && !problem ? URL.createObjectURL(file) : null,
      progress: 0,
      status: problem ? "error" : "queued",
      error: problem ?? undefined,
    };
  });
  store.setState((s) => ({ items: [...s.items, ...added] }));
  const results = added.map(
    (a) =>
      new Promise<{ id: number; url: string } | null>((resolve) => {
        if (a.status === "error") resolve(null);
        else waiters.set(a.id, resolve);
      }),
  );
  pump();
  return results;
}

export function cancelUpload(id: number) {
  const x = xhrs.get(id);
  if (x) x.abort();
  else patch(id, { status: "canceled" });
}
export function retryUpload(id: number) {
  const it = store.state.items.find((i) => i.id === id);
  if (!it || uploadProblem(it.file)) return;
  patch(id, { status: "queued", progress: 0, error: undefined });
  pump();
}
export function clearFinished() {
  store.setState((s) => {
    for (const i of s.items)
      if (i.status === "done" || i.status === "canceled" || i.status === "error")
        if (i.preview) URL.revokeObjectURL(i.preview);
    return {
      items: s.items.filter(
        (i) => i.status === "queued" || i.status === "uploading" || i.status === "processing",
      ),
    };
  });
}
export const removeUpload = (id: number) =>
  store.setState((s) => ({ items: s.items.filter((i) => i.id !== id) }));

/** Hook: queue state + upload helpers. Refreshes the library whenever a file finishes. */
export function useUploader() {
  const qc = useQueryClient();
  onChange = () => void qc.invalidateQueries({ queryKey: ["media"] });
  const items = useSelector(store, (s) => s.items);
  const busy = items.some(
    (i) => i.status === "queued" || i.status === "uploading" || i.status === "processing",
  );
  /** Single file (pickers): resolves with the new row, or null. */
  const upload = async (file: File) => (await Promise.all(enqueue([file])))[0];
  return { items, busy, upload, enqueue };
}

const STATUS: Record<UploadStatus, string> = {
  queued: "Waiting…",
  uploading: "Uploading",
  processing: "Finishing…",
  done: "Uploaded",
  error: "Failed",
  canceled: "Canceled",
};

/** The visible queue: one row per file with progress and actions. */
export function UploadQueue({ onOpen }: { onOpen?: (mediaId: number) => void }) {
  const items = useSelector(store, (s) => s.items);
  if (!items.length) return null;
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;
  const active = items.filter(
    (i) => i.status === "queued" || i.status === "uploading" || i.status === "processing",
  ).length;
  return (
    <section className="upq" aria-label="Uploads">
      <header className="upq-h">
        <b>
          {active
            ? `Uploading ${active} file${active === 1 ? "" : "s"}…`
            : `${done} uploaded${failed ? ` · ${failed} failed` : ""}`}
        </b>
        {active < items.length ? (
          <button type="button" className="btn btn-sm" onClick={clearFinished}>
            Clear finished
          </button>
        ) : null}
      </header>
      <ul>
        {items.map((i) => (
          <li key={i.id} className={`upq-row is-${i.status}`}>
            <span className="upq-thumb" aria-hidden="true">
              {i.preview ? (
                // biome-ignore lint/performance/noImgElement: local object URL preview
                <img src={i.preview} alt="" />
              ) : (
                <span>{i.name.split(".").pop()?.toUpperCase().slice(0, 4)}</span>
              )}
            </span>
            <div className="upq-main">
              <div className="upq-top">
                <b title={i.name}>{i.name}</b>
                <span className="mono subtle">
                  {i.status === "uploading"
                    ? `${Math.round(i.progress * 100)}% · ${fmtBytes(Math.round(i.size * i.progress))} of ${fmtBytes(i.size)}`
                    : `${STATUS[i.status]} · ${fmtBytes(i.size)}`}
                </span>
              </div>
              {i.error ? (
                <p className="upq-err" role="alert">
                  {i.error}
                </p>
              ) : (
                <span
                  className="upq-bar"
                  role="progressbar"
                  aria-label={`${i.name} upload progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(i.progress * 100)}
                >
                  <i style={{ transform: `scaleX(${i.status === "done" ? 1 : i.progress})` }} />
                </span>
              )}
            </div>
            <div className="upq-acts">
              {i.status === "uploading" || i.status === "queued" ? (
                <button type="button" className="btn btn-sm" onClick={() => cancelUpload(i.id)}>
                  Cancel
                </button>
              ) : null}
              {(i.status === "error" && !uploadProblem(i.file)) || i.status === "canceled" ? (
                <button type="button" className="btn btn-sm" onClick={() => retryUpload(i.id)}>
                  Retry
                </button>
              ) : null}
              {i.status === "done" && i.mediaId && onOpen ? (
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => onOpen(i.mediaId as number)}
                >
                  {i.mime.startsWith("image/") ? "Add alt text" : "Edit details"}
                </button>
              ) : null}
              {i.status !== "uploading" && i.status !== "processing" && i.status !== "queued" ? (
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`Remove ${i.name} from the list`}
                  onClick={() => removeUpload(i.id)}
                >
                  ✕
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Summary toast hook-in for bulk drops (call after enqueue). */
export async function announce(results: Promise<unknown>[]) {
  const r = await Promise.all(results);
  const ok = r.filter(Boolean).length;
  const bad = r.length - ok;
  if (r.length > 1 || bad) {
    if (bad)
      toast(`${ok} uploaded, ${bad} failed. See the list for details.`, ok ? "warn" : "error");
    else toast(`${ok} files uploaded.`);
  } else if (ok) toast("Uploaded.");
}

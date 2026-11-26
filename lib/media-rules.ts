/** Upload rules shared by the browser (instant feedback) and the server (enforcement). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Shape of every key this app writes (YYYY-MM/name-xxxxxx.ext, see makeKey). */
export const APP_KEY = /^\d{4}-\d{2}\/[a-z0-9-]+\.[a-z0-9]+$/;
export const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "application/pdf",
] as const;
export const ACCEPT_ATTR = ALLOWED_MIME.join(",");

/** Returns a human reason when a file can't be uploaded, or null when it's fine. */
export function uploadProblem(file: { type: string; size: number }) {
  if (!ALLOWED_MIME.includes(file.type as (typeof ALLOWED_MIME)[number]))
    return "Not a supported type (JPG, PNG, WebP, AVIF, SVG, ICO or PDF).";
  if (file.size > MAX_UPLOAD_BYTES)
    return `Too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is 10 MB.`;
  if (file.size === 0) return "The file is empty.";
  return null;
}

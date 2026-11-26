/**
 * Browser-side: a ~24px-wide preview of an image as a data: URL (about 1 KB), stored with the
 * media item and painted behind the real image while it loads. Returns null when the image
 * can't be read (e.g. a cross-origin URL without CORS, or an SVG).
 */
export async function makeBlur(src: string | File, width = 24): Promise<string | null> {
  if (typeof document === "undefined") return null;
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) return null;
    const w = width;
    const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const webp = c.toDataURL("image/webp", 0.5);
    return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", 0.5);
  } catch {
    return null;
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

/** Server-side check before storing a client-made preview. */
export const isBlurDataUrl = (s: unknown): s is string =>
  typeof s === "string" &&
  /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(s) &&
  s.length < 6000;

import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * File storage. Cloudflare R2 (S3-compatible, free egress) when R2_* is set; otherwise files go
 * to ./public/uploads (local development only — Vercel's filesystem is read-only).
 * Browsers upload straight to R2 with a presigned PUT, so large files never pass through a function.
 */

export { ALLOWED_MIME, APP_KEY, MAX_UPLOAD_BYTES } from "./media-rules";

const r2 =
  process.env.R2_BUCKET &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_ENDPOINT
    ? new S3Client({
        region: "auto",
        // R2 wants the account endpoint with no bucket in it; the bucket goes in the path.
        endpoint: process.env.R2_ENDPOINT.replace(/\/+$/, ""),
        forcePathStyle: true,
        // Newer SDKs add CRC32 checksum params to presigned URLs; browsers don't send them, so R2
        // rejects the signature. Only checksum when an operation requires it (Cloudflare's advice).
        requestChecksumCalculation: "WHEN_REQUIRED",
        responseChecksumValidation: "WHEN_REQUIRED",
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      })
    : null;

export const storageKind = () => (r2 ? "r2" : "local");
const LOCAL_DIR = path.join(process.cwd(), "public", "uploads");

/** Local-disk path for a key; refuses keys that would escape public/uploads ("../", absolute). */
function localPath(key: string) {
  const file = path.resolve(LOCAL_DIR, key);
  if (!file.startsWith(LOCAL_DIR + path.sep)) throw new Error("Invalid storage key.");
  return file;
}

export function publicUrl(key: string) {
  if (r2) return `${(process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "")}/${key}`;
  return `/uploads/${key}`;
}

export async function presignUpload(key: string, mime: string) {
  if (r2) {
    const url = await getSignedUrl(
      r2,
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, ContentType: mime }),
      { expiresIn: 600 },
    );
    return { url, method: "PUT" as const };
  }
  if (process.env.NODE_ENV === "production") throw new Error("R2 is not configured.");
  return { url: `/api/admin/upload-local?key=${encodeURIComponent(key)}`, method: "PUT" as const };
}

export async function readObject(key: string): Promise<Buffer> {
  if (r2) {
    const res = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    if (!res.Body) throw new Error(`Object ${key} is empty`);
    return Buffer.from(await res.Body.transformToByteArray());
  }
  return readFile(localPath(key));
}

export async function writeObject(key: string, body: Buffer, mime: string) {
  if (r2) {
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: body,
        ContentType: mime,
      }),
    );
    return;
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

/** What storage actually holds for a key (size and stored content type), or null if missing. */
export async function headObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  if (r2) {
    try {
      const res = await r2.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
    } catch {
      return null;
    }
  }
  const st = await stat(localPath(key)).catch(() => null);
  return st ? { size: st.size, contentType: null } : null;
}

export async function deleteObject(key: string) {
  if (r2) {
    await r2.send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
    return;
  }
  await unlink(localPath(key)).catch(() => undefined);
}

/** Rejects SVGs that can run script or pull remote resources (SSRF / XSS). */
export function isSafeSvg(src: string) {
  const bad = [
    /<script[\s>]/i,
    /\son\w+\s*=/i,
    /javascript:/i,
    /<foreignObject[\s>]/i,
    /<!ENTITY/i,
    /<!DOCTYPE/i,
    /(?:xlink:)?href\s*=\s*["']\s*(?!#|data:image\/(?:png|jpe?g|webp|gif);)/i,
    /url\(\s*["']?\s*(?!#|data:)/i,
  ];
  return !bad.some((re) => re.test(src));
}

export function makeKey(filename: string) {
  const ext = path
    .extname(filename)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, "");
  const base = path
    .basename(filename, path.extname(filename))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const stamp = new Date().toISOString().slice(0, 7);
  return `${stamp}/${base || "file"}-${Math.random().toString(36).slice(2, 8)}${ext}`;
}

export type StoredObject = { key: string; size: number; lastModified: Date | null };

/** Every stored object (key + size), for the orphan check. Capped at 5,000 objects. */
export async function listObjects(): Promise<StoredObject[]> {
  const out: StoredObject[] = [];
  if (r2) {
    let token: string | undefined;
    do {
      const res = await r2.send(
        new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET, ContinuationToken: token }),
      );
      for (const o of res.Contents ?? [])
        if (o.Key)
          out.push({ key: o.Key, size: o.Size ?? 0, lastModified: o.LastModified ?? null });
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token && out.length < 5000);
    return out;
  }
  const walk = async (dir: string, prefix: string) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const key = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) await walk(full, key);
      else {
        const st = await stat(full);
        out.push({ key, size: st.size, lastModified: st.mtime });
      }
    }
  };
  await walk(LOCAL_DIR, "");
  return out;
}

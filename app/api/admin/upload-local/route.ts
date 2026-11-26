import type { NextRequest } from "next/server";
import { getUser } from "@/lib/session";
import { APP_KEY, MAX_UPLOAD_BYTES, storageKind, writeObject } from "@/lib/storage";

/** Development-only stand-in for R2's presigned PUT. */
export async function PUT(req: NextRequest) {
  if (storageKind() !== "local" || process.env.NODE_ENV === "production")
    return new Response("Not found", { status: 404 });
  if (!(await getUser())) return new Response("Unauthorized", { status: 401 });
  const key = req.nextUrl.searchParams.get("key") ?? "";
  if (!APP_KEY.test(key)) return new Response("Bad key", { status: 400 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > MAX_UPLOAD_BYTES) return new Response("Too large", { status: 413 });
  await writeObject(key, body, req.headers.get("content-type") ?? "application/octet-stream");
  return new Response(null, { status: 200 });
}

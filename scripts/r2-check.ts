/**
 * End-to-end check of the R2 setup, using the same functions the admin uses.
 * Run: bun run r2:check   (reads .env; creates and deletes two small test files)
 */
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import {
  deleteObject,
  isSafeSvg,
  makeKey,
  presignUpload,
  publicUrl,
  readObject,
  storageKind,
  writeObject,
} from "../lib/storage";

const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
let failed = 0;
const ok = (msg: string) => console.log(`  ✓ ${msg}`);
const bad = (msg: string, hint?: string) => {
  failed++;
  console.log(`  ✗ ${msg}${hint ? `\n      → ${hint}` : ""}`);
};
async function step(name: string, fn: () => Promise<void>) {
  console.log(`\n${name}`);
  try {
    await fn();
  } catch (e) {
    bad(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
  }
}

const env = (k: string) => process.env[k] ?? "";

await step("1. Config", async () => {
  if (storageKind() !== "r2") {
    bad(
      "R2 is not configured",
      "Set R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_ENDPOINT in .env",
    );
    process.exit(1);
  }
  ok(`bucket "${env("R2_BUCKET")}"`);
  const ep = new URL(env("R2_ENDPOINT"));
  if (ep.pathname !== "/" && ep.pathname !== "")
    bad(
      `R2_ENDPOINT has a path (${ep.pathname})`,
      "Use https://<account-id>.r2.cloudflarestorage.com with no bucket at the end",
    );
  else ok("endpoint has no bucket path");
  if (!env("R2_PUBLIC_URL"))
    bad(
      "R2_PUBLIC_URL is empty",
      "Enable the r2.dev URL (or a custom domain) on the bucket and paste it here",
    );
  else ok(`public URL ${env("R2_PUBLIC_URL")}`);
});

await step("2. Credentials can reach the bucket", async () => {
  const c = new S3Client({
    region: "auto",
    endpoint: env("R2_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: env("R2_ACCESS_KEY_ID"),
      secretAccessKey: env("R2_SECRET_ACCESS_KEY"),
    },
  });
  await c.send(new HeadBucketCommand({ Bucket: env("R2_BUCKET") })).then(
    () => ok("signed request accepted"),
    (e) =>
      bad(
        `${e.name} (${e.$metadata?.httpStatusCode ?? "?"})`,
        "Check the token has Object Read & Write on this bucket, and that the keys match",
      ),
  );
});

await step(`3. Browser CORS preflight from ${origin}`, async () => {
  const { url } = await presignUpload("cors-check.txt", "text/plain");
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const allowOrigin = res.headers.get("access-control-allow-origin");
  const allowMethods = res.headers.get("access-control-allow-methods") ?? "";
  if (res.ok && allowOrigin && /PUT/i.test(allowMethods)) ok(`allowed (${allowMethods})`);
  else
    bad(
      `preflight refused (status ${res.status}, methods "${allowMethods}")`,
      `In Cloudflare → R2 → ${env("R2_BUCKET")} → Settings → CORS policy, allow origin ${origin}, methods GET + PUT, header content-type`,
    );
});

const key = makeKey("r2-check.png");
// 1×1 transparent PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

await step("4. Upload with a presigned PUT (what the admin's browser does)", async () => {
  const { url } = await presignUpload(key, "image/png");
  if (/x-amz-checksum|x-amz-sdk-checksum/i.test(url))
    bad("presigned URL carries checksum params; browsers will fail the signature");
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "image/png", Origin: origin },
    body: png,
  });
  if (res.ok) ok(`uploaded ${key}`);
  else bad(`PUT failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
});

await step("5. Read back on the server (SVG check / metadata)", async () => {
  const buf = await readObject(key);
  if (buf.equals(png)) ok(`read ${buf.length} bytes, identical`);
  else bad(`read ${buf.length} bytes, content differs`);
});

await step("6. Public URL serves the file (site + admin thumbnails)", async () => {
  const res = await fetch(publicUrl(key));
  if (res.ok) ok(`${res.status} ${res.headers.get("content-type")}`);
  else
    bad(
      `public GET returned ${res.status}`,
      "Turn on public access for the bucket (R2 → Settings → Public Development URL) and copy that URL into R2_PUBLIC_URL",
    );
});

await step("7. Server-side write + unsafe SVG removal (seed résumé, SVG guard)", async () => {
  const svgKey = makeKey("r2-check.svg");
  const evil = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
  await writeObject(svgKey, Buffer.from(evil), "image/svg+xml");
  ok("server write");
  const text = (await readObject(svgKey)).toString("utf8");
  if (!isSafeSvg(text)) ok("unsafe SVG detected");
  else bad("unsafe SVG was not detected");
  await deleteObject(svgKey);
  ok("unsafe SVG deleted");
});

await step("8. Delete (Media → Delete)", async () => {
  await deleteObject(key);
  const gone = await readObject(key).then(
    () => false,
    () => true,
  );
  if (gone) ok("object removed from the bucket");
  else bad("object still readable after delete");
});

console.log(failed ? `\n${failed} check(s) failed.` : "\nAll R2 checks passed ✓");
process.exit(failed ? 1 : 0);

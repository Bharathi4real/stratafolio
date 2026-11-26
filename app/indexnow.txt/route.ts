import { indexNowKey } from "@/lib/indexnow";

/** /indexnow.txt: the IndexNow key, so search engines can verify submissions (see lib/indexnow). */
export function GET() {
  const key = indexNowKey();
  return new Response(key ?? "Not found", {
    status: key ? 200 : 404,
    headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
  });
}

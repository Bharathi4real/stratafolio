import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { DEMO, DEMO_MESSAGE } from "@/lib/demo";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

/** In a demo, only signing in and out reach Better Auth: no password, email or profile changes. */
export async function POST(req: Request) {
  if (DEMO && !/\/api\/auth\/sign-(in\/email|out)$/.test(new URL(req.url).pathname))
    return Response.json({ message: DEMO_MESSAGE }, { status: 403 });
  return handler.POST(req);
}

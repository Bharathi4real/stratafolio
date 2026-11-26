import type { Metadata } from "next";
import { Inbox } from "@/components/admin/Inbox";
import { listMessages } from "@/lib/admin/actions";
import { readGlobal } from "@/lib/content/store";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  await requirePermission("site.manage");
  const [msgs, privacy] = await Promise.all([listMessages(), readGlobal("privacy")]);
  return <Inbox initial={msgs} retention={privacy.retentionMonths} />;
}

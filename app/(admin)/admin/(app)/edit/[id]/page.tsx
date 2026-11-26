import { notFound, redirect } from "next/navigation";
import { readEntryRow } from "@/lib/content/store";
import { canEditEntry } from "@/lib/rbac";
import { requireUser } from "@/lib/session";

/**
 * Generic link target (dashboard activity): sends you to the right editor, only for entries you
 * may edit (posts: posts.write and, for authors, their own; everything else: site.manage).
 */
export default async function EditRedirect({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const row = await readEntryRow(id);
  if (!row) notFound();
  if (!canEditEntry(user, row)) redirect("/admin?denied=1");
  redirect(`/admin/${row.collection}/${row.id}`);
}

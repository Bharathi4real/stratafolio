import type { Metadata } from "next";
import { ToolkitEditor } from "@/components/admin/editors/ToolkitEditor";
import { readGlobal, readGlobalRow } from "@/lib/content/store";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Toolkit strata" };

export default async function ToolkitPage() {
  await requirePermission("site.manage");
  const [row, initial] = await Promise.all([
    readGlobalRow("toolkit"),
    readGlobal("toolkit", { draft: true }),
  ]);
  return (
    <ToolkitEditor
      initial={initial}
      published={Boolean(row?.publishedAt ?? row?.data)}
      hasDraft={Boolean(row?.draft)}
    />
  );
}

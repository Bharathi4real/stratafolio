import type { Metadata } from "next";
import { ProjectEditor } from "@/components/admin/editors/ProjectEditor";
import { loadEntry } from "@/lib/admin/load";
import type { ProjectData } from "@/lib/content/schema";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Edit case study" };

export default async function EditProject({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("site.manage");
  const e = await loadEntry("projects", (await params).id, user);
  return (
    <ProjectEditor
      key={e.id}
      id={e.id}
      initial={e.data as ProjectData}
      published={e.published}
      hasDraft={e.hasDraft}
    />
  );
}

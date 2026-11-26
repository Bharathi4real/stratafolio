import type { Metadata } from "next";
import { ExperienceEditor } from "@/components/admin/editors/ExperienceEditor";
import { loadEntry } from "@/lib/admin/load";
import type { ExperienceData } from "@/lib/content/schema";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Edit role" };

export default async function EditExperience({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("site.manage");
  const e = await loadEntry("experience", (await params).id, user);
  return (
    <ExperienceEditor
      key={e.id}
      id={e.id}
      initial={e.data as ExperienceData}
      published={e.published}
      hasDraft={e.hasDraft}
    />
  );
}

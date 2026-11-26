import type { Metadata } from "next";
import { ProjectsTable } from "@/components/admin/tables";
import { adminRows } from "@/lib/admin/rows";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Case studies" };

export default async function ProjectsPage() {
  await requirePermission("site.manage");
  return <ProjectsTable rows={await adminRows("projects")} />;
}

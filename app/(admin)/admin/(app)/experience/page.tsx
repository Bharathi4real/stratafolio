import type { Metadata } from "next";
import { ExperienceTable } from "@/components/admin/tables";
import { adminRows } from "@/lib/admin/rows";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Experience" };

export default async function ExperiencePage() {
  await requirePermission("site.manage");
  return <ExperienceTable rows={await adminRows("experience")} />;
}

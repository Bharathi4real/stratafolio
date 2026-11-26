import type { Metadata } from "next";
import { HomeBuilder } from "@/components/admin/editors/HomeBuilder";
import { listEntryRows, readGlobal, readGlobalRow } from "@/lib/content/store";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Home page" };

export default async function HomePageEditor() {
  await requirePermission("site.manage");
  const [row, initial, projects] = await Promise.all([
    readGlobalRow("home-page"),
    readGlobal("home-page", { draft: true }),
    listEntryRows("projects"),
  ]);
  return (
    <HomeBuilder
      initial={initial}
      published={Boolean(row?.publishedAt ?? row?.data)}
      hasDraft={Boolean(row?.draft)}
      projects={projects.map((p) => ({
        id: p.id,
        title: ((p.draft ?? p.data) as { title?: string } | null)?.title ?? p.slug,
      }))}
    />
  );
}

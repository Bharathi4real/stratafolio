import type { Metadata } from "next";
import { SettingsBlog } from "@/components/admin/editors/SettingsBlog";
import { readGlobal, readGlobalRow } from "@/lib/content/store";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Blog settings" };

/** Blog name, page copy, categories and RSS: its own page so editors can reach it too. */
export default async function BlogSettingsPage() {
  await requirePermission("blog.settings");
  const [row, initial] = await Promise.all([
    readGlobalRow("blog-page"),
    readGlobal("blog-page", { draft: true }),
  ]);
  return (
    <SettingsBlog
      key="blog-page"
      initial={initial as never}
      published={Boolean(row?.publishedAt ?? row?.data)}
      hasDraft={Boolean(row?.draft)}
      tabs={null}
    />
  );
}

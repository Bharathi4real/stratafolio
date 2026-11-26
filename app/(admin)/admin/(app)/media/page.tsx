import type { Metadata } from "next";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { readGlobal } from "@/lib/content/store";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";
import { storageKind } from "@/lib/storage";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage() {
  const user = await requirePermission("media.upload");
  const privacy = await readGlobal("privacy");
  return (
    <MediaLibrary
      canDelete={can(user.role, "media.delete")}
      canEdit={can(user.role, "media.edit")}
      storage={storageKind()}
      binDays={privacy.binDays ?? 30}
    />
  );
}

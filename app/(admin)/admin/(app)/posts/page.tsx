import type { Metadata } from "next";
import { PostsTable } from "@/components/admin/tables";
import { adminRows } from "@/lib/admin/rows";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Blog posts" };

export default async function PostsPage() {
  const user = await requirePermission("posts.write");
  return (
    <PostsTable rows={await adminRows("posts", user)} canManage={can(user.role, "posts.manage")} />
  );
}

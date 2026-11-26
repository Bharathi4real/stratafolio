import type { Metadata } from "next";
import { PostEditor } from "@/components/admin/editors/PostEditor";
import { loadEntry } from "@/lib/admin/load";
import type { PostData } from "@/lib/content/schema";
import { readGlobal } from "@/lib/content/store";
import { can } from "@/lib/rbac";
import { requirePermission } from "@/lib/session";

export const metadata: Metadata = { title: "Edit post" };

export default async function EditPost({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("posts.write");
  const [e, blog, seo] = await Promise.all([
    // 404s for posts this user may not edit (authors: anyone else's).
    loadEntry("posts", (await params).id, user),
    readGlobal("blog-page", { draft: true }),
    readGlobal("seo", { draft: true }),
  ]);
  return (
    <PostEditor
      key={e.id}
      id={e.id}
      initial={e.data as PostData}
      published={e.published}
      hasDraft={e.hasDraft}
      categories={blog.categories}
      titleTemplate={seo.titleTemplate ?? "%s"}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
      canPublish={can(user.role, "posts.manage")}
    />
  );
}

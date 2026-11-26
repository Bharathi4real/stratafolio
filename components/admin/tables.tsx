"use client";

import type { Row } from "@/lib/admin/rows";
import { EntryTable } from "./EntryTable";

export const PostsTable = ({ rows, canManage }: { rows: Row[]; canManage: boolean }) => (
  <EntryTable
    collection="posts"
    rows={rows}
    canManage={canManage}
    title="Blog"
    accent="posts"
    desc="The newest published post is featured automatically on the home page and the blog. Writing and Draft stages show as “Coming soon”."
    newLabel="+ New post"
    publicPath={(r) => (r.stage === "published" && !r.scheduledFor ? `/blog/${r.slug}` : null)}
  />
);

export const ProjectsTable = ({ rows }: { rows: Row[] }) => (
  <EntryTable
    collection="projects"
    rows={rows}
    title="Case"
    accent="studies"
    desc="Shown in the Work section in this order, and at /work/[slug]."
    newLabel="+ New case study"
    publicPath={(r) => `/work/${r.slug}`}
  />
);

export const ExperienceTable = ({ rows }: { rows: Row[] }) => (
  <EntryTable
    collection="experience"
    rows={rows}
    title="Experience"
    accent="timeline"
    desc="Roles sort by start date on the site. Leave the end date empty for your current role."
    newLabel="+ New role"
  />
);

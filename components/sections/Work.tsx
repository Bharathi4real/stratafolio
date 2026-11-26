import type { Project, WorkBlock } from "@/lib/content/schema";
import { WorkList } from "./WorkList";

export function Work({
  block,
  num,
  projects,
}: {
  block: WorkBlock;
  num: string;
  projects: Project[];
}) {
  const picked = (block.projects ?? [])
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => Boolean(p));
  const list = picked.length ? picked : projects;
  return (
    <section className="section gutter" id={block.anchor ?? "work"} style={{ paddingTop: 0 }}>
      <div className="sec-head">
        <p className="eyebrow" data-reveal>
          {num} / {block.label}
        </p>
        <h2 data-split>
          {block.heading}
          <span className="count">({String(list.length).padStart(2, "0")})</span>
        </h2>
      </div>
      <WorkList
        items={list.map((p, i) => ({
          slug: p.slug,
          index: String(i + 1).padStart(2, "0"),
          title: p.title,
          summary: p.summary,
          label: p.listLabel ?? p.kind,
          tags: (p.listTags?.length ? p.listTags : (p.stack ?? [])).slice(0, 3),
          inline: (p.metrics ?? [])
            .filter((m) => m.inline)
            .map((m) => ({ value: m.value, label: m.short ?? m.label })),
          previewLabel: p.previewLabel ?? "Impact",
          metrics: (p.metrics ?? []).map((m) => ({ value: m.value, label: m.label })),
        }))}
      />
    </section>
  );
}

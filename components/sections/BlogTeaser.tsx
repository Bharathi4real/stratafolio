import Link from "next/link";
import { NoteFeature } from "@/components/blog/NoteFeature";
import { Pill } from "@/components/ui/Pill";
import { Accent } from "@/components/ui/Rich";
import type { PostAuthor } from "@/lib/author";
import type { BlogTeaserBlock, Post } from "@/lib/content/schema";
import { splitPosts } from "@/lib/queries";
import { fmtMonth } from "@/lib/time";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function BlogTeaser({
  block,
  num,
  posts,
  authorOf,
}: {
  block: BlogTeaserBlock;
  num: string;
  posts: Post[];
  authorOf?: (p: Post) => PostAuthor;
}) {
  const { published, upcoming } = splitPosts(posts);
  const showUpcoming = block.showUpcoming !== false;
  if (!published.length && (!showUpcoming || !upcoming.length)) return null;

  const [latest, ...earlier] = published;
  const total = published.length;
  const max = block.sideCount ?? 4;
  // Published posts are numbered newest = total, so the featured card is #total.
  let n = total - 1;
  let k = total;
  const items = [
    ...earlier.slice(0, max).map((p) => ({ p, num: n--, published: true })),
    ...(showUpcoming ? upcoming : []).map((p) => ({ p, num: ++k, published: false })),
  ].slice(0, max);
  const hasPublished = items.some((i) => i.published);
  const head = hasPublished ? "More from the blog" : "Coming up next";
  const count = total ? plural(total, "post") : `${items.length} upcoming`;
  const allLabel = block.allLabel ?? "All posts";

  return (
    <section className="section gutter" id={block.anchor ?? "blog"} style={{ paddingTop: 0 }}>
      <div className="sec-head">
        <p className="eyebrow" data-reveal>
          {num} / {block.label}
        </p>
        <h2 data-split>
          <Accent text={block.heading} />
        </h2>
      </div>
      {latest && !items.length ? (
        // Only one post so far: a wide card (cover beside the text) instead of an empty side
        // panel, with the count and the archive link underneath.
        <>
          <div className="notes-grid is-single">
            <NoteFeature post={latest} number={total} author={authorOf?.(latest)} />
          </div>
          <div className="notes-strip" data-reveal>
            <p className="eyebrow">
              {plural(total, "post")} published <span aria-hidden="true">·</span> more on the way
            </p>
            <Pill href="/blog" variant="ghost" arrow="→">
              {allLabel}
            </Pill>
          </div>
        </>
      ) : (
        <div className={`notes-grid${latest ? "" : " is-solo"}`}>
          {latest ? <NoteFeature post={latest} number={total} author={authorOf?.(latest)} /> : null}
          <aside className="note-queue" data-reveal aria-label={head}>
            <div className="note-queue-head">
              <p className="eyebrow">{head}</p>
              <p className="eyebrow">{count}</p>
            </div>
            <ol>
              {items.map(({ p, num: no, published: pub }) => (
                <li className="q-item" key={p.id}>
                  <span className="q-num">{String(no).padStart(2, "0")}</span>
                  <div>
                    <h4>{pub ? <Link href={`/blog/${p.slug}`}>{p.title}</Link> : p.title}</h4>
                    <div className="q-tags">
                      {pub ? (
                        <span className="q-status pub">
                          <i />
                          {p.publishedAt ? fmtMonth(p.publishedAt) : ""}
                        </span>
                      ) : (
                        <span className={`q-status ${p.stage === "writing" ? "wip" : ""}`}>
                          <i />
                          {p.stage === "writing" ? "Writing" : "Draft"}
                        </span>
                      )}
                      {p.tags?.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <Pill href="/blog" variant="ghost" arrow="→">
              {`${allLabel} (${total})`}
            </Pill>
          </aside>
        </div>
      )}
    </section>
  );
}

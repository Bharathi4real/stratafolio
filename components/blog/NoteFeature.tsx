import Link from "next/link";
import { ViewTransition } from "react";
import { Arrow } from "@/components/ui/Arrow";
import { CoverTopo } from "@/components/ui/Topo";
import type { PostAuthor } from "@/lib/author";
import type { Post } from "@/lib/content/schema";
import { fmtMonth } from "@/lib/time";
import { AuthorAvatar } from "./AuthorAvatar";
import { CoverImage } from "./CoverImage";

export function CoverCode({ lines }: { lines: Post["coverLines"] }) {
  if (!lines?.length) return null;
  return (
    <div className="note-cover-code" aria-hidden="true">
      {lines.map((l) => (
        <span key={`${l.kind}-${l.text}`} style={{ display: "block" }}>
          {l.kind === "cmd" ? <b>$</b> : l.kind === "ok" ? <i>✓</i> : null}
          {l.kind === "plain" ? "" : " "}
          {l.text}
        </span>
      ))}
    </div>
  );
}

export const readLabel = (p: Pick<Post, "readMinutes">) => `${p.readMinutes ?? 1} min read`;

export function NoteFeature({
  post,
  number,
  author,
}: {
  post: Post;
  number: number;
  author?: PostAuthor;
}) {
  return (
    <Link
      className="note-feature"
      href={`/blog/${post.slug}`}
      data-reveal
      aria-label={`Latest post: ${post.title}`}
    >
      <ViewTransition name={`post-cover-${post.slug}`} share="morph" default="none">
        <div className="note-cover">
          <CoverTopo seed={post.slug} />
          {/* Decorative here: the card's link already names the post. */}
          <CoverImage id={post.coverImage} sizes="(max-width: 900px) 100vw, 55vw" />
          <div className="note-cover-tl">
            <span className="is-latest">
              <i />
              Latest
            </span>
            <span>{post.category}</span>
          </div>
          <CoverCode lines={post.coverLines} />
          <span className="note-cover-num" aria-hidden="true">
            {String(number).padStart(2, "0")}
          </span>
        </div>
      </ViewTransition>
      <div className="note-body">
        <p className="note-meta eyebrow">
          <span>{post.publishedAt ? fmtMonth(post.publishedAt) : ""}</span>
          <span>{readLabel(post)}</span>
        </p>
        <h3>{post.title}</h3>
        <p>{post.excerpt}</p>
        {author ? (
          <span className="note-author">
            <AuthorAvatar author={author} size="sm" />
            {author.name}
          </span>
        ) : null}
        <div className="tags">
          {post.tags?.map((t) => (
            <span className="tag" key={t}>
              {t}
            </span>
          ))}
        </div>
        <span className="note-cta">
          Read the post <Arrow dir="right" />
        </span>
      </div>
    </Link>
  );
}

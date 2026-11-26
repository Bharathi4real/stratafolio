import type { PostAuthor } from "@/lib/author";

/** Photo when the author has one (e.g. from Google/GitHub sign-in), initials otherwise. */
export function AuthorAvatar({ author, size }: { author: PostAuthor; size?: "sm" }) {
  return (
    <span className={`avatar${size ? ` avatar-${size}` : ""}`} aria-hidden="true">
      {author.image ? (
        // biome-ignore lint/performance/noImgElement: external avatar host, tiny image
        <img src={author.image} alt="" width={48} height={48} loading="lazy" />
      ) : (
        author.initials
      )}
    </span>
  );
}

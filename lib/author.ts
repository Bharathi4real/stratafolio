import type { Author } from "@/lib/queries";

type Settings = {
  fullName: string;
  firstName: string;
  initials?: string;
  byline?: string | null;
  authorBio?: string | null;
};
export type PostAuthor = {
  name: string;
  firstName: string;
  initials: string;
  image: string | null;
  byline: string | null;
  bio: string | null;
};

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

/**
 * Who wrote a post. No author (older posts) = the site owner from Settings → General.
 * An admin with no byline/bio of their own borrows the site's; a guest editor never shows
 * someone else's bio.
 */
export function resolveAuthor(
  id: string | null | undefined,
  authors: Map<string, Author>,
  s: Settings,
): PostAuthor {
  const owner: PostAuthor = {
    name: s.fullName,
    firstName: s.firstName || s.fullName.split(" ")[0],
    initials: s.initials || initialsOf(s.fullName),
    image: null,
    byline: s.byline ?? null,
    bio: s.authorBio ?? null,
  };
  const a = id ? authors.get(id) : undefined;
  if (!a) return owner;
  // Admins are the site's owners: they borrow the site byline/bio until they set their own.
  const isOwner = a.role === "admin";
  return {
    name: a.name,
    firstName: a.name.split(/\s+/)[0] || a.name,
    initials: isOwner ? owner.initials : initialsOf(a.name),
    image: a.image,
    byline: a.byline || (isOwner ? owner.byline : null),
    bio: a.bio || (isOwner ? owner.bio : null),
  };
}

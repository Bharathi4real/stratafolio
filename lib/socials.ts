import type { SiteSettings, Social } from "@/lib/content/schema";
import { safeHref } from "./safe-url";

export type SocialNetwork = Social["network"];

/** Display name, card colour and whether the link opens in a new tab. */
export const NETWORK: Record<SocialNetwork, { name: string; tile?: string; external: boolean }> = {
  github: { name: "GitHub", external: true },
  linkedin: { name: "LinkedIn", tile: "#0a66c2", external: true },
  x: { name: "X", external: true },
  instagram: { name: "Instagram", tile: "#d62976", external: true },
  youtube: { name: "YouTube", tile: "#ff0033", external: true },
  facebook: { name: "Facebook", tile: "#1877f2", external: true },
  bluesky: { name: "Bluesky", tile: "#1185fe", external: true },
  dribbble: { name: "Dribbble", tile: "#ea4c89", external: true },
  medium: { name: "Medium", external: true },
  devto: { name: "DEV", external: true },
  dailydev: { name: "daily.dev", external: true },
  stackoverflow: { name: "Stack Overflow", tile: "#f48024", external: true },
  email: { name: "Email", external: false },
  phone: { name: "Phone", external: false },
  website: { name: "Website", external: true },
  custom: { name: "Link", external: true },
};

/** A profile ready to render (custom icon resolved to a URL). */
export type SocialLink = Social & { name: string; href: string; iconUrl: string | null };

const hrefOf = (s: Pick<Social, "network" | "url">) => {
  const u = s.url.trim();
  if (s.network === "email" && !u.startsWith("mailto:")) return `mailto:${u}`;
  if (s.network === "phone" && !u.startsWith("tel:")) return `tel:${u.replace(/\s+/g, "")}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) || u.startsWith("/")) return safeHref(u);
  return `https://${u}`;
};

/** Saved socials, or the older GitHub/LinkedIn fields when the list hasn't been set up yet. */
export function socialsOf(
  s: Pick<
    SiteSettings,
    | "socials"
    | "githubUrl"
    | "githubHandle"
    | "githubCaption"
    | "linkedinUrl"
    | "linkedinHandle"
    | "linkedinCaption"
  >,
  icons: Map<number, string> = new Map(),
): SocialLink[] {
  const base = {
    icon: null,
    inHeader: true,
    inHero: true,
    inContact: true,
    inMenu: true,
    inFooter: true,
  };
  const list: Social[] = s.socials?.length
    ? s.socials
    : [
        ...(s.githubUrl
          ? [
              {
                ...base,
                id: "github",
                network: "github" as const,
                url: s.githubUrl,
                handle: s.githubHandle,
                caption: s.githubCaption,
              },
            ]
          : []),
        ...(s.linkedinUrl
          ? [
              {
                ...base,
                id: "linkedin",
                network: "linkedin" as const,
                url: s.linkedinUrl,
                handle: s.linkedinHandle,
                caption: s.linkedinCaption,
              },
            ]
          : []),
      ];
  return list
    .filter((x) => x.url?.trim())
    .map((x) => ({
      ...x,
      name: x.label?.trim() || NETWORK[x.network]?.name || "Link",
      href: hrefOf(x),
      iconUrl: x.icon ? (icons.get(x.icon) ?? null) : null,
    }));
}

export const isExternal = (l: SocialLink) => NETWORK[l.network]?.external !== false;

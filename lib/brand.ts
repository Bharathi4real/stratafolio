/** Resolved logo, safe to pass to client components. */
export type Logo =
  | { type: "text"; text: string }
  | { type: "image"; text: string; src: string; srcLight: string | null; height: number };

export type Brand = {
  site: Logo;
  admin: Logo;
  /** Favicon URLs + mime (null = built-in /icon.svg). */
  favicon: { url: string; mime: string } | null;
  adminFavicon: { url: string; mime: string } | null;
  /** Admin browser-tab title and the tag next to the sidebar logo. */
  adminTitle: string;
  adminBadge: string;
  /** Site name for metadata (Settings → General → Brand mark). */
  siteName: string;
  ownerName: string;
};

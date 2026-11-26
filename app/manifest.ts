import type { MetadataRoute } from "next";
import { getBrand } from "@/lib/queries";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { favicon, siteName, ownerName } = await getBrand();
  return {
    name: `${siteName} · ${ownerName}`,
    short_name: siteName,
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0d",
    theme_color: "#0b0b0d",
    icons: [
      favicon
        ? { src: favicon.url, sizes: "any", type: favicon.mime }
        : { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}

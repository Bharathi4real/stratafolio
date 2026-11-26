import { ogImage, ogSize } from "@/lib/og";

export const size = ogSize;
export const contentType = "image/png";
export const alt = "Privacy policy";

export default async function Image() {
  return ogImage({
    kicker: "Privacy policy",
    title: "Your data,",
    accent: "kept small.",
    footer: "No tracking cookies by default",
  });
}

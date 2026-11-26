import Image from "next/image";
import { getMediaImage } from "@/lib/queries";

/**
 * A post's cover photo (Post editor → Cover image). Sits over the generated contour art,
 * which stays as the fallback when no image is set. Recommended size: 2100 × 800 px (21:8).
 *
 * Served through next/image: resized per screen and converted to WebP/AVIF, so phones don't
 * download the full upload. On the post page it's the largest thing above the fold (LCP), so it
 * loads eagerly at high priority there; everywhere else it lazy-loads.
 */
export async function CoverImage({
  id,
  eager,
  alt = "",
  sizes = "(max-width: 1100px) 100vw, 1100px",
}: {
  id: number | null | undefined;
  eager?: boolean;
  /** Fallback when the media library has no alt text for the image; "" marks it decorative. */
  alt?: string;
  sizes?: string;
}) {
  const img = await getMediaImage(id);
  if (!img) return null;
  return (
    <Image
      className="cover-img"
      src={img.url}
      alt={img.alt?.trim() || alt}
      fill
      sizes={sizes}
      {...(eager ? { loading: "eager" as const, fetchPriority: "high" as const } : {})}
      {...(img.blur ? { placeholder: "blur" as const, blurDataURL: img.blur } : {})}
    />
  );
}

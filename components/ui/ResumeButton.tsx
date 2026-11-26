import { splitArrow } from "./Arrow";
import { Pill } from "./Pill";

/**
 * Résumé download, in the site's own pill style (as in the approved preview): solid in the
 * header, ghost in Contact. The label rolls on hover and the download icon replaces "↓".
 */
export function ResumeButton({
  href,
  label,
  variant = "solid",
  large,
}: {
  href: string;
  label: string;
  variant?: "solid" | "ghost";
  large?: boolean;
}) {
  return (
    <Pill href={href} variant={variant} large={large} download arrow="download">
      {splitArrow(label).text}
    </Pill>
  );
}

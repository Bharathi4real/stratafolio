/** Shimmering placeholder blocks for loading states (site and admin). */
export function Sk({
  w = "100%",
  h = "1rem",
  r,
  className = "",
}: {
  w?: string;
  h?: string;
  r?: string;
  className?: string;
}) {
  return (
    <span
      className={`sk ${className}`.trim()}
      style={{ width: w, height: h, borderRadius: r }}
      aria-hidden="true"
    />
  );
}

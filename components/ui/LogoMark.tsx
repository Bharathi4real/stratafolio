import type { Logo } from "@/lib/brand";

/**
 * Text logo (with the ember dot) or an image logo. With a separate light-theme image, both are
 * rendered and CSS shows the one matching html[data-theme], so there is no flash on toggle.
 */
export function LogoMark({ logo }: { logo: Logo }) {
  if (logo.type === "text")
    return (
      <>
        {logo.text}
        <i />
      </>
    );
  const style = { height: logo.height };
  return (
    <span className="logo-img">
      {/* biome-ignore lint/performance/noImgElement: logos are small SVG/PNG from the media library */}
      <img
        src={logo.src}
        alt={logo.text}
        style={style}
        className={logo.srcLight ? "logo-dark" : undefined}
      />
      {logo.srcLight ? (
        // biome-ignore lint/performance/noImgElement: see above
        <img src={logo.srcLight} alt={logo.text} style={style} className="logo-light" />
      ) : null}
    </span>
  );
}

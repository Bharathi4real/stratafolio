import Link from "next/link";
import type { ReactNode } from "react";
import { Arrow, splitArrow, toArrowDir } from "./Arrow";

/** Button label that rolls up to an identical copy on hover (no metric changes). */
export function Roll({ children }: { children: string }) {
  return (
    <span className="roll">
      <span data-text={children}>{children}</span>
    </span>
  );
}

type Variant = "solid" | "accent" | "ghost";

export function Pill({
  href,
  children,
  variant = "ghost",
  large,
  arrow,
  external,
  download,
  className = "",
  onClick,
  type,
}: {
  href?: string;
  children: string;
  variant?: Variant;
  large?: boolean;
  arrow?: ReactNode;
  external?: boolean;
  download?: boolean | string;
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const cls = `pill pill-${variant}${large ? " pill-lg" : ""} ${className}`.trim();
  // Labels typed with a trailing arrow ("View work →") get a real icon instead.
  const { text, dir } = splitArrow(children);
  const iconDir =
    (typeof arrow === "string" ? toArrowDir(arrow) : dir) ??
    (external && !arrow ? "out" : download && !arrow ? "download" : null);
  const icon = iconDir ? <Arrow dir={iconDir} /> : typeof arrow === "string" ? null : arrow;
  const inner = (
    <>
      <Roll>{text}</Roll>
      {icon ? (
        <span className="arrow" aria-hidden="true">
          {icon}
        </span>
      ) : null}
    </>
  );
  if (!href)
    return (
      <button className={cls} type={type ?? "button"} onClick={onClick}>
        {inner}
      </button>
    );
  if (external || download || /^(https?:|mailto:|tel:)/.test(href))
    return (
      <a
        className={cls}
        href={href}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
        {...(download ? { download: typeof download === "string" ? download : true } : {})}
      >
        {inner}
      </a>
    );
  return (
    <Link className={cls} href={href}>
      {inner}
    </Link>
  );
}

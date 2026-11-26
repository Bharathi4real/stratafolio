"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/ui/LogoMark";
import type { Logo } from "@/lib/brand";
import { scrollToTarget } from "@/lib/lenis";

export function BrandLinkView({ logo, pathname }: { logo: Logo; pathname: string }) {
  return (
    <Link
      href="/"
      className="brand"
      aria-label={`${logo.text}, home`}
      onClick={(e) => {
        if (pathname === "/") {
          e.preventDefault();
          scrollToTarget(0);
        }
      }}
    >
      <LogoMark logo={logo} />
    </Link>
  );
}

export function BrandLink({ logo }: { logo: Logo }) {
  return <BrandLinkView logo={logo} pathname={usePathname()} />;
}

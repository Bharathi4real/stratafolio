import { Suspense } from "react";
import { ResumeButton } from "@/components/ui/ResumeButton";
import { SocialIcon } from "@/components/ui/SocialIcon";
import type { Logo } from "@/lib/brand";
import { isExternal, type SocialLink } from "@/lib/socials";
import { BrandLink, BrandLinkView } from "./BrandLink";
import { Dock, DockView, type NavItem } from "./Dock";

/** Any path that isn't "/" or /blog: section links then point at the home page. */
const OFF_PAGE = "/_";

import { HeaderShell } from "./HeaderShell";
import { MenuButton } from "./MenuButton";
import { ThemeSwitch } from "./ThemeSwitch";

export function SiteHeader({
  logo,
  dock,
  socials,
  resumeUrl,
  resumeLabel,
}: {
  logo: Logo;
  dock: NavItem[];
  socials: SocialLink[];
  resumeUrl?: string;
  resumeLabel: string;
}) {
  return (
    <HeaderShell>
      {/* The pathname is unknown only while prerendering the 404 shell: show a neutral copy. */}
      <Suspense fallback={<BrandLinkView logo={logo} pathname={OFF_PAGE} />}>
        <BrandLink logo={logo} />
      </Suspense>
      <Suspense fallback={<DockView items={dock} pathname={OFF_PAGE} />}>
        <Dock items={dock} />
      </Suspense>
      <div className="header-actions">
        {socials
          .filter((l) => l.inHeader)
          .map((l) => (
            <a
              key={l.id}
              className="icon-btn social-btn"
              href={l.href}
              {...(isExternal(l) ? { target: "_blank", rel: "noreferrer" } : {})}
              aria-label={`${l.name}${l.network === "email" || l.network === "phone" ? "" : " profile"}`}
              title={l.name}
            >
              <SocialIcon link={l} />
            </a>
          ))}
        <span className="hdr-sep" aria-hidden="true" />
        <ThemeSwitch />
        {resumeUrl ? <ResumeButton href={resumeUrl} label={resumeLabel} /> : null}
        <MenuButton />
      </div>
    </HeaderShell>
  );
}

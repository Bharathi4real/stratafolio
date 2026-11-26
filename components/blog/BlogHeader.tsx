import Link from "next/link";
import { HeaderShell } from "@/components/header/HeaderShell";
import { ThemeSwitch } from "@/components/header/ThemeSwitch";
import { LogoMark } from "@/components/ui/LogoMark";
import { Pill } from "@/components/ui/Pill";
import type { Logo } from "@/lib/brand";
import { safeHref } from "@/lib/safe-url";

function RssIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" fill="currentColor" />
    </svg>
  );
}

/**
 * Standalone blog header: logo + blog name, optional extra links, RSS (when on), theme switch and
 * a way back to the portfolio (when on).
 */
export function BlogHeader({
  logo,
  blogName,
  portfolioLabel,
  showPortfolioLink = true,
  links = [],
  rss,
}: {
  logo: Logo;
  blogName: string;
  portfolioLabel: string;
  showPortfolioLink?: boolean;
  links?: { label: string; href: string }[];
  rss: boolean;
}) {
  const items = links.filter((l) => l.label?.trim());
  return (
    <HeaderShell>
      <Link href="/blog" className="brand blog-brand" aria-label={`${blogName}, all posts`}>
        <LogoMark logo={logo} />
        <span className="blog-divider" aria-hidden="true" />
        <span className="blog-name">{blogName}</span>
      </Link>
      {items.length ? (
        <nav className="blog-nav" aria-label="Blog">
          {items.map((l, i) => {
            const href = safeHref(l.href);
            const key = `${i}-${href}`;
            return /^[/#?]/.test(href) ? (
              <Link key={key} href={href}>
                {l.label}
              </Link>
            ) : (
              <a key={key} href={href} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            );
          })}
        </nav>
      ) : null}
      <div className="header-actions">
        {rss ? (
          <a className="icon-btn" href="/blog/feed.xml" aria-label="RSS feed" title="RSS feed">
            <RssIcon />
          </a>
        ) : null}
        <ThemeSwitch />
        {showPortfolioLink ? (
          <Pill href="/" variant="ghost" arrow="↗" className="blog-portfolio">
            {portfolioLabel}
          </Pill>
        ) : null}
      </div>
    </HeaderShell>
  );
}

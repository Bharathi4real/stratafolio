import Link from "next/link";
import { BackToTop, PrivacyChoicesLink } from "@/components/footer/FooterActions";
import { Arrow, ArrowLabel } from "@/components/ui/Arrow";
import { currentYear } from "@/lib/now";
import { safeHref } from "@/lib/safe-url";
import { isExternal, type SocialLink } from "@/lib/socials";

/** Slim blog footer: no big mark or topo, just the meta row (Settings → Blog → Blog footer). */
export async function BlogFooter({
  name,
  blogName,
  links = [],
  socials = [],
  email = "",
  showEmail = false,
  showPortfolioLink = true,
  portfolioLabel,
  rss,
  showPrivacy = true,
  privacyChoices,
  backToTop = "Back to top ↑",
}: {
  name: string;
  blogName: string;
  links?: { label: string; href: string }[];
  /** Profiles already filtered by the layout (empty when footer socials are off). */
  socials?: SocialLink[];
  email?: string;
  showEmail?: boolean;
  showPortfolioLink?: boolean;
  portfolioLabel: string;
  rss: boolean;
  showPrivacy?: boolean;
  privacyChoices: boolean;
  backToTop?: string;
}) {
  const footerSocials = socials.filter((l) => l.inFooter);
  const mail = email.trim();
  const showMail = showEmail && mail !== "" && !footerSocials.some((l) => l.network === "email");
  return (
    <footer className="footer gutter blog-footer">
      <div className="footer-row eyebrow">
        <span>
          © {await currentYear()} {name}
        </span>
        <nav className="footer-links" aria-label={`${blogName} footer`}>
          {links
            .filter((l) => l.label?.trim())
            .map((l, i) => {
              const href = safeHref(l.href);
              const key = `${i}-${href}`;
              return /^[/#?]/.test(href) ? (
                <Link key={key} href={href}>
                  <ArrowLabel label={l.label} />
                </Link>
              ) : (
                <a key={key} href={href} target="_blank" rel="noreferrer">
                  <ArrowLabel label={l.label} />
                </a>
              );
            })}
          {footerSocials.map((l) => (
            <a
              key={l.id}
              href={safeHref(l.href)}
              {...(isExternal(l) ? { target: "_blank", rel: "noreferrer" } : {})}
            >
              {l.name} <Arrow dir="out" />
            </a>
          ))}
          {showMail ? (
            <a href={safeHref(`mailto:${mail}`)}>
              Email <Arrow dir="out" />
            </a>
          ) : null}
          {showPortfolioLink ? <Link href="/">{portfolioLabel}</Link> : null}
          {rss ? <a href="/blog/feed.xml">RSS</a> : null}
          {showPrivacy ? <Link href="/privacy">Privacy</Link> : null}
          {privacyChoices ? <PrivacyChoicesLink /> : null}
        </nav>
        <BackToTop label={backToTop} />
      </div>
    </footer>
  );
}

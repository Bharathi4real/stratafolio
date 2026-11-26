import Link from "next/link";
import { Arrow, ArrowLabel } from "@/components/ui/Arrow";
import { StaticTopo } from "@/components/ui/Topo";
import { currentYear } from "@/lib/now";
import { isExternal, type SocialLink } from "@/lib/socials";
import { BackToTop, PrivacyChoicesLink } from "./FooterActions";

export async function SiteFooter({
  brand,
  name,
  socials,
  email,
  backToTop,
  privacyChoices,
  showMark = true,
  links = [],
  showEmail = true,
  showPrivacy = true,
  blogLink = null,
}: {
  brand: string;
  name: string;
  socials: SocialLink[];
  email: string;
  backToTop: string;
  privacyChoices: boolean;
  showMark?: boolean;
  links?: { label: string; href: string }[];
  showEmail?: boolean;
  showPrivacy?: boolean;
  blogLink?: { label: string } | null;
}) {
  return (
    <footer className="footer gutter">
      <StaticTopo seed="footer" cx={600} cy={760} n={20} h={500} className="footer-topo" />
      {showMark ? (
        <div className="footer-mark" aria-hidden="true">
          {brand}
        </div>
      ) : null}
      <div className="footer-row eyebrow">
        <span>
          © {await currentYear()} {name}
        </span>
        <span className="footer-links">
          {socials
            .filter((l) => l.inFooter)
            .map((l) => (
              <a
                key={l.id}
                href={l.href}
                {...(isExternal(l) ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {l.name} <Arrow dir="out" />
              </a>
            ))}
          {!showEmail || socials.some((l) => l.network === "email" && l.inFooter) ? null : (
            <a href={`mailto:${email}`}>
              Email <Arrow dir="out" />
            </a>
          )}
          {links.map((l) =>
            /^(https?:|mailto:)/.test(l.href) ? (
              <a key={l.href + l.label} href={l.href} target="_blank" rel="noreferrer">
                <ArrowLabel label={l.label} />
              </a>
            ) : (
              <Link key={l.href + l.label} href={l.href}>
                <ArrowLabel label={l.label} />
              </Link>
            ),
          )}
          {blogLink ? <Link href="/blog">{blogLink.label}</Link> : null}
          {showPrivacy ? <Link href="/privacy">Privacy</Link> : null}
          {privacyChoices ? <PrivacyChoicesLink /> : null}
        </span>
        <BackToTop label={backToTop} />
      </div>
    </footer>
  );
}

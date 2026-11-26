import { EmberCanvas } from "@/components/hero/EmberCanvas";
import { HeroMotion } from "@/components/hero/HeroMotion";
import { Pill } from "@/components/ui/Pill";
import { Accent } from "@/components/ui/Rich";
import { SocialIcon } from "@/components/ui/SocialIcon";
import type { HeroBlock, SiteSettings } from "@/lib/content/schema";
import { isExternal, type SocialLink } from "@/lib/socials";

export function Hero({
  block,
  settings,
  socials,
}: {
  block: HeroBlock;
  settings: SiteSettings;
  socials: SocialLink[];
}) {
  const fullName = `${block.nameLine1} ${block.nameLine2}`;
  return (
    <HeroMotion reveal={block.nameReveal !== false}>
      {block.shader !== false ? (
        <EmberCanvas />
      ) : (
        <canvas className="is-fallback" aria-hidden="true" tabIndex={-1} />
      )}
      <div className="hero-inner gutter" data-hero-inner>
        <div className="hero-top eyebrow" data-hero-hide>
          <span>{block.eyebrow}</span>
          {block.showCoords !== false ? (
            <span className="coords">
              {settings.locationShort} · {settings.coords}
            </span>
          ) : null}
        </div>

        <h1 className="hero-name" aria-label={fullName}>
          <span className="l1" data-hero-name aria-hidden="true">
            {block.nameLine1}
          </span>
          <span className="l2" data-hero-name aria-hidden="true">
            {block.nameLine2}
          </span>
        </h1>

        <div className="hero-bottom">
          <p className="hero-tagline muted" data-hero-hide>
            <Accent text={block.tagline} />
          </p>
          <div className="now" data-hero-hide>
            <span className="eyebrow muted">{block.currentlyLabel}</span>
            <span className="now-line">
              <span className="dot" aria-hidden="true" />
              {block.currently}
            </span>
            {block.showSocials !== false ? (
              <span className="hero-social">
                {socials
                  .filter((l) => l.inHero)
                  .map((l) => (
                    <a
                      key={l.id}
                      href={l.href}
                      {...(isExternal(l) ? { target: "_blank", rel: "noreferrer" } : {})}
                    >
                      <SocialIcon link={l} />
                      <span>{l.name}</span>
                    </a>
                  ))}
              </span>
            ) : null}
          </div>
          <div className="hero-ctas" data-hero-hide>
            {block.primaryLabel && block.primaryHref ? (
              <Pill href={block.primaryHref} variant="accent" large arrow="↘">
                {block.primaryLabel}
              </Pill>
            ) : null}
            {block.secondaryLabel && block.secondaryHref ? (
              <Pill href={block.secondaryHref} variant="ghost" large>
                {block.secondaryLabel}
              </Pill>
            ) : null}
          </div>
        </div>
      </div>
      <span className="scroll-cue" aria-hidden="true" />
    </HeroMotion>
  );
}

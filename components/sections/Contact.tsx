import { ContactForm } from "@/components/contact/ContactForm";
import { CopyEmail } from "@/components/contact/CopyEmail";
import { Arrow } from "@/components/ui/Arrow";
import { LiveClock } from "@/components/ui/LiveClock";
import { ResumeButton } from "@/components/ui/ResumeButton";
import { Accent } from "@/components/ui/Rich";
import { SocialIcon } from "@/components/ui/SocialIcon";
import { StatusTag } from "@/components/ui/StatusTag";
import { CardTopo, StaticTopo } from "@/components/ui/Topo";
import type { ContactBlock, SiteSettings } from "@/lib/content/schema";
import { isExternal, NETWORK, type SocialLink } from "@/lib/socials";

export function Contact({
  block,
  num,
  settings,
  socials,
  resumeUrl,
}: {
  block: ContactBlock;
  num: string;
  settings: SiteSettings;
  socials: SocialLink[];
  resumeUrl?: string;
}) {
  const status = settings.openToWork ? settings.statusLong : settings.statusOff;
  return (
    <section className="contact gutter" id={block.anchor ?? "contact"}>
      <div className="contact-card" data-reveal>
        <StaticTopo seed="contact" cx={125} cy={720} n={24} />
        <div className="contact-top">
          <p className="eyebrow accent">
            {num} / {block.label}
          </p>
          {status ? <StatusTag value={status} /> : null}
        </div>
        <h2 data-split>
          <Accent text={block.heading} />
        </h2>

        <div className="contact-grid">
          <div className="contact-left">
            <CopyEmail email={settings.email} label={block.emailLabel ?? "Email me"} />
            <dl className="contact-meta">
              <div>
                <dt className="eyebrow">Based in</dt>
                <dd>{settings.locationShort}</dd>
              </div>
              <div>
                <dt className="eyebrow">Local time</dt>
                <dd>
                  <LiveClock timeZone={settings.timeZone ?? "Asia/Kolkata"} />
                </dd>
              </div>
              {settings.showPhone && settings.phone ? (
                <div>
                  <dt className="eyebrow">Phone</dt>
                  <dd>
                    <a href={`tel:${settings.phone.replace(/\s+/g, "")}`}>{settings.phone}</a>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="profiles" data-reveal>
              {socials
                .filter((l) => l.inContact)
                .map((l) => (
                  <a
                    key={l.id}
                    className="profile"
                    href={l.href}
                    {...(isExternal(l) ? { target: "_blank", rel: "noreferrer" } : {})}
                  >
                    <CardTopo seed={`profile-${l.id}`} />
                    <span
                      className={`profile-ic is-${l.network}`}
                      style={
                        !l.iconUrl && NETWORK[l.network]?.tile
                          ? { background: NETWORK[l.network].tile, color: "#fff" }
                          : undefined
                      }
                    >
                      <SocialIcon link={l} />
                    </span>
                    <span className="profile-txt">
                      <span className="eyebrow">{l.name}</span>
                      {l.handle ? <strong>{l.handle}</strong> : null}
                      {l.caption ? <span className="muted">{l.caption}</span> : null}
                    </span>
                    <span className="profile-arrow" aria-hidden="true">
                      <Arrow dir="out" />
                    </span>
                  </a>
                ))}
            </div>
            {resumeUrl ? (
              <div className="socials">
                <ResumeButton
                  href={resumeUrl}
                  label={block.resumeLabel ?? "Download résumé"}
                  variant="ghost"
                />
              </div>
            ) : null}
          </div>

          <ContactForm
            copy={{
              formTitle: block.formTitle ?? "Send a message",
              formNote: block.formNote ?? "",
              topicsLegend: block.topicsLegend ?? "I’m reaching out about",
              topics: (block.topics ?? []).map((t) => ({ value: t.value, label: t.label })),
              nameLabel: block.nameLabel ?? "Your name",
              emailLabel: block.emailFieldLabel ?? "Email",
              messageLabel: block.messageLabel ?? "Message",
              // Older content still holds the slider's label; the form now sends with one click.
              slideLabel:
                !block.slideLabel || /slide/i.test(block.slideLabel)
                  ? "Send message"
                  : block.slideLabel,
              sendingLabel: block.sendingLabel ?? "Sending",
              sentLabel: block.sentLabel ?? "Delivered",
              successText: block.successText ?? "Thanks!",
              errorText: block.errorText ?? "Couldn’t send right now.",
              privacyNote: block.privacyNote ?? "",
              fallbackEmail: settings.email,
            }}
          />
        </div>
      </div>
    </section>
  );
}

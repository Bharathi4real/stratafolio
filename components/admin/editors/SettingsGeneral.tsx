"use client";

import { type SiteSettings, SOCIAL_NETWORKS } from "@/lib/content/schema";
import { NETWORK, socialsOf } from "@/lib/socials";
import { EditorChrome } from "../EditorChrome";
import { MediaField } from "../media";
import { Repeater, RepItem } from "../Repeater";
import { SetGrid } from "../ui";
import { useGlobalForm } from "../useDocForm";

export function SettingsGeneral({
  initial,
  published,
  hasDraft,
  tabs,
}: {
  initial: SiteSettings;
  published: boolean;
  hasDraft: boolean;
  tabs: React.ReactNode;
}) {
  // Older content kept GitHub/LinkedIn in separate fields: show them as list items to edit.
  const start = initial.socials?.length
    ? initial
    : {
        ...initial,
        socials: socialsOf(initial).map(({ name: _n, href: _h, iconUrl: _i, ...l }) => l),
      };
  const { form, ...doc } = useGlobalForm("site-settings", start);
  return (
    <>
      <EditorChrome
        title="Site"
        accent="settings"
        desc="Global content and switches used across every page."
        published={published}
        hasDraft={hasDraft}
        {...doc}
        onRestored={doc.restore}
      />
      {tabs}
      <SetGrid
        title="Identity"
        desc="Name, brand mark and role used in the header, footer and metadata."
      >
        <div className="row2">
          <form.AppField name="fullName">{(f) => <f.Text label="Full name" />}</form.AppField>
          <form.AppField name="brand">
            {(f) => <f.Text label="Brand mark" hint="Header logo and giant footer mark." />}
          </form.AppField>
        </div>
        <div className="row2">
          <form.AppField name="role">{(f) => <f.Text label="Role" />}</form.AppField>
          <form.AppField name="firstName">
            {(f) => <f.Text label="First name" hint="Used in the author card." />}
          </form.AppField>
        </div>
        <div className="row2">
          <form.AppField name="initials">
            {(f) => <f.Text label="Initials" maxLength={3} />}
          </form.AppField>
          <form.AppField name="byline">
            {(f) => <f.Text label="Byline" hint="Under your name on blog posts." />}
          </form.AppField>
        </div>
        <form.AppField name="authorBio">
          {(f) => <f.Area label="Author bio" hint="Author card at the end of every post." />}
        </form.AppField>
      </SetGrid>
      <SetGrid title="Status tag" desc="The dashed ember tag in Contact and the menu.">
        <form.AppField name="openToWork">
          {(f) => <f.Toggle title="Open to work" desc="Shows the “off” text when switched off" />}
        </form.AppField>
        <div className="row2">
          <form.AppField name="statusShort">{(f) => <f.Text label="Short (menu)" />}</form.AppField>
          <form.AppField name="statusLong">
            {(f) => <f.Text label="Long (contact)" />}
          </form.AppField>
        </div>
        <form.AppField name="statusOff">{(f) => <f.Text label="When not looking" />}</form.AppField>
      </SetGrid>
      <SetGrid title="Contact & location" desc="Shown in Contact, the menu, footer and hero.">
        <div className="row2">
          <form.AppField name="email">{(f) => <f.Text label="Email" type="email" />}</form.AppField>
          <form.AppField name="phone">{(f) => <f.Text label="Phone" />}</form.AppField>
        </div>
        <form.AppField name="showPhone">
          {(f) => (
            <f.Toggle
              title="Show phone publicly"
              desc="Bots scrape public numbers; email-only is fine too"
            />
          )}
        </form.AppField>
        <div className="row2">
          <form.AppField name="location">{(f) => <f.Text label="Location" />}</form.AppField>
          <form.AppField name="locationShort">
            {(f) => <f.Text label="Location (short)" />}
          </form.AppField>
        </div>
        <div className="row2">
          <form.AppField name="city">
            {(f) => <f.Text label="City" hint="Label above the live clock." />}
          </form.AppField>
          <form.AppField name="timeZone">
            {(f) => <f.Text label="Time zone" hint="IANA name, e.g. Asia/Kolkata." mono />}
          </form.AppField>
        </div>
        <form.AppField name="coords">{(f) => <f.Text label="Coordinates line" />}</form.AppField>
      </SetGrid>
      <SetGrid
        title="Profiles & links"
        desc="GitHub, LinkedIn, daily.dev, X, email and more. Pick where each one shows: header icons, hero, contact cards, menu and footer. Reorder with the arrows."
      >
        <form.Field name="socials" mode="array">
          {(arr) => (
            <Repeater
              label="Links"
              count={arr.state.value.length}
              max={16}
              addLabel="+ Add link"
              onAdd={() =>
                arr.pushValue({
                  id: `s-${Date.now().toString(36)}`,
                  network: "website",
                  url: "",
                  label: "",
                  handle: "",
                  caption: "",
                  icon: null,
                  inHeader: false,
                  inHero: true,
                  inContact: true,
                  inMenu: true,
                  inFooter: true,
                })
              }
            >
              {arr.state.value.map((l, i) => (
                <RepItem
                  key={l.id}
                  index={i}
                  total={arr.state.value.length}
                  title={`${l.label || NETWORK[l.network]?.name || "Link"}${l.handle ? ` · ${l.handle}` : ""}`}
                  onMove={(to) => arr.moveValue(i, to)}
                  onRemove={() => arr.removeValue(i)}
                >
                  <div className="row2">
                    <form.AppField name={`socials[${i}].network` as const}>
                      {(f) => (
                        <f.SelectInput
                          label="Network"
                          options={SOCIAL_NETWORKS.map((n) => ({
                            value: n,
                            label: NETWORK[n].name,
                          }))}
                        />
                      )}
                    </form.AppField>
                    <form.AppField name={`socials[${i}].url` as const}>
                      {(f) => (
                        <f.Text
                          label={
                            l.network === "email"
                              ? "Email address"
                              : l.network === "phone"
                                ? "Phone number"
                                : "URL"
                          }
                          mono
                        />
                      )}
                    </form.AppField>
                  </div>
                  <div className="row2">
                    <form.AppField name={`socials[${i}].label` as const}>
                      {(f) => (
                        <f.Text label="Name" hint={`Empty shows “${NETWORK[l.network]?.name}”.`} />
                      )}
                    </form.AppField>
                    <form.AppField name={`socials[${i}].handle` as const}>
                      {(f) => (
                        <f.Text
                          label="Handle"
                          hint="Big text on the contact card, e.g. @Bharathi4real."
                        />
                      )}
                    </form.AppField>
                  </div>
                  <form.AppField name={`socials[${i}].caption` as const}>
                    {(f) => <f.Text label="Caption" hint="Small line on the contact card." />}
                  </form.AppField>
                  <form.AppField name={`socials[${i}].icon` as const}>
                    {() => (
                      <MediaField
                        label="Custom icon (optional)"
                        accept="image"
                        hint="Square SVG or PNG. Empty uses the built-in icon for the network."
                      />
                    )}
                  </form.AppField>
                  <fieldset className="place-grid">
                    <legend className="flabel">Show in</legend>
                    {(
                      [
                        ["inHeader", "Header"],
                        ["inHero", "Hero"],
                        ["inContact", "Contact cards"],
                        ["inMenu", "Menu"],
                        ["inFooter", "Footer"],
                      ] as const
                    ).map(([k, t]) => (
                      <form.AppField key={k} name={`socials[${i}].${k}` as const}>
                        {(f) => <f.Toggle title={t} />}
                      </form.AppField>
                    ))}
                  </fieldset>
                </RepItem>
              ))}
            </Repeater>
          )}
        </form.Field>
      </SetGrid>
      <div id="resume">
        <SetGrid title="Résumé" desc="The PDF behind every “Résumé” button.">
          <form.AppField name="resume">
            {() => <MediaField label="Current file" accept="pdf" />}
          </form.AppField>
          <form.AppField name="resumeLabel">{(f) => <f.Text label="Button label" />}</form.AppField>
        </SetGrid>
      </div>
    </>
  );
}

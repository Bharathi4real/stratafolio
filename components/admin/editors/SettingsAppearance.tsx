"use client";

import { useStore } from "@tanstack/react-form";
import { Arrow } from "@/components/ui/Arrow";
import type { AppearanceData } from "@/lib/content/schema";
import {
  DEFAULT_PALETTE,
  hexToRgb,
  PRESETS,
  paletteChecks,
  palettePreviewCss,
  resolvePalette,
} from "@/lib/palette";
import { AdminPrefs } from "../AdminPrefs";
import { EditorChrome } from "../EditorChrome";
import { MediaField } from "../media";
import { Btn, SetGrid } from "../ui";
import { useGlobalForm } from "../useDocForm";

const ratio = (n: number) => `${n.toFixed(1)}:1`;

/**
 * Settings → Appearance: pick a preset palette or a custom accent, see it live, publish.
 * The default (Ink & Ember) is always one click away, and every change is in Versions.
 */
export function SettingsAppearance({
  initial,
  published,
  hasDraft,
  tabs,
}: {
  initial: AppearanceData;
  published: boolean;
  hasDraft: boolean;
  tabs: React.ReactNode;
}) {
  const { form, ...doc } = useGlobalForm("appearance", initial);
  const values = useStore(form.store, (s) => s.values) as AppearanceData;
  const palette = values.palette ?? DEFAULT_PALETTE;
  const custom = values.custom ?? "#ff5a1f";
  const isDefault = palette === DEFAULT_PALETTE;
  const checks = paletteChecks(values);
  const current = resolvePalette(values);

  const pick = (id: string) => form.setFieldValue("palette", id);
  const setCustom = (hex: string) => {
    form.setFieldValue("custom", hex);
    form.setFieldValue("palette", "custom");
  };

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
      >
        <Btn href="/api/preview?path=/" external>
          Preview on site <Arrow dir="out" />
        </Btn>
      </EditorChrome>
      {tabs}
      <AdminPrefs />

      {/* Scoped live preview of the chosen palette (the rest of the admin keeps the published one). */}
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: CSS built from validated hex values */}
      <style dangerouslySetInnerHTML={{ __html: palettePreviewCss(values, ".pal-scope") }} />

      <SetGrid
        title="Colour palette"
        desc="Re-tints the whole site: buttons, links, highlights, the hero shader and the admin. Neutrals (ink and paper) stay the same in both themes."
      >
        <div className="pal-grid" role="radiogroup" aria-label="Palette">
          {PRESETS.map((p) => (
            <label key={p.id} className={`pal-card${palette === p.id ? " is-on" : ""}`}>
              <input
                type="radio"
                name="palette"
                value={p.id}
                checked={palette === p.id}
                onChange={() => pick(p.id)}
              />
              <span className="pal-sw" aria-hidden="true">
                <i style={{ background: p.accent.s300 }} />
                <i style={{ background: p.accent.s500 }} />
                <i style={{ background: p.accent.s700 }} />
                <i style={{ background: p.signal.s400 }} />
              </span>
              <b>
                {p.name}
                {p.id === DEFAULT_PALETTE ? <em>Default</em> : null}
              </b>
              <small>{p.note}</small>
            </label>
          ))}
          <label className={`pal-card${palette === "custom" ? " is-on" : ""}`}>
            <input
              type="radio"
              name="palette"
              value="custom"
              checked={palette === "custom"}
              onChange={() => pick("custom")}
            />
            <span className="pal-sw" aria-hidden="true">
              {palette === "custom" ? (
                <>
                  <i style={{ background: current.accent.s300 }} />
                  <i style={{ background: current.accent.s500 }} />
                  <i style={{ background: current.accent.s700 }} />
                </>
              ) : (
                <i className="pal-rainbow" />
              )}
            </span>
            <b>Custom</b>
            <small>Pick any accent; lighter and darker shades are derived for you.</small>
          </label>
        </div>

        {palette === "custom" ? (
          <div className="pal-custom">
            <label className="pal-color">
              <input
                type="color"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                aria-label="Accent colour"
              />
            </label>
            <div className="field">
              <label htmlFor="pal-hex">Accent hex</label>
              <input
                id="pal-hex"
                className="inp inp-mono"
                defaultValue={custom}
                key={custom}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const hex = v.startsWith("#") ? v : `#${v}`;
                  if (hexToRgb(hex) && hex.length === 7) setCustom(hex.toLowerCase());
                  else e.target.value = custom;
                }}
                spellCheck={false}
              />
            </div>
          </div>
        ) : null}

        <div className="pal-actions">
          <Btn onClick={() => pick(DEFAULT_PALETTE)} disabled={isDefault}>
            Reset to default (Ink &amp; Ember)
          </Btn>
          <span className="hint">
            Changes save as a draft. Publish to apply them; restore any earlier palette from
            Versions.
          </span>
        </div>
      </SetGrid>

      <SetGrid title="Preview" desc="How the palette looks in both themes.">
        <div className="pal-previews">
          {(["dark", "light"] as const).map((t) => (
            <div key={t} className="pal-scope pal-preview" data-theme={t}>
              <span className="pal-eyebrow">{`// ${t} theme`}</span>
              <h3>
                Let’s build something <em>secure.</em>
              </h3>
              <p>
                Body copy with <span className="pal-link">an inline link</span> and a{" "}
                <code className="pal-code">code tag</code>.
              </p>
              <div className="pal-row">
                <span className="pal-btn">
                  View work <Arrow dir="right" />
                </span>
                <span className="pal-chip">Open to work</span>
                <span className="pal-dot" />
              </div>
            </div>
          ))}
        </div>
        <ul className="pal-checks">
          <Check label="Accent text on dark" value={checks.darkText} />
          <Check label="Accent text on light" value={checks.lightText} />
          <Check label="Button label (dark)" value={checks.darkButton} />
          <Check label="Button label (light)" value={checks.lightButton} />
        </ul>
      </SetGrid>

      <SetGrid
        title="Logo"
        desc="The mark in the site header. Text uses the display font with the accent dot; an image can be SVG, PNG or WebP."
      >
        <div className="row2">
          <form.AppField name="logoType">
            {(f) => (
              <f.SelectInput
                label="Logo type"
                options={[
                  { value: "text", label: "Text" },
                  { value: "image", label: "Image" },
                ]}
              />
            )}
          </form.AppField>
          <form.AppField name="logoText">
            {(f) => <f.Text label="Logo text" hint="Empty uses the brand from General." />}
          </form.AppField>
        </div>
        {values.logoType === "image" ? (
          <>
            <div className="row2">
              <form.AppField name="logoImage">
                {() => (
                  <MediaField
                    label="Logo image"
                    accept="image"
                    hint="Used in dark mode, and in light mode unless you add a light version."
                  />
                )}
              </form.AppField>
              <form.AppField name="logoImageLight">
                {() => (
                  <MediaField
                    label="Light-theme version (optional)"
                    accept="image"
                    hint="A darker logo for the light theme."
                  />
                )}
              </form.AppField>
            </div>
            <form.AppField name="logoHeight">
              {(f) => <f.NumberInput label="Height (px)" min={16} max={72} />}
            </form.AppField>
            {!values.logoImage ? (
              <p className="hint">Until you pick an image, the text logo is shown.</p>
            ) : null}
          </>
        ) : null}
      </SetGrid>

      <SetGrid
        title="Admin logo & tab title"
        desc="The mark at the top of this sidebar and what browser tabs say."
      >
        <div className="row2">
          <form.AppField name="adminTitle">
            {(f) => (
              <f.Text
                label="Browser tab title"
                hint="Tabs read “Messages · <this>”. Empty uses “<brand> Admin”."
              />
            )}
          </form.AppField>
          <form.AppField name="adminBadge">
            {(f) => <f.Text label="Badge next to the logo" hint="E.g. Admin, Studio, CMS." />}
          </form.AppField>
        </div>
        <div className="row2">
          <form.AppField name="adminLogo">
            {(f) => (
              <f.SelectInput
                label="Admin logo"
                options={[
                  { value: "same", label: "Same as the site" },
                  { value: "text", label: "Text" },
                  { value: "image", label: "Image" },
                ]}
              />
            )}
          </form.AppField>
          {values.adminLogo === "text" ? (
            <form.AppField name="adminLogoText">
              {(f) => <f.Text label="Admin logo text" hint="Empty uses the site logo text." />}
            </form.AppField>
          ) : values.adminLogo === "image" ? (
            <form.AppField name="adminLogoImage">
              {() => <MediaField label="Admin logo image" accept="image" />}
            </form.AppField>
          ) : null}
        </div>
      </SetGrid>

      <SetGrid
        title="Favicon"
        desc="The browser tab icon. Square SVG or PNG (at least 512×512) works best; ICO is fine too. Empty uses the built-in icon."
      >
        <div className="row2">
          <form.AppField name="favicon">
            {() => <MediaField label="Site favicon" accept="image" />}
          </form.AppField>
          <form.AppField name="adminFavicon">
            {() => (
              <MediaField
                label="Admin favicon (optional)"
                accept="image"
                hint="Handy to tell the admin tab apart. Empty uses the site favicon."
              />
            )}
          </form.AppField>
        </div>
      </SetGrid>
    </>
  );
}

function Check({ label, value }: { label: string; value: number }) {
  const ok = value >= 4.5;
  const large = value >= 3;
  return (
    <li className={ok ? "is-ok" : large ? "is-warn" : "is-bad"}>
      <span>{label}</span>
      <b className="mono">{ratio(value)}</b>
      <small>{ok ? "Passes AA" : large ? "Large text only" : "Too low"}</small>
    </li>
  );
}

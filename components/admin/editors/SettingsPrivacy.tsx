"use client";

import { useStore } from "@tanstack/react-form";
import type { Privacy, RichDoc } from "@/lib/content/schema";

/** Rich-text fields are typed opaque in the form so TanStack Form’s deep path types stay shallow. */
type Vals = Omit<Privacy, "policy"> & { policy?: unknown };

import { EditorChrome } from "../EditorChrome";
import { RichEditor } from "../rich/RichEditor";
import { SetGrid } from "../ui";
import { useGlobalForm } from "../useDocForm";
import { VersionHistory } from "../VersionHistory";

export function SettingsPrivacy({
  initial,
  published,
  hasDraft,
  tabs,
}: {
  initial: Privacy;
  published: boolean;
  hasDraft: boolean;
  tabs: React.ReactNode;
}) {
  const { form, ...doc } = useGlobalForm<Vals>("privacy", initial);
  const ga4 = useStore(form.store, (st) =>
    Boolean((st.values as { ga4Enabled?: boolean }).ga4Enabled),
  );
  return (
    <>
      <EditorChrome
        title="Analytics"
        accent="& privacy"
        desc="Cookieless tools need no consent; optional tools only load after a visitor opts in."
        published={published}
        hasDraft={hasDraft}
        {...doc}
        onRestored={doc.restore}
      />
      {tabs}
      <SetGrid
        title="Analytics"
        desc="Turning on an optional tool automatically enables the consent card."
      >
        <div className="card" style={{ background: "var(--input)" }}>
          <div className="card-b" style={{ padding: ".2rem 1rem" }}>
            <form.AppField name="siteStats">
              {(f) => (
                <f.Toggle
                  title="Site stats (built in)"
                  desc="Cookieless visitor, page and blog-read counts in Admin → Stats. Browsers signed in to the admin are never counted. Open /api/e in any browser to see whether it’s counted and why."
                />
              )}
            </form.AppField>
            <form.AppField name="statsHonorDnt">
              {(f) => (
                <f.Toggle
                  title="Skip Do Not Track / GPC browsers"
                  desc="Privacy browsers (Brave, DuckDuckGo, many Firefox setups) send these signals. The stats are anonymous and cookieless either way; turn this off to count them too."
                />
              )}
            </form.AppField>
            <form.AppField name="vercelAnalytics">
              {(f) => <f.Toggle title="Vercel Web Analytics" desc="Cookieless page views" />}
            </form.AppField>
            <form.AppField name="speedInsights">
              {(f) => <f.Toggle title="Vercel Speed Insights" desc="Real-user Core Web Vitals" />}
            </form.AppField>
            <form.AppField name="ga4Enabled">
              {(f) => <f.Toggle title="Google Analytics 4" desc="Optional · requires consent" />}
            </form.AppField>
          </div>
        </div>
        {ga4 ? (
          <form.AppField name="ga4Id">
            {(f) => <f.Text label="GA4 measurement ID" placeholder="G-XXXXXXX" mono />}
          </form.AppField>
        ) : null}
      </SetGrid>
      <SetGrid title="Consent card" desc="Appears only when an optional tool is on.">
        <div className="callout">
          <b>Consent card: {ga4 ? "on" : "off"}</b>
          {ga4
            ? "Visitors are asked once; GPC/Do Not Track counts as “reject”."
            : "No optional tools are enabled, so visitors never see a popup."}
        </div>
        <form.AppField name="consentTitle">{(f) => <f.Text label="Title" />}</form.AppField>
        <form.AppField name="consentBody">{(f) => <f.Area label="Card text" />}</form.AppField>
        <div className="row2">
          <form.AppField name="acceptLabel">
            {(f) => <f.Text label="Accept button" />}
          </form.AppField>
          <form.AppField name="rejectLabel">
            {(f) => <f.Text label="Reject button" />}
          </form.AppField>
        </div>
        <div className="row2">
          <form.AppField name="chooseLabel">{(f) => <f.Text label="Choose link" />}</form.AppField>
          <form.AppField name="policyVersion">
            {(f) => (
              <f.NumberInput label="Policy version" hint="Bump to ask everyone again." min={1} />
            )}
          </form.AppField>
        </div>
      </SetGrid>
      <SetGrid title="Policy" desc="The /privacy page and message retention.">
        <div className="row2">
          <form.AppField name="retentionMonths">
            {(f) => <f.NumberInput label="Message retention (months)" min={1} max={36} />}
          </form.AppField>
          <form.AppField name="statsRetentionMonths">
            {(f) => (
              <f.NumberInput
                label="Stats retention (months)"
                hint="0 keeps stats forever, so All time stays complete. Stats hold no personal data."
                min={0}
                max={120}
              />
            )}
          </form.AppField>
          <form.AppField name="binDays">
            {(f) => (
              <f.NumberInput
                label="Media bin (days)"
                hint="Files in the bin are deleted from storage after this many days. 0 keeps them until you empty the bin."
                min={0}
                max={365}
              />
            )}
          </form.AppField>
          <form.AppField name="updated">
            {(f) => <f.DateInput label="Last updated" />}
          </form.AppField>
        </div>
        <form.Field name="policy">
          {(f) => (
            <div className="field">
              <p className="flabel">Privacy policy</p>
              <div className="card rt-card">
                <RichEditor
                  value={f.state.value as RichDoc | null}
                  onChange={(v) => f.handleChange(v)}
                  compact
                />
              </div>
            </div>
          )}
        </form.Field>
      </SetGrid>
      <VersionHistory />
    </>
  );
}

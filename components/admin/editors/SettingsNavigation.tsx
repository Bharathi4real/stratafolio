"use client";

import type { Navigation } from "@/lib/content/schema";
import { EditorChrome } from "../EditorChrome";
import { Repeater, RepItem } from "../Repeater";
import { SetGrid } from "../ui";
import { useGlobalForm } from "../useDocForm";

export function SettingsNavigation({
  initial,
  published,
  hasDraft,
  tabs,
}: {
  initial: Navigation;
  published: boolean;
  hasDraft: boolean;
  tabs: React.ReactNode;
}) {
  const { form, ...doc } = useGlobalForm("navigation", initial);
  const list = (name: "dock" | "menu" | "footerLinks", title: string, desc: string) => (
    <SetGrid title={title} desc={desc}>
      <form.Field name={name} mode="array">
        {(arr) => (
          <Repeater
            label="Links"
            count={arr.state.value.length}
            onAdd={() =>
              arr.pushValue({ label: "New link", href: name === "footerLinks" ? "/" : "#about" })
            }
            max={name === "dock" ? 7 : undefined}
          >
            {arr.state.value.map((l, i) => (
              <RepItem
                key={`${name}-${i}-${l.href}`}
                index={i}
                total={arr.state.value.length}
                title={l.label}
                onMove={(to) => arr.moveValue(i, to)}
                onRemove={() => arr.removeValue(i)}
              >
                <div className="row2">
                  <form.AppField name={`${name}[${i}].label` as const}>
                    {(f) => <f.Text label="Label" />}
                  </form.AppField>
                  <form.AppField name={`${name}[${i}].href` as const}>
                    {(f) => <f.Text label="Link" hint="#section, /page or full URL" mono />}
                  </form.AppField>
                </div>
              </RepItem>
            ))}
          </Repeater>
        )}
      </form.Field>
    </SetGrid>
  );
  return (
    <>
      <EditorChrome
        title="Portfolio"
        accent="header & footer"
        desc="The portfolio’s top bar, menu and footer. The blog has its own in Blog settings."
        published={published}
        hasDraft={hasDraft}
        {...doc}
        onRestored={doc.restore}
      />
      {tabs}
      {list(
        "dock",
        "Header dock",
        "Order and labels of the top navigation. Numbers follow the home page section order.",
      )}
      {list("menu", "Overlay menu", "The full-screen menu on mobile and from the menu button.")}
      <SetGrid
        id="footer"
        title="Footer"
        desc="The bottom of every portfolio page (the blog has its own in Blog settings): the giant mark, the © line and the link row. Profile links (GitHub, LinkedIn…) come from General → Profiles & links, where each has a “Footer” switch."
      >
        <form.AppField name="showFooterMark">
          {(f) => <f.Toggle title="Show the giant mark" desc="The large word above the link row" />}
        </form.AppField>
        <div className="row2">
          <form.AppField name="footerMark">
            {(f) => <f.Text label="Mark text" hint="Empty uses the brand from General." />}
          </form.AppField>
          <form.AppField name="footerName">
            {(f) => <f.Text label="© name" hint="Empty uses your full name from General." />}
          </form.AppField>
        </div>
        <form.AppField name="showFooterEmail">
          {(f) => <f.Toggle title="Show “Email” link" desc="Opens your email from General" />}
        </form.AppField>
        <form.AppField name="showPrivacyLink">
          {(f) => <f.Toggle title="Show “Privacy” link" desc="Links to /privacy" />}
        </form.AppField>
        <form.AppField name="showBlogLink">
          {(f) => <f.Toggle title="Show “Blog” link" desc="Links to /blog" />}
        </form.AppField>
        <form.AppField name="showPrivacyChoices">
          {(f) => <f.Toggle title="Show “Privacy choices” link" desc="Re-opens the consent card" />}
        </form.AppField>
        <div className="row2">
          <form.AppField name="blogLinkLabel">
            {(f) => <f.Text label="Blog link label" />}
          </form.AppField>
          <form.AppField name="backToTopLabel">
            {(f) => <f.Text label="Back-to-top label" />}
          </form.AppField>
        </div>
      </SetGrid>
      {list(
        "footerLinks",
        "Footer links",
        "Extra links in the footer row, e.g. Uses, Now or a résumé page.",
      )}
    </>
  );
}

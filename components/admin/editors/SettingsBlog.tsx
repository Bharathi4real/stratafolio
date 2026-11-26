"use client";

import type { BlogPage } from "@/lib/content/schema";
import { EditorChrome } from "../EditorChrome";
import { Repeater, RepItem } from "../Repeater";
import { SetGrid } from "../ui";
import { useGlobalForm } from "../useDocForm";

export function SettingsBlog({
  initial,
  published,
  hasDraft,
  tabs,
}: {
  initial: BlogPage;
  published: boolean;
  hasDraft: boolean;
  tabs?: React.ReactNode;
}) {
  const { form, ...doc } = useGlobalForm("blog-page", initial);
  const links = (name: "headerLinks" | "footerLinks") => (
    <form.Field name={name} mode="array">
      {(arr) => (
        <Repeater
          label="Links"
          count={arr.state.value.length}
          onAdd={() => arr.pushValue({ label: "New link", href: "/blog" })}
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
  );
  return (
    <>
      <EditorChrome
        title="Blog settings"
        accent="settings"
        desc="Your blog’s name, page copy, categories and feed. Posts live in Blog posts."
        published={published}
        hasDraft={hasDraft}
        {...doc}
        onRestored={doc.restore}
      />
      {tabs}
      <SetGrid
        title="Blog site"
        desc="The blog has its own header and footer, separate from the portfolio."
      >
        <form.AppField name="siteName">
          {(f) => (
            <f.Text
              label="Blog name"
              hint="Shown next to your logo and in the browser tab. Empty: your brand + “· Blog”."
            />
          )}
        </form.AppField>
        <form.AppField name="rss">
          {(f) => (
            <f.Toggle
              title="RSS feed"
              desc="Adds /blog/feed.xml and an RSS button. Off by default."
            />
          )}
        </form.AppField>
      </SetGrid>
      <SetGrid
        title="Blog header"
        desc="Links between your blog name and the buttons (hidden on narrow screens), and the way back to the portfolio."
      >
        <form.AppField name="showPortfolioLink">
          {(f) => (
            <f.Toggle
              title="Show the portfolio link"
              desc="Header button and footer link back to /"
            />
          )}
        </form.AppField>
        <form.AppField name="portfolioLabel">
          {(f) => <f.Text label="Portfolio link label" hint="Header and footer link back to /." />}
        </form.AppField>
        {links("headerLinks")}
      </SetGrid>
      <SetGrid
        title="Blog footer"
        desc="The © line and link row at the bottom of every blog page. Profile links (GitHub, LinkedIn…) come from General → Profiles & links, where each has a “Footer” switch."
      >
        <div className="row2">
          <form.AppField name="footerName">
            {(f) => <f.Text label="© name" hint="Empty uses your full name from General." />}
          </form.AppField>
          <form.AppField name="backToTopLabel">
            {(f) => <f.Text label="Back-to-top label" />}
          </form.AppField>
        </div>
        <form.AppField name="showFooterSocials">
          {(f) => (
            <f.Toggle
              title="Show profile links"
              desc="Profiles with the “Footer” switch on in General"
            />
          )}
        </form.AppField>
        <form.AppField name="showFooterEmail">
          {(f) => <f.Toggle title="Show “Email” link" desc="Opens your email from General" />}
        </form.AppField>
        <form.AppField name="showPrivacyLink">
          {(f) => <f.Toggle title="Show “Privacy” link" desc="Links to /privacy" />}
        </form.AppField>
        <form.AppField name="showPrivacyChoices">
          {(f) => <f.Toggle title="Show “Privacy choices” link" desc="Re-opens the consent card" />}
        </form.AppField>
        {links("footerLinks")}
      </SetGrid>
      <SetGrid title="Blog page" desc="Copy on /blog. Posts themselves live in Blog posts.">
        <form.AppField name="eyebrow">{(f) => <f.Text label="Eyebrow" />}</form.AppField>
        <form.AppField name="heading">
          {(f) => (
            <f.Text label="Heading" hint="Wrap the light-weight accent words in *asterisks*." />
          )}
        </form.AppField>
        <form.AppField name="intro">{(f) => <f.Area label="Intro" />}</form.AppField>
        <div className="row2">
          <form.AppField name="archiveHeading">
            {(f) => <f.Text label="Archive heading" />}
          </form.AppField>
          <form.AppField name="emptyText">
            {(f) => <f.Text label="Empty filter text" />}
          </form.AppField>
        </div>
        <form.AppField name="perPage">
          {(f) => (
            <f.NumberInput
              label="Posts per page"
              hint="The archive splits into numbered pages (/blog?page=2). 3–50."
              min={3}
              max={50}
            />
          )}
        </form.AppField>
      </SetGrid>
      <SetGrid
        title="Categories"
        desc="Topics a post can belong to. The /blog filter lists them in this order, once a post uses them."
      >
        <form.AppField name="categories">
          {(f) => (
            <f.Tags
              label="Categories"
              placeholder="Add a category, press Enter"
              hint="Removing or renaming one doesn’t change posts that already use it; pick the new category in those posts. Publish this page to make new categories available to everyone."
            />
          )}
        </form.AppField>
      </SetGrid>
      <SetGrid title="Follow call-to-action" desc="Bottom of the listing.">
        <form.AppField name="ctaTitle">{(f) => <f.Text label="Title" />}</form.AppField>
        <form.AppField name="ctaBody">{(f) => <f.Text label="Text" />}</form.AppField>
      </SetGrid>
    </>
  );
}

"use client";

import { Arrow } from "@/components/ui/Arrow";
import type { Seo } from "@/lib/content/schema";
import { EditorChrome } from "../EditorChrome";
import { MediaField } from "../media";
import { SetGrid } from "../ui";
import { useGlobalForm } from "../useDocForm";

export function SettingsSeo({
  initial,
  published,
  hasDraft,
  tabs,
}: {
  initial: Seo;
  published: boolean;
  hasDraft: boolean;
  tabs: React.ReactNode;
}) {
  const { form, ...doc } = useGlobalForm("seo", initial);
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
      <SetGrid title="Defaults" desc="Used when a page or post doesn’t set its own.">
        <form.AppField name="siteTitle">
          {(f) => (
            <f.Text
              label="Site title"
              maxLength={70}
              hint="Google shows about 60 characters. Lead with your name, then role and stack."
            />
          )}
        </form.AppField>
        <form.AppField name="titleTemplate">
          {(f) => <f.Text label="Title template" hint="%s is replaced by the page title." />}
        </form.AppField>
        <form.AppField name="description">
          {(f) => (
            <f.Area
              label="Default description"
              maxLength={200}
              hint="Aim for 120–155 characters: who, where, what you build, with which stack."
            />
          )}
        </form.AppField>
        <form.AppField name="keywords">
          {(f) => (
            <f.Tags
              label="Keywords"
              hint="Google ignores this tag. Put the phrases people search for in titles, descriptions and headings."
            />
          )}
        </form.AppField>
        <form.AppField name="ogImage">
          {() => (
            <MediaField
              label="Default share image"
              accept="image"
              hint="Optional. A generated contour card is used when empty."
            />
          )}
        </form.AppField>
      </SetGrid>
      <SetGrid title="Indexing" desc="Sitemap and robots are generated automatically.">
        <form.AppField name="allowIndexing">
          {(f) => (
            <f.Toggle title="Allow search engines" desc="Preview deployments are always noindex" />
          )}
        </form.AppField>
        <form.AppField name="googleVerification">
          {(f) => (
            <f.Text label="Google Search Console verification" placeholder="token only" mono />
          )}
        </form.AppField>
        <form.AppField name="bingVerification">
          {(f) => (
            <f.Text
              label="Bing Webmaster Tools verification"
              placeholder="token only"
              hint="The content value of Bing’s msvalidate.01 meta tag."
              mono
            />
          )}
        </form.AppField>
        <form.AppField name="indexNow">
          {(f) => (
            <f.Toggle
              title="Notify Bing on publish (IndexNow)"
              desc="Publishing or removing a post or page tells Bing, Yandex and other IndexNow engines straight away. Google doesn’t use IndexNow; it reads the sitemap."
            />
          )}
        </form.AppField>
      </SetGrid>
      <SetGrid
        title="Crawlers & AI"
        desc="robots.txt and sitemap.xml are generated automatically from published content. llms.txt gives AI assistants a short map of the site."
      >
        <div className="seo-files">
          <a className="btn btn-sm" href="/robots.txt" target="_blank" rel="noreferrer">
            robots.txt <Arrow dir="out" />
          </a>
          <a className="btn btn-sm" href="/sitemap.xml" target="_blank" rel="noreferrer">
            sitemap.xml <Arrow dir="out" />
          </a>
          <a className="btn btn-sm" href="/llms.txt" target="_blank" rel="noreferrer">
            llms.txt <Arrow dir="out" />
          </a>
        </div>
        <form.AppField name="llmsTxt">
          {(f) => (
            <f.Toggle
              title="Publish llms.txt"
              desc="Lists your pages, case studies, posts and contact links in Markdown."
            />
          )}
        </form.AppField>
        <form.AppField name="llmsSummary">
          {(f) => (
            <f.Area
              label="llms.txt summary"
              hint="One or two sentences. Empty uses the description above."
            />
          )}
        </form.AppField>
        <form.AppField name="blockAiTraining">
          {(f) => (
            <f.Toggle
              title="Ask AI-training crawlers to stay out"
              desc="Adds GPTBot, Google-Extended, CCBot, ClaudeBot and others to robots.txt. Search engines are unaffected."
            />
          )}
        </form.AppField>
      </SetGrid>
    </>
  );
}

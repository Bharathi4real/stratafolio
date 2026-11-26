import type { Metadata } from "next";
import { SiteMotion } from "@/components/providers/SiteMotion";
import { About } from "@/components/sections/About";
import { BlogTeaser } from "@/components/sections/BlogTeaser";
import { Contact } from "@/components/sections/Contact";
import { Experience } from "@/components/sections/Experience";
import { Hero } from "@/components/sections/Hero";
import { Marquee } from "@/components/sections/Marquee";
import { Toolkit } from "@/components/sections/Toolkit";
import { Work } from "@/components/sections/Work";
import { JsonLd, profilePageLd, websiteLd } from "@/components/seo/JsonLd";
import { resolveAuthor } from "@/lib/author";
import {
  getAuthors,
  getExperience,
  getHome,
  getMediaUrl,
  getPosts,
  getProjects,
  getSeo,
  getSettings,
  getSocials,
  getToolkit,
} from "@/lib/queries";
import { numberSections } from "@/lib/site";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [home, settings, seo] = await Promise.all([getHome(), getSettings(), getSeo()]);
  const { visible, numbers } = numberSections(home);
  const needs = new Set(visible.map((s) => s.blockType));
  // Projects, roles and toolkit also feed the Person structured data, so they're always read
  // (all cached).
  const [projects, roles, toolkit, posts, authors] = await Promise.all([
    getProjects(),
    getExperience(),
    getToolkit(),
    needs.has("blogTeaser") ? getPosts() : Promise.resolve([]),
    getAuthors(),
  ]);
  // Person.image: the site owner's account photo (Settings → Users), when one is set.
  const ownerPhoto = [...authors.values()].find(
    (a) => a.role === "admin" && a.image && a.name === settings.fullName,
  )?.image;
  const [resumeUrl, socials] = await Promise.all([getMediaUrl(settings.resume), getSocials()]);
  const num = (id?: string | null) => (id ? (numbers.get(id) ?? "") : "");

  return (
    <>
      <JsonLd
        data={[
          profilePageLd(settings, roles, {
            description: seo.description,
            image: ownerPhoto,
            knowsAbout: [...new Set(toolkit?.layers?.flatMap((l) => l.tools) ?? [])].slice(0, 30),
            modified: projects
              .map((p) => p.updatedAt)
              .sort()
              .at(-1),
          }),
          websiteLd(settings, seo.description),
        ]}
      />
      {/* Every page needs one h1; the hero holds it, so keep one for crawlers and screen readers
          when the hero is hidden in the home builder. */}
      {needs.has("hero") ? null : (
        <h1 className="sr-only">
          {settings.fullName}, {settings.role}
        </h1>
      )}
      {visible.map((s) => {
        switch (s.blockType) {
          case "hero":
            return <Hero key={s.id} block={s} settings={settings} socials={socials} />;
          case "marquee":
            return <Marquee key={s.id} block={s} />;
          case "about":
            return <About key={s.id} block={s} num={num(s.id)} />;
          case "work":
            return <Work key={s.id} block={s} num={num(s.id)} projects={projects} />;
          case "experience":
            return <Experience key={s.id} block={s} num={num(s.id)} roles={roles} />;
          case "toolkit":
            return toolkit ? (
              <Toolkit key={s.id} block={s} num={num(s.id)} toolkit={toolkit} />
            ) : null;
          case "blogTeaser":
            return (
              <BlogTeaser
                key={s.id}
                block={s}
                num={num(s.id)}
                posts={posts}
                authorOf={(p) => resolveAuthor(p.authorId, authors, settings)}
              />
            );
          case "contact":
            return (
              <Contact
                key={s.id}
                block={s}
                num={num(s.id)}
                settings={settings}
                socials={socials}
                resumeUrl={resumeUrl}
              />
            );
          default:
            return null;
        }
      })}
      <SiteMotion />
    </>
  );
}

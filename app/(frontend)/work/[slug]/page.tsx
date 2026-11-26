import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteMotion } from "@/components/providers/SiteMotion";
import { breadcrumbLd, JsonLd, projectLd } from "@/components/seo/JsonLd";
import { Arrow } from "@/components/ui/Arrow";
import { noindexFollow } from "@/lib/document";
import { getBrand, getProject, getProjects, getSettings } from "@/lib/queries";

type Params = { params: Promise<{ slug: string }> };

/**
 * Posts and case studies are fully static. Requiring a complete static page (instead of the
 * App Shell for unknown slugs) also lets a missing slug answer with a real 404 status.
 */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  return (await getProjects()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [p, brand] = await Promise.all([getProject(slug), getBrand()]);
  // Metadata resolves before the page streams, so this sends a real 404 status.
  if (!p) notFound();
  const description = p.meta?.description || p.summary;
  return {
    title: p.meta?.title ? { absolute: p.meta.title } : p.title,
    description,
    alternates: { canonical: `/work/${p.slug}` },
    keywords: p.stack?.length ? p.stack : undefined,
    ...(p.meta?.noindex ? noindexFollow : {}),
    // A page's openGraph replaces the layout's whole object (shallow merge), so repeat siteName.
    openGraph: {
      type: "article",
      siteName: brand.siteName,
      locale: "en_US",
      title: p.meta?.title || p.title,
      description,
      url: `/work/${p.slug}`,
      modifiedTime: p.updatedAt,
      authors: [brand.ownerName],
      tags: p.stack ?? undefined,
    },
  };
}

export default async function CaseStudy({ params }: Params) {
  const { slug } = await params;
  const [project, projects, settings] = await Promise.all([
    getProject(slug),
    getProjects(),
    getSettings(),
  ]);
  if (!project) notFound();
  const i = projects.findIndex((p) => p.slug === project.slug);
  const index = String(i + 1).padStart(2, "0");
  const next = projects.length > 1 ? projects[(i + 1) % projects.length] : undefined;

  return (
    <div className="case-page">
      <JsonLd
        data={[
          projectLd(project, settings),
          breadcrumbLd([
            // No "Work" level: Google drops the fragment, so /#work would just be the home page.
            { name: "Home", path: "/" },
            { name: project.title, path: `/work/${project.slug}` },
          ]),
        ]}
      />
      <header className="case-hero gutter">
        <Link className="eyebrow case-crumb" href="/#work">
          <Arrow dir="left" /> Work / {index}
        </Link>
        <p className="eyebrow accent" data-reveal style={{ marginTop: "2rem" }}>
          {index} / {project.kind}
        </p>
        <h1 data-split>{project.title}</h1>
        <p className="lede" data-reveal>
          {project.summary}
        </p>
        <dl className="case-facts" data-reveal>
          <div>
            <dt className="eyebrow">Client</dt>
            <dd>{project.client}</dd>
          </div>
          <div>
            <dt className="eyebrow">Role</dt>
            <dd>{project.role ?? "Full-stack engineer"}</dd>
          </div>
          <div>
            <dt className="eyebrow">Stack</dt>
            <dd>
              <div className="tags">
                {project.stack?.map((s) => (
                  <span className="tag" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </dd>
          </div>
        </dl>
      </header>
      {project.metrics?.length ? (
        <div className="case-metrics gutter">
          {project.metrics.map((m) => (
            <div data-reveal key={m.label}>
              <strong>{m.value}</strong>
              <span>{m.label}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="case-body gutter">
        <p className="ctx" data-reveal>
          {project.context}
        </p>
        {project.sections?.map((s, n) => (
          <div className="case-sec" data-reveal key={s.heading}>
            <span className="eyebrow accent">{String(n + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="h3">{s.heading}</h2>
              <ul>
                {s.points?.map((pt) => (
                  <li key={pt}>{pt}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      {next && next.slug !== project.slug ? (
        <Link className="case-next gutter" href={`/work/${next.slug}`}>
          <span className="eyebrow muted">
            Next case study <Arrow dir="right" />
          </span>
          <h4>{next.title}</h4>
        </Link>
      ) : null}
      <SiteMotion />
    </div>
  );
}

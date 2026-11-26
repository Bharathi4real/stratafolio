import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { ArticleProgress } from "@/components/blog/ArticleProgress";
import { AuthorAvatar } from "@/components/blog/AuthorAvatar";
import { CoverImage } from "@/components/blog/CoverImage";
import { CoverCode, readLabel } from "@/components/blog/NoteFeature";
import { extractToc, RichText } from "@/components/blog/RichText";
import { ShareCopy } from "@/components/blog/ShareCopy";
import { SiteMotion } from "@/components/providers/SiteMotion";
import { breadcrumbLd, JsonLd, postLd, siteUrl } from "@/components/seo/JsonLd";
import { ReadTracker } from "@/components/stats/ReadTracker";
import { Arrow } from "@/components/ui/Arrow";
import { Pill } from "@/components/ui/Pill";
import { CardTopo, CoverTopo } from "@/components/ui/Topo";
import { resolveAuthor } from "@/lib/author";
import { blogFeedAlternate, noindexFollow } from "@/lib/document";
import { blogHref } from "@/lib/pagination";
import {
  getAuthors,
  getBlogPage,
  getBrand,
  getMediaUrl,
  getPost,
  getPosts,
  getSettings,
  isDraft,
  relatedPosts,
  splitPosts,
} from "@/lib/queries";
import { fmtDay } from "@/lib/time";

type Params = { params: Promise<{ slug: string }> };

/**
 * Posts and case studies are fully static. Requiring a complete static page (instead of the
 * App Shell for unknown slugs) also lets a missing slug answer with a real 404 status.
 */
export const ensureStatic = "navigation";

export async function generateStaticParams() {
  const posts = await getPosts();
  return posts.filter((p) => p.stage === "published").map((p) => ({ slug: p.slug }));
}

/**
 * Visitors only see published posts. Draft Mode (admin "Preview draft") reads the draft, which
 * can still be at the Draft or Writing stage for a post that was never published, so show any stage.
 */
function isVisible<T extends { stage?: string }>(post: T | null, preview: boolean): post is T {
  return Boolean(post) && (preview || post?.stage === "published");
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const [post, page, preview, settings, authors, brand] = await Promise.all([
    getPost(slug),
    getBlogPage(),
    isDraft(),
    getSettings(),
    getAuthors(),
    getBrand(),
  ]);
  // Metadata resolves before the page streams, so this sends a real 404 status.
  if (!isVisible(post, preview)) notFound();
  const author = resolveAuthor(post.authorId, authors, settings);
  const title = post.meta?.title || post.title;
  const description = post.meta?.description || post.excerpt;
  const feed = blogFeedAlternate(page.rss === true);
  return {
    title: post.meta?.title ? { absolute: post.meta.title } : post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}`, ...(feed ? { types: feed } : {}) },
    keywords: post.tags?.length ? [post.category, ...post.tags] : undefined,
    authors: [{ name: author.name }],
    category: post.category,
    // Drafts seen through Preview must never be indexed, even if a crawler got the cookie.
    ...(post.meta?.noindex || post.stage !== "published" ? noindexFollow : {}),
    // A page's openGraph replaces the layout's whole object (shallow merge), so repeat siteName.
    // Twitter/X cards inherit title, description and image from here.
    openGraph: {
      type: "article",
      siteName: brand.siteName,
      locale: "en_US",
      title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: [author.name],
      section: post.category,
      tags: post.tags ?? undefined,
    },
  };
}

export default async function PostPage({ params }: Params) {
  const { slug } = await params;
  const [post, posts, settings, authors, page, brand] = await Promise.all([
    getPost(slug),
    getPosts(),
    getSettings(),
    getAuthors(),
    getBlogPage(),
    getBrand(),
  ]);
  if (!isVisible(post, await isDraft())) notFound();
  const author = resolveAuthor(post.authorId, authors, settings);
  const cover = await getMediaUrl(post.coverImage);
  const blogName = page.siteName?.trim() || `${brand.siteName} · Blog`;

  const { published, upcoming } = splitPosts(posts);
  const idx = published.findIndex((p) => p.slug === post.slug);
  const newer = idx > 0 ? published[idx - 1] : undefined;
  const older = idx >= 0 && idx + 1 < published.length ? published[idx + 1] : undefined;
  const writing = upcoming.find((p) => p.stage === "writing");
  const related = relatedPosts(post, posts);
  const toc = extractToc(post.content);
  const minutes = post.readMinutes ?? 1;
  const shareUrl = encodeURIComponent(`${siteUrl()}/blog/${post.slug}`);
  const tags = post.tags?.map((t) => (
    <span className="tag" key={t}>
      {t}
    </span>
  ));

  return (
    <>
      <JsonLd
        data={[
          postLd(post, settings, author, { cover, blogName }),
          breadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
        ]}
      />
      <article data-article data-minutes={minutes}>
        <header className="post-hero gutter">
          <Link className="back-link" href="/blog">
            <Arrow dir="left" /> All posts
          </Link>
          <div className="post-kicker" data-reveal>
            <span className="status">
              <span className="dot" aria-hidden="true" />
              {/* A real link, so crawlers reach the category archive (the filters are inputs). */}
              <Link className="status-v" href={blogHref(1, post.category.toLowerCase())} rel="tag">
                {post.category}
              </Link>
            </span>
          </div>
          <ViewTransition name={`post-title-${post.slug}`} share="morph" default="none">
            <h1 data-split data-morph>
              {post.title}
            </h1>
          </ViewTransition>
          <p className="post-dek" data-reveal>
            {post.excerpt}
          </p>
          <div className="post-meta" data-reveal>
            <div className="byline">
              <AuthorAvatar author={author} />
              <div>
                <small>Written by</small>
                <strong>{author.name}</strong>
                {author.byline ? <span>{author.byline}</span> : null}
              </div>
            </div>
            <div className="pm-item">
              <small>Published</small>
              {post.publishedAt ? (
                <time dateTime={post.publishedAt}>{fmtDay(post.publishedAt)}</time>
              ) : (
                <span />
              )}
            </div>
            <div className="pm-item">
              <small>Reading time</small>
              <span>{readLabel(post)}</span>
            </div>
            <div className="tags">{tags}</div>
          </div>
          <ViewTransition name={`post-cover-${post.slug}`} share="morph" default="none">
            <div className="post-cover">
              <CoverTopo seed={post.slug} w={1050} h={400} cx={720} cy={250} n={20} />
              <CoverImage id={post.coverImage} eager alt={post.title} />
              <CoverCode lines={post.coverLines} />
            </div>
          </ViewTransition>
        </header>
        <div className="post-layout gutter">
          <ArticleProgress minutes={minutes} toc={toc} slug={post.slug} />
          <ReadTracker path={`/blog/${post.slug}`} />
          <RichText data={post.content} className="prose prose-post" />
          <footer className="post-end">
            <div className="pe-row">
              <div className="tags">{tags}</div>
              <div className="pe-share">
                <ShareCopy />
                <Pill
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                  variant="ghost"
                  external
                >
                  Share on LinkedIn
                </Pill>
              </div>
            </div>
            <div className="author-card">
              <CardTopo seed="author" />
              <AuthorAvatar author={author} />
              <div>
                <h4>Written by {author.firstName}</h4>
                {author.bio ? <p>{author.bio}</p> : null}
              </div>
              <div className="cta-btns">
                <Pill href="/#contact" variant="accent">
                  Get in touch
                </Pill>
                <Pill href="/#work" variant="ghost">
                  See my work
                </Pill>
              </div>
            </div>
            <nav className="post-nav" aria-label="More posts">
              {older ? (
                <Link href={`/blog/${older.slug}`}>
                  <small>
                    <Arrow dir="left" /> Previous
                  </small>
                  <strong>{older.title}</strong>
                </Link>
              ) : (
                <Link href="/blog">
                  <small>
                    <Arrow dir="left" /> Back
                  </small>
                  <strong>All posts</strong>
                </Link>
              )}
              {newer ? (
                <Link href={`/blog/${newer.slug}`}>
                  <small>
                    Next <Arrow dir="right" />
                  </small>
                  <strong>{newer.title}</strong>
                </Link>
              ) : writing ? (
                <div className="is-soon">
                  <small>Up next · writing</small>
                  <strong>{writing.title}</strong>
                </div>
              ) : (
                <div className="is-soon">
                  <small>Next</small>
                  <strong>More soon</strong>
                </div>
              )}
            </nav>
            {related.length ? (
              <section className="related" aria-labelledby="related-h">
                <h2 id="related-h" className="eyebrow">
                  Related posts
                </h2>
                <ul>
                  {related.map((r) => (
                    <li key={r.slug}>
                      <Link className="related-card" href={`/blog/${r.slug}`}>
                        <CardTopo seed={r.slug} />
                        <small>
                          {r.category}
                          {r.publishedAt ? ` · ${fmtDay(r.publishedAt)}` : ""} · {readLabel(r)}
                        </small>
                        <ViewTransition name={`post-title-${r.slug}`} share="morph" default="none">
                          <strong>{r.title}</strong>
                        </ViewTransition>
                        {r.excerpt ? <span>{r.excerpt}</span> : null}
                        <span className="related-tags">
                          {r.tags
                            ?.filter((t) =>
                              post.tags?.some((x) => x.toLowerCase() === t.toLowerCase()),
                            )
                            .map((t) => (
                              <span className="tag" key={t}>
                                {t}
                              </span>
                            ))}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </footer>
        </div>
      </article>
      <SiteMotion />
    </>
  );
}

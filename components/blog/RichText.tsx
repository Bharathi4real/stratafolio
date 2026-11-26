import Image from "next/image";
import type { ReactNode } from "react";
import { Accent } from "@/components/ui/Rich";
import { nodeText, slugifyHeading, toc } from "@/lib/content/rich";
import type { RichDoc, RichNode } from "@/lib/content/schema";
import { getMediaItems } from "@/lib/queries";
import { safeHref } from "@/lib/safe-url";
import { CodeBlock, type CodeBlockProps } from "./CodeBlock";

export const extractToc = (doc: RichDoc | null | undefined) => toc(doc);

type MediaMap = Record<
  string,
  { url: string; alt: string; width: number | null; height: number | null; blur?: string | null }
>;

function collectMediaIds(n: RichNode, out: number[]) {
  if (n.type === "figureImage" && typeof n.attrs?.mediaId === "number") out.push(n.attrs.mediaId);
  for (const c of n.content ?? []) collectMediaIds(c, out);
  return out;
}

const a = (n: RichNode, k: string) => n.attrs?.[k] as string | undefined;

function renderText(n: RichNode, key: number): ReactNode {
  let el: ReactNode = n.text ?? "";
  for (const m of n.marks ?? []) {
    if (m.type === "bold") el = <strong>{el}</strong>;
    else if (m.type === "italic") el = <em>{el}</em>;
    else if (m.type === "code") el = <code>{el}</code>;
    else if (m.type === "strike") el = <s>{el}</s>;
    else if (m.type === "link") {
      const href = safeHref(m.attrs?.href);
      const ext = /^https?:/.test(href);
      el = (
        <a href={href} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}>
          {el}
        </a>
      );
    }
  }
  return <span key={key}>{el}</span>;
}

function renderNode(n: RichNode, key: number, media: MediaMap): ReactNode {
  const kids = () => (n.content ?? []).map((c, i) => renderNode(c, i, media));
  switch (n.type) {
    case "text":
      return renderText(n, key);
    case "paragraph":
      return <p key={key}>{kids()}</p>;
    case "heading": {
      const id = slugifyHeading(nodeText(n));
      return n.attrs?.level === 3 ? (
        <h3 key={key} id={id}>
          {kids()}
        </h3>
      ) : (
        <h2 key={key} id={id}>
          {kids()}
        </h2>
      );
    }
    case "bulletList":
      return <ul key={key}>{kids()}</ul>;
    case "orderedList":
      return <ol key={key}>{kids()}</ol>;
    case "listItem":
      // Unwrap a single paragraph so list items keep inline flow.
      return (
        <li key={key}>
          {n.content?.length === 1 && n.content[0].type === "paragraph"
            ? (n.content[0].content ?? []).map((c, i) => renderNode(c, i, media))
            : kids()}
        </li>
      );
    case "blockquote":
      return (
        <blockquote key={key}>
          {n.content?.length === 1 && n.content[0].type === "paragraph"
            ? (n.content[0].content ?? []).map((c, i) => renderNode(c, i, media))
            : kids()}
        </blockquote>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "codeFigure":
      return <CodeBlock key={key} block={(n.attrs ?? {}) as unknown as CodeBlockProps} />;
    case "callout":
      return (
        <aside className="callout" key={key}>
          <span className="callout-k">{a(n, "kicker") || "Note"}</span>
          <p>
            <Accent text={a(n, "body")} />
          </p>
        </aside>
      );
    case "pullQuote":
      return (
        <blockquote key={key}>
          {a(n, "quote")}
          {a(n, "attribution") ? <cite>{a(n, "attribution")}</cite> : null}
        </blockquote>
      );
    case "figureImage": {
      const m = media[String(n.attrs?.mediaId)];
      if (!m) return null;
      return (
        <figure className={`prose-figure${n.attrs?.wide ? " is-wide" : ""}`} key={key}>
          <Image
            src={m.url}
            alt={m.alt}
            width={m.width ?? 1600}
            height={m.height ?? 900}
            sizes="(max-width: 900px) 100vw, 60rem"
            {...(m.blur ? { placeholder: "blur" as const, blurDataURL: m.blur } : {})}
          />
          {a(n, "caption") ? <figcaption>{a(n, "caption")}</figcaption> : null}
        </figure>
      );
    }
    default:
      return n.content ? <div key={key}>{kids()}</div> : null;
  }
}

/** Renders Tiptap JSON on the server (no editor JS on the site). */
export async function RichText({
  data,
  className = "prose",
}: {
  data: RichDoc | null | undefined;
  className?: string;
}) {
  if (!data?.content?.length) return null;
  const ids = data.content.flatMap((n) => collectMediaIds(n, []));
  const media: MediaMap = ids.length ? await getMediaItems(ids.join(",")) : {};
  return <div className={className}>{data.content.map((n, i) => renderNode(n, i, media))}</div>;
}

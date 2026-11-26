import { renderCode } from "@/lib/highlight";
import { CopyCode } from "./CopyCode";

export type CodeBlockProps = {
  code: string;
  language: string;
  filename?: string | null;
  lineNumbers?: boolean | null;
  highlight?: string | null;
  inserted?: string | null;
  deleted?: string | null;
};

/** Server-rendered TanStack Highlight output. Only the Copy button ships JS. */
export function CodeBlock({ block }: { block: CodeBlockProps }) {
  const out = renderCode({
    code: block.code,
    lang: block.language,
    title: block.filename,
    lineNumbers: block.lineNumbers,
    highlight: block.highlight,
    inserted: block.inserted,
    deleted: block.deleted,
  });
  return (
    <figure className="code-block" data-lang={out.lang}>
      <figcaption className="cb-head">
        <span className="cb-title">{block.filename || out.lang}</span>
        <span className="cb-lang">{out.lang}</span>
        <CopyCode text={out.copyText} />
      </figcaption>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: TanStack Highlight escapes the code */}
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: out.htmlMarkup }} />
    </figure>
  );
}

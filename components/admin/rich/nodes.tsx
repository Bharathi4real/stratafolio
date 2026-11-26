"use client";

import {
  mergeAttributes,
  Node,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { useMemo, useState } from "react";
import { renderCode } from "@/lib/highlight";
import { LANGUAGES } from "@/lib/highlight-languages";
import { MediaPicker, Thumb, useMediaItem } from "../media";
import { Select } from "../Select";

/**
 * Custom Tiptap blocks. Stored in the post JSON and rendered on the site by
 * components/blog/RichText.tsx. Each is an atom with a small inline editor.
 */

function useAttr<T>(props: ReactNodeViewProps, key: string) {
  return [props.node.attrs[key] as T, (v: T) => props.updateAttributes({ [key]: v })] as const;
}

function Remove({ props }: { props: ReactNodeViewProps }) {
  return (
    <button
      className="icon-btn rtb-x"
      type="button"
      aria-label="Remove block"
      onClick={() => props.deleteNode()}
    >
      ✕
    </button>
  );
}

function CodeView(props: ReactNodeViewProps) {
  const [code, setCode] = useAttr<string>(props, "code");
  const [language, setLanguage] = useAttr<string>(props, "language");
  const [filename, setFilename] = useAttr<string>(props, "filename");
  const [lineNumbers, setLineNumbers] = useAttr<boolean>(props, "lineNumbers");
  const [highlight, setHighlight] = useAttr<string>(props, "highlight");
  const [inserted, setInserted] = useAttr<string>(props, "inserted");
  const [deleted, setDeleted] = useAttr<string>(props, "deleted");
  const [editing, setEditing] = useState(!code);
  const html = useMemo(
    () =>
      code
        ? renderCode({
            code,
            lang: language,
            title: filename,
            lineNumbers,
            highlight,
            inserted,
            deleted,
          }).htmlMarkup
        : "",
    [code, language, filename, lineNumbers, highlight, inserted, deleted],
  );
  return (
    <NodeViewWrapper
      className={`rt-block rtb${props.selected ? " is-sel" : ""}`}
      data-kind="Code · TanStack Highlight"
      contentEditable={false}
    >
      <div className="rtb-bar">
        <input
          className="inp inp-sm"
          placeholder="filename.ts"
          value={filename ?? ""}
          onChange={(e) => setFilename(e.target.value)}
        />
        <Select
          size="sm"
          label="Language"
          value={language}
          onChange={(v) => setLanguage(v)}
          options={LANGUAGES}
        />
        <input
          className="inp inp-sm"
          placeholder="Highlight 2-3,9"
          value={highlight ?? ""}
          onChange={(e) => setHighlight(e.target.value)}
        />
        <input
          className="inp inp-sm"
          placeholder="+ lines"
          value={inserted ?? ""}
          onChange={(e) => setInserted(e.target.value)}
        />
        <input
          className="inp inp-sm"
          placeholder="− lines"
          value={deleted ?? ""}
          onChange={(e) => setDeleted(e.target.value)}
        />
        <label className="rtb-chk">
          <input
            type="checkbox"
            checked={Boolean(lineNumbers)}
            onChange={(e) => setLineNumbers(e.target.checked)}
          />{" "}
          Line numbers
        </label>
        <button className="btn btn-sm" type="button" onClick={() => setEditing((v) => !v)}>
          {editing ? "Preview" : "Edit code"}
        </button>
        <Remove props={props} />
      </div>
      {editing ? (
        <textarea
          className="inp rtb-code"
          spellCheck={false}
          value={code}
          rows={Math.min(24, Math.max(4, (code ?? "").split("\n").length + 1))}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Tab") {
              e.preventDefault();
              const t = e.currentTarget;
              const s = t.selectionStart;
              setCode(`${code.slice(0, s)}  ${code.slice(t.selectionEnd)}`);
              requestAnimationFrame(() => t.setSelectionRange(s + 2, s + 2));
            }
          }}
        />
      ) : (
        <div className="rt-codewrap">
          <figure className="code-block">
            <figcaption className="cb-head">
              <span className="cb-title">{filename || language}</span>
              <span className="cb-lang">{language}</span>
            </figcaption>
            {/* biome-ignore lint/security/noDangerouslySetInnerHtml: TanStack Highlight escapes the code */}
            <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: html }} />
          </figure>
        </div>
      )}
    </NodeViewWrapper>
  );
}

function CalloutView(props: ReactNodeViewProps) {
  const [kicker, setKicker] = useAttr<string>(props, "kicker");
  const [body, setBody] = useAttr<string>(props, "body");
  return (
    <NodeViewWrapper
      className={`rt-block rt-callout rtb${props.selected ? " is-sel" : ""}`}
      data-kind="Callout"
      contentEditable={false}
    >
      <div className="rtb-bar">
        <input
          className="inp inp-sm"
          placeholder="Kicker"
          value={kicker ?? ""}
          onChange={(e) => setKicker(e.target.value)}
        />
        <Remove props={props} />
      </div>
      <textarea
        className="inp"
        rows={2}
        placeholder="Callout text. *asterisks* for emphasis."
        value={body ?? ""}
        onChange={(e) => setBody(e.target.value)}
      />
    </NodeViewWrapper>
  );
}

function QuoteView(props: ReactNodeViewProps) {
  const [quote, setQuote] = useAttr<string>(props, "quote");
  const [attribution, setAttribution] = useAttr<string>(props, "attribution");
  return (
    <NodeViewWrapper
      className={`rt-block rtb${props.selected ? " is-sel" : ""}`}
      data-kind="Pull quote"
      contentEditable={false}
    >
      <div className="rtb-bar">
        <input
          className="inp inp-sm"
          placeholder="Attribution (optional)"
          value={attribution ?? ""}
          onChange={(e) => setAttribution(e.target.value)}
        />
        <Remove props={props} />
      </div>
      <textarea
        className="inp rtb-quote"
        rows={2}
        placeholder="A line worth pulling out"
        value={quote ?? ""}
        onChange={(e) => setQuote(e.target.value)}
      />
    </NodeViewWrapper>
  );
}

/** Recommended widths for body images: 2× the column they render in (Wide spans the page). */
function ImageSizeHint({
  width,
  height,
  wide,
}: {
  width?: number | null;
  height?: number | null;
  wide: boolean;
}) {
  const want = wide ? 2400 : 1600;
  const small = typeof width === "number" && width < want * 0.75;
  return (
    <p className={`hint${small ? " err" : ""}`}>
      {typeof width === "number" && typeof height === "number" ? `${width} × ${height} px. ` : ""}
      {small
        ? `A bit small for ${wide ? "a wide" : "a body"} image and may look soft; aim for ${want} px wide.`
        : `Best at ${want} px wide (${wide ? "wide spans the page" : "fits the text column"}), any height; 16:9 or 3:2 read well. JPG or WebP under 500 KB; PNG or SVG for screenshots and diagrams.`}
    </p>
  );
}

function ImageView(props: ReactNodeViewProps) {
  const [mediaId, setMediaId] = useAttr<number | null>(props, "mediaId");
  const [caption, setCaption] = useAttr<string>(props, "caption");
  const [wide, setWide] = useAttr<boolean>(props, "wide");
  const [open, setOpen] = useState(!mediaId);
  const { data: m } = useMediaItem(mediaId);
  return (
    <NodeViewWrapper
      className={`rt-block rtb${props.selected ? " is-sel" : ""}`}
      data-kind="Image"
      contentEditable={false}
    >
      <div className="rtb-bar">
        <input
          className="inp inp-sm"
          placeholder="Caption (optional)"
          value={caption ?? ""}
          onChange={(e) => setCaption(e.target.value)}
        />
        <label className="rtb-chk">
          <input
            type="checkbox"
            checked={Boolean(wide)}
            onChange={(e) => setWide(e.target.checked)}
          />{" "}
          Wide
        </label>
        <button className="btn btn-sm" type="button" onClick={() => setOpen(true)}>
          {m ? "Replace" : "Choose image"}
        </button>
        <Remove props={props} />
      </div>
      {m ? (
        <div className="rtb-img">
          <Thumb item={m} />
          {!m.alt ? <p className="hint err">This image has no alt text. Add it in Media.</p> : null}
        </div>
      ) : null}
      <ImageSizeHint width={m?.width} height={m?.height} wide={Boolean(wide)} />
      <MediaPicker
        open={open}
        accept="image"
        onClose={() => setOpen(false)}
        onPick={(x) => {
          setMediaId(x.id);
          setOpen(false);
        }}
      />
    </NodeViewWrapper>
  );
}

const atom = (
  name: string,
  attrs: Record<string, unknown>,
  view: (p: ReactNodeViewProps) => React.ReactNode,
) =>
  Node.create({
    name,
    group: "block",
    atom: true,
    draggable: true,
    addAttributes() {
      return Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, { default: v }]));
    },
    parseHTML() {
      return [{ tag: `div[data-b4="${name}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["div", mergeAttributes(HTMLAttributes, { "data-b4": name })];
    },
    addNodeView() {
      return ReactNodeViewRenderer(view);
    },
  });

export const CodeFigure = atom(
  "codeFigure",
  {
    code: "",
    language: "ts",
    filename: "",
    lineNumbers: true,
    highlight: "",
    inserted: "",
    deleted: "",
  },
  CodeView,
);
export const Callout = atom("callout", { kicker: "Note", body: "" }, CalloutView);
export const PullQuote = atom("pullQuote", { quote: "", attribution: "" }, QuoteView);
export const FigureImage = atom(
  "figureImage",
  { mediaId: null, caption: "", wide: false },
  ImageView,
);

export const BLOCKS = [
  { id: "h2", k: "H2", label: "Heading", hint: "Section title, shows in the TOC" },
  { id: "code", k: "{}", label: "Code block", hint: "Filename, language, highlighted lines" },
  { id: "callout", k: "!", label: "Callout", hint: "Dashed ember tip box" },
  { id: "image", k: "IMG", label: "Image", hint: "From Media, alt text required" },
  { id: "quote", k: "“", label: "Pull quote", hint: "Large display quote" },
  { id: "list", k: "•", label: "Bulleted list", hint: "Round bullets" },
] as const;
export type BlockId = (typeof BLOCKS)[number]["id"];

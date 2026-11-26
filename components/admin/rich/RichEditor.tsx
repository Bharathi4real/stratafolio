"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState } from "react";
import type { RichDoc } from "@/lib/content/schema";
import { safeHref } from "@/lib/safe-url";
import { BLOCKS, type BlockId, Callout, CodeFigure, FigureImage, PullQuote } from "./nodes";

/** Tiptap editor for posts and the privacy policy. Type “/” on an empty line for blocks. */
export function RichEditor({
  value,
  onChange,
  compact,
}: {
  value: RichDoc | null | undefined;
  onChange: (v: RichDoc) => void;
  compact?: boolean;
}) {
  const [slash, setSlash] = useState<{ top: number; left: number } | null>(null);
  const [hl, setHl] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const slashRef = useRef(slash);
  slashRef.current = slash;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({
        placeholder: "Write, or type / for a code block, callout, image or quote…",
      }),
      CodeFigure,
      Callout,
      PullQuote,
      FigureImage,
    ],
    content: value ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: {
      attributes: { class: "rt", spellcheck: "true" },
      handleKeyDown: (view, e) => {
        if (slashRef.current) {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            setHl((h) => (h + (e.key === "ArrowDown" ? 1 : BLOCKS.length - 1)) % BLOCKS.length);
            return true;
          }
          if (e.key === "Enter") {
            setHl((h) => {
              insertRef.current?.(BLOCKS[h].id, true);
              return h;
            });
            return true;
          }
          if (e.key === "Escape") {
            setSlash(null);
            return true;
          }
          setSlash(null);
        }
        if (e.key === "/") {
          const { $from } = view.state.selection;
          if ($from.parent.type.name === "paragraph" && $from.parent.textContent === "") {
            const c = view.coordsAtPos($from.pos);
            const box = wrap.current?.getBoundingClientRect();
            if (box) setSlash({ top: c.bottom - box.top + 6, left: c.left - box.left });
            setHl(0);
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => onChange(ed.getJSON() as RichDoc),
  });

  const insertRef = useRef<((id: BlockId, fromSlash?: boolean) => void) | null>(null);
  insertRef.current = (id, fromSlash) => {
    if (!editor) return;
    setSlash(null);
    let chain = editor.chain().focus();
    if (fromSlash) {
      const { from } = editor.state.selection;
      chain = chain.deleteRange({ from: from - 1, to: from });
    }
    switch (id) {
      case "h2":
        chain.setNode("heading", { level: 2 }).run();
        break;
      case "list":
        chain.toggleBulletList().run();
        break;
      case "code":
        chain.insertContent({ type: "codeFigure" }).run();
        break;
      case "callout":
        chain.insertContent({ type: "callout" }).run();
        break;
      case "quote":
        chain.insertContent({ type: "pullQuote" }).run();
        break;
      case "image":
        chain.insertContent({ type: "figureImage" }).run();
        break;
    }
  };

  // Reset content when a version is restored from outside.
  const lastSet = useRef(value);
  useEffect(() => {
    if (!editor || value === lastSet.current) return;
    lastSet.current = value;
    const current = JSON.stringify(editor.getJSON());
    if (value && JSON.stringify(value) !== current)
      editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className={`rt-wrap${compact ? " is-compact" : ""}`} ref={wrap}>
      {editor ? (
        <Toolbar
          editor={editor}
          onBlock={() => {
            const box = wrap.current?.getBoundingClientRect();
            const bar = wrap.current?.querySelector(".rt-bar")?.getBoundingClientRect();
            if (box && bar)
              setSlash({ top: bar.bottom - box.top + 6, left: bar.right - box.left - 240 });
            setHl(0);
          }}
        />
      ) : null}
      <EditorContent editor={editor} />
      {slash ? (
        <div
          className="slash open"
          role="menu"
          style={{ top: slash.top, left: Math.max(0, slash.left) }}
        >
          {BLOCKS.map((b, i) => (
            <button
              key={b.id}
              type="button"
              role="menuitem"
              className={i === hl ? "hl" : undefined}
              onMouseEnter={() => setHl(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                insertRef.current?.(b.id, false);
              }}
            >
              <span className="k">{b.k}</span>
              <span>
                {b.label}
                <small>{b.hint}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Toolbar({ editor, onBlock }: { editor: Editor; onBlock: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      p: e.isActive("paragraph"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      b: e.isActive("bold"),
      i: e.isActive("italic"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      q: e.isActive("blockquote"),
    }),
  });
  const btn = (on: boolean, label: string, run: () => void, children: React.ReactNode) => (
    <button
      type="button"
      className={on ? "on" : undefined}
      aria-label={label}
      aria-pressed={on}
      onMouseDown={(e) => {
        e.preventDefault();
        run();
      }}
    >
      {children}
    </button>
  );
  const c = () => editor.chain().focus();
  const [linkOpen, setLinkOpen] = useState(false);
  const [href, setHref] = useState("");
  const openLink = () => {
    setHref((editor.getAttributes("link").href as string | undefined) ?? "");
    setLinkOpen(true);
  };
  const applyLink = () => {
    const raw = href.trim();
    // "example.com" → "https://example.com"; unsafe schemes (javascript:, data:, …) are dropped.
    const v = raw && !/^[a-z][a-z0-9+.-]*:|^[/#?]/i.test(raw) ? `https://${raw}` : raw;
    if (!v || safeHref(v) === "#") c().extendMarkRange("link").unsetLink().run();
    else c().extendMarkRange("link").setLink({ href: v }).run();
    setLinkOpen(false);
  };
  return (
    <>
      <div className="rt-bar" role="toolbar" aria-label="Formatting">
        {btn(s.p, "Paragraph", () => c().setParagraph().run(), <Ic d={IC.p} />)}
        {btn(s.h2, "Heading", () => c().toggleHeading({ level: 2 }).run(), "H2")}
        {btn(s.h3, "Subheading", () => c().toggleHeading({ level: 3 }).run(), "H3")}
        <span className="sep" />
        {btn(s.b, "Bold", () => c().toggleBold().run(), <Ic d={IC.bold} w={2.4} />)}
        {btn(s.i, "Italic", () => c().toggleItalic().run(), <Ic d={IC.italic} />)}
        {btn(s.code, "Inline code", () => c().toggleCode().run(), <Ic d={IC.code} />)}
        {btn(s.link || linkOpen, "Link", openLink, <Ic d={IC.link} />)}
        <span className="sep" />
        {btn(s.ul, "Bulleted list", () => c().toggleBulletList().run(), <Ic d={IC.ul} />)}
        {btn(s.ol, "Numbered list", () => c().toggleOrderedList().run(), <Ic d={IC.ol} />)}
        {btn(s.q, "Quote", () => c().toggleBlockquote().run(), <Ic d={IC.quote} />)}
        <button
          type="button"
          className="blk"
          onMouseDown={(e) => {
            e.preventDefault();
            onBlock();
          }}
        >
          / Insert block
        </button>
      </div>
      {linkOpen ? (
        <fieldset className="rt-link" aria-label="Edit link">
          <input
            className="inp inp-sm"
            // biome-ignore lint/a11y/noAutofocus: opened on purpose by the Link button
            autoFocus
            placeholder="https://… or /path"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") setLinkOpen(false);
            }}
          />
          <button type="button" className="btn btn-sm btn-primary" onClick={applyLink}>
            {href.trim() ? "Apply" : "Remove link"}
          </button>
          {s.link ? (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                c().extendMarkRange("link").unsetLink().run();
                setLinkOpen(false);
              }}
            >
              Remove
            </button>
          ) : null}
          <button type="button" className="btn btn-sm" onClick={() => setLinkOpen(false)}>
            Cancel
          </button>
        </fieldset>
      ) : null}
    </>
  );
}

const IC = {
  p: "M13 4v16M17 4v16M19 4H9.5a4.5 4.5 0 0 0 0 9H13",
  bold: "M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z",
  italic: "M19 4h-9M14 20H5M15 4 9 20",
  code: "m16 18 6-6-6-6M8 6l-6 6 6 6",
  link: "M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7",
  ul: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  ol: "M10 6h10M10 12h10M10 18h10M4 6h1v4M4 10h2M6 18H4c0-1 2-2 2-3s-1-1.5-2-1",
  quote:
    "M3 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1zM15 21c3 0 7-1 7-8V5c0-1.25-.76-2-2-2h-4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z",
};
function Ic({ d, w = 2 }: { d: string; w?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
      width="15"
      height="15"
    >
      <path d={d} />
    </svg>
  );
}

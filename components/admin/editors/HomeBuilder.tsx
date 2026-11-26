"use client";

import { useEffect, useRef, useState } from "react";
import { discardGlobal, publishGlobal, saveGlobal } from "@/lib/admin/actions";
import { refreshPreview, setAdmin, toast } from "@/lib/admin/store";
import type { HomePage, Section } from "@/lib/content/schema";
import { useDebouncedCallback } from "@/lib/pacer";
import { EditorChrome } from "../EditorChrome";
import { Seg } from "../ui";
import { plainJson } from "../useDocForm";
import { SectionFields } from "./SectionFields";

const NAMES: Record<Section["blockType"], string> = {
  hero: "Hero",
  marquee: "Marquee",
  about: "About + stats",
  work: "Case studies",
  experience: "Experience",
  toolkit: "Toolkit strata",
  blogTeaser: "Blog teaser",
  contact: "Contact",
};

const uid = () => Math.random().toString(36).slice(2, 10);

const TEMPLATES: Record<Section["blockType"], () => Section> = {
  hero: () => ({
    id: uid(),
    hidden: false,
    blockType: "hero",
    eyebrow: "// Full-stack Engineer",
    showCoords: true,
    nameLine1: "First",
    nameLine2: "Last",
    tagline: "One line about what you do.",
    currentlyLabel: "Currently",
    currently: "Role at Company",
    showSocials: true,
    primaryLabel: "View work",
    primaryHref: "#work",
    secondaryLabel: "Get in touch",
    secondaryHref: "#contact",
    shader: true,
    nameReveal: true,
  }),
  marquee: () => ({ id: uid(), hidden: false, blockType: "marquee", items: ["React", "Next.js"] }),
  about: () => ({
    id: uid(),
    hidden: false,
    blockType: "about",
    label: "About",
    anchor: "about",
    facts: [],
    lead: "A lead line with an *accent*.",
    paragraphs: [],
    stats: [],
  }),
  work: () => ({
    id: uid(),
    hidden: false,
    blockType: "work",
    label: "Selected work",
    anchor: "work",
    heading: "Case studies",
    projects: [],
  }),
  experience: () => ({
    id: uid(),
    hidden: false,
    blockType: "experience",
    label: "Experience",
    anchor: "experience",
    heading: "Where I’ve *worked*",
    summary: [],
  }),
  toolkit: () => ({
    id: uid(),
    hidden: false,
    blockType: "toolkit",
    label: "Toolkit",
    anchor: "toolkit",
    heading: "The stack, *in strata*",
    scaleTop: "Surface",
    scaleBottom: "Core",
  }),
  blogTeaser: () => ({
    id: uid(),
    hidden: false,
    blockType: "blogTeaser",
    label: "Blog",
    anchor: "blog",
    heading: "Writing *& learnings*",
    sideCount: 4,
    showUpcoming: true,
    allLabel: "All posts",
  }),
  contact: () => ({
    id: uid(),
    hidden: false,
    blockType: "contact",
    label: "Contact",
    anchor: "contact",
    heading: "Let’s build something *secure.*",
    emailLabel: "Email me",
    resumeLabel: "Download résumé ↓",
    formTitle: "Send a message",
    topicsLegend: "I’m reaching out about",
    topics: [{ value: "role", label: "A full-time role" }],
    nameLabel: "Your name",
    emailFieldLabel: "Email",
    messageLabel: "What are you building?",
    slideLabel: "Send message",
    sendingLabel: "Sending",
    sentLabel: "Delivered",
    successText: "Thanks! I’ll reply soon.",
    errorText: "Couldn’t send right now.",
  }),
};

const Grip = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {[6, 12, 18].flatMap((y) =>
      [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4" />),
    )}
  </svg>
);
const Eye = ({ off }: { off?: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {off ? <path d="M3 3l18 18" /> : null}
  </svg>
);

export function HomeBuilder({
  initial,
  published,
  hasDraft,
  projects,
}: {
  initial: HomePage;
  published: boolean;
  hasDraft: boolean;
  projects: { id: number; title: string }[];
}) {
  const [sections, setSections] = useState<Section[]>(initial.sections);
  const [sel, setSel] = useState(initial.sections[0]?.id ?? "");
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const [adding, setAdding] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const lastSaved = useRef(JSON.stringify(initial.sections));
  // Unpublished changes as last reported by autosave (null = as loaded with the page).
  const [draft, setDraft] = useState<boolean | null>(null);
  const current = sections.find((s) => s.id === sel);

  const save = async (list: Section[]) => {
    const json = JSON.stringify(list);
    if (json === lastSaved.current) return;
    setAdmin({ save: "saving" });
    const r = await saveGlobal("home-page", plainJson({ sections: list }));
    if (r.ok) {
      lastSaved.current = json;
      if (r.data) setDraft(r.data.draft);
      setAdmin({ save: "saved", saveError: undefined, savedAt: Date.now() });
      const s = list.find((x) => x.id === sel);
      refreshPreview(s && "anchor" in s ? s.anchor : undefined);
    } else setAdmin({ save: "error", saveError: r.error });
  };
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const saving = useRef<Promise<void> | null>(null);
  const saveNow = async () => {
    if (saving.current) await saving.current;
    const p = save(sectionsRef.current);
    saving.current = p;
    await p.finally(() => {
      if (saving.current === p) saving.current = null;
    });
  };
  // Reads the latest sections when it fires, so a save queued before a restore can't undo it.
  const debounced = useDebouncedCallback(() => void saveNow(), { wait: 900 });
  const [restores, setRestores] = useState(0);

  const update = (next: Section[]) => {
    sectionsRef.current = next;
    setSections(next);
    setAdmin({ save: "dirty" });
    debounced();
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll the preview when the selection changes
  useEffect(() => {
    const s = sections.find((x) => x.id === sel);
    if (s && "anchor" in s) refreshPreview(s.anchor);
  }, [sel]);

  let n = 0;
  return (
    <>
      <EditorChrome
        title="Home"
        accent="page"
        desc="Drag to reorder sections, hide any section, and edit every word. The preview updates as you type."
        published={published}
        hasDraft={hasDraft}
        versionsRef="global:home-page"
        flush={saveNow}
        draft={draft}
        publish={async () => {
          const r = await publishGlobal("home-page", plainJson({ sections: sectionsRef.current }));
          if (r.ok) setDraft(false);
          return r;
        }}
        discard={async () => {
          await saveNow();
          return discardGlobal("home-page");
        }}
        onRestored={(d, isDraft) => {
          const list = (d as HomePage).sections ?? [];
          sectionsRef.current = list;
          setSections(list);
          lastSaved.current = JSON.stringify(list);
          setDraft(isDraft);
          setRestores((n) => n + 1);
          if (!list.some((s) => s.id === sel)) setSel(list[0]?.id ?? "");
          setAdmin({ save: "saved" });
          refreshPreview();
        }}
      />
      <div className="builder">
        <div className="card">
          <div className="card-h">
            <h3>Sections</h3>
            <span className="mono subtle">Drag ⋮⋮</span>
          </div>
          <ol className="blocks">
            {sections.map((s, i) => {
              const numbered = "anchor" in s && !s.hidden;
              if (numbered) n += 1;
              return (
                // biome-ignore lint/a11y/useKeyWithClickEvents: the row is a drag target; the name button inside handles keyboard selection
                <li
                  key={s.id}
                  className={`block${s.id === sel ? " is-active" : ""}${s.hidden ? " is-hidden" : ""}${drag?.from === i ? " is-dragging" : ""}${drag && drag.over === i && drag.from !== i ? " drop-above" : ""}`}
                  draggable
                  onDragStart={() => setDrag({ from: i, over: i })}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (drag && drag.over !== i) setDrag({ ...drag, over: i });
                  }}
                  onDragEnd={() => setDrag(null)}
                  onDrop={() => {
                    if (!drag) return;
                    const next = [...sections];
                    const [m] = next.splice(drag.from, 1);
                    next.splice(drag.over, 0, m);
                    setDrag(null);
                    update(next);
                  }}
                  onClick={() => setSel(s.id)}
                >
                  <span className="grip" aria-hidden="true">
                    <Grip />
                  </span>
                  <span className="b-n">{numbered ? String(n).padStart(2, "0") : "·"}</span>
                  <button
                    type="button"
                    className="b-name"
                    aria-label={`${s.name ?? NAMES[s.blockType]}. Alt + arrow keys to move.`}
                    aria-pressed={s.id === sel}
                    onKeyDown={(e) => {
                      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                        const to = i + (e.key === "ArrowUp" ? -1 : 1);
                        if (to < 0 || to >= sections.length) return;
                        const next = [...sections];
                        const [m] = next.splice(i, 1);
                        next.splice(to, 0, m);
                        update(next);
                      }
                    }}
                  >
                    {s.name ?? NAMES[s.blockType]}
                  </button>
                  <button
                    className="eye"
                    type="button"
                    aria-label={s.hidden ? "Show section" : "Hide section"}
                    aria-pressed={!s.hidden}
                    onClick={(e) => {
                      e.stopPropagation();
                      update(
                        sections.map((x) => (x.id === s.id ? { ...x, hidden: !x.hidden } : x)),
                      );
                    }}
                  >
                    <Eye off={s.hidden} />
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="add-wrap">
            <button
              className="btn btn-sm add-block"
              type="button"
              aria-expanded={adding}
              onClick={() => setAdding((v) => !v)}
            >
              + Add section
            </button>
            {adding ? (
              <div className="add-menu">
                {(Object.keys(NAMES) as Section["blockType"][]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const s = TEMPLATES[t]();
                      update([...sections, s]);
                      setSel(s.id);
                      setAdding(false);
                    }}
                  >
                    {NAMES[t]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>{current ? (current.name ?? NAMES[current.blockType]) : "No section"}</h3>
            {current ? (
              <button
                className="btn btn-sm"
                type="button"
                onClick={() => {
                  // No "are you sure": remove straight away and offer Undo.
                  const before = sections;
                  const removed = current;
                  const next = sections.filter((x) => x.id !== removed.id);
                  update(next);
                  setSel(next[0]?.id ?? "");
                  toast(`${removed.name ?? NAMES[removed.blockType]} removed.`, "ok", {
                    action: {
                      label: "Undo",
                      run: () => {
                        update(before);
                        setSel(removed.id);
                      },
                    },
                  });
                }}
              >
                Remove
              </button>
            ) : null}
          </div>
          <div className="card-b fields">
            {current ? (
              <SectionFields
                key={`${current.id}-${restores}`}
                section={current}
                projects={projects}
                onChange={(s) => update(sectionsRef.current.map((x) => (x.id === s.id ? s : x)))}
              />
            ) : (
              <p className="muted">Add a section to start.</p>
            )}
          </div>
        </div>

        <Preview device={device} setDevice={setDevice} path="/" />
      </div>
    </>
  );
}

/** Live preview of the draft: the real site in draft mode, scaled to fit. */
export function Preview({
  path,
  device,
  setDevice,
}: {
  path: string;
  device: "desktop" | "mobile";
  setDevice: (d: "desktop" | "mobile") => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  const width = device === "desktop" ? 1440 : 390;
  const height = device === "desktop" ? 900 : 844;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div className="card preview">
      <div className="pv-bar">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="pv-url">draft preview · {path}</span>
        <Seg
          label="Preview size"
          value={device}
          onChange={setDevice}
          options={[
            { value: "desktop", label: "Desktop" },
            { value: "mobile", label: "Mobile" },
          ]}
        />
      </div>
      <div className="pv-frame-wrap" ref={box} style={{ height: height * scale }}>
        <iframe
          data-preview
          title="Live preview"
          src={`/api/preview?path=${encodeURIComponent(path)}`}
          style={{
            width,
            height,
            transform: `scale(${scale})`,
            left: device === "mobile" ? `calc(50% - ${(width * scale) / 2}px)` : 0,
          }}
        />
      </div>
      <div className="pv-note">
        <i />
        Live preview of the draft. Visitors still see the published version.
      </div>
    </div>
  );
}

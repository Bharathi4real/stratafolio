"use client";

import { useStore } from "@tanstack/react-form";
import { useEffect } from "react";
import { Arrow } from "@/components/ui/Arrow";
import type {
  AboutBlock,
  BlogTeaserBlock,
  ContactBlock,
  ExperienceBlock,
  HeroBlock,
  MarqueeBlock,
  Section,
  ToolkitBlock,
  WorkBlock,
} from "@/lib/content/schema";
import { TOPIC_VALUES } from "@/lib/content/schema";
import { useAppForm } from "../form";
import { Repeater, RepItem } from "../Repeater";

/** One small TanStack form per section; values flow up to the page builder. */
function useSectionForm<T extends Section>(section: T, onChange: (s: T) => void) {
  const form = useAppForm({ defaultValues: section });
  const values = useStore(form.store, (s) => s.values);
  // biome-ignore lint/correctness/useExhaustiveDependencies: push on value change only
  useEffect(() => {
    if (values !== section) onChange(values as T);
  }, [values]);
  return form;
}

type FieldKit = { Text: (p: { label: string; hint?: string; mono?: boolean }) => React.ReactNode };
const move = (a: number[], from: number, to: number) => {
  const n = [...a];
  const [x] = n.splice(from, 1);
  n.splice(to, 0, x);
  return n;
};

const accent = "Wrap the light-weight accent words in *asterisks*.";

// biome-ignore lint/suspicious/noExplicitAny: shared by all section forms (label + anchor exist on each)
function Head({ form }: { form: any }) {
  return (
    <div className="row2">
      <form.AppField name="label">
        {(f: FieldKit) => <f.Text label="Eyebrow" hint="The number (01 /) comes from the order." />}
      </form.AppField>
      <form.AppField name="anchor">
        {(f: FieldKit) => <f.Text label="Anchor" hint="Section id for links (#about)." mono />}
      </form.AppField>
    </div>
  );
}

function HeroFields({ s, onChange }: { s: HeroBlock; onChange: (s: HeroBlock) => void }) {
  const form = useSectionForm(s, onChange);
  return (
    <>
      <div className="row2">
        <form.AppField name="nameLine1">{(f) => <f.Text label="Name · line 1" />}</form.AppField>
        <form.AppField name="nameLine2">
          {(f) => <f.Text label="Name · line 2 · ember, light" />}
        </form.AppField>
      </div>
      <form.AppField name="eyebrow">{(f) => <f.Text label="Eyebrow" />}</form.AppField>
      <form.AppField name="tagline">
        {(f) => (
          <f.Area
            label="Tagline"
            maxLength={180}
            hint="Words wrapped in *asterisks* become the bold highlight."
          />
        )}
      </form.AppField>
      <div className="row2">
        <form.AppField name="currentlyLabel">
          {(f) => <f.Text label="“Currently” label" />}
        </form.AppField>
        <form.AppField name="currently">{(f) => <f.Text label="Currently" />}</form.AppField>
      </div>
      <div className="row2">
        <form.AppField name="primaryLabel">
          {(f) => <f.Text label="Primary button" />}
        </form.AppField>
        <form.AppField name="primaryHref">
          {(f) => <f.Text label="Primary link" mono />}
        </form.AppField>
      </div>
      <div className="row2">
        <form.AppField name="secondaryLabel">
          {(f) => <f.Text label="Secondary button" />}
        </form.AppField>
        <form.AppField name="secondaryHref">
          {(f) => <f.Text label="Secondary link" mono />}
        </form.AppField>
      </div>
      <div className="card" style={{ background: "var(--input)" }}>
        <div className="card-b" style={{ padding: ".2rem 1rem" }}>
          <form.AppField name="shader">
            {(f) => (
              <f.Toggle
                title="Ember shader background"
                desc="three.js hero. Off = static gradient."
              />
            )}
          </form.AppField>
          <form.AppField name="nameReveal">
            {(f) => (
              <f.Toggle
                title="Letter-by-letter name reveal"
                desc="Respects reduced motion automatically."
              />
            )}
          </form.AppField>
          <form.AppField name="showSocials">
            {(f) => (
              <f.Toggle
                title="Show GitHub + LinkedIn under “Currently”"
                desc="Links come from Settings → General."
              />
            )}
          </form.AppField>
          <form.AppField name="showCoords">
            {(f) => <f.Toggle title="Show location + coordinates" />}
          </form.AppField>
        </div>
      </div>
    </>
  );
}

function MarqueeFields({ s, onChange }: { s: MarqueeBlock; onChange: (s: MarqueeBlock) => void }) {
  const form = useSectionForm(s, onChange);
  return (
    <form.AppField name="items">
      {(f) => (
        <f.Tags label="Scrolling words" hint="Shown twice in a loop with ember ✦ separators." />
      )}
    </form.AppField>
  );
}

function AboutFields({ s, onChange }: { s: AboutBlock; onChange: (s: AboutBlock) => void }) {
  const form = useSectionForm(s, onChange);
  return (
    <>
      <Head form={form} />
      <form.AppField name="lead">{(f) => <f.Area label="Lead line" hint={accent} />}</form.AppField>
      <form.Field name="paragraphs" mode="array">
        {(arr) => (
          <Repeater
            label="Paragraphs"
            count={arr.state.value.length}
            onAdd={() => arr.pushValue({ text: "" })}
          >
            {arr.state.value.map((_, i) => (
              <RepItem
                key={`p-${i}`}
                index={i}
                total={arr.state.value.length}
                onMove={(to) => arr.moveValue(i, to)}
                onRemove={() => arr.removeValue(i)}
              >
                <form.AppField name={`paragraphs[${i}].text` as const}>
                  {(f) => <f.Area label="Text" rows={4} />}
                </form.AppField>
              </RepItem>
            ))}
          </Repeater>
        )}
      </form.Field>
      <form.Field name="facts" mode="array">
        {(arr) => (
          <Repeater
            label="Facts"
            count={arr.state.value.length}
            max={5}
            onAdd={() => arr.pushValue({ label: "Label", value: "Value" })}
          >
            {arr.state.value.map((x, i) => (
              <RepItem
                key={`f-${i}`}
                index={i}
                total={arr.state.value.length}
                title={x.label}
                onMove={(to) => arr.moveValue(i, to)}
                onRemove={() => arr.removeValue(i)}
              >
                <div className="row2">
                  <form.AppField name={`facts[${i}].label` as const}>
                    {(f) => <f.Text label="Label" />}
                  </form.AppField>
                  <form.AppField name={`facts[${i}].value` as const}>
                    {(f) => <f.Text label="Value" />}
                  </form.AppField>
                </div>
              </RepItem>
            ))}
          </Repeater>
        )}
      </form.Field>
      <form.Field name="stats" mode="array">
        {(arr) => (
          <Repeater
            label="Counters"
            count={arr.state.value.length}
            max={4}
            onAdd={() => arr.pushValue({ value: 1, suffix: "", label: "Label" })}
          >
            {arr.state.value.map((x, i) => (
              <RepItem
                key={`s-${i}`}
                index={i}
                total={arr.state.value.length}
                title={`${x.value}${x.suffix ?? ""} ${x.label}`}
                onMove={(to) => arr.moveValue(i, to)}
                onRemove={() => arr.removeValue(i)}
              >
                <div className="row3">
                  <form.AppField name={`stats[${i}].value` as const}>
                    {(f) => <f.NumberInput label="Number" />}
                  </form.AppField>
                  <form.AppField name={`stats[${i}].suffix` as const}>
                    {(f) => <f.Text label="Suffix" />}
                  </form.AppField>
                  <form.AppField name={`stats[${i}].label` as const}>
                    {(f) => <f.Text label="Label" />}
                  </form.AppField>
                </div>
              </RepItem>
            ))}
          </Repeater>
        )}
      </form.Field>
    </>
  );
}

function WorkFields({
  s,
  onChange,
  projects,
}: {
  s: WorkBlock;
  onChange: (s: WorkBlock) => void;
  projects: { id: number; title: string }[];
}) {
  const form = useSectionForm(s, onChange);
  return (
    <>
      <Head form={form} />
      <form.AppField name="heading">{(f) => <f.Text label="Heading" />}</form.AppField>
      <form.Field name="projects">
        {(f) => {
          const sel = f.state.value ?? [];
          const ordered = [
            ...sel.map((id) => projects.find((p) => p.id === id)).filter(Boolean),
            ...projects.filter((p) => !sel.includes(p.id)),
          ] as { id: number; title: string }[];
          return (
            <div className="field">
              <p className="flabel">Case studies shown</p>
              <div className="pick-list">
                {ordered.map((p) => {
                  const on = sel.includes(p.id);
                  const idx = sel.indexOf(p.id);
                  return (
                    <div className="pick" key={p.id}>
                      <input
                        type="checkbox"
                        checked={on}
                        aria-label={p.title}
                        onChange={() =>
                          f.handleChange(on ? sel.filter((x) => x !== p.id) : [...sel, p.id])
                        }
                      />
                      <span>{p.title}</span>
                      {on ? (
                        <>
                          <button
                            className="icon-btn"
                            type="button"
                            aria-label="Move up"
                            disabled={idx === 0}
                            onClick={() => f.handleChange(move(sel, idx, idx - 1))}
                          >
                            <Arrow dir="up" />
                          </button>
                          <button
                            className="icon-btn"
                            type="button"
                            aria-label="Move down"
                            disabled={idx === sel.length - 1}
                            onClick={() => f.handleChange(move(sel, idx, idx + 1))}
                          >
                            <Arrow dir="down" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <p className="hint">None ticked = all published case studies, in their list order.</p>
            </div>
          );
        }}
      </form.Field>
    </>
  );
}

function ExperienceFields({
  s,
  onChange,
}: {
  s: ExperienceBlock;
  onChange: (s: ExperienceBlock) => void;
}) {
  const form = useSectionForm(s, onChange);
  return (
    <>
      <Head form={form} />
      <form.AppField name="heading">
        {(f) => <f.Text label="Heading" hint={accent} />}
      </form.AppField>
      <form.AppField name="intro">{(f) => <f.Area label="Intro" />}</form.AppField>
      <form.Field name="summary" mode="array">
        {(arr) => (
          <Repeater
            label="Summary tiles (2×2)"
            count={arr.state.value.length}
            max={4}
            onAdd={() => arr.pushValue({ value: "1", label: "Label", liveTenure: false })}
          >
            {arr.state.value.map((x, i) => (
              <RepItem
                key={`t-${i}`}
                index={i}
                total={arr.state.value.length}
                title={x.label}
                onMove={(to) => arr.moveValue(i, to)}
                onRemove={() => arr.removeValue(i)}
              >
                <div className="row2">
                  <form.AppField name={`summary[${i}].value` as const}>
                    {(f) => <f.Text label="Value" />}
                  </form.AppField>
                  <form.AppField name={`summary[${i}].label` as const}>
                    {(f) => <f.Text label="Label" />}
                  </form.AppField>
                </div>
                <form.AppField name={`summary[${i}].liveTenure` as const}>
                  {(f) => (
                    <f.Toggle
                      title="Live tenure"
                      desc="Counts time since your first role instead of the value"
                    />
                  )}
                </form.AppField>
              </RepItem>
            ))}
          </Repeater>
        )}
      </form.Field>
    </>
  );
}

function ToolkitFields({ s, onChange }: { s: ToolkitBlock; onChange: (s: ToolkitBlock) => void }) {
  const form = useSectionForm(s, onChange);
  return (
    <>
      <Head form={form} />
      <form.AppField name="heading">
        {(f) => <f.Text label="Heading" hint={accent} />}
      </form.AppField>
      <form.AppField name="legendLabel">{(f) => <f.Text label="Legend label" />}</form.AppField>
      <form.AppField name="note">{(f) => <f.Area label="Legend note" />}</form.AppField>
      <div className="row2">
        <form.AppField name="scaleTop">{(f) => <f.Text label="Scale · top" />}</form.AppField>
        <form.AppField name="scaleBottom">{(f) => <f.Text label="Scale · bottom" />}</form.AppField>
      </div>
      <p className="hint">The layers themselves are edited in Toolkit strata.</p>
    </>
  );
}

function BlogFields({
  s,
  onChange,
}: {
  s: BlogTeaserBlock;
  onChange: (s: BlogTeaserBlock) => void;
}) {
  const form = useSectionForm(s, onChange);
  return (
    <>
      <Head form={form} />
      <form.AppField name="heading">
        {(f) => <f.Text label="Heading" hint={accent} />}
      </form.AppField>
      <div className="row2">
        <form.AppField name="sideCount">
          {(f) => <f.NumberInput label="Recent posts shown" min={1} max={8} />}
        </form.AppField>
        <form.AppField name="allLabel">
          {(f) => <f.Text label="“All posts” button" />}
        </form.AppField>
      </div>
      <form.AppField name="showUpcoming">
        {(f) => (
          <f.Toggle
            title="Show upcoming posts"
            desc="Drafts and posts being written appear as “coming soon”"
          />
        )}
      </form.AppField>
      <p className="hint">The newest published post is always the featured card.</p>
    </>
  );
}

const TOPIC_LABEL: Record<(typeof TOPIC_VALUES)[number], string> = {
  role: "Role",
  freelance: "Freelance",
  collab: "Collaboration",
  hi: "Just saying hi",
};

function ContactFields({ s, onChange }: { s: ContactBlock; onChange: (s: ContactBlock) => void }) {
  const form = useSectionForm(s, onChange);
  return (
    <>
      <Head form={form} />
      <form.AppField name="heading">
        {(f) => <f.Text label="Heading" hint={accent} />}
      </form.AppField>
      <div className="row2">
        <form.AppField name="emailLabel">
          {(f) => <f.Text label="Copy-email label" />}
        </form.AppField>
        <form.AppField name="resumeLabel">{(f) => <f.Text label="Résumé button" />}</form.AppField>
      </div>
      <div className="row2">
        <form.AppField name="formTitle">{(f) => <f.Text label="Form title" />}</form.AppField>
        <form.AppField name="formNote">{(f) => <f.Text label="Form note" />}</form.AppField>
      </div>
      <form.AppField name="topicsLegend">{(f) => <f.Text label="Topics question" />}</form.AppField>
      <form.Field name="topics" mode="array">
        {(arr) => (
          <Repeater
            label="Topic chips"
            count={arr.state.value.length}
            max={4}
            onAdd={() => {
              const used = arr.state.value.map((t) => t.value);
              const next = TOPIC_VALUES.find((v) => !used.includes(v));
              if (next) arr.pushValue({ value: next, label: TOPIC_LABEL[next] });
            }}
          >
            {arr.state.value.map((x, i) => (
              <RepItem
                key={`tp-${x.value}`}
                index={i}
                total={arr.state.value.length}
                title={x.label}
                onMove={(to) => arr.moveValue(i, to)}
                onRemove={() => arr.removeValue(i)}
              >
                <div className="row2">
                  <form.AppField name={`topics[${i}].value` as const}>
                    {(f) => (
                      <f.SelectInput
                        label="Saved as"
                        options={TOPIC_VALUES.map((v) => ({ value: v, label: TOPIC_LABEL[v] }))}
                      />
                    )}
                  </form.AppField>
                  <form.AppField name={`topics[${i}].label` as const}>
                    {(f) => <f.Text label="Chip text" />}
                  </form.AppField>
                </div>
              </RepItem>
            ))}
          </Repeater>
        )}
      </form.Field>
      <div className="row3">
        <form.AppField name="nameLabel">{(f) => <f.Text label="Name field" />}</form.AppField>
        <form.AppField name="emailFieldLabel">
          {(f) => <f.Text label="Email field" />}
        </form.AppField>
        <form.AppField name="messageLabel">{(f) => <f.Text label="Message field" />}</form.AppField>
      </div>
      <div className="row3">
        <form.AppField name="slideLabel">{(f) => <f.Text label="Button label" />}</form.AppField>
        <form.AppField name="sendingLabel">{(f) => <f.Text label="Sending" />}</form.AppField>
        <form.AppField name="sentLabel">{(f) => <f.Text label="Delivered" />}</form.AppField>
      </div>
      <form.AppField name="successText">{(f) => <f.Text label="Success message" />}</form.AppField>
      <form.AppField name="errorText">{(f) => <f.Text label="Error message" />}</form.AppField>
      <form.AppField name="privacyNote">{(f) => <f.Text label="Privacy note" />}</form.AppField>
    </>
  );
}

export function SectionFields({
  section,
  onChange,
  projects,
}: {
  section: Section;
  onChange: (s: Section) => void;
  projects: { id: number; title: string }[];
}) {
  switch (section.blockType) {
    case "hero":
      return <HeroFields s={section} onChange={onChange} />;
    case "marquee":
      return <MarqueeFields s={section} onChange={onChange} />;
    case "about":
      return <AboutFields s={section} onChange={onChange} />;
    case "work":
      return <WorkFields s={section} onChange={onChange} projects={projects} />;
    case "experience":
      return <ExperienceFields s={section} onChange={onChange} />;
    case "toolkit":
      return <ToolkitFields s={section} onChange={onChange} />;
    case "blogTeaser":
      return <BlogFields s={section} onChange={onChange} />;
    case "contact":
      return <ContactFields s={section} onChange={onChange} />;
  }
}

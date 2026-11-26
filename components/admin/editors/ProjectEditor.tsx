"use client";

import { useStore } from "@tanstack/react-form";
import { Arrow } from "@/components/ui/Arrow";
import { useAdmin } from "@/lib/admin/store";
import type { ProjectData } from "@/lib/content/schema";
import { EditorChrome } from "../EditorChrome";
import { Repeater, RepItem } from "../Repeater";
import { Btn, Card } from "../ui";
import { useEntryForm } from "../useDocForm";

export function ProjectEditor({
  id,
  initial,
  published,
  hasDraft,
}: {
  id: number;
  initial: ProjectData;
  published: boolean;
  hasDraft: boolean;
}) {
  const { form, ...doc } = useEntryForm(id, initial);
  // Preview shows unpublished changes; with nothing unpublished it would match the live page.
  const saveState = useAdmin((st) => st.save);
  const canPreview =
    !published || Boolean(doc.draft ?? hasDraft) || saveState === "dirty" || saveState === "saving";
  const slug = useStore(form.store, (s) => s.values.slug);
  return (
    <>
      <EditorChrome
        title="Case"
        accent="study"
        desc={`/work/${slug}`}
        published={published}
        hasDraft={hasDraft}
        {...doc}
        onRestored={doc.restore}
      >
        <Btn
          href={`/api/preview?path=${encodeURIComponent(`/work/${slug}`)}`}
          external
          disabled={!canPreview}
          title={canPreview ? undefined : "No unpublished changes to preview"}
        >
          Preview draft <Arrow dir="out" />
        </Btn>
      </EditorChrome>
      <div className="editor">
        <div className="fields">
          <Card title="Story">
            <div className="fields">
              <form.AppField name="title">{(f) => <f.Text label="Title" />}</form.AppField>
              <form.AppField name="summary">
                {(f) => (
                  <f.Area
                    label="Summary"
                    hint="One line. Shown on the home list and as the page lede."
                  />
                )}
              </form.AppField>
              <form.AppField name="context">
                {(f) => <f.Area label="Context" rows={5} />}
              </form.AppField>
              <form.Field name="sections" mode="array">
                {(arr) => (
                  <Repeater
                    label="Sections"
                    count={arr.state.value.length}
                    onAdd={() => arr.pushValue({ heading: "New section", points: [] })}
                    addLabel="+ Add section"
                  >
                    {arr.state.value.map((sct, i) => (
                      <RepItem
                        key={`sec-${i}`}
                        index={i}
                        total={arr.state.value.length}
                        title={sct.heading}
                        onMove={(to) => arr.moveValue(i, to)}
                        onRemove={() => arr.removeValue(i)}
                      >
                        <form.AppField name={`sections[${i}].heading` as const}>
                          {(f) => <f.Text label="Heading" />}
                        </form.AppField>
                        <form.Field name={`sections[${i}].points` as const} mode="array">
                          {(pts) => (
                            <Repeater
                              label="Points"
                              count={pts.state.value.length}
                              onAdd={() => pts.pushValue("")}
                              addLabel="+ Add point"
                            >
                              {pts.state.value.map((_, j) => (
                                <RepItem
                                  key={`pt-${i}-${j}`}
                                  index={j}
                                  total={pts.state.value.length}
                                  onMove={(to) => pts.moveValue(j, to)}
                                  onRemove={() => pts.removeValue(j)}
                                >
                                  <form.AppField name={`sections[${i}].points[${j}]` as const}>
                                    {(f) => <f.Area label="Point" rows={2} />}
                                  </form.AppField>
                                </RepItem>
                              ))}
                            </Repeater>
                          )}
                        </form.Field>
                      </RepItem>
                    ))}
                  </Repeater>
                )}
              </form.Field>
            </div>
          </Card>
        </div>
        <div className="panel-stack">
          <Card title="Details">
            <div className="fields">
              <form.AppField name="slug">{(f) => <f.Text label="Slug" mono />}</form.AppField>
              <form.AppField name="client">{(f) => <f.Text label="Client" />}</form.AppField>
              <form.AppField name="kind">
                {(f) => <f.Text label="Kind" hint="e.g. Security · Production support" />}
              </form.AppField>
              <form.AppField name="role">{(f) => <f.Text label="Your role" />}</form.AppField>
              <form.AppField name="stack">{(f) => <f.Tags label="Stack" />}</form.AppField>
            </div>
          </Card>
          <Card title="Home list">
            <div className="fields">
              <form.AppField name="listLabel">
                {(f) => <f.Text label="Label" hint="e.g. Security · Client name" />}
              </form.AppField>
              <form.AppField name="listTags">
                {(f) => <f.Tags label="Tags (up to 3)" />}
              </form.AppField>
              <form.AppField name="previewLabel">
                {(f) => <f.Text label="Cursor-card heading" />}
              </form.AppField>
            </div>
          </Card>
          <Card title="Metrics">
            <form.Field name="metrics" mode="array">
              {(arr) => (
                <Repeater
                  label="Metrics"
                  count={arr.state.value.length}
                  max={4}
                  onAdd={() =>
                    arr.pushValue({ value: "1", label: "Label", short: "", inline: false })
                  }
                >
                  {arr.state.value.map((m, i) => (
                    <RepItem
                      key={`m-${i}`}
                      index={i}
                      total={arr.state.value.length}
                      title={`${m.value} ${m.label}`}
                      onMove={(to) => arr.moveValue(i, to)}
                      onRemove={() => arr.removeValue(i)}
                    >
                      <div className="row2">
                        <form.AppField name={`metrics[${i}].value` as const}>
                          {(f) => <f.Text label="Value" />}
                        </form.AppField>
                        <form.AppField name={`metrics[${i}].short` as const}>
                          {(f) => <f.Text label="Short label" />}
                        </form.AppField>
                      </div>
                      <form.AppField name={`metrics[${i}].label` as const}>
                        {(f) => <f.Text label="Label" />}
                      </form.AppField>
                      <form.AppField name={`metrics[${i}].inline` as const}>
                        {(f) => <f.Toggle title="Show on the home list" />}
                      </form.AppField>
                    </RepItem>
                  ))}
                </Repeater>
              )}
            </form.Field>
          </Card>
          <Card title="SEO">
            <div className="fields">
              <form.AppField name="meta.title">
                {(f) => (
                  <f.Text label="Meta title" placeholder="Defaults to the title" maxLength={70} />
                )}
              </form.AppField>
              <form.AppField name="meta.description">
                {(f) => (
                  <f.Area
                    label="Meta description"
                    placeholder="Defaults to the summary"
                    maxLength={160}
                  />
                )}
              </form.AppField>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

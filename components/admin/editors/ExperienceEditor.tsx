"use client";

import { useStore } from "@tanstack/react-form";
import type { ExperienceData } from "@/lib/content/schema";
import { EditorChrome } from "../EditorChrome";
import { Repeater, RepItem } from "../Repeater";
import { Card } from "../ui";
import { useEntryForm } from "../useDocForm";

export function ExperienceEditor({
  id,
  initial,
  published,
  hasDraft,
}: {
  id: number;
  initial: ExperienceData;
  published: boolean;
  hasDraft: boolean;
}) {
  const { form, ...doc } = useEntryForm(id, initial);
  const type = useStore(form.store, (s) => s.values.type);
  const edu = type === "education";
  return (
    <>
      <EditorChrome
        title={edu ? "Education" : "Role"}
        accent="entry"
        desc="Shown on the Experience timeline."
        published={published}
        hasDraft={hasDraft}
        {...doc}
        onRestored={doc.restore}
      />
      <div className="editor">
        <div className="fields">
          <Card title="Basics">
            <div className="fields">
              <form.AppField name="type">
                {(f) => (
                  <f.SelectInput
                    label="Type"
                    options={[
                      { value: "role", label: "Role" },
                      { value: "education", label: "Education" },
                    ]}
                  />
                )}
              </form.AppField>
              <div className="row2">
                <form.AppField name="company">
                  {(f) => <f.Text label={edu ? "School" : "Company"} />}
                </form.AppField>
                <form.AppField name="title">
                  {(f) => <f.Text label={edu ? "Degree" : "Job title"} />}
                </form.AppField>
              </div>
              <div className="row2">
                <form.AppField name="start">
                  {(f) => <f.DateInput label="Start" month />}
                </form.AppField>
                <form.AppField name="end">
                  {(f) => (
                    <f.DateInput
                      label="End"
                      month
                      hint={
                        edu ? undefined : "Empty = current role (shows “Now” and a live duration)."
                      }
                    />
                  )}
                </form.AppField>
              </div>
              <div className="row2">
                <form.AppField name="location">{(f) => <f.Text label="Location" />}</form.AppField>
                {edu ? (
                  <form.AppField name="score">
                    {(f) => <f.Text label="Score" hint="e.g. 8.03 (CGPA)" />}
                  </form.AppField>
                ) : (
                  <form.AppField name="logo">
                    {(f) => <f.Text label="Logo initials" maxLength={3} />}
                  </form.AppField>
                )}
              </div>
            </div>
          </Card>
          {!edu ? (
            <Card title="Highlights">
              <form.Field name="bullets" mode="array">
                {(arr) => (
                  <Repeater
                    label="Bullets"
                    count={arr.state.value.length}
                    onAdd={() => arr.pushValue("")}
                  >
                    {arr.state.value.map((_, i) => (
                      <RepItem
                        key={`b-${i}`}
                        index={i}
                        total={arr.state.value.length}
                        onMove={(to) => arr.moveValue(i, to)}
                        onRemove={() => arr.removeValue(i)}
                      >
                        <form.AppField name={`bullets[${i}]` as const}>
                          {(f) => (
                            <f.Area
                              label="Text"
                              rows={3}
                              hint="Wrap key phrases in **double asterisks** to bold them."
                            />
                          )}
                        </form.AppField>
                      </RepItem>
                    ))}
                  </Repeater>
                )}
              </form.Field>
            </Card>
          ) : null}
        </div>
        {!edu ? (
          <div className="panel-stack">
            <Card title="KPIs">
              <form.Field name="kpis" mode="array">
                {(arr) => (
                  <Repeater
                    label="Numbers"
                    count={arr.state.value.length}
                    max={3}
                    onAdd={() => arr.pushValue({ value: "1", suffix: "", label: "Label" })}
                  >
                    {arr.state.value.map((k, i) => (
                      <RepItem
                        key={`k-${i}`}
                        index={i}
                        total={arr.state.value.length}
                        title={`${k.value}${k.suffix ?? ""}`}
                        onMove={(to) => arr.moveValue(i, to)}
                        onRemove={() => arr.removeValue(i)}
                      >
                        <div className="row2">
                          <form.AppField name={`kpis[${i}].value` as const}>
                            {(f) => <f.Text label="Value" />}
                          </form.AppField>
                          <form.AppField name={`kpis[${i}].suffix` as const}>
                            {(f) => <f.Text label="Suffix" />}
                          </form.AppField>
                        </div>
                        <form.AppField name={`kpis[${i}].label` as const}>
                          {(f) => <f.Text label="Label" />}
                        </form.AppField>
                      </RepItem>
                    ))}
                  </Repeater>
                )}
              </form.Field>
            </Card>
            <Card title="Tags">
              <form.AppField name="tags">{(f) => <f.Tags label="Tech tags" />}</form.AppField>
            </Card>
          </div>
        ) : null}
      </div>
    </>
  );
}

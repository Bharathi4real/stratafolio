"use client";

import { Arrow } from "@/components/ui/Arrow";
import type { Toolkit } from "@/lib/content/schema";
import { EditorChrome } from "../EditorChrome";
import { Repeater, RepItem } from "../Repeater";
import { Btn } from "../ui";
import { useGlobalForm } from "../useDocForm";

export function ToolkitEditor({
  initial,
  published,
  hasDraft,
}: {
  initial: Toolkit;
  published: boolean;
  hasDraft: boolean;
}) {
  const { form, ...doc } = useGlobalForm("toolkit", initial, () => "toolkit");
  return (
    <>
      <EditorChrome
        title="Toolkit"
        accent="strata"
        desc="Layers from the Surface down to The Core. The last layer renders solid ember with dark chips."
        published={published}
        hasDraft={hasDraft}
        {...doc}
        onRestored={doc.restore}
      >
        <Btn href="/api/preview?path=/%23toolkit" external>
          Preview <Arrow dir="out" />
        </Btn>
      </EditorChrome>
      <div className="card card-b">
        <form.Field name="layers" mode="array">
          {(arr) => (
            <Repeater
              label="Layers"
              count={arr.state.value.length}
              max={9}
              onAdd={() => arr.pushValue({ name: "New layer", role: "Role", tools: [] })}
              addLabel="+ Add layer"
            >
              {arr.state.value.map((l, i) => (
                <RepItem
                  key={`layer-${i}-${l.name}`}
                  index={i}
                  total={arr.state.value.length}
                  title={`−${String(i).padStart(2, "0")} · ${l.name}`}
                  onMove={(to) => arr.moveValue(i, to)}
                  onRemove={() => arr.removeValue(i)}
                >
                  <div className="row2">
                    <form.AppField name={`layers[${i}].name` as const}>
                      {(f) => <f.Text label="Layer name" />}
                    </form.AppField>
                    <form.AppField name={`layers[${i}].role` as const}>
                      {(f) => <f.Text label="Role label" />}
                    </form.AppField>
                  </div>
                  <form.AppField name={`layers[${i}].tools` as const}>
                    {(f) => <f.Tags label="Tools" />}
                  </form.AppField>
                </RepItem>
              ))}
            </Repeater>
          )}
        </form.Field>
      </div>
    </>
  );
}

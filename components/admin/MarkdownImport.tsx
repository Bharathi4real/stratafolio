"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { importMarkdownPostAction } from "@/lib/admin/actions";
import { toast } from "@/lib/admin/store";
import { POST_TEMPLATE } from "@/lib/content/post-template";
import { Modal } from "./media";
import { Btn } from "./ui";

/** Blog list: download the Markdown template, or import a filled-in file as a draft post. */
export function MarkdownImport() {
  const router = useRouter();
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: number; warnings: string[] } | null>(null);

  const download = () => {
    const url = URL.createObjectURL(new Blob([POST_TEMPLATE], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "post-template.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const open = (id: number) => {
    setDone(null);
    void qc.invalidateQueries({ queryKey: ["pending"] });
    router.push(`/admin/posts/${id}`);
  };

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    if (!/\.(md|markdown|txt)$/i.test(file.name)) {
      toast("Choose a Markdown (.md) file.", "error");
      return;
    }
    setBusy(true);
    const r = await importMarkdownPostAction(await file.text()).catch(() => ({
      ok: false as const,
      error: "Import failed. Try again.",
    }));
    setBusy(false);
    if (!r.ok || !r.data) {
      if (!r.ok) toast(r.error, "error");
      return;
    }
    if (r.data.warnings.length) setDone(r.data);
    else {
      toast("Imported as a draft. Review it, then publish.");
      open(r.data.id);
    }
  };

  return (
    <>
      <Btn onClick={download} title="A .md file with every field and the formatting rules">
        Template ↓
      </Btn>
      <Btn onClick={() => input.current?.click()} disabled={busy}>
        {busy ? "Importing…" : "Import .md"}
      </Btn>
      <input
        ref={input}
        type="file"
        accept=".md,.markdown,text/markdown"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <Modal open={done !== null} onClose={() => done && open(done.id)} title="Imported as a draft">
        <p className="hint">The post was created, with a few things to check in the editor:</p>
        <ul className="import-warnings">
          {done?.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
        <div>
          <Btn primary onClick={() => done && open(done.id)}>
            Open the draft
          </Btn>
        </div>
      </Modal>
    </>
  );
}

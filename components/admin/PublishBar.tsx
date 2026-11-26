"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { publishAll } from "@/lib/admin/actions";
import { setAdmin, toast } from "@/lib/admin/store";
import { Btn, Status } from "./ui";

type Item = { kind: "global" | "entry"; label: string; isNew?: boolean };

export function PublishBar({ items }: { items: Item[] }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const live = items.filter((i) => i.kind === "global" || !i.isNew);
  if (!live.length) return null;
  return (
    <div className="publish-bar">
      <Status tone="changed">
        {live.length} unpublished change{live.length === 1 ? "" : "s"}
      </Status>
      <p className="muted">{live.map((i) => i.label).join(", ")}.</p>
      <Btn onClick={() => setAdmin({ reviewOpen: true })}>Review changes</Btn>
      <Btn
        primary
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const r = await publishAll();
          setBusy(false);
          if (r.ok) {
            toast("Published and live.");
            await qc.invalidateQueries();
            router.refresh();
          } else toast(r.error, "error");
        }}
      >
        {busy ? "Publishing…" : "Publish all"}
      </Btn>
    </div>
  );
}

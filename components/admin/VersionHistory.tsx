"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sk } from "@/components/ui/Skeleton";
import { clearAutosaves, versionStorage } from "@/lib/admin/actions";
import { confirmDialog, toast } from "@/lib/admin/store";
import { fmtBytes, SetGrid } from "./ui";

/**
 * Settings → Analytics & privacy: how much version history is stored, and a way to clear
 * every autosave at once. Drafts and published versions are never touched.
 */
export function VersionHistory() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["version-storage"],
    queryFn: () => versionStorage(),
  });
  const clear = () =>
    confirmDialog({
      title: `Clear ${data?.autosaves ?? 0} autosaves everywhere?`,
      body: "Every page keeps its published versions and its current draft. Only the saved-while-typing snapshots are deleted.",
      confirmLabel: "Clear all autosaves",
      busyLabel: "Clearing…",
      tone: "danger",
      action: async () => {
        const r = await clearAutosaves();
        if (!r.ok) throw new Error(r.error);
        await qc.invalidateQueries({ queryKey: ["version-storage"] });
        await qc.invalidateQueries({ queryKey: ["versions"] });
        toast(`${r.data?.cleared ?? 0} autosaves cleared.`);
      },
    });
  return (
    <SetGrid
      id="versions"
      title="Version history"
      desc="Autosaves from one editing session merge into one, each page keeps its last 10 autosaves and up to 40 versions in total, and drafts that match the live page are dropped automatically."
    >
      <div className="vh-stats">
        {isLoading || !data ? (
          <Sk h="3.2rem" r=".8rem" />
        ) : (
          <>
            <div>
              <strong>{data.total}</strong>
              <span className="mono subtle">versions</span>
            </div>
            <div>
              <strong>{data.autosaves}</strong>
              <span className="mono subtle">autosaves</span>
            </div>
            <div>
              <strong>{data.docs}</strong>
              <span className="mono subtle">pages</span>
            </div>
            <div>
              <strong>{fmtBytes(data.bytes)}</strong>
              <span className="mono subtle">in the database</span>
            </div>
          </>
        )}
      </div>
      <div>
        <button type="button" className="btn btn-sm" disabled={!data?.autosaves} onClick={clear}>
          Clear all autosaves
        </button>
      </div>
    </SetGrid>
  );
}

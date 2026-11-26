"use client";

import { setToastPos, TOAST_POSITIONS, toast, useAdmin } from "@/lib/admin/store";
import { resetAdminTheme, ThemeMode } from "./ThemeMode";
import { SetGrid } from "./ui";

const LABEL: Record<string, string> = {
  "top-left": "Top left",
  "top-center": "Top centre",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom centre",
  "bottom-right": "Bottom right",
};

/** Per-device admin preferences (stored in this browser, not published). */
export function AdminPrefs() {
  const pos = useAdmin((s) => s.toastPos);
  return (
    <SetGrid
      title="Admin preferences"
      desc="Only for you, on this device. They don’t change the public site."
    >
      <div className="prefs">
        <div className="field">
          <p className="flabel">Admin theme</p>
          <ThemeMode />
        </div>
        <div className="field">
          <p className="flabel">Notification position</p>
          <div className="prefs-row">
            <fieldset className="pos-picker" aria-label="Notification position">
              {TOAST_POSITIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  data-pos={p}
                  aria-pressed={pos === p}
                  aria-label={LABEL[p]}
                  title={LABEL[p]}
                  onClick={() => {
                    setToastPos(p);
                    toast(`Notifications now appear ${LABEL[p].toLowerCase()}.`);
                  }}
                />
              ))}
            </fieldset>
            <span className="mono subtle">{LABEL[pos]}</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                toast("Website_Validation_E2E_Flow.png moved to the bin.", "ok", {
                  action: { label: "Undo", run: () => toast.info("Undo works like this.") },
                });
                setTimeout(() => toast.error("And this is an error, with more room to read."), 350);
              }}
            >
              Show test notifications
            </button>
          </div>
        </div>
        <div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              resetAdminTheme();
              setToastPos("bottom-right");
              toast("Admin preferences reset: Auto theme, notifications bottom right.");
            }}
          >
            Reset preferences
          </button>
        </div>
      </div>
    </SetGrid>
  );
}

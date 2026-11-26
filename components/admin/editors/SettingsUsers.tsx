"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { inviteUser, removeUser, updateProfile } from "@/lib/admin/actions";
import { confirmDialog, toast } from "@/lib/admin/store";
import { authClient } from "@/lib/auth-client";
import { ROLE_LABEL, type Role } from "@/lib/rbac";
import { Modal } from "../media";
import { Spinner } from "../overlays";
import { PasswordInput } from "../PasswordInput";
import { Select } from "../Select";
import { Btn, PageHead, SetGrid } from "../ui";

type U = {
  id: string;
  name: string;
  email: string;
  role: Role;
  image: string | null;
  byline: string | null;
  bio: string | null;
};

/** Name, byline and bio shown on this person's posts. */
function ProfileForm({ u, onDone }: { u: U; onDone: () => void }) {
  const router = useRouter();
  const [v, setV] = useState({ name: u.name, byline: u.byline ?? "", bio: u.bio ?? "" });
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="fields"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await updateProfile(v, u.id).finally(() => setBusy(false));
        if (!r.ok) return toast.error(r.error);
        toast.success("Profile saved. Posts show it now.");
        router.refresh();
        onDone();
      }}
    >
      <div className="field">
        <label htmlFor="pf-name">Name</label>
        <input
          id="pf-name"
          className="inp"
          value={v.name}
          maxLength={80}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="pf-byline">Byline</label>
        <input
          id="pf-byline"
          className="inp"
          value={v.byline}
          maxLength={120}
          placeholder="Frontend engineer · Chennai"
          onChange={(e) => setV({ ...v, byline: e.target.value })}
        />
        <p className="hint">Under the name at the top of each post.</p>
      </div>
      <div className="field">
        <label htmlFor="pf-bio">Bio</label>
        <textarea
          id="pf-bio"
          className="inp"
          rows={4}
          value={v.bio}
          maxLength={600}
          onChange={(e) => setV({ ...v, bio: e.target.value })}
        />
        <p className="hint">
          Author card at the end of their posts. Left empty for the site owner, the bio from General
          is used.
        </p>
      </div>
      <div className="md-acts">
        <span className="bulk-gap" />
        <button type="button" className="btn btn-sm" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
          {busy ? (
            <>
              <Spinner /> Saving…
            </>
          ) : (
            "Save profile"
          )}
        </button>
      </div>
    </form>
  );
}

export function SettingsUsers({
  users,
  me,
  tabs,
}: {
  users: U[];
  me: string;
  tabs: React.ReactNode;
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", role: "author" as Role });
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [touched, setTouched] = useState(false);
  const [inviting, setInviting] = useState(false);
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email.trim());
  const emailBad = touched && form.email.trim() !== "" && !emailOk;
  const invite = async () => {
    setTouched(true);
    if (!emailOk || inviting) return;
    setInviting(true);
    const r = await inviteUser({ ...form, email: form.email.trim() });
    setInviting(false);
    if (r.ok && r.data) {
      setIssued({ email: form.email.trim(), password: r.data.password });
      setForm({ name: "", email: "", role: "author" });
      setTouched(false);
      router.refresh();
    } else if (!r.ok) toast(r.error, "error");
  };
  const [pw, setPw] = useState({ current: "", next: "" });
  const [editing, setEditing] = useState<U | null>(null);
  return (
    <>
      <PageHead
        title="Site"
        accent="settings"
        desc="Global content and switches used across every page."
      />
      {tabs}
      <SetGrid
        title="People with access"
        desc="Admins can change everything; editors run the blog; authors write their own drafts."
      >
        <div className="card">
          <table>
            <thead>
              <tr>
                <th className="mono">User</th>
                <th className="mono">Role</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ cursor: "default" }}>
                  <td>
                    <div style={{ display: "flex", gap: ".6rem", alignItems: "center" }}>
                      <span className="avatar">
                        {u.image ? (
                          // biome-ignore lint/performance/noImgElement: provider avatar
                          <img src={u.image} alt="" width={32} height={32} />
                        ) : (
                          u.name.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <div>
                        <span className="t-title">{u.name}</span>
                        <span className="t-sub">
                          {u.email}
                          {u.byline ? ` · ${u.byline}` : ""}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>{ROLE_LABEL[u.role] ?? ROLE_LABEL.author}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn btn-sm" type="button" onClick={() => setEditing(u)}>
                      Author profile
                    </button>{" "}
                    {u.id !== me ? (
                      <button
                        className="btn btn-sm"
                        type="button"
                        onClick={async () => {
                          if (
                            !(await confirmDialog({
                              title: `Remove ${u.email}?`,
                              body: "They’ll be signed out everywhere and can’t sign in again unless you re-invite them.",
                              confirmLabel: "Remove user",
                              tone: "danger",
                            }))
                          )
                            return;
                          const r = await removeUser(u.id);
                          if (r.ok) router.refresh();
                          else toast(r.error, "error");
                        }}
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="mono subtle">You</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SetGrid>
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Author profile · ${editing.name}` : "Author profile"}
      >
        {editing ? (
          <ProfileForm key={editing.id} u={editing} onDone={() => setEditing(null)} />
        ) : null}
      </Modal>
      <SetGrid
        title="Invite someone"
        desc="They get a one-time password to sign in with; ask them to change it under “Your password”."
      >
        <div className="row2">
          <div className="field">
            <label htmlFor="iv-name">Name</label>
            <input
              id="iv-name"
              className="inp"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="iv-email">Email</label>
            <input
              id="iv-email"
              className="inp"
              type="email"
              autoComplete="off"
              placeholder="name@example.com"
              aria-invalid={emailBad || undefined}
              aria-describedby={emailBad ? "iv-email-err" : undefined}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void invite();
              }}
            />
            {emailBad ? (
              <p id="iv-email-err" className="hint err">
                Enter a valid email, like name@example.com.
              </p>
            ) : null}
          </div>
        </div>
        <div className="field">
          <label htmlFor="iv-role">Role</label>
          <Select
            id="iv-role"
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={[
              {
                value: "author",
                label: ROLE_LABEL.author,
                hint: "Writes their own posts as drafts; an editor publishes them",
              },
              {
                value: "editor",
                label: ROLE_LABEL.editor,
                hint: "Runs the blog: every post, publishing, blog settings, media and stats",
              },
              {
                value: "admin",
                label: ROLE_LABEL.admin,
                hint: "Can change everything, including site settings and users",
              },
            ]}
          />
        </div>
        <div>
          <Btn
            primary
            disabled={!emailOk || inviting}
            title={emailOk ? undefined : "Enter an email first"}
            onClick={invite}
          >
            {inviting ? "Inviting…" : "+ Invite"}
          </Btn>
        </div>
        {issued ? (
          <div className="callout">
            <b>One-time password · shown once</b>
            Send this to {issued.email}: <code className="mono-code">{issued.password}</code>
          </div>
        ) : null}
      </SetGrid>
      <SetGrid title="Your password" desc="At least 10 characters. Other sessions are signed out.">
        <div className="row2">
          <div className="field">
            <label htmlFor="pw-cur">Current password</label>
            <PasswordInput
              id="pw-cur"
              value={pw.current}
              onChange={(v) => setPw({ ...pw, current: v })}
            />
          </div>
          <div className="field">
            <label htmlFor="pw-new">New password</label>
            <PasswordInput
              id="pw-new"
              autoComplete="new-password"
              value={pw.next}
              onChange={(v) => setPw({ ...pw, next: v })}
            />
          </div>
        </div>
        <div>
          <Btn
            onClick={async () => {
              const { error } = await authClient.changePassword({
                currentPassword: pw.current,
                newPassword: pw.next,
                revokeOtherSessions: true,
              });
              if (error) toast(error.message ?? "Couldn’t change the password.", "error");
              else {
                toast("Password changed.");
                setPw({ current: "", next: "" });
              }
            }}
          >
            Change password
          </Btn>
        </div>
      </SetGrid>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { PasswordInput } from "@/components/admin/PasswordInput";
import { authClient } from "@/lib/auth-client";

const OAUTH_ERRORS: Record<string, string> = {
  signup_disabled:
    "That account isn’t invited yet. Ask an admin to invite the same email in Settings → Users.",
  account_not_linked: "That account’s email doesn’t match an invited user.",
  email_not_found:
    "Your provider didn’t share an email address. Make one public, or use a password.",
  access_denied: "Sign-in was cancelled.",
};

export function LoginForm({
  magicLink,
  google,
  github,
  demo = null,
  error,
}: {
  magicLink: boolean;
  google: boolean;
  github: boolean;
  demo?: { email: string; password: string } | null;
  error?: string;
}) {
  const router = useRouter();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(
    error
      ? { tone: "error", text: OAUTH_ERRORS[error] ?? "Couldn’t sign you in with that provider." }
      : null,
  );
  const social = async (provider: "google" | "github") => {
    setBusy(provider);
    setMsg(null);
    const { error: e } = await authClient.signIn.social({
      provider,
      callbackURL: "/admin",
      errorCallbackURL: "/admin/login",
    });
    if (e) {
      setBusy(null);
      setMsg({ tone: "error", text: e.message ?? "Couldn’t start sign-in." });
    }
  };

  return (
    <form
      className="login-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy("password");
        setMsg(null);
        const { error: e2 } = await authClient.signIn.email({ email, password });
        setBusy(null);
        if (e2)
          setMsg({
            tone: "error",
            text:
              e2.status === 429
                ? "Too many attempts. Wait a few minutes."
                : "Email or password is wrong.",
          });
        else router.replace("/admin");
      }}
    >
      <span className="mono tag-admin" style={{ alignSelf: "flex-start" }}>
        Admin
      </span>
      <h1>Sign in</h1>
      <p className="muted">Only invited people can sign in.</p>
      {google || github ? (
        <>
          <div className="oauth">
            {google ? (
              <button
                className="btn oauth-btn"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => social("google")}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
                  />
                </svg>
                {busy === "google" ? "Opening Google…" : "Continue with Google"}
              </button>
            ) : null}
            {github ? (
              <button
                className="btn oauth-btn"
                type="button"
                disabled={Boolean(busy)}
                onClick={() => social("github")}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7c-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7a3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.9v2.8c0 .3.2.6.7.5A10 10 0 0 0 12 2Z" />
                </svg>
                {busy === "github" ? "Opening GitHub…" : "Continue with GitHub"}
              </button>
            ) : null}
          </div>
          <div className="or mono">or with email</div>
        </>
      ) : null}
      {demo?.email ? (
        <div className="demo-login">
          <p className="mono">
            Demo login · {demo.email} / {demo.password}
          </p>
          <button
            className="btn btn-sm"
            type="button"
            onClick={() => {
              setEmail(demo.email);
              setPassword(demo.password);
            }}
          >
            Fill in
          </button>
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${uid}-email`}>Email</label>
        <input
          className="inp"
          id={`${uid}-email`}
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor={`${uid}-pw`}>Password</label>
        <PasswordInput id={`${uid}-pw`} value={password} onChange={setPassword} required />
      </div>
      <button className="btn btn-primary" type="submit" disabled={Boolean(busy)}>
        {busy === "password" ? "Signing in…" : "Sign in"}
      </button>
      {magicLink ? (
        <>
          <div className="or mono">or</div>
          <button
            className="btn"
            type="button"
            disabled={Boolean(busy)}
            onClick={async () => {
              if (!email) {
                setMsg({ tone: "error", text: "Enter your email first." });
                return;
              }
              setBusy("magic");
              const { error: e3 } = await authClient.signIn.magicLink({
                email,
                callbackURL: "/admin",
              });
              setBusy(null);
              setMsg(
                e3
                  ? { tone: "error", text: "Couldn’t send the link." }
                  : { tone: "ok", text: "Check your inbox for a sign-in link." },
              );
            }}
          >
            Email me a magic link
          </button>
        </>
      ) : null}
      <p className={`hint${msg?.tone === "error" ? " err" : ""}`} role="status">
        {msg?.text ?? "Sign-in attempts are rate-limited."}
      </p>
    </form>
  );
}

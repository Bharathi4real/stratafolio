"use client";

import { useState } from "react";
import { MailIcon } from "@/components/ui/Icons";
import { track } from "@/lib/analytics";

export function CopyEmail({ email, label }: { email: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className={`copy-mail${copied ? " is-copied" : ""}`}
      type="button"
      aria-label={`Copy email address ${email}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(email);
          setCopied(true);
          track("email_copy");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.location.href = `mailto:${email}`;
        }
      }}
    >
      <span className="cm-ic" aria-hidden="true">
        <MailIcon />
      </span>
      <span className="cm-txt">
        <small>{label}</small>
        <strong>{email}</strong>
      </span>
      <span className="cm-act" aria-live="polite">
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}

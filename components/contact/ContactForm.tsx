"use client";

import { useForm } from "@tanstack/react-form";
import Link from "next/link";
import { useRef, useState } from "react";
import { sendMessage } from "@/app/actions/contact";
import { track } from "@/lib/analytics";
import { type ContactInput, contactDefaults, contactSchema } from "@/lib/contact-schema";
import { LiquidChips } from "./LiquidChips";
import { type LaunchState, SendButton } from "./SendButton";

export type ContactCopy = {
  formTitle: string;
  formNote: string;
  topicsLegend: string;
  topics: { value: ContactInput["topic"]; label: string }[];
  nameLabel: string;
  emailLabel: string;
  messageLabel: string;
  slideLabel: string;
  sendingLabel: string;
  sentLabel: string;
  successText: string;
  errorText: string;
  privacyNote: string;
  fallbackEmail: string;
};

/** TanStack Form + the same Zod schema as the Server Action; errors map back onto fields. */
export function ContactForm({ copy }: { copy: ContactCopy }) {
  const [launch, setLaunch] = useState<LaunchState>("idle");
  const [bounce, setBounce] = useState(0);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const form = useForm({
    defaultValues: { ...contactDefaults, topic: copy.topics[0]?.value ?? "role" } as ContactInput,
    validators: { onBlur: contactSchema, onSubmit: contactSchema },
    // Invalid fields: shake the send button and put the cursor in the first field that needs fixing.
    onSubmitInvalid: () => {
      setBounce((b) => b + 1);
      // Wait a frame so the error states have rendered.
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>("[aria-invalid='true']")
          ?.focus({ preventScroll: true }),
      );
    },
    onSubmit: async ({ value, formApi }) => {
      setStatus(null);
      setLaunch("sending");
      const started = Date.now();
      let res: Awaited<ReturnType<typeof sendMessage>>;
      try {
        res = await sendMessage(value);
      } catch {
        res = { status: "error", message: copy.errorText };
      }
      // Let the knob finish its run before flipping state.
      await new Promise((r) => setTimeout(r, Math.max(0, 700 - (Date.now() - started))));
      if (res.status === "ok") {
        track("contact_submit", { topic: value.topic });
        setLaunch("sent");
        setStatus({ tone: "ok", text: copy.successText });
        // Clear every field (values, errors, touched) straight away; the knob shows the check,
        // then slides home so the form is ready for another message.
        formApi.reset();
        setTimeout(() => setLaunch("idle"), 1800);
        setTimeout(() => setStatus((s) => (s?.tone === "ok" ? null : s)), 6000);
        return;
      }
      track("contact_error");
      setLaunch("idle"); // knob springs home; the visitor's text stays so they can retry
      if (res.fields)
        for (const [k, msg] of Object.entries(res.fields))
          formApi.setFieldMeta(k as keyof ContactInput, (m) => ({
            ...m,
            errorMap: { ...m.errorMap, onServer: msg },
            isTouched: true,
          }));
      setStatus({ tone: "error", text: res.message || copy.errorText });
    },
  });

  const firstError = (errors: unknown[]) => {
    const e = errors.find(Boolean) as string | { message?: string } | undefined;
    return typeof e === "string" ? e : e?.message;
  };

  const field = (
    name: "name" | "email" | "message",
    n: string,
    label: string,
    opts: { type?: string; autoComplete?: string; textarea?: boolean },
  ) => (
    <form.Field name={name}>
      {(f) => {
        const err = f.state.meta.isTouched ? firstError(f.state.meta.errors) : undefined;
        const id = `f-${name}`;
        const common = {
          id,
          name,
          placeholder: " ",
          value: f.state.value,
          onBlur: f.handleBlur,
          "aria-invalid": err ? true : undefined,
          "aria-describedby": err ? `${id}-err` : undefined,
          required: true,
        } as const;
        return (
          <>
            <div className={`field${err ? " has-error" : ""}`}>
              <span className="fn">{n}</span>
              <div className="fi">
                {opts.textarea ? (
                  <textarea {...common} rows={4} onChange={(e) => f.handleChange(e.target.value)} />
                ) : (
                  <input
                    {...common}
                    type={opts.type ?? "text"}
                    autoComplete={opts.autoComplete}
                    onChange={(e) => f.handleChange(e.target.value)}
                  />
                )}
                <label htmlFor={id}>{label}</label>
              </div>
            </div>
            <p className="field-err" id={`${id}-err`} aria-live="polite">
              {err ?? ""}
            </p>
          </>
        );
      }}
    </form.Field>
  );

  return (
    <form
      className="form-card"
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (launch === "idle") void form.handleSubmit();
      }}
    >
      <div className="form-card-head">
        <h3>{copy.formTitle}</h3>
        <span className="eyebrow muted">{copy.formNote}</span>
      </div>
      <form.Field name="topic">
        {(f) => (
          <LiquidChips
            name="topic"
            legend={copy.topicsLegend}
            options={copy.topics}
            value={f.state.value}
            onChange={(v) => f.handleChange(v as ContactInput["topic"])}
            onBlur={f.handleBlur}
          />
        )}
      </form.Field>
      {field("name", "01", copy.nameLabel, { autoComplete: "name" })}
      {field("email", "02", copy.emailLabel, { type: "email", autoComplete: "email" })}
      {field("message", "03", copy.messageLabel, { textarea: true })}
      <form.Field name="company">
        {(f) => (
          <div className="hp" aria-hidden="true">
            <label htmlFor="f-company">Company</label>
            <input
              id="f-company"
              tabIndex={-1}
              autoComplete="off"
              value={f.state.value ?? ""}
              onChange={(e) => f.handleChange(e.target.value)}
            />
          </div>
        )}
      </form.Field>
      <div className="form-foot">
        <p data-status role="status" className={status?.tone === "error" ? "is-error" : undefined}>
          {status?.text ?? ""}
          {status?.tone === "error" ? (
            <>
              {" "}
              <a href={`mailto:${copy.fallbackEmail}`}>{copy.fallbackEmail}</a>
            </>
          ) : null}
        </p>
        <SendButton
          state={launch}
          labels={{ idle: copy.slideLabel, sending: copy.sendingLabel, sent: copy.sentLabel }}
          bounce={bounce}
        />
      </div>
      <p className="form-note">
        {copy.privacyNote.replace(/\s*See the privacy policy\.?$/, "")}{" "}
        <Link href="/privacy">See the privacy policy.</Link>
      </p>
    </form>
  );
}

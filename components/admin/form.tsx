"use client";

import { createFormHook, createFormHookContexts } from "@tanstack/react-form";
import { type KeyboardEvent, useId, useState } from "react";
import { DatePicker } from "./DatePicker";
import { Select } from "./Select";
import { Switch } from "./ui";

/**
 * Admin form kit (TanStack Form composition API). Field components read their field from
 * context, so editors write `<form.AppField name="title">{(f) => <f.Text label="Title" />}</form.AppField>`.
 */
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

function Label({ id, label, extra }: { id: string; label: string; extra?: React.ReactNode }) {
  return (
    <label htmlFor={id}>
      {label}
      {extra ? <small>{extra}</small> : null}
    </label>
  );
}

function errorText(errors: unknown[]) {
  const e = errors.find(Boolean) as string | { message?: string } | undefined;
  return typeof e === "string" ? e : e?.message;
}

function Text({
  label,
  hint,
  placeholder,
  maxLength,
  type = "text",
  mono,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  maxLength?: number;
  type?: string;
  mono?: boolean;
}) {
  const f = useFieldContext<string | null | undefined>();
  const id = useId();
  const v = f.state.value ?? "";
  const err = errorText(f.state.meta.errors);
  return (
    <div className="field">
      <Label id={id} label={label} extra={maxLength ? `${v.length}/${maxLength}` : undefined} />
      <input
        id={id}
        className={`inp${mono ? " inp-mono" : ""}`}
        type={type}
        value={v}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(e) => f.handleChange(e.target.value)}
        onBlur={f.handleBlur}
        aria-invalid={err ? true : undefined}
      />
      {err ? <p className="hint err">{err}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function Area({
  label,
  hint,
  rows = 3,
  maxLength,
  placeholder,
}: {
  label: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
}) {
  const f = useFieldContext<string | null | undefined>();
  const id = useId();
  const v = f.state.value ?? "";
  return (
    <div className="field">
      <Label id={id} label={label} extra={maxLength ? `${v.length}/${maxLength}` : undefined} />
      <textarea
        id={id}
        className="inp"
        rows={rows}
        value={v}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => f.handleChange(e.target.value)}
        onBlur={f.handleBlur}
      />
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function NumberInput({
  label,
  hint,
  min,
  max,
  step = 1,
}: {
  label: string;
  hint?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const f = useFieldContext<number | null | undefined>();
  const id = useId();
  const v = f.state.value;
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const bump = (d: number) => f.handleChange(clamp((v ?? min ?? 0) + d));
  return (
    <div className="field">
      <Label id={id} label={label} />
      <div className="num">
        <input
          id={id}
          className="inp"
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          step={step}
          value={v ?? ""}
          onChange={(e) => f.handleChange(e.target.value === "" ? null : Number(e.target.value))}
          onBlur={() => {
            if (v != null && !Number.isNaN(v)) f.handleChange(clamp(v));
            f.handleBlur();
          }}
        />
        <span className="num-step">
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Decrease ${label}`}
            disabled={v != null && min != null && v <= min}
            onClick={() => bump(-step)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M6 12h12" />
            </svg>
          </button>
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Increase ${label}`}
            disabled={v != null && max != null && v >= max}
            onClick={() => bump(step)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 6v12M6 12h12" />
            </svg>
          </button>
        </span>
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function DateInput({
  label,
  hint,
  month,
  time,
  placeholder,
  min,
}: {
  label: string;
  hint?: string;
  month?: boolean;
  /** Date + time (stored as an ISO instant). */
  time?: boolean;
  placeholder?: string;
  min?: string;
}) {
  const f = useFieldContext<string | null | undefined>();
  const id = useId();
  return (
    <div className="field">
      <Label id={id} label={label} />
      <DatePicker
        id={id}
        mode={time ? "datetime" : month ? "month" : "date"}
        value={f.state.value}
        placeholder={placeholder}
        min={min}
        onChange={(v) => f.handleChange(v)}
        onBlur={f.handleBlur}
      />
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function SelectInput({
  label,
  options,
  hint,
}: {
  label: string;
  options: readonly { value: string; label: string }[] | readonly string[];
  hint?: string;
}) {
  const f = useFieldContext<string>();
  const id = useId();
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="field">
      <Label id={id} label={label} />
      <Select
        id={id}
        value={f.state.value ?? ""}
        onChange={(v) => f.handleChange(v)}
        onBlur={f.handleBlur}
        options={opts}
      />
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

function Toggle({ title, desc }: { title: string; desc?: string }) {
  const f = useFieldContext<boolean | null | undefined>();
  return (
    <div className="switch-row">
      <div>
        <b>{title}</b>
        {desc ? <span>{desc}</span> : null}
      </div>
      <Switch checked={Boolean(f.state.value)} onChange={(v) => f.handleChange(v)} label={title} />
    </div>
  );
}

/** Chips input for string[] (tags, tools, marquee items). Enter or comma adds; Backspace removes. */
function Tags({
  label,
  hint,
  placeholder = "Add, press Enter",
}: {
  label: string;
  hint?: string;
  placeholder?: string;
}) {
  const f = useFieldContext<string[] | null | undefined>();
  const id = useId();
  const [draft, setDraft] = useState("");
  const tags = f.state.value ?? [];
  const add = () => {
    const t = draft.trim().replace(/,$/, "");
    if (t && !tags.includes(t)) f.handleChange([...tags, t]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && !draft && tags.length) f.handleChange(tags.slice(0, -1));
  };
  return (
    <div className="field">
      <Label id={id} label={label} extra={tags.length ? String(tags.length) : undefined} />
      <div className="tags-inp">
        {tags.map((t, i) => (
          <span className="tagc" key={t}>
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => f.handleChange(tags.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
        />
      </div>
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { Text, Area, NumberInput, DateInput, SelectInput, Toggle, Tags },
  formComponents: {},
});

"use client";

import Link from "next/link";
import { type ReactNode, useLayoutEffect, useRef } from "react";

export function PageHead({
  title,
  accent,
  desc,
  children,
}: {
  title: string;
  accent?: string;
  desc?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>
          {title} {accent ? <em>{accent}</em> : null}
        </h1>
        {desc ? <p>{desc}</p> : null}
      </div>
      {children ? <div className="ph-actions">{children}</div> : null}
    </div>
  );
}

export function Btn({
  children,
  primary,
  small = true,
  href,
  onClick,
  type = "button",
  disabled,
  external,
  className = "",
  title,
}: {
  children: ReactNode;
  title?: string;
  primary?: boolean;
  small?: boolean;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  external?: boolean;
  className?: string;
}) {
  const cls = `btn${small ? " btn-sm" : ""}${primary ? " btn-primary" : ""} ${className}`.trim();
  // A disabled link can't be clicked, so render it as a disabled button instead.
  if (href && !disabled)
    return external ? (
      <a className={cls} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    ) : (
      <Link className={cls} href={href}>
        {children}
      </Link>
    );
  return (
    <button className={cls} type={type} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

export function Status({
  tone,
  children,
}: {
  tone?: "pub" | "wip" | "changed" | "sched";
  children: ReactNode;
}) {
  return (
    <span className={`status${tone ? ` ${tone}` : ""}`}>
      <i />
      {children}
    </span>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      className="sw"
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

export function SwitchRow({
  title,
  desc,
  checked,
  onChange,
  disabled,
}: {
  title: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="switch-row">
      <div>
        <b>{title}</b>
        {desc ? <span>{desc}</span> : null}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

/** Segmented control with a sliding ember indicator. */
export function Seg<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const ref = useRef<HTMLFieldSetElement>(null);
  const ind = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const btn = ref.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (btn && ind.current) {
      ind.current.style.width = `${btn.offsetWidth}px`;
      ind.current.style.transform = `translateX(${btn.offsetLeft}px)`;
    }
  });
  return (
    <fieldset className="seg" ref={ref} aria-label={label}>
      <span className="ind" ref={ind} />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </fieldset>
  );
}

/** Tabs with a sliding underline (Settings). */
export function Tabs({
  tabs,
  current,
}: {
  tabs: { href: string; label: string; id: string }[];
  current: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ind = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const a = ref.current?.querySelector<HTMLAnchorElement>('[aria-selected="true"]');
    if (a && ind.current) {
      ind.current.style.width = `${a.offsetWidth}px`;
      ind.current.style.transform = `translateX(${a.offsetLeft}px)`;
    }
  });
  return (
    <div className="tabs" role="tablist" ref={ref}>
      <span className="ind" ref={ind} />
      {tabs.map((t) => (
        <Link key={t.id} role="tab" aria-selected={t.id === current} href={t.href} className="tab">
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function Card({
  title,
  aside,
  children,
  bodyClass = "card-b",
  className = "",
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  bodyClass?: string;
  className?: string;
}) {
  return (
    <div className={`card ${className}`.trim()}>
      {title ? (
        <div className="card-h">
          <h3>{title}</h3>
          {aside ? <span className="mono subtle">{aside}</span> : null}
        </div>
      ) : null}
      <div className={bodyClass}>{children}</div>
    </div>
  );
}

export function SetGrid({
  title,
  desc,
  children,
  id,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
  /** Anchor, so search and links can jump straight to a section (e.g. #footer). */
  id?: string;
}) {
  return (
    <div className="set-grid" id={id}>
      <div>
        <h4>{title}</h4>
        {desc ? <p>{desc}</p> : null}
      </div>
      <div className="fields">{children}</div>
    </div>
  );
}

export { fmtBytes, timeAgo } from "@/lib/admin/format";

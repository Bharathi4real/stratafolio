"use client";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Arrow } from "@/components/ui/Arrow";
import { LogoMark } from "@/components/ui/LogoMark";
import { adminNavAction, pendingChanges, unreadCount } from "@/lib/admin/actions";
import { setAdmin, showFlashToast, useAdmin } from "@/lib/admin/store";
import type { AdminUser } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import type { Logo } from "@/lib/brand";
import { useHotkey } from "@/lib/hotkeys";
import { markDocument } from "@/lib/mark";
import { can, type Permission, ROLE_LABEL } from "@/lib/rbac";
import { ReviewHost } from "./Changes";
import { ConfirmHost, Toaster } from "./overlays";
import { ThemeMode } from "./ThemeMode";
import { Btn } from "./ui";

type Counts = {
  home: number;
  projects: number;
  experience: number;
  toolkit: number;
  posts: number;
  unread: number;
};
type SearchItem = { label: string; href: string; group: string };
/** A fixed ⌘K entry, shown only to roles with `perm` (the pages enforce it on the server). */
type PageItem = SearchItem & { perm?: Permission };

const I = {
  dash: <path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" />,
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  nav: <path d="M4 6h16M4 12h16M4 18h10" />,
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  case: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18" />
    </>
  ),
  brief: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </>
  ),
  strata: <path d="M3 7c3-2 6 2 9 0s6-2 9 0M3 12c3-2 6 2 9 0s6-2 9 0M3 17c3-2 6 2 9 0s6-2 9 0" />,
  post: (
    <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5" />
  ),
  media: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  shield: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
  users: (
    <path d="M9 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M17 11a3 3 0 1 0 0-6M22 21a6 6 0 0 0-4-5.7" />
  ),
  stats: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  palette: (
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.7-.9 1.4-1.9-.3-1 .3-2.1 1.4-2.1H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10ZM7.5 11.5h.01M10.5 7.5h.01M15.5 8.5h.01" />
  ),
};

const Icon = ({ d }: { d: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
    {d}
  </svg>
);

function NavLink({
  href,
  icon,
  label,
  extra,
  exact,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  extra?: ReactNode;
  exact?: boolean;
}) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={active ? "is-active" : undefined}
      aria-current={active ? "page" : undefined}
      onClick={() => setAdmin({ navOpen: false })}
    >
      <Icon d={icon} />
      {label}
      {extra}
    </Link>
  );
}

type Crumb = { label: string; href?: string };
/** Site-wide settings tabs (/admin/settings/[tab]); "navigation" is the portfolio's own. */
const SETTINGS_TABS: Record<string, string> = {
  general: "General",
  seo: "SEO",
  privacy: "Analytics & privacy",
  appearance: "Appearance",
  users: "Users",
};
/** Sidebar group each section sits in (shown as a plain crumb: groups have no page). */
const SECTIONS: Record<string, { label: string; group?: string }> = {
  stats: { label: "Stats" },
  home: { label: "Home page", group: "Portfolio" },
  projects: { label: "Case studies", group: "Portfolio" },
  experience: { label: "Experience", group: "Portfolio" },
  toolkit: { label: "Toolkit strata", group: "Portfolio" },
  posts: { label: "Posts", group: "Blog" },
  "blog-settings": { label: "Blog settings", group: "Blog" },
  media: { label: "Media", group: "Library" },
  messages: { label: "Messages", group: "Library" },
};
/** Trail for the current admin path: Admin / Portfolio / Case studies / Edit. */
function crumbsFor(path: string): Crumb[] {
  const parts = path
    .replace(/^\/admin\/?/, "")
    .split("/")
    .filter(Boolean);
  const out: Crumb[] = [{ label: "Admin", href: "/admin" }];
  if (!parts.length) return [...out, { label: "Dashboard" }];
  const [section, sub] = parts;
  if (section === "settings") {
    // Same URL family, but the header & footer belong to the portfolio.
    if (sub === "navigation") return [...out, { label: "Portfolio" }, { label: "Header & footer" }];
    out.push({ label: "Settings", href: "/admin/settings/general" });
    if (sub) out.push({ label: SETTINGS_TABS[sub] ?? sub });
    return out;
  }
  const { label: name, group } = SECTIONS[section] ?? { label: section };
  if (group) out.push({ label: group });
  if (!sub) return [...out, { label: name }];
  out.push({ label: name, href: `/admin/${section}` });
  out.push({
    label: section === "stats" ? decodeURIComponent(sub) : sub === "new" ? "New" : "Edit",
  });
  return out;
}

function SaveIndicator() {
  const save = useAdmin((s) => s.save);
  const err = useAdmin((s) => s.saveError);
  const text = {
    idle: "All changes saved",
    saved: "Draft saved",
    dirty: "Unsaved changes",
    saving: "Saving…",
    error: err ? `Not saved: ${err}` : "Not saved",
  }[save];
  return (
    <span
      className={`saved mono${save === "dirty" || save === "saving" ? " is-dirty" : ""}${save === "error" ? " is-error" : ""}`}
      aria-live="polite"
    >
      <i />
      <span>{text}</span>
    </span>
  );
}

/** Editors and admins only (posts.manage); authors' drafts are published by an editor. */
function PublishButton({ canPublish }: { canPublish: boolean }) {
  const savedAt = useAdmin((s) => s.savedAt ?? 0);
  const { data = [] } = useQuery({
    queryKey: ["pending", savedAt],
    queryFn: () => pendingChanges(),
    refetchInterval: 30_000,
    enabled: canPublish,
  });
  const n = data.filter((d) => d.kind === "global" || !d.isNew).length;
  if (!canPublish) return null;
  // Opens the Review panel (see exactly what goes live, publish per item or all).
  return (
    <Btn primary disabled={n === 0} onClick={() => setAdmin({ reviewOpen: true })}>
      {n ? `Publish changes · ${n}` : "Published"}
    </Btn>
  );
}

function UnreadBadge({ initial }: { initial: number }) {
  const { data } = useQuery({
    queryKey: ["unread"],
    queryFn: () => unreadCount(),
    initialData: initial,
    refetchInterval: 60_000,
  });
  return data ? <span className="count">{data}</span> : null;
}

function Palette({ items }: { items: SearchItem[] }) {
  const open = useAdmin((s) => s.paletteOpen);
  const [q, setQ] = useState("");
  const [hl, setHl] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (
      s ? items.filter((i) => i.label.toLowerCase().includes(s) || i.group.includes(s)) : items
    ).slice(0, 12);
  }, [q, items]);
  useEffect(() => {
    if (open) {
      setQ("");
      setHl(0);
      setTimeout(() => input.current?.focus(), 20);
    }
  }, [open]);
  useHotkey("Escape", () => setAdmin({ paletteOpen: false }), {
    enabled: open,
    conflictBehavior: "allow",
  });
  if (!open) return null;
  const go = (href: string) => {
    setAdmin({ paletteOpen: false });
    router.push(href);
  };
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes; Escape and the list are keyboard accessible
    <div
      className="palette-wrap"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && setAdmin({ paletteOpen: false })}
    >
      <div className="palette" role="dialog" aria-label="Search content">
        <input
          ref={input}
          className="inp"
          placeholder="Search pages, posts, case studies…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setHl(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHl((h) => Math.min(h + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHl((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && results[hl]) go(results[hl].href);
          }}
        />
        <ul>
          {results.map((r, i) => (
            <li key={r.href}>
              <button
                type="button"
                className={i === hl ? "hl" : undefined}
                onMouseEnter={() => setHl(i)}
                onClick={() => go(r.href)}
              >
                <span>{r.label}</span>
                <span className="mono subtle">{r.group}</span>
              </button>
            </li>
          ))}
          {results.length === 0 ? <li className="palette-empty">Nothing matches.</li> : null}
        </ul>
      </div>
    </div>
  );
}

const SITE: Permission = "site.manage";
// Labels follow the sidebar groups: Portfolio · …, Blog · …, Library · …, Settings · ….
const PAGES: PageItem[] = [
  { label: "Dashboard", href: "/admin", group: "page" },
  {
    label: "Stats: visitors, page views, blog reads",
    href: "/admin/stats",
    group: "page",
    perm: "stats.view",
  },
  { label: "Portfolio · Home page", href: "/admin/home", group: "portfolio", perm: SITE },
  { label: "Portfolio · Case studies", href: "/admin/projects", group: "portfolio", perm: SITE },
  { label: "Portfolio · Experience", href: "/admin/experience", group: "portfolio", perm: SITE },
  { label: "Portfolio · Toolkit strata", href: "/admin/toolkit", group: "portfolio", perm: SITE },
  {
    label: "Portfolio · Header & footer",
    href: "/admin/settings/navigation",
    group: "portfolio",
    perm: SITE,
  },
  {
    label: "Portfolio · Footer",
    href: "/admin/settings/navigation#footer",
    group: "portfolio",
    perm: SITE,
  },
  { label: "Blog · Posts", href: "/admin/posts", group: "blog", perm: "posts.write" },
  {
    label: "Blog · Settings (header, footer & page)",
    href: "/admin/blog-settings",
    group: "blog",
    perm: "blog.settings",
  },
  { label: "Library · Media", href: "/admin/media", group: "library", perm: "media.upload" },
  { label: "Library · Messages", href: "/admin/messages", group: "library", perm: SITE },
  { label: "Settings · General", href: "/admin/settings/general", group: "settings", perm: SITE },
  { label: "Settings · SEO", href: "/admin/settings/seo", group: "settings", perm: SITE },
  {
    label: "Settings · Analytics & privacy",
    href: "/admin/settings/privacy",
    group: "settings",
    perm: SITE,
  },
  {
    label: "Settings · Version history & drafts",
    href: "/admin/settings/privacy#versions",
    group: "settings",
    perm: SITE,
  },
  {
    label: "Settings · Appearance (colour palette)",
    href: "/admin/settings/appearance",
    group: "settings",
    perm: SITE,
  },
  { label: "Settings · Users", href: "/admin/settings/users", group: "settings", perm: SITE },
];

export function AdminShell({
  user,
  counts: initialCounts,
  search: initialSearch,
  logo,
  badge = "Admin",
  demo = false,
  children,
}: {
  user: AdminUser;
  counts: Counts;
  search: SearchItem[];
  logo: Logo;
  badge?: string;
  demo?: boolean;
  children: ReactNode;
}) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 15_000 } } }),
  );
  const path = usePathname();
  const router = useRouter();
  const navOpen = useAdmin((s) => s.navOpen);
  const crumbs = crumbsFor(path);
  // UI only: every page and Server Action checks the same permissions on the server.
  const site = can(user.role, "site.manage");
  const blogPosts = can(user.role, "posts.write");
  const blogSettings = can(user.role, "blog.settings");
  const media = can(user.role, "media.upload");
  const canPublish = can(user.role, "posts.manage");
  const pages = PAGES.filter((p) => !p.perm || can(user.role, p.perm));
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useHotkey("Mod+K", (e) => {
    e.preventDefault();
    setAdmin({ paletteOpen: true });
  });

  useEffect(() => {
    setAdmin({ save: "idle" });
    showFlashToast();
    markDocument();
  }, []);

  // Sidebar counts + ⌘K index. The layout's props are only the first snapshot (layouts don't
  // re-render on client navigation), so refetch after every navigation and whenever an action
  // invalidates queries (create, cancel, delete, publish).
  const nav = useQuery(
    {
      queryKey: ["nav"],
      queryFn: () => adminNavAction(),
      initialData: { counts: initialCounts, search: initialSearch },
      staleTime: 0,
    },
    client,
  );
  const counts = nav.data.counts;
  const search = nav.data.search;
  const firstPath = useRef(path);
  useEffect(() => {
    if (path === firstPath.current) return;
    firstPath.current = path;
    void client.invalidateQueries({ queryKey: ["nav"] });
  }, [path, client]);

  return (
    <QueryClientProvider client={client}>
      <div className="app">
        <aside className={`side${navOpen ? " open" : ""}`} aria-label="Admin navigation">
          <div className="side-top">
            <Link className="brand" href="/admin" aria-label={`${logo.text} admin, dashboard`}>
              <LogoMark logo={logo} />
            </Link>
            <span className="mono tag-admin">{badge}</span>
          </div>
          <button className="search" type="button" onClick={() => setAdmin({ paletteOpen: true })}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            Search content<kbd>⌘K</kbd>
          </button>
          <nav className="nav">
            <div className="nav-group">
              <p className="mono">Overview</p>
              <NavLink href="/admin" exact icon={I.dash} label="Dashboard" />
              {can(user.role, "stats.view") ? (
                <NavLink href="/admin/stats" icon={I.stats} label="Stats" />
              ) : null}
            </div>
            {site ? (
              <div className="nav-group">
                <p className="mono">Portfolio</p>
                <NavLink
                  href="/admin/home"
                  icon={I.home}
                  label="Home page"
                  extra={<span className="cnt">{counts.home}</span>}
                />
                <NavLink
                  href="/admin/projects"
                  icon={I.case}
                  label="Case studies"
                  extra={<span className="cnt">{counts.projects}</span>}
                />
                <NavLink
                  href="/admin/experience"
                  icon={I.brief}
                  label="Experience"
                  extra={<span className="cnt">{counts.experience}</span>}
                />
                <NavLink
                  href="/admin/toolkit"
                  icon={I.strata}
                  label="Toolkit strata"
                  extra={<span className="cnt">{counts.toolkit}</span>}
                />
                <NavLink href="/admin/settings/navigation" icon={I.nav} label="Header & footer" />
              </div>
            ) : null}
            {blogPosts || blogSettings ? (
              <div className="nav-group">
                <p className="mono">Blog</p>
                {blogPosts ? (
                  <NavLink
                    href="/admin/posts"
                    icon={I.post}
                    label="Posts"
                    extra={<span className="cnt">{counts.posts}</span>}
                  />
                ) : null}
                {blogSettings ? (
                  <NavLink href="/admin/blog-settings" icon={I.gear} label="Blog settings" />
                ) : null}
              </div>
            ) : null}
            {media || site ? (
              <div className="nav-group">
                <p className="mono">Library</p>
                {media ? <NavLink href="/admin/media" icon={I.media} label="Media" /> : null}
                {site ? (
                  <NavLink
                    href="/admin/messages"
                    icon={I.mail}
                    label="Messages"
                    extra={<UnreadBadge initial={counts.unread} />}
                  />
                ) : null}
              </div>
            ) : null}
            {site ? (
              <div className="nav-group">
                <p className="mono">Settings</p>
                <NavLink href="/admin/settings/general" icon={I.gear} label="General" />
                <NavLink href="/admin/settings/seo" icon={I.search} label="SEO" />
                <NavLink
                  href="/admin/settings/privacy"
                  icon={I.shield}
                  label="Analytics & privacy"
                />
                <NavLink href="/admin/settings/appearance" icon={I.palette} label="Appearance" />
                <NavLink href="/admin/settings/users" icon={I.users} label="Users" />
              </div>
            ) : null}
          </nav>
          <div className="side-foot">
            <span className="avatar">{initials}</span>
            <div className="who">
              <strong>{user.name}</strong>
              <button
                type="button"
                className="signout"
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/admin/login");
                }}
              >
                {ROLE_LABEL[user.role]} · Sign out
              </button>
            </div>
          </div>
        </aside>
        {navOpen ? (
          <button
            className="side-scrim"
            type="button"
            aria-label="Close navigation"
            onClick={() => setAdmin({ navOpen: false })}
          />
        ) : null}

        <div className="main">
          <header className="topbar">
            <button
              className="icon-btn m-menu"
              type="button"
              aria-label="Open navigation"
              onClick={() => setAdmin({ navOpen: true })}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M4 8h16M4 16h16" />
              </svg>
            </button>
            <nav className="crumbs" aria-label="Breadcrumb">
              {crumbs.map((c, n) => (
                <span key={`${c.label}-${n}`} className="crumb">
                  {n ? <span aria-hidden="true">/</span> : null}
                  {n === crumbs.length - 1 ? (
                    <b aria-current="page">{c.label}</b>
                  ) : c.href ? (
                    <Link href={c.href}>{c.label}</Link>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
            <div className="top-actions">
              <SaveIndicator />
              <ThemeMode />
              <Btn href="/" external>
                View site <Arrow dir="out" />
              </Btn>
              <PublishButton canPublish={canPublish} />
            </div>
          </header>
          <main className="view" id="admin-main">
            {demo ? (
              <p className="demo-bar mono" role="status">
                Read-only demo · look around freely, nothing you change is saved
              </p>
            ) : null}
            {children}
          </main>
        </div>
      </div>
      <Palette items={[...pages, ...search]} />
      <Toaster />
      <ConfirmHost />
      <ReviewHost canPublish={canPublish} />
    </QueryClientProvider>
  );
}

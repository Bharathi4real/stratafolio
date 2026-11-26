import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SettingsAppearance } from "@/components/admin/editors/SettingsAppearance";
import { SettingsGeneral } from "@/components/admin/editors/SettingsGeneral";
import { SettingsNavigation } from "@/components/admin/editors/SettingsNavigation";
import { SettingsPrivacy } from "@/components/admin/editors/SettingsPrivacy";
import { SettingsSeo } from "@/components/admin/editors/SettingsSeo";
import { SettingsUsers } from "@/components/admin/editors/SettingsUsers";
import { Tabs } from "@/components/admin/ui";
import { listUsers } from "@/lib/admin/actions";
import type { GlobalKey } from "@/lib/content/schema";
import { readGlobal, readGlobalRow } from "@/lib/content/store";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Settings" };

/** Site-wide settings: one tab strip. */
const TABS = [
  { id: "general", label: "General", key: "site-settings" },
  { id: "seo", label: "SEO", key: "seo" },
  { id: "privacy", label: "Analytics & privacy", key: "privacy" },
  { id: "appearance", label: "Appearance", key: "appearance" },
  { id: "users", label: "Users", key: null },
] as const;
/**
 * The portfolio's header & footer: same URL family (/admin/settings/navigation) so existing
 * links keep working, but it sits under Portfolio in the sidebar and has no settings tab strip.
 */
const PORTFOLIO_NAV = { id: "navigation", label: "Header & footer", key: "navigation" } as const;

export default async function SettingsPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  // Blog settings moved to their own page (admins and editors), which does its own guard.
  if (tab === "blog") redirect("/admin/blog-settings");
  const me = await requireUser("admin");
  const t = tab === PORTFOLIO_NAV.id ? PORTFOLIO_NAV : TABS.find((x) => x.id === tab);
  if (!t) notFound();
  const tabs =
    t === PORTFOLIO_NAV ? null : (
      <Tabs
        current={tab}
        tabs={TABS.map((x) => ({ id: x.id, label: x.label, href: `/admin/settings/${x.id}` }))}
      />
    );

  if (!t.key) return <SettingsUsers users={await listUsers()} me={me.id} tabs={tabs} />;

  const key = t.key as GlobalKey;
  const [row, initial] = await Promise.all([readGlobalRow(key), readGlobal(key, { draft: true })]);
  const props = {
    published: Boolean(row?.publishedAt ?? row?.data),
    hasDraft: Boolean(row?.draft),
    tabs,
  };
  switch (key) {
    case "site-settings":
      return <SettingsGeneral key={key} initial={initial as never} {...props} />;
    case "navigation":
      return <SettingsNavigation key={key} initial={initial as never} {...props} />;
    case "seo":
      return <SettingsSeo key={key} initial={initial as never} {...props} />;
    case "privacy":
      return <SettingsPrivacy key={key} initial={initial as never} {...props} />;
    case "appearance":
      return <SettingsAppearance key={key} initial={initial as never} {...props} />;
    default:
      notFound();
  }
}

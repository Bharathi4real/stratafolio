import { type ReactNode, Suspense } from "react";
import { AdminBootSkeleton } from "@/components/admin/BootSkeleton";
import { AdminShell } from "@/components/admin/Shell";
import { loadAdminNav } from "@/lib/admin/nav";
import { DEMO } from "@/lib/demo";
import { getBrand } from "@/lib/queries";
import { requireUser } from "@/lib/session";

/**
 * Everything in the admin depends on who is signed in (a request-time read), so the shell
 * renders inside <Suspense>: the static part is a skeleton, the rest streams per request.
 */
export default function AdminAppLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminBootSkeleton />}>
      <AdminFrame>{children}</AdminFrame>
    </Suspense>
  );
}

async function AdminFrame({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [nav, brand] = await Promise.all([loadAdminNav(user), getBrand()]);
  return (
    <AdminShell
      user={user}
      counts={nav.counts}
      search={nav.search}
      logo={brand.admin}
      badge={brand.adminBadge}
      demo={DEMO}
    >
      {children}
    </AdminShell>
  );
}

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { type AdminUser, auth } from "./auth";
import { atLeast, can, type Permission, type Role, toRole } from "./rbac";

export async function getUser(): Promise<AdminUser | null> {
  // Sessions are per request: opt out of prerendering before better-auth reads the clock
  // (Date.now() during a prerender is a Cache Components "blocking route" error).
  await connection();
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const u = s.user as typeof s.user & { role?: string };
  return { id: u.id, name: u.name, email: u.email, role: toRole(u.role) };
}

/** Page guard: redirects to the sign-in screen, or to the dashboard when the role is too low. */
export async function requireUser(min?: Role) {
  const user = await getUser();
  if (!user) redirect("/admin/login");
  if (min && !atLeast(user.role, min)) redirect("/admin?denied=1");
  return user;
}

/** Page guard for one permission (see lib/rbac.ts). */
export async function requirePermission(perm: Permission) {
  const user = await requireUser();
  if (!can(user.role, perm)) redirect("/admin?denied=1");
  return user;
}

/** Server Action guard: throws instead of redirecting. `min` is the lowest role allowed. */
export async function assertUser(min?: Role) {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");
  if (min && !atLeast(user.role, min))
    throw new Error(min === "admin" ? "Admins only" : "You don’t have access to that.");
  return user;
}

/** Server Action guard for one permission (see lib/rbac.ts). */
export async function assertPermission(perm: Permission) {
  const user = await assertUser();
  if (!can(user.role, perm)) throw new Error("You don’t have access to that.");
  return user;
}

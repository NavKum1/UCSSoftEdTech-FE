"use client";

import { useAppAuth } from "@/lib/appAuth";

/**
 * The role badge in the /admin top bar. Since H12, institute admins and exam creators reach /admin/exams too, so the
 * "Super admin" badge is shown only to a SuperAdmin; anyone else sees their own platform role (their
 * Keycloak realm roles), or nothing when they have none. Nothing is shown until auth has loaded, so the badge never
 * flashes the wrong role. Display only: the API decides what each user may do.
 */
const ROLE_ORDER = ["superadmin", "instituteadmin", "recruiter", "faculty", "counselor", "candidate"];

function label(role: string): string {
  return role
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());
}

export function AdminRoleBadge() {
  const { isLoaded, isSignedIn, roles } = useAppAuth();
  if (!isLoaded || !isSignedIn || roles.length === 0) return null;
  const rank = (r: string) => {
    const i = ROLE_ORDER.indexOf(r.toLowerCase());
    return i === -1 ? ROLE_ORDER.length : i;
  };
  const role = [...roles].sort((a, b) => rank(a) - rank(b))[0];
  if (role.toLowerCase() === "superadmin") {
    return (
      <span data-admin-role="SuperAdmin" className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
        Super admin
      </span>
    );
  }
  return (
    <span
      data-admin-role={role}
      className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
    >
      {label(role)}
    </span>
  );
}

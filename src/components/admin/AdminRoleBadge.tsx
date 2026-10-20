"use client";

import { useAppAuth } from "@/lib/appAuth";

/**
 * The role badge in the /admin top bar. Since H12, institute admins and exam creators reach /admin/exams too, so the
 * "SUPER ADMIN" badge is shown only to a SuperAdmin; anyone else sees their own platform role (Clerk public metadata or
 * Keycloak realm roles), or nothing when they have none. Nothing is shown until auth has loaded, so the badge never
 * flashes the wrong role. Display only: the API decides what each user may do.
 */
const ROLE_ORDER = ["superadmin", "instituteadmin", "recruiter", "faculty", "counselor", "candidate"];

function label(role: string): string {
  return role
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toUpperCase();
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
      <span
        data-admin-role="SuperAdmin"
        className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/30 flex items-center space-x-1"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping inline-block mr-1" aria-hidden></span>
        SUPER ADMIN
      </span>
    );
  }
  return (
    <span
      data-admin-role={role}
      className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-800 dark:text-indigo-300 border border-indigo-500/30"
    >
      {label(role)}
    </span>
  );
}

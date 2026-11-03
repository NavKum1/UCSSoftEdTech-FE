/**
 * Where each person works (4 Nov 2026): staff open their own area after sign-in, not the member dashboard, which is for
 * students and candidates. Platform roles decide first; career-centre staff, faculty and employers come from their
 * memberships (/api/career/me). Members have neither and stay on /dashboard.
 */
"use client";

import { useEffect, useState } from "react";

/** The path of the area a person works in */
export type RoleHome = string;

const has = (roles: string[], role: string) => roles.some((r) => r.toLowerCase() === role.toLowerCase());

const HOMES = {
  admin: "/admin",
  institute: "/institute/dashboard",
  recruiter: "/recruiter/dashboard",
  advisor: "/advisor/guidance",
  mentor: "/mentor/guidance",
  careerCentre: "/career-center",
  faculty: "/faculty",
  employer: "/employer",
};

/** The area a platform role works in; null when memberships decide (or for a member) */
export function platformHome(roles: string[]): RoleHome | null {
  if (has(roles, "SuperAdmin")) return HOMES.admin;
  if (has(roles, "InstituteAdmin")) return HOMES.institute;
  if (has(roles, "Recruiter")) return HOMES.recruiter;
  if (has(roles, "EdulexaAdvisor")) return HOMES.advisor;
  if (has(roles, "MentorReviewer")) return HOMES.mentor;
  return null;
}

interface CareerMe {
  memberships?: { role: string; status: string }[];
  employers?: unknown[];
}

const CAREER_STAFF = ["CareerAdmin", "Counselor", "EmployerRelations"];

/** The area from career-centre memberships, else an institute counsellor's CRM; null for a member */
export function membershipHome(roles: string[], me: CareerMe | null): RoleHome | null {
  const active = (me?.memberships ?? []).filter((m) => m.status === "Active");
  if (active.some((m) => CAREER_STAFF.includes(m.role))) return HOMES.careerCentre;
  if (active.some((m) => m.role === "Faculty") || has(roles, "Faculty")) return HOMES.faculty;
  if ((me?.employers ?? []).length > 0) return HOMES.employer;
  if (has(roles, "Counselor")) return HOMES.institute;
  return null;
}

/**
 * This person's own area, once known (resolved). Memberships are only looked up when no platform role decides, so a
 * member's dashboard costs one small request.
 */
export function useRoleHome(
  roles: string[],
  apiFetch: (path: string, init?: RequestInit, options?: { quiet?: boolean }) => Promise<Response>,
  ready: boolean,
): { home: RoleHome | null; resolved: boolean } {
  const fromRoles = platformHome(roles);
  const [fromMemberships, setFromMemberships] = useState<{ home: RoleHome | null } | null>(null);
  const rolesKey = roles.join(",");

  useEffect(() => {
    if (!ready || fromRoles) return;
    let cancelled = false;
    apiFetch("/api/career/me", {}, { quiet: true })
      .then(async (res) => (res.ok ? ((await res.json()) as CareerMe) : null))
      .catch(() => null)
      .then((me) => {
        if (!cancelled) setFromMemberships({ home: membershipHome(rolesKey ? rolesKey.split(",") : [], me) });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, fromRoles, apiFetch, rolesKey]);

  if (fromRoles) return { home: fromRoles, resolved: true };
  return { home: fromMemberships?.home ?? null, resolved: fromMemberships !== null };
}

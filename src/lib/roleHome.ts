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
  student: "/student",
  alumni: "/alumni",
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

export interface CareerMe {
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
  // P1 (5 Nov 2026): a school's student (or alumnus) has one home, the school's area, whose menu also holds practice and
  // guidance; the member dashboard is for people without a school
  if (active.some((m) => m.role === "Student")) return HOMES.student;
  if (active.some((m) => m.role === "Alumni")) return HOMES.alumni;
  return null;
}

/** P1: the school area of a person who studies at (or graduated from) a school on Edulexa, the same one membershipHome picks; null otherwise */
export function schoolHome(me: CareerMe | null): typeof HOMES.student | typeof HOMES.alumni | null {
  const active = (me?.memberships ?? []).filter((m) => m.status === "Active");
  if (active.some((m) => m.role === "Student")) return HOMES.student;
  if (active.some((m) => m.role === "Alumni")) return HOMES.alumni;
  return null;
}

/**
 * S4b: every area this person's memberships open, for "Switch to" in the account menu: someone who is career-center staff
 * and also teaches gets both, a student who also works for an employer gets both. Labels are English (en() where shown).
 */
export function schoolAreas(me: CareerMe | null): { href: string; label: string }[] {
  const active = (me?.memberships ?? []).filter((m) => m.status === "Active");
  const areas: { href: string; label: string }[] = [];
  if (active.some((m) => CAREER_STAFF.includes(m.role))) areas.push({ href: HOMES.careerCentre, label: "Career center" });
  if (active.some((m) => m.role === "Faculty")) areas.push({ href: HOMES.faculty, label: "Faculty" });
  if ((me?.employers ?? []).length > 0) areas.push({ href: HOMES.employer, label: "Employer" });
  const school = schoolHome(me);
  if (school) areas.push({ href: school, label: "My school" });
  return areas;
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

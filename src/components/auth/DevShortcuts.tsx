"use client";

/**
 * One-click portal shortcuts for local development. Each starts a developer session as that persona (lib/devSession:
 * one of the API's development tokens, accepted only by an API running in Development), then opens the portal, so the
 * portals work without Keycloak. They render only when DEMO_LOGIN_ENABLED is true; NODE_ENV and NEXT_PUBLIC_* are inlined
 * at build time, so a production build drops them.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, BookOpen, Briefcase, Building2, GraduationCap, Loader2, ShieldCheck, TerminalSquare, UserCheck } from "lucide-react";

import { DEMO_LOGIN_ENABLED, DEV_PERSONAS, startDevSession } from "@/lib/devSession";
import { useEn } from "@/lib/english/EnglishProvider";

export { DEMO_LOGIN_ENABLED };

// The name on each button is the persona's own (lib/devSession DEV_PERSONAS), so a button and the session it starts agree
type Shortcut = { role: keyof typeof DEV_PERSONAS & string; hint: string; href: string; icon: typeof Briefcase };

// 7 Nov 2026: every role that signs in. The school roles belong to the demo school the API seeds in Development
// (Riverside College, with a demo class taught by the faculty member and an approved employer).
const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Edulexa and partners",
    items: [
      { role: "Candidate", hint: "Practice, results and credentials, without a school", href: "/dashboard", icon: UserCheck },
      { role: "Recruiter", hint: "Assessments and integrity reviews", href: "/recruiter/dashboard", icon: Briefcase },
      { role: "InstituteAdmin", hint: "Admissions leads, forms and settings", href: "/institute/dashboard", icon: GraduationCap },
      { role: "Counselor", hint: "Work the admissions leads assigned to you", href: "/institute/dashboard", icon: GraduationCap },
      { role: "EdulexaAdvisor", hint: "Career guidance requests to Edulexa", href: "/advisor/guidance", icon: UserCheck },
      { role: "MentorReviewer", hint: "Guidance requests assigned to mentors", href: "/mentor/guidance", icon: UserCheck },
      { role: "SuperAdmin", hint: "Schools, plans and platform operations", href: "/admin", icon: ShieldCheck },
    ],
  },
  {
    title: "Demo school (Riverside College)",
    items: [
      { role: "CareerAdmin", hint: "The school's settings, staff, students and employers", href: "/career-center", icon: Building2 },
      { role: "CareerCounselor", hint: "Appointments, caseload and document review", href: "/career-center", icon: Building2 },
      { role: "EmployerRelations", hint: "Employers, jobs and career fairs", href: "/career-center", icon: Building2 },
      { role: "Faculty", hint: "Teaches the demo class: class assessments and evidence", href: "/faculty", icon: BookOpen },
      { role: "Student", hint: "In the demo class: assessments, jobs and guidance", href: "/student", icon: GraduationCap },
      { role: "Alumni", hint: "A graduate of the demo school", href: "/alumni", icon: GraduationCap },
      { role: "Employer", hint: "Northbridge Labs, approved at the demo school", href: "/employer", icon: Briefcase },
    ],
  },
];

export default function DevShortcuts() {
  const en = useEn();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const open = (role: string, href: string) => {
    setBusy(role);
    startDevSession(role);
    router.push(href);
  };

  return (
    <section aria-labelledby="dev-shortcuts-title" className="mt-8 rounded-xl border border-dashed border-[var(--auth-input-border)]/60 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="dev-shortcuts-title" className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <TerminalSquare aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          {en("Developer shortcuts")}
        </h2>
        <span className="rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          {en("Local only")}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{en("Open a portal signed in as a test user (needs the API running in Development). Not part of production builds.")}</p>
      {GROUPS.map((group) => (
        <div key={group.title} className="mt-3">
          <h3 className="text-[11px] font-medium text-muted-foreground">{en(group.title)}</h3>
          <ul className="mt-1.5 flex flex-wrap gap-2">
            {group.items.map(({ role, hint, href, icon: Icon }) => (
              <li key={role}>
                <button
                  type="button"
                  onClick={() => open(role, href)}
                  disabled={busy !== null}
                  title={en(hint)}
                  className="group inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--auth-card-border)] bg-[var(--auth-card-bg)] px-2.5 py-2 text-start text-xs font-medium text-foreground transition-colors hover:border-[var(--auth-input-border)] hover:bg-[var(--auth-hover-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-ring)] disabled:cursor-wait disabled:opacity-70"
                >
                  {busy === role ? (
                    <Loader2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
                  ) : (
                    <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
                  )}
                  <span>
                    {en(DEV_PERSONAS[role]?.label ?? role)}
                    <span className="sr-only">{" "}{en("portal ({hint})", { hint: en(hint) })}</span>
                  </span>
                  <ArrowUpRight aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p role="status" className="sr-only">
        {busy ? en("Opening the portal") : ""}
      </p>
    </section>
  );
}

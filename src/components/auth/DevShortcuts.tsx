"use client";

/**
 * One-click portal shortcuts for local development. They don't sign anyone in: in development the middleware lets
 * every route through (src/middleware.ts, isDev), so they simply open each portal. They render only when
 * DEMO_LOGIN_ENABLED is true; NODE_ENV and NEXT_PUBLIC_* are inlined at build time, so a production build drops them.
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Briefcase, GraduationCap, Loader2, TerminalSquare, UserCheck } from "lucide-react";

export const DEMO_LOGIN_ENABLED =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

const SHORTCUTS = [
  { role: "Recruiter", label: "Recruiter", hint: "Assessments and integrity reviews", href: "/recruiter/dashboard", icon: Briefcase },
  { role: "Candidate", label: "Candidate", hint: "Sprints, voice defense and katas", href: "/dashboard", icon: UserCheck },
  { role: "InstituteAdmin", label: "Institute admin", hint: "Cohorts and institute reports", href: "/institute/dashboard", icon: GraduationCap },
];

export default function DevShortcuts() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const open = (role: string, href: string) => {
    setBusy(role);
    router.push(href);
  };

  return (
    <section aria-labelledby="dev-shortcuts-title" className="mt-8 rounded-xl border border-dashed border-[var(--auth-input-border)]/60 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="dev-shortcuts-title" className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <TerminalSquare aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
          Developer shortcuts
        </h2>
        <span className="rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
          Local only
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Open a portal without signing in. Not part of production builds.</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {SHORTCUTS.map(({ role, label, hint, href, icon: Icon }) => (
          <li key={role}>
            <button
              type="button"
              onClick={() => open(role, href)}
              disabled={busy !== null}
              title={hint}
              className="group inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--auth-card-border)] bg-[var(--auth-card-bg)] px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:border-[var(--auth-input-border)] hover:bg-[var(--auth-hover-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-ring)] disabled:cursor-wait disabled:opacity-70"
            >
              {busy === role ? (
                <Loader2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
              ) : (
                <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground" />
              )}
              <span>
                {label}
                <span className="sr-only"> portal ({hint})</span>
              </span>
              <ArrowUpRight aria-hidden="true" className="h-3 w-3 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </button>
          </li>
        ))}
      </ul>
      <p role="status" className="sr-only">
        {busy ? "Opening the portal" : ""}
      </p>
    </section>
  );
}

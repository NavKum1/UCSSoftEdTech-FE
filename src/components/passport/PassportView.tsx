/**
 * The skill passport as anyone sees it: name, target role, skill areas with their best graded result, and credentials
 * with their verification links. Used by the member's own page (/passport) and the shared page (/passport/public/[token]).
 */

import React from "react";
import Link from "next/link";
import { Award, BadgeCheck, Bug, Code2, GraduationCap, Layers, Mic, Siren } from "lucide-react";

export interface PassportSkill {
  skillCategory: string;
  kind: string;
  bestScore: number | null;
  results: number;
  verified: boolean;
  lastActivityAt: string;
}
export interface PassportCredential {
  title: string;
  score: number;
  issuedAt: string;
  verificationUrl: string;
  underReview: boolean;
}
export interface PassportData {
  fullName: string;
  targetRole: string;
  badges: PassportSkill[];
  credentials: PassportCredential[];
  updatedAt: string;
}

const KIND: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  challenge: { label: "Coding challenges", icon: Code2 },
  exam: { label: "Exams", icon: GraduationCap },
  interview: { label: "Voice interviews", icon: Mic },
  incident: { label: "Incident drills", icon: Siren },
  codeReview: { label: "Code reviews", icon: Bug },
};

const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";

export default function PassportView({ data, publicView }: { data: PassportData; publicView: boolean }) {
  const initials = (data.fullName || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase())
    .join("");
  const verifiedCount = data.badges.filter((b) => b.verified).length;
  return (
    <div className="space-y-6">
      <section className={`${card} flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8`}>
        <span
          aria-hidden="true"
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-600 to-violet-600 text-xl font-semibold text-white shadow-[0_8px_24px_-8px_rgb(79_70_229/0.6)]"
        >
          {initials || "?"}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">{data.fullName || "Name not set"}</h1>
          {data.targetRole && <p className="mt-0.5 text-sm text-muted-foreground">Aiming for {data.targetRole}</p>}
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <BadgeCheck aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              {data.credentials.length} {data.credentials.length === 1 ? "credential" : "credentials"}
            </span>
            <span>
              {verifiedCount} verified {verifiedCount === 1 ? "skill area" : "skill areas"} of {data.badges.length}
            </span>
            <span>Updated {date(data.updatedAt)}</span>
          </p>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="pp-skills" className={`${card} p-5 sm:p-6 lg:col-span-2`}>
          <h2 id="pp-skills" className="text-base font-semibold">
            Skills
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Best graded result in each area. <span className="font-medium text-foreground">Verified</span> means a credential backs it.
          </p>
          {data.badges.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {publicView ? "No graded results yet." : "Your skills appear here as soon as your first challenge, exam or interview is graded."}
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {data.badges.map((s) => {
                const k = KIND[s.kind] ?? { label: s.kind, icon: Layers };
                return (
                  <li key={`${s.kind}:${s.skillCategory}`} className="flex items-center gap-4 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <k.icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                        {s.skillCategory}
                        {s.verified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                            <BadgeCheck aria-hidden="true" className="h-3 w-3" />
                            Verified
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {k.label} · {s.results} {s.results === 1 ? "result" : "results"} · last {date(s.lastActivityAt)}
                      </p>
                    </div>
                    {s.bestScore === null ? (
                      <span className="text-xs text-muted-foreground">Not scored yet</span>
                    ) : (
                      <span className="text-lg font-semibold tabular-nums text-foreground">{Math.round(s.bestScore)}%</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="pp-creds" className={`${card} p-5 sm:p-6`}>
          <h2 id="pp-creds" className="flex items-center gap-2 text-base font-semibold">
            <Award aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Credentials
          </h2>
          {data.credentials.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {publicView ? "No credentials yet." : "Pass a credential exam or a hiring assessment to earn one."}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.credentials.map((c) => (
                <li key={c.verificationUrl}>
                  <Link href={c.verificationUrl} className="block rounded-xl border border-border p-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                    <span className="block text-sm font-medium text-foreground">{c.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {Math.round(c.score)}% · issued {date(c.issuedAt)}
                      {c.underReview ? " · under review" : ""}
                    </span>
                    <span className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">Verify</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

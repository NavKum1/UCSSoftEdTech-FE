"use client";

/**
 * The member's home. Everything on it comes from GET /api/me/overview, which reads the member's own records: no figure
 * is estimated or filled in. A new member sees an empty, useful page (what to do first), never an error.
 */

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  Bug,
  CalendarDays,
  Code2,
  Compass,
  Flame,
  GraduationCap,
  Layers,
  Mic,
  Share2,
  ShieldCheck,
  Siren,
  Sparkles,
  Timer,
} from "lucide-react";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";

interface Skill {
  skillCategory: string;
  kind: string;
  bestScore: number | null;
  results: number;
  verified: boolean;
  lastActivityAt: string;
}
interface RecentItem {
  kind: string;
  title: string;
  score: number | null;
  passed: boolean | null;
  verified: boolean;
  at: string;
  href: string;
}
interface CredentialItem {
  title: string;
  score: number;
  issuedAt: string;
  verificationUrl: string;
  underReview: boolean;
}
interface NextStep {
  key: string;
  title: string;
  description: string;
  href: string;
}
interface Overview {
  profile: { name: string; email: string; countryCode: string | null; targetRole: string; organization: { id: string; name: string } | null };
  plan: { tier: string; status: string; voiceMinutesRemaining: number; voiceMinutesPlan: number; voiceMinutesUsed: number; voiceMinutesBonus: number; resetsAt: string | null };
  activity: { currentStreakDays: number; longestStreakDays: number; lastActiveAt: string | null; activeDaysLast30: number; days: { date: string; count: number }[] };
  totals: { challenges: number; exams: number; interviews: number; incidents: number; codeReviews: number; credentials: number };
  skills: Skill[];
  recent: RecentItem[];
  credentials: CredentialItem[];
  counselling: { primaryTrack: string; secondaryTrack: string; takenAt: string } | null;
  nextSteps: NextStep[];
  passport: { sharingEnabled: boolean; shareToken: string | null };
}

const KIND: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  challenge: { label: "Coding challenge", icon: Code2 },
  exam: { label: "Exam", icon: GraduationCap },
  interview: { label: "Voice interview", icon: Mic },
  incident: { label: "Incident drill", icon: Siren },
  codeReview: { label: "Code review", icon: Bug },
};

const STEP_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "claim-credential": Award,
  counselling: Compass,
  challenge: Code2,
  exam: GraduationCap,
  interview: Mic,
  incident: Siren,
  "code-review": Bug,
};

function timeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function relative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const day = 86_400_000;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < day) return `${Math.floor(diff / 3_600_000)} h ago`;
  if (diff < 2 * day) return "yesterday";
  if (diff < 30 * day) return `${Math.floor(diff / day)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

const scoreTone = (score: number) =>
  score >= 80 ? "text-emerald-700 dark:text-emerald-400" : score >= 60 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400";

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";

export default function DashboardPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [data, setData] = useState<Overview | null>(null);
  const [failed, setFailed] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      setFailed(null);
      try {
        const tz = timeZone();
        const res = await apiFetch(`/api/me/overview${tz ? `?tz=${encodeURIComponent(tz)}` : ""}`);
        if (cancelled) return;
        if (res.ok) setData((await res.json()) as Overview);
        else setFailed(res.status);
      } catch {
        if (!cancelled) setFailed(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, apiFetch, attempt]);

  if (access) return <AccessNotice problem={access} feature="Your dashboard" />;

  if (failed !== null && !data) {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-xl font-semibold">We couldn&apos;t load your dashboard</h1>
        <p className="text-sm text-muted-foreground">
          {failed === 0 ? "The connection to Edulexa failed." : "Something went wrong on our side."} Your work is saved; please try again.
        </p>
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Try again
        </button>
      </main>
    );
  }

  if (!data) return <DashboardSkeleton />;

  const firstName = (data.profile.name || "").split(/\s+/)[0];
  const totalResults = data.totals.challenges + data.totals.exams + data.totals.interviews + data.totals.incidents + data.totals.codeReviews;
  const isNew = totalResults === 0;

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-muted-foreground">
            {data.profile.organization ? data.profile.organization.name : "Individual member"}
            {data.profile.targetRole ? ` · Aiming for ${data.profile.targetRole}` : ""}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isNew
              ? "Welcome to Edulexa. Start with one of the steps below; everything you do builds your verified skill record."
              : data.activity.lastActiveAt
                ? `Last active ${relative(data.activity.lastActiveAt)}.`
                : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/passport"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {data.passport.sharingEnabled ? <Share2 aria-hidden="true" className="h-4 w-4" /> : <ShieldCheck aria-hidden="true" className="h-4 w-4" />}
            Skill passport
          </Link>
        </div>
      </header>

      {/* Key figures */}
      <section aria-label="Your progress" className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={Flame}
          label="Current streak"
          value={`${data.activity.currentStreakDays} ${data.activity.currentStreakDays === 1 ? "day" : "days"}`}
          hint={data.activity.longestStreakDays > 0 ? `Longest: ${data.activity.longestStreakDays} days` : "Practise today to start one"}
        />
        <Stat icon={CalendarDays} label="Active days" value={`${data.activity.activeDaysLast30}`} hint="In the last 30 days" />
        <Stat
          icon={BadgeCheck}
          label="Verified credentials"
          value={`${data.totals.credentials}`}
          hint={`${totalResults} graded ${totalResults === 1 ? "result" : "results"} in total`}
        />
        <Stat
          icon={Timer}
          label="Interview minutes"
          value={`${data.plan.voiceMinutesRemaining} left`}
          hint={
            data.plan.resetsAt
              ? `${data.plan.voiceMinutesPlan} a month on ${data.plan.tier}${data.plan.voiceMinutesBonus ? ` + ${data.plan.voiceMinutesBonus} extra` : ""} · renews ${new Date(data.plan.resetsAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
              : `${data.plan.voiceMinutesPlan} a month on ${data.plan.tier}`
          }
          href="/pricing"
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Next steps */}
          {data.nextSteps.length > 0 && (
            <section aria-labelledby="next-steps" className={`${card} p-5 sm:p-6`}>
              <h2 id="next-steps" className="flex items-center gap-2 text-base font-semibold">
                <Sparkles aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                {isNew ? "Get started" : "Up next"}
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                {data.nextSteps.map((s) => {
                  const Icon = STEP_ICON[s.key] ?? ArrowRight;
                  return (
                    <li key={s.key}>
                      <Link
                        href={s.href}
                        className="group flex h-full flex-col gap-2 rounded-xl border border-border bg-background p-4 transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/30"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600/10 text-indigo-700 dark:text-indigo-300">
                          <Icon aria-hidden="true" className="h-4.5 w-4.5" />
                        </span>
                        <span className="text-sm font-semibold text-foreground">{s.title}</span>
                        <span className="text-xs leading-relaxed text-muted-foreground">{s.description}</span>
                        <span className="mt-auto inline-flex items-center gap-1 pt-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          Start
                          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Activity calendar */}
          <section aria-labelledby="activity" className={`${card} p-5 sm:p-6`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="activity" className="text-base font-semibold">
                Activity
              </h2>
              <p className="text-xs text-muted-foreground">Last 12 weeks</p>
            </div>
            <ActivityCalendar days={data.activity.days} />
          </section>

          {/* Skills */}
          <section aria-labelledby="skills" className={`${card} p-5 sm:p-6`}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="skills" className="text-base font-semibold">
                Skills
              </h2>
              <p className="text-xs text-muted-foreground">Best graded result per area</p>
            </div>
            {data.skills.length === 0 ? (
              <EmptyState text="Your skills appear here as soon as your first challenge, exam or interview is graded." />
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {data.skills.map((s) => (
                  <li key={`${s.kind}:${s.skillCategory}`} className="flex items-center gap-4 py-3">
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
                        {KIND[s.kind]?.label ?? s.kind} · {s.results} {s.results === 1 ? "result" : "results"} · {relative(s.lastActivityAt)}
                      </p>
                    </div>
                    {s.bestScore === null ? (
                      <span className="text-xs text-muted-foreground">Not scored yet</span>
                    ) : (
                      <div className="flex w-32 items-center gap-2 sm:w-44">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <div className="h-full rounded-full bg-indigo-600 dark:bg-indigo-400" style={{ width: `${Math.max(2, Math.min(100, s.bestScore))}%` }} />
                        </div>
                        <span className={`w-12 text-right text-sm font-semibold tabular-nums ${scoreTone(s.bestScore)}`}>{Math.round(s.bestScore)}%</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recent results */}
          <section aria-labelledby="recent" className={`${card} p-5 sm:p-6`}>
            <h2 id="recent" className="text-base font-semibold">
              Recent results
            </h2>
            {data.recent.length === 0 ? (
              <EmptyState text="Nothing graded yet. Your results will be listed here with a link to the full report." />
            ) : (
              <ul className="mt-3 divide-y divide-border">
                {data.recent.map((r, i) => {
                  const k = KIND[r.kind] ?? { label: r.kind, icon: Layers };
                  const Icon = k.icon;
                  return (
                    <li key={`${r.href}:${r.at}:${i}`}>
                      <Link href={r.href} className="flex items-center gap-3 rounded-lg py-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-indigo-600">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon aria-hidden="true" className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{r.title}</span>
                          <span className="block text-xs text-muted-foreground">
                            {k.label} · {relative(r.at)}
                          </span>
                        </span>
                        {r.score === null ? (
                          <span className="text-xs text-muted-foreground">Pending</span>
                        ) : (
                          <span className={`text-sm font-semibold tabular-nums ${scoreTone(r.score)}`}>{Math.round(r.score)}%</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          {/* Credentials */}
          <section aria-labelledby="credentials" className={`${card} p-5 sm:p-6`}>
            <h2 id="credentials" className="flex items-center gap-2 text-base font-semibold">
              <Award aria-hidden="true" className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Credentials
            </h2>
            {data.credentials.length === 0 ? (
              <EmptyState text="Pass a credential exam or a hiring assessment to earn a credential anyone can verify." />
            ) : (
              <ul className="mt-3 space-y-2">
                {data.credentials.map((c) => (
                  <li key={c.verificationUrl}>
                    <Link
                      href={c.verificationUrl}
                      className="block rounded-xl border border-border p-3 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      <span className="block truncate text-sm font-medium text-foreground">{c.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {Math.round(c.score)}% · issued {new Date(c.issuedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        {c.underReview ? " · under review" : ""}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Career track */}
          <section aria-labelledby="track" className={`${card} p-5 sm:p-6`}>
            <h2 id="track" className="flex items-center gap-2 text-base font-semibold">
              <Compass aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Career track
            </h2>
            {data.counselling ? (
              <div className="mt-3 space-y-1">
                <p className="text-sm font-semibold text-foreground">{data.counselling.primaryTrack}</p>
                {data.counselling.secondaryTrack && <p className="text-xs text-muted-foreground">Also a good fit: {data.counselling.secondaryTrack}</p>}
                <Link href="/prep/counselling" className="inline-flex items-center gap-1 pt-2 text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                  See your results <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">A short quiz matches your interests and strengths to a career track and the skills it needs.</p>
                <Link
                  href="/prep/counselling"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Take the quiz <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              </div>
            )}
          </section>

          {/* Practice */}
          <section aria-labelledby="practice" className={`${card} p-5 sm:p-6`}>
            <h2 id="practice" className="text-base font-semibold">
              Practice
            </h2>
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {[
                { href: "/sprint/distributed-database", label: "Challenges", icon: Code2, n: data.totals.challenges },
                { href: "/prep/exam", label: "Exams", icon: GraduationCap, n: data.totals.exams },
                { href: "/interview/practice", label: "Interviews", icon: Mic, n: data.totals.interviews },
                { href: "/daily/incident", label: "Incidents", icon: Siren, n: data.totals.incidents },
                { href: "/daily/review", label: "Code review", icon: Bug, n: data.totals.codeReviews },
                { href: "/prep/counselling", label: "Counselling", icon: Compass, n: data.counselling ? 1 : 0 },
              ].map((p) => (
                <li key={p.href + p.label}>
                  <Link
                    href={p.href}
                    className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm font-medium text-foreground hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-indigo-600"
                  >
                    <p.icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{p.label}</span>
                    <span className="text-xs tabular-nums text-muted-foreground" aria-label={`${p.n} done`}>
                      {p.n}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </span>
      <span className="mt-2 block text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</span>
      <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>
    </>
  );
  return href ? (
    <Link href={href} className={`${card} block p-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:p-5`}>
      {body}
    </Link>
  ) : (
    <div className={`${card} p-4 sm:p-5`}>{body}</div>
  );
}

function ActivityCalendar({ days }: { days: { date: string; count: number }[] }) {
  // Columns are weeks (Monday first), rows are weekdays
  const weeks = useMemo(() => {
    if (days.length === 0) return [] as ({ date: string; count: number } | null)[][];
    const first = new Date(days[0].date + "T00:00:00");
    const pad = (first.getDay() + 6) % 7;
    const cells: ({ date: string; count: number } | null)[] = [...Array(pad).fill(null), ...days];
    const out: ({ date: string; count: number } | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [days]);
  const level = (n: number) =>
    n === 0 ? "bg-muted" : n === 1 ? "bg-indigo-200 dark:bg-indigo-900" : n <= 3 ? "bg-indigo-400 dark:bg-indigo-700" : "bg-indigo-600 dark:bg-indigo-400";
  const active = days.filter((d) => d.count > 0).length;
  return (
    <div className="mt-4">
      <div className="flex gap-1 overflow-x-auto pb-1" role="img" aria-label={`Activity calendar: active on ${active} of the last ${days.length} days`}>
        {weeks.map((w, i) => (
          <div key={i} className="flex flex-col gap-1">
            {w.map((d, j) =>
              d ? (
                <span
                  key={d.date}
                  title={`${new Date(d.date + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}: ${d.count} ${d.count === 1 ? "activity" : "activities"}`}
                  className={`h-3.5 w-3.5 rounded-[3px] ${level(d.count)}`}
                />
              ) : (
                <span key={`pad-${j}`} className="h-3.5 w-3.5" />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground" aria-hidden="true">
        Less
        {[0, 1, 2, 4].map((n) => (
          <span key={n} className={`h-3 w-3 rounded-[3px] ${level(n)}`} />
        ))}
        More
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="mt-3 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading your dashboard">
      <div className="h-4 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="mt-3 h-8 w-72 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${card} h-28 animate-pulse motion-reduce:animate-none`} />
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className={`${card} h-72 animate-pulse lg:col-span-2 motion-reduce:animate-none`} />
        <div className={`${card} h-72 animate-pulse motion-reduce:animate-none`} />
      </div>
    </main>
  );
}

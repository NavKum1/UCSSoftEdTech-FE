"use client";

/**
 * Career path (phase E, 24 Oct 2026). Built from the member's own data: their target role (skill passport), the area of
 * their latest counselling result with what to learn next, their verified and practised skills from graded results, and
 * practice on this platform. Salary figures appear only from a named, licensed dataset with its date; without one the
 * page says so. (This page used to predict promotions to made-up levels and show invented salary bands.)
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Compass, Target, Wallet } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Skill {
  skillCategory: string;
  kind: string;
  bestScore: number | null;
  results: number;
  verified: boolean;
}
interface Path {
  targetRole: string | null;
  area: string | null;
  guide: { summary: string; roles: string[]; learnNext: string[]; languages: string[] } | null;
  verifiedSkills: Skill[];
  practisedSkills: Skill[];
  nextSteps: { title: string; description: string; href: string }[];
  compensation: {
    role: string;
    region: string;
    currency: string;
    p25: number | null;
    median: number | null;
    p75: number | null;
    source: string;
    licence: string;
    asOf: string;
  } | null;
  compensationNote: string | null;
}

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";

export default function CareerPathPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [path, setPath] = useState<Path | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/career/path");
      if (!res.ok) return setFailed(true);
      setPath((await res.json()) as Path);
    } catch {
      setFailed(true);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  if (access) return <AccessNotice problem={access} feature="Your career path" />;
  if (failed)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">We couldn&apos;t load your career path</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh the page to try again.</p>
      </main>
    );
  if (!path)
    return (
      <main className="mx-auto max-w-5xl px-4 py-10" aria-busy="true" aria-label="Loading your career path">
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const money = (n: number | null) => (n == null ? "—" : new Intl.NumberFormat(undefined, { style: "currency", currency: path.compensation!.currency, maximumFractionDigits: 0 }).format(n));

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Your career path</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Where you are, from your graded results, and what to do next. We don&apos;t predict promotions or salaries; salary data is shown only from a
          named, licensed source.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Target aria-hidden="true" className="h-4 w-4 text-indigo-600" /> Target role
          </h2>
          {path.targetRole ? (
            <p className="mt-2 text-lg font-semibold">{path.targetRole}</p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not set yet.</p>
          )}
          <Link href="/passport" className="mt-2 inline-block text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300">
            {path.targetRole ? "Change it in your skill passport" : "Set it in your skill passport"}
          </Link>
        </section>
        <section className={`${card} p-5`}>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Compass aria-hidden="true" className="h-4 w-4 text-indigo-600" /> Area that suits you
          </h2>
          {path.area && path.guide ? (
            <>
              <p className="mt-2 font-semibold">{path.area}</p>
              <p className="mt-1 text-sm text-muted-foreground">{path.guide.summary}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Take the <Link href="/prep/counselling" className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">career quiz</Link> to find it.
            </p>
          )}
        </section>
      </div>

      <section className={`${card} p-5`}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <BadgeCheck aria-hidden="true" className="h-4 w-4 text-emerald-600" /> Your skills
        </h2>
        {path.verifiedSkills.length === 0 && path.practisedSkills.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No graded results yet. Your skills appear here as you complete challenges, exams and drills.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...path.verifiedSkills, ...path.practisedSkills].map((s) => (
              <li
                key={`${s.skillCategory}-${s.kind}`}
                className={`rounded-full border px-3 py-1 text-sm ${s.verified ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10" : "border-border"}`}
              >
                {s.skillCategory}
                {s.bestScore != null && <span className="ml-1 text-xs text-muted-foreground">best {Math.round(s.bestScore)}</span>}
                {s.verified && <span className="ml-1 text-xs text-emerald-700 dark:text-emerald-400">verified</span>}
              </li>
            ))}
          </ul>
        )}
        {path.guide && path.guide.learnNext.length > 0 && (
          <div className="mt-5">
            <h3 className="text-sm font-semibold">Good things to learn next for {path.area}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {path.guide.learnNext.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="cp-next">
        <h2 id="cp-next" className="mb-3 text-base font-semibold">
          Next steps
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {path.nextSteps.map((s) => (
            <Link key={s.href} href={s.href} className={`${card} group p-4 hover:border-indigo-400`}>
              <span className="flex items-center justify-between gap-2 text-sm font-semibold">
                {s.title}
                <ArrowRight aria-hidden="true" className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600" />
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{s.description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className={`${card} p-5`}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Wallet aria-hidden="true" className="h-4 w-4 text-indigo-600" /> Salary data
        </h2>
        {path.compensation ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              {path.compensation.role}, {path.compensation.region}
            </p>
            <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
              {[
                ["25th percentile", path.compensation.p25],
                ["Median", path.compensation.median],
                ["75th percentile", path.compensation.p75],
              ].map(([label, v]) => (
                <div key={label as string} className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-semibold tabular-nums">{money(v as number | null)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Source: {path.compensation.source}, as of {new Date(path.compensation.asOf).toLocaleDateString()}. {path.compensation.licence}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{path.compensationNote}</p>
        )}
      </section>
    </main>
  );
}

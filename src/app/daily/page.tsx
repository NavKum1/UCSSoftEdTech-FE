"use client";

/**
 * Daily practice (phase B, 24 Oct 2026): today's incident drill and code review, the member's practice streak (with
 * earned freezes), this week's points and rank, and the top of the weekly leaderboard. Everything comes from the
 * member's graded drills (/api/practice/summary, /api/practice/leaderboard); nothing is filled in when it's missing.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Flame, GitPullRequest, Snowflake, Swords, Terminal, Trophy } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Summary {
  streak: {
    current: number;
    longest: number;
    practisedToday: boolean;
    freezesAvailable: number;
    maxFreezes: number;
    daysPerFreeze: number;
    frozenDays: string[];
    days: { date: string; count: number }[];
  };
  week: { startsAt: string; endsAt: string; points: number; rank: number | null; rankedMembers: number };
  totalPoints: number;
  leaderboardVisible: boolean;
}
interface DrillStatus {
  openAttemptId: string | null;
  completed: boolean;
  score: number | null;
  points: number | null;
}
interface Board {
  entries: { rank: number; displayName: string; points: number; drills: number; isYou: boolean }[];
  you: { rank: number; points: number } | null;
  rankedMembers: number;
}

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";

export default function DailyPracticePage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [incident, setIncident] = useState<{ title: string; track: string; status: DrillStatus } | null>(null);
  const [review, setReview] = useState<{ title: string; language: string; status: DrillStatus } | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const [s, i, r, b] = await Promise.all([
        apiFetch(`/api/practice/summary?tz=${encodeURIComponent(tz)}`),
        apiFetch("/api/incidents/today?track=DevOps&difficultyTier=Bronze", {}, { quiet: true }),
        apiFetch("/api/codereview/today", {}, { quiet: true }),
        apiFetch("/api/practice/leaderboard?period=week&take=5", {}, { quiet: true }),
      ]);
      if (!s.ok) {
        setFailed(true);
        return;
      }
      setSummary((await s.json()) as Summary);
      if (i.ok) {
        const body = await i.json();
        setIncident({ title: body.incident.title, track: body.incident.track, status: body.status });
      }
      if (r.ok) {
        const body = await r.json();
        setReview({ title: body.review.title, language: body.review.language, status: body.status });
      }
      if (b.ok) setBoard((await b.json()) as Board);
    } catch {
      setFailed(true);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  if (access) return <AccessNotice problem={access} feature="Daily practice" />;
  if (failed)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">We couldn&apos;t load your daily practice</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh the page to try again.</p>
      </main>
    );
  if (!summary)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-label="Loading daily practice">
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const { streak, week } = summary;
  const frozen = new Set(streak.frozenDays);
  const weekEnds = new Date(week.endsAt);

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Daily practice</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Two short drills a day: diagnose a production incident and review a pull request. Your first try at each drill earns points; the answers are
          shown once you submit.
        </p>
      </header>

      <section aria-label="Your progress" className="grid gap-4 sm:grid-cols-3">
        <div className={`${card} p-5`}>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Flame aria-hidden="true" className="h-4 w-4 text-orange-500" /> Streak
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {streak.current} <span className="text-base font-normal text-muted-foreground">day{streak.current === 1 ? "" : "s"}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {streak.practisedToday ? "Practised today." : streak.current > 0 ? "Practise today to keep it going." : "Practise today to start one."} Best: {streak.longest}.
          </p>
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" title={`Earn a freeze for every ${streak.daysPerFreeze} days in a row; it covers one missed day.`}>
            <Snowflake aria-hidden="true" className="h-3.5 w-3.5 text-sky-500" />
            {streak.freezesAvailable} of {streak.maxFreezes} streak freezes. Earn one every {streak.daysPerFreeze} days in a row; it covers a missed day.
          </p>
        </div>
        <div className={`${card} p-5`}>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Trophy aria-hidden="true" className="h-4 w-4 text-amber-500" /> This week
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {week.points} <span className="text-base font-normal text-muted-foreground">points</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {week.rank ? `Rank ${week.rank} of ${week.rankedMembers}.` : "No points yet this week."} Resets{" "}
            {weekEnds.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}.
          </p>
        </div>
        <div className={`${card} p-5`}>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-500" /> All time
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {summary.totalPoints} <span className="text-base font-normal text-muted-foreground">points</span>
          </p>
          <ol aria-label="The last 14 days" className="mt-3 flex gap-1">
            {streak.days.map((d) => (
              <li
                key={d.date}
                title={`${d.date}: ${d.count > 0 ? `${d.count} activit${d.count === 1 ? "y" : "ies"}` : frozen.has(d.date) ? "covered by a streak freeze" : "no practice"}`}
                className={`h-6 flex-1 rounded ${d.count > 0 ? "bg-emerald-500" : frozen.has(d.date) ? "bg-sky-300 dark:bg-sky-700" : "bg-muted"}`}
              >
                <span className="sr-only">
                  {d.date}: {d.count > 0 ? "practised" : frozen.has(d.date) ? "streak freeze" : "no practice"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="dp-today" className="mt-8">
        <h2 id="dp-today" className="mb-3 text-base font-semibold">
          Today&apos;s drills
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <DrillCard
            href="/daily/incident"
            icon={<Terminal aria-hidden="true" className="h-5 w-5" />}
            label="Incident drill"
            title={incident?.title}
            meta={incident ? `${incident.track} · pick another track on the drill page` : undefined}
            status={incident?.status}
            description="Read the logs and metrics of a production outage, choose the root cause and the safe fix. About 10 minutes."
          />
          <DrillCard
            href="/daily/review"
            icon={<GitPullRequest aria-hidden="true" className="h-5 w-5" />}
            label="Code review"
            title={review?.title}
            meta={review?.language}
            status={review?.status}
            description="Find the defect in a pull request, name it and decide whether to approve. About 3 minutes."
          />
          <Link href="/duels/arena" className={`${card} group flex flex-col p-5 hover:border-indigo-400`}>
            <span className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300">
              <Swords aria-hidden="true" className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">System design duel</span>
            </span>
            <span className="mt-3 text-sm text-muted-foreground">Practise a system design problem against an AI opponent. Duels don&apos;t count towards points.</span>
            <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold">
              Open <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="dp-board" className={`${card} mt-8 p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="dp-board" className="text-base font-semibold">
            This week&apos;s leaderboard
          </h2>
          <Link href="/leaderboard" className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
            Full leaderboard
          </Link>
        </div>
        {!board || board.entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nobody has earned points this week yet. Finish a drill to be first.</p>
        ) : (
          <ol className="mt-3 divide-y divide-border text-sm">
            {board.entries.map((e) => (
              <li key={`${e.rank}-${e.displayName}`} className={`flex items-center justify-between gap-3 py-2.5 ${e.isYou ? "font-semibold" : ""}`}>
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right tabular-nums text-muted-foreground">{e.rank}</span>
                  {e.displayName}
                  {e.isYou && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                </span>
                <span className="tabular-nums">{e.points} pts</span>
              </li>
            ))}
            {board.you && !board.entries.some((e) => e.isYou) && (
              <li className="flex items-center justify-between gap-3 py-2.5 font-semibold">
                <span className="flex items-center gap-3">
                  <span className="w-6 text-right tabular-nums text-muted-foreground">{board.you.rank}</span>
                  You{summary.leaderboardVisible ? "" : " (hidden from others)"}
                </span>
                <span className="tabular-nums">{board.you.points} pts</span>
              </li>
            )}
          </ol>
        )}
      </section>
    </main>
  );
}

function DrillCard({
  href,
  icon,
  label,
  title,
  meta,
  status,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  title?: string;
  meta?: string;
  status?: DrillStatus;
  description: string;
}) {
  return (
    <Link href={href} className={`${card} group flex flex-col p-5 hover:border-indigo-400`}>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          {icon}
          <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        </span>
        {status?.completed && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> {status.points ?? 0} pts
          </span>
        )}
      </span>
      {title && <span className="mt-3 font-semibold leading-snug">{title}</span>}
      {meta && <span className="mt-1 text-xs text-muted-foreground">{meta}</span>}
      <span className="mt-2 text-sm text-muted-foreground">{description}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold">
        {status?.completed ? "Practise again (no points)" : status?.openAttemptId ? "Continue" : "Start"}
        <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
      </span>
    </Link>
  );
}

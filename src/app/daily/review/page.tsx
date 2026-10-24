"use client";

/**
 * Daily code review (phase B, 24 Oct 2026). The pull request arrives without its answers; opening it starts an attempt
 * timed on the server. The member flags the line with the defect, names the kind of defect and decides; the server grades
 * it and only then shows where the defect was and why. The first graded review of a pull request earns points; later
 * ones are practice.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, XCircle } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Review {
  id: string;
  title: string;
  repository: string;
  author: string;
  language: string;
  diffContent: string;
  categories: string[];
}
interface Status {
  openAttemptId: string | null;
  startedAt: string | null;
  completed: boolean;
  score: number | null;
  points: number | null;
}
interface Result {
  score: number;
  lineCorrect: boolean;
  decisionCorrect: boolean;
  categoryCorrect: boolean;
  timeSeconds: number;
  countsForPoints: boolean;
  points: number;
  speedBonus: number;
  feedback: string;
  defectLine: number;
  defectCategory: string;
  correctDecision: string;
  explanation: string;
  suggestedRemediation: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  Security_CVE: "Security vulnerability",
  Concurrency: "Concurrency bug",
  Memory_Leak: "Memory or resource leak",
  ReDoS: "Regular expression denial of service",
  Data_Integrity: "Data integrity",
  Performance: "Performance",
};
const DECISIONS = [
  { value: "APPROVE", label: "Approve" },
  { value: "REQUEST_CHANGES", label: "Request changes" },
  { value: "COMMENT", label: "Comment only" },
];
const decisionLabel = (v: string) => DECISIONS.find((d) => d.value === v)?.label ?? v;

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export default function DailyCodeReviewPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [review, setReview] = useState<Review | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [attempt, setAttempt] = useState<{ id: string; startedAt: string } | null>(null);
  const [line, setLine] = useState<number | null>(null);
  const [category, setCategory] = useState("");
  const [decision, setDecision] = useState("");
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/codereview/today");
      if (!res.ok) {
        setLoadFailed(true);
        return;
      }
      const body = await res.json();
      setReview(body.review as Review);
      setStatus(body.status as Status);
      if (body.status?.openAttemptId) setAttempt({ id: body.status.openAttemptId, startedAt: body.status.startedAt });
    } catch {
      setLoadFailed(true);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  useEffect(() => {
    if (!attempt || result) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt, result]);

  const lines = useMemo(() => (review?.diffContent ?? "").split("\n"), [review]);

  const start = async () => {
    if (!review) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/codereview/${review.id}/start`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setAttempt({ id: body.attemptId, startedAt: body.startedAt });
        setResult(null);
        setLine(null);
        setCategory("");
        setDecision("");
        setComment("");
      } else setError(body?.error ?? "The review couldn't be opened. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!attempt || line == null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/codereview/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id, flaggedLineNumber: line, decision, category, comment: comment.trim() || null }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setResult(body as Result);
        setAttempt(null);
        setStatus((s) => (s && body.countsForPoints ? { ...s, completed: true, score: body.score, points: body.points } : s));
      } else setError(body?.error ?? "Your review couldn't be submitted. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="The daily code review" />;
  if (loadFailed)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">No code review is available right now</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please try again later.</p>
      </main>
    );
  if (!review || !status)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-label="Loading the code review">
        <div className={`${card} h-64 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const elapsed = attempt ? Math.max(0, Math.floor((now - new Date(attempt.startedAt).getTime()) / 1000)) : 0;
  const lineClass = (text: string, n: number) => {
    if (result && n === result.defectLine) return "bg-red-100 dark:bg-red-500/20";
    if (n === line) return "bg-indigo-100 dark:bg-indigo-500/20";
    if (text.startsWith("+") && !text.startsWith("+++")) return "bg-emerald-50 dark:bg-emerald-500/10";
    if (text.startsWith("-") && !text.startsWith("---")) return "bg-rose-50 dark:bg-rose-500/10";
    return "";
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <Link href="/daily" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Daily practice
      </Link>
      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Today&apos;s code review · {review.language}</p>
          <h1 className="mt-1 text-xl font-semibold">{review.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {review.repository} · opened by {review.author} (a practice scenario)
          </p>
        </div>
        {attempt && (
          <p className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm tabular-nums" aria-live="off">
            <Clock aria-hidden="true" className="h-4 w-4" /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
          </p>
        )}
      </header>

      {status.completed && !result && (
        <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          You completed this review and earned {status.points ?? 0} points. You can practise it again; repeats don&apos;t earn points.
        </p>
      )}

      {!attempt && !result ? (
        <section className={`${card} mt-6 p-6`}>
          <h2 className="text-base font-semibold">How it works</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Find the line with the defect (within one line counts): 50 points.</li>
            <li>Make the right call on the pull request: 30 points. Name the kind of defect: 20 points.</li>
            <li>Line and call right within 3 minutes: 20 bonus points. The time is measured from when you open it.</li>
          </ul>
          <button type="button" className={`${primary} mt-5`} disabled={busy} onClick={() => void start()}>
            {status.completed ? "Practise again" : "Open the pull request"}
          </button>
        </section>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <section aria-label="Diff" className={`${card} overflow-hidden lg:col-span-2`}>
            <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
              {result ? "The defect is highlighted in red." : "Select the line with the defect."}
            </p>
            <div className="overflow-x-auto">
              <ol className="min-w-max font-mono text-xs leading-6">
                {lines.map((text, i) => {
                  const n = i + 1;
                  return (
                    <li key={n} className={lineClass(text, n)}>
                      <button
                        type="button"
                        disabled={!!result}
                        aria-pressed={line === n}
                        onClick={() => setLine(n)}
                        className="flex w-full gap-3 px-3 text-left hover:bg-muted/60 disabled:cursor-default"
                      >
                        <span className="w-8 shrink-0 select-none text-right text-muted-foreground">{n}</span>
                        <span className="whitespace-pre">{text || " "}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <aside className="space-y-4">
            {!result ? (
              <form
                className={`${card} space-y-4 p-5`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <p className="text-sm">{line ? `Line ${line} flagged.` : "No line flagged yet."}</p>
                <label className="block text-sm">
                  <span className="font-medium">Kind of defect</span>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  >
                    <option value="" disabled>
                      Choose…
                    </option>
                    {review.categories.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORY_LABELS[c] ?? c}
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend className="text-sm font-medium">Your decision</legend>
                  <div className="mt-1 space-y-1.5">
                    {DECISIONS.map((d) => (
                      <label key={d.value} className="flex items-center gap-2 text-sm">
                        <input type="radio" name="decision" required value={d.value} checked={decision === d.value} onChange={() => setDecision(d.value)} className="accent-indigo-600" />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-sm">
                  <span className="font-medium">Comment (optional)</span>
                  <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={2000} className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm" />
                </label>
                {error && (
                  <p role="alert" className="text-sm text-red-700 dark:text-red-400">
                    {error}
                  </p>
                )}
                <button type="submit" className={`${primary} w-full`} disabled={busy || line == null || !category || !decision}>
                  {busy ? "Submitting…" : "Submit review"}
                </button>
              </form>
            ) : (
              <ReviewResultPanel result={result} onAgain={() => void start()} busy={busy} />
            )}
          </aside>
        </div>
      )}
    </main>
  );
}

function Mark({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 aria-label="Right" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle aria-label="Not right" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />}
      <span>{children}</span>
    </li>
  );
}

function ReviewResultPanel({ result, onAgain, busy }: { result: Result; onAgain: () => void; busy: boolean }) {
  return (
    <section className={`${card} space-y-4 p-5`} aria-live="polite">
      <div>
        <p className="text-3xl font-semibold tabular-nums">{result.score} / 100</p>
        <p className="text-sm text-muted-foreground">
          {result.countsForPoints ? `${result.points} points${result.speedBonus ? `, including a ${result.speedBonus}-point speed bonus` : ""}.` : "Practice: no points for a repeat."} Time:{" "}
          {Math.floor(result.timeSeconds / 60)}m {result.timeSeconds % 60}s.
        </p>
      </div>
      <p className="text-sm">{result.feedback}</p>
      <ul className="space-y-1.5">
        <Mark ok={result.lineCorrect}>Defect on line {result.defectLine}</Mark>
        <Mark ok={result.decisionCorrect}>Right call: {decisionLabel(result.correctDecision)}</Mark>
        <Mark ok={result.categoryCorrect}>Kind: {CATEGORY_LABELS[result.defectCategory] ?? result.defectCategory}</Mark>
      </ul>
      <div>
        <h3 className="text-sm font-semibold">Why</h3>
        <p className="mt-1 text-sm text-muted-foreground">{result.explanation}</p>
      </div>
      {result.suggestedRemediation && (
        <div>
          <h3 className="text-sm font-semibold">The fix</h3>
          <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-3 text-xs">{result.suggestedRemediation}</pre>
        </div>
      )}
      <button type="button" className="text-sm font-semibold text-indigo-700 hover:underline disabled:opacity-50 dark:text-indigo-300" disabled={busy} onClick={onAgain}>
        Practise again (no points)
      </button>
    </section>
  );
}

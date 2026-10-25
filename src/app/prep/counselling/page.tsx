"use client";

/**
 * Career counselling quiz (phase B, 24 Oct 2026). The member answers about 15 questions the server draws for them from
 * a reviewed pool (or their institute's own bank); the result shows how clearly their answers point to an area, quotes
 * the answers that led there, explains the area and links to practice on this platform. Courses appear only when a real
 * institute offers them, and an inquiry is sent only with the member's consent. Results are saved; the quiz can be
 * taken again after 30 days. The question and course builders are in the institute portal (/institute/counselling).
 * ?instituteId= or ?partner= opens a partner institute's quiz; ?result= opens a saved result.
 */

import AdvisorRequest from "@/components/counselling/AdvisorRequest";
import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ChevronRight, Clock, Compass, GraduationCap, History, Lightbulb, Send } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

// ------------------------------------------------------------------ API types

interface Scope {
  instituteId: string;
  instituteName: string;
}
interface LatestSummary {
  evaluationId: string;
  evaluatedAt: string;
  primaryTrack: string;
  secondaryTrack: string;
  matchConfidence: string;
  legacy: boolean;
}
interface Status {
  scope: Scope | null;
  questionsPerAttempt: number;
  poolSize: number;
  retakeAfterDays: number;
  canStart: boolean;
  retakeAvailableAt: string | null;
  latest: LatestSummary | null;
  openAttempt: { attemptId: string; expiresAt: string } | null;
}
interface AttemptQuestion {
  id: number;
  title: string;
  subtitle: string;
  options: { index: number; text: string; description: string }[];
}
interface Attempt {
  attemptId: string;
  createdAt: string;
  expiresAt: string;
  scope: Scope | null;
  questions: AttemptQuestion[];
}
interface TrackGuide {
  summary: string;
  roles: string[];
  learnNext: string[];
  languages: string[];
}
interface Course {
  courseId: string;
  instituteId: string;
  instituteName: string;
  courseName: string;
  description: string;
  targetTrack: string;
  credentialType: string;
  duration: string;
  intake: string;
  accreditation: string;
  features: string[];
  isBestFit: boolean;
}
interface Result {
  evaluationId: string;
  evaluatedAt: string;
  legacy?: boolean;
  scope?: Scope | null;
  questionCount?: number;
  primaryTrack: string;
  secondaryTrack: string;
  matchConfidence?: string;
  ranking?: { track: string; percent: number; picked: number; offered: number }[];
  reasons?: { track: string; question: string; answer: string }[];
  guide?: TrackGuide | null;
  secondaryGuide?: TrackGuide | null;
  nextSteps?: { title: string; description: string; href: string }[];
  courses?: Course[];
  retakeAvailableAt?: string | null;
}
interface ResultSummary extends LatestSummary {
  instituteId: string | null;
}

// ------------------------------------------------------------------ helpers

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "";

function clarityText(r: Result): string {
  switch (r.matchConfidence) {
    case "clear":
      return "Your answers point clearly to this area.";
    case "moderate":
      return `Your answers lean towards this area, with ${r.secondaryTrack} close behind.`;
    case "close":
      return `Your answers are split between ${r.primaryTrack} and ${r.secondaryTrack}. Both are worth exploring.`;
    case "none":
      return "Your answers didn't point to any one area.";
    default:
      return "";
  }
}

const draftKey = (attemptId: string) => `edulexa.counselling.${attemptId}`;
function loadDraft(attemptId: string): Record<number, number> {
  try {
    const raw = sessionStorage.getItem(draftKey(attemptId));
    return raw ? (JSON.parse(raw) as Record<number, number>) : {};
  } catch {
    return {};
  }
}
function saveDraft(attemptId: string, answers: Record<number, number>) {
  try {
    sessionStorage.setItem(draftKey(attemptId), JSON.stringify(answers));
  } catch {
    // private mode or storage blocked: answers stay in memory only
  }
}
function clearDraft(attemptId: string) {
  try {
    sessionStorage.removeItem(draftKey(attemptId));
  } catch {
    // nothing stored
  }
}

// ------------------------------------------------------------------ page

export default function CounsellingPage() {
  return (
    <Suspense fallback={<Loading label="Loading the counselling quiz" />}>
      <CounsellingInner />
    </Suspense>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10" aria-busy="true" aria-label={label}>
      <div className={`${card} h-48 animate-pulse motion-reduce:animate-none`} />
    </main>
  );
}

function CounsellingInner() {
  const params = useSearchParams();
  const scopeQuery = useMemo(() => {
    const q = new URLSearchParams();
    const instituteId = params.get("instituteId");
    const partner = params.get("partner");
    if (instituteId) q.set("instituteId", instituteId);
    else if (partner) q.set("partner", partner);
    return q.toString();
  }, [params]);
  const startBody = useMemo(() => {
    const instituteId = params.get("instituteId");
    const partner = params.get("partner");
    return instituteId ? { instituteId } : partner ? { partnerSlug: partner } : {};
  }, [params]);
  const resultParam = params.get("result");

  const { apiFetch, ready, access } = useLegacyApi();
  const [status, setStatus] = useState<Status | null>(null);
  const [history, setHistory] = useState<ResultSummary[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [st, hist] = await Promise.all([
        apiFetch(`/api/quiz/counselling/status${scopeQuery ? `?${scopeQuery}` : ""}`),
        apiFetch("/api/quiz/counselling/results?take=20", {}, { quiet: true }),
      ]);
      if (st.status === 404) {
        setProblem("This institute's quiz wasn't found. Check the link you were given.");
        return;
      }
      if (!st.ok) {
        setProblem("We couldn't load the quiz. Please refresh the page to try again.");
        return;
      }
      setStatus((await st.json()) as Status);
      if (hist.ok) setHistory(((await hist.json()) as { results: ResultSummary[] }).results);
      if (resultParam) {
        const r = await apiFetch(`/api/quiz/counselling/results/${encodeURIComponent(resultParam)}`, {}, { quiet: true });
        if (r.ok) setResult((await r.json()) as Result);
      }
    } catch {
      setProblem("We couldn't reach the server. Please check your connection and refresh.");
    } finally {
      setLoaded(true);
    }
  }, [apiFetch, scopeQuery, resultParam]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const start = async () => {
    setBusy(true);
    setProblem(null);
    try {
      const res = await apiFetch("/api/quiz/counselling/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(startBody),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.attempt) {
        setResult(null);
        setAttempt(body.attempt as Attempt);
      } else if (res.status === 409) {
        setProblem(`You took this quiz recently. You can take it again on ${formatDate(body?.retakeAvailableAt)}.`);
      } else if (res.status === 429) {
        setProblem("You've started the quiz many times in a short period. Please try again later.");
      } else {
        setProblem(body?.error ?? "The quiz couldn't be started. Please try again.");
      }
    } catch {
      setProblem("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const openResult = async (id: string) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/quiz/counselling/results/${id}`);
      if (res.ok) {
        setResult((await res.json()) as Result);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } finally {
      setBusy(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="The counselling quiz" />;
  if (!loaded) return <Loading label="Loading the counselling quiz" />;

  if (attempt)
    return (
      <QuizRunner
        attempt={attempt}
        apiFetch={apiFetch}
        onDone={(r) => {
          setAttempt(null);
          setResult(r);
          setStatus((s) => (s ? { ...s, canStart: false, retakeAvailableAt: r.retakeAvailableAt ?? null, openAttempt: null } : s));
          setHistory((h) => [
            { evaluationId: r.evaluationId, evaluatedAt: r.evaluatedAt, primaryTrack: r.primaryTrack, secondaryTrack: r.secondaryTrack, matchConfidence: r.matchConfidence ?? "", legacy: false, instituteId: r.scope?.instituteId ?? null },
            ...h,
          ]);
          window.scrollTo({ top: 0 });
        }}
        onExit={() => setAttempt(null)}
      />
    );

  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-6">
        <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
          <Compass aria-hidden="true" className="h-4 w-4" />
          Career counselling
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{status?.scope ? `${status.scope.instituteName}: career quiz` : "Find the area of tech that suits you"}</h1>
      </header>

      {loaded && !problem && <AdvisorRequest apiFetch={apiFetch} scope={status?.scope ?? null} hasQuizResult={history.length > 0 || !!result} track={result?.primaryTrack ?? history[0]?.primaryTrack ?? null} />}

      {problem && (
        <p role="alert" className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {problem}
        </p>
      )}

      {result ? (
        <ResultView result={result} apiFetch={apiFetch} onClose={() => setResult(null)} status={status} />
      ) : (
        status && <Intro status={status} busy={busy} onStart={start} onOpenLatest={(id) => void openResult(id)} />
      )}

      {history.length > 0 && (
        <section aria-labelledby="cq-history" className={`${card} mt-8 p-5 sm:p-6`}>
          <h2 id="cq-history" className="flex items-center gap-2 text-base font-semibold">
            <History aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            Your results
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {history.map((h) => (
              <li key={h.evaluationId}>
                <button
                  type="button"
                  onClick={() => void openResult(h.evaluationId)}
                  className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  <span>
                    <span className="block text-sm font-medium">{h.primaryTrack || "No clear area"}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDate(h.evaluatedAt)}
                      {h.secondaryTrack && h.secondaryTrack !== h.primaryTrack ? ` · then ${h.secondaryTrack}` : ""}
                      {h.legacy ? " · earlier version of the quiz" : ""}
                    </span>
                  </span>
                  <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

// ------------------------------------------------------------------ intro

function Intro({ status, busy, onStart, onOpenLatest }: { status: Status; busy: boolean; onStart: () => void; onOpenLatest: (id: string) => void }) {
  const minutes = Math.max(3, Math.round(status.questionsPerAttempt / 3));
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className={`${card} p-6 lg:col-span-2`}>
        <p className="text-sm text-muted-foreground">
          {status.questionsPerAttempt} short questions about what you enjoy and how you like to work. There are no right or wrong answers, and no
          experience is needed. Your result shows which area of tech your answers point to, the answers that led there, and how to start practising it.
        </p>
        <ul className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <li className="rounded-xl border border-border p-3">
            <Clock aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="mt-1 block font-medium">About {minutes} minutes</span>
          </li>
          <li className="rounded-xl border border-border p-3">
            <Check aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="mt-1 block font-medium">Your result is saved</span>
          </li>
          <li className="rounded-xl border border-border p-3">
            <History aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <span className="mt-1 block font-medium">{status.retakeAfterDays > 0 ? `Retake after ${status.retakeAfterDays} days` : "Retake any time"}</span>
          </li>
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {status.openAttempt ? (
            <button type="button" className={primaryButton} disabled={busy} onClick={onStart}>
              Continue where you left off <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : status.canStart ? (
            <button type="button" className={primaryButton} disabled={busy || status.questionsPerAttempt === 0} onClick={onStart}>
              {status.latest ? "Take the quiz again" : "Start the quiz"} <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">You can take the quiz again on {formatDate(status.retakeAvailableAt)}.</p>
          )}
          {status.questionsPerAttempt === 0 && <p className="text-sm text-muted-foreground">This quiz has no questions yet.</p>}
        </div>
      </section>
      <aside className={`${card} p-6`}>
        <h2 className="text-base font-semibold">Your latest result</h2>
        {status.latest ? (
          <>
            <p className="mt-3 text-lg font-semibold">{status.latest.primaryTrack || "No clear area"}</p>
            <p className="text-xs text-muted-foreground">{formatDate(status.latest.evaluatedAt)}</p>
            <button type="button" onClick={() => onOpenLatest(status.latest!.evaluationId)} className={`${secondaryButton} mt-4 w-full`}>
              See the result
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">You haven&apos;t taken this quiz yet.</p>
        )}
      </aside>
    </div>
  );
}

// ------------------------------------------------------------------ quiz

function QuizRunner({
  attempt,
  apiFetch,
  onDone,
  onExit,
}: {
  attempt: Attempt;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onDone: (r: Result) => void;
  onExit: () => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>(() => loadDraft(attempt.attemptId));
  const [step, setStep] = useState(() => {
    const draft = loadDraft(attempt.attemptId);
    const firstOpen = attempt.questions.findIndex((q) => draft[q.id] === undefined);
    return firstOpen < 0 ? attempt.questions.length - 1 : firstOpen;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = attempt.questions.length;
  const question = attempt.questions[step];
  const answered = Object.keys(answers).length;
  const last = step === total - 1;

  const choose = (optionIndex: number) => {
    const next = { ...answers, [question.id]: optionIndex };
    setAnswers(next);
    saveDraft(attempt.attemptId, next);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/quiz/counselling/attempts/${attempt.attemptId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: attempt.questions.map((q) => ({ questionId: q.id, selectedOptionIndex: answers[q.id] })) }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        clearDraft(attempt.attemptId);
        onDone(body as Result);
        return;
      }
      if (res.status === 409 && body?.evaluationId) {
        const saved = await apiFetch(`/api/quiz/counselling/results/${body.evaluationId}`);
        if (saved.ok) {
          clearDraft(attempt.attemptId);
          onDone((await saved.json()) as Result);
          return;
        }
      }
      setError(body?.error ?? "Your answers couldn't be submitted. Please try again.");
    } catch {
      setError("We couldn't reach the server. Your answers are kept on this page; please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-4 flex items-center justify-between gap-3 text-sm">
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Leave (your answers are kept)
        </button>
        <span className="text-muted-foreground" aria-live="polite">
          Question {step + 1} of {total}
        </span>
      </div>
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Answered" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered}>
        <div className="h-full bg-indigo-600 transition-[width] motion-reduce:transition-none" style={{ width: `${(answered / total) * 100}%` }} />
      </div>

      <section className={`${card} p-6`}>
        <fieldset>
          <legend className="text-lg font-semibold leading-snug">{question.title}</legend>
          {question.subtitle && <p className="mt-1 text-sm text-muted-foreground">{question.subtitle}</p>}
          <div className="mt-5 space-y-2.5">
            {question.options.map((o) => {
              const selected = answers[question.id] === o.index;
              return (
                <label
                  key={o.index}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition-colors motion-reduce:transition-none ${
                    selected ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-500/10" : "border-border hover:bg-muted/60"
                  }`}
                >
                  <input
                    type="radio"
                    name={`q-${question.id}`}
                    className="mt-0.5 h-4 w-4 accent-indigo-600"
                    checked={selected}
                    onChange={() => choose(o.index)}
                  />
                  <span>
                    <span className="block font-medium">{o.text}</span>
                    {o.description && <span className="mt-0.5 block text-xs text-muted-foreground">{o.description}</span>}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="mt-6 flex items-center justify-between gap-3">
          <button type="button" className={secondaryButton} disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back
          </button>
          {last ? (
            <button type="button" className={primaryButton} disabled={answered < total || submitting} onClick={() => void submit()}>
              {submitting ? "Working out your result…" : "See my result"}
            </button>
          ) : (
            <button type="button" className={primaryButton} disabled={answers[question.id] === undefined} onClick={() => setStep((s) => s + 1)}>
              Next <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
        {last && answered < total && (
          <p className="mt-3 text-right text-xs text-muted-foreground">
            {total - answered} question{total - answered === 1 ? "" : "s"} still to answer. Use Back to find {total - answered === 1 ? "it" : "them"}.
          </p>
        )}
      </section>
    </main>
  );
}

// ------------------------------------------------------------------ result

function ResultView({
  result,
  apiFetch,
  onClose,
  status,
}: {
  result: Result;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  status: Status | null;
}) {
  if (result.legacy)
    return (
      <section className={`${card} p-6`}>
        <p className="text-xs text-muted-foreground">{formatDate(result.evaluatedAt)} · earlier version of the quiz</p>
        <h2 className="mt-1 text-xl font-semibold">{result.primaryTrack}</h2>
        {result.secondaryTrack && result.secondaryTrack !== result.primaryTrack && <p className="mt-1 text-sm text-muted-foreground">Then {result.secondaryTrack}</p>}
        <p className="mt-4 text-sm text-muted-foreground">
          This result came from an earlier version of the quiz, so only the areas are kept. Take the current quiz for a full explanation.
        </p>
        <button type="button" onClick={onClose} className={`${secondaryButton} mt-5`}>
          Back
        </button>
      </section>
    );

  const top = result.ranking ?? [];
  const primaryReasons = (result.reasons ?? []).filter((r) => r.track === result.primaryTrack);
  const secondaryReasons = (result.reasons ?? []).filter((r) => r.track !== result.primaryTrack);
  const none = result.matchConfidence === "none";

  return (
    <div className="space-y-6">
      <section className={`${card} p-6`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">
              {formatDate(result.evaluatedAt)}
              {result.questionCount ? ` · ${result.questionCount} questions` : ""}
              {result.scope ? ` · ${result.scope.instituteName}` : ""}
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">{none ? "No clear area yet" : result.primaryTrack}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{clarityText(result)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>

        {top.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-semibold">How your answers split</h3>
            <p className="text-xs text-muted-foreground">For each area: how often you picked it when it was one of the options.</p>
            <ul className="mt-3 space-y-2.5">
              {top.map((t) => (
                <li key={t.track}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={t.track === result.primaryTrack ? "font-semibold" : ""}>{t.track}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {t.percent}% <span className="text-xs">({t.picked} of {t.offered})</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${t.track === result.primaryTrack ? "bg-indigo-600" : "bg-indigo-300 dark:bg-indigo-700"}`} style={{ width: `${t.percent}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.retakeAvailableAt && <p className="mt-5 text-xs text-muted-foreground">You can take the quiz again on {formatDate(result.retakeAvailableAt)}.</p>}
      </section>

      {!none && (
        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="cq-why" className={`${card} p-6`}>
            <h3 id="cq-why" className="flex items-center gap-2 text-base font-semibold">
              <Lightbulb aria-hidden="true" className="h-4 w-4 text-amber-500" />
              Why this result
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Answers you gave that point to {result.primaryTrack}:</p>
            <ul className="mt-3 space-y-3">
              {primaryReasons.map((r, i) => (
                <li key={i} className="text-sm">
                  <span className="block text-muted-foreground">{r.question}</span>
                  <span className="block font-medium">“{r.answer}”</span>
                </li>
              ))}
            </ul>
            {secondaryReasons.length > 0 && (
              <>
                <p className="mt-5 text-xs text-muted-foreground">And towards {result.secondaryTrack}:</p>
                <ul className="mt-2 space-y-2">
                  {secondaryReasons.map((r, i) => (
                    <li key={i} className="text-sm">
                      <span className="text-muted-foreground">{r.question}</span> <span className="font-medium">“{r.answer}”</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {result.guide && (
            <section aria-labelledby="cq-guide" className={`${card} p-6`}>
              <h3 id="cq-guide" className="text-base font-semibold">
                About {result.primaryTrack}
              </h3>
              <p className="mt-2 text-sm">{result.guide.summary}</p>
              {result.guide.roles.length > 0 && <GuideList title="Roles people start in" items={result.guide.roles} />}
              {result.guide.learnNext.length > 0 && <GuideList title="Good things to learn first" items={result.guide.learnNext} />}
              {result.guide.languages.length > 0 && <p className="mt-4 text-xs text-muted-foreground">Common languages: {result.guide.languages.join(", ")}</p>}
              {result.secondaryGuide && result.secondaryTrack !== result.primaryTrack && (
                <p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{result.secondaryTrack}: </span>
                  {result.secondaryGuide.summary}
                </p>
              )}
            </section>
          )}
        </div>
      )}

      {(result.nextSteps?.length ?? 0) > 0 && (
        <section aria-labelledby="cq-next">
          <h3 id="cq-next" className="mb-3 text-base font-semibold">
            Start practising here
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.nextSteps!.map((s) => (
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
      )}

      {!none && (
        <CoursesSection
          courses={result.courses ?? []}
          primaryTrack={result.primaryTrack}
          scope={result.scope ?? status?.scope ?? null}
          apiFetch={apiFetch}
        />
      )}
    </div>
  );
}

function GuideList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ courses and inquiries

function CoursesSection({
  courses,
  primaryTrack,
  scope,
  apiFetch,
}: {
  courses: Course[];
  primaryTrack: string;
  scope: Scope | null;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [inquiring, setInquiring] = useState<Course | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});

  if (courses.length === 0)
    return scope ? (
      <section className={`${card} p-6`}>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <GraduationCap aria-hidden="true" className="h-4 w-4" /> Courses
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{scope.instituteName} hasn&apos;t listed courses here yet. Ask your counsellor about courses in this area.</p>
      </section>
    ) : null;

  return (
    <section aria-labelledby="cq-courses" className="space-y-3">
      <div>
        <h3 id="cq-courses" className="flex items-center gap-2 text-base font-semibold">
          <GraduationCap aria-hidden="true" className="h-4 w-4" /> Courses that fit
        </h3>
        <p className="text-xs text-muted-foreground">
          Offered by the institutes named. Course details are as each institute describes them. Nothing is shared with an institute unless you send an inquiry.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {courses.map((c) => (
          <article key={c.courseId} className={`${card} flex flex-col p-5`}>
            <p className="text-xs font-medium text-muted-foreground">{c.instituteName}</p>
            <h4 className="mt-1 font-semibold">{c.courseName}</h4>
            {c.isBestFit && c.targetTrack === primaryTrack && (
              <span className="mt-1 inline-flex w-fit rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
                Matches your result
              </span>
            )}
            {c.description && <p className="mt-2 text-sm text-muted-foreground">{c.description}</p>}
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {c.credentialType && <Fact label="Qualification" value={c.credentialType} />}
              {c.duration && <Fact label="Length" value={c.duration} />}
              {c.intake && <Fact label="Intake" value={c.intake} />}
              {c.accreditation && <Fact label="Accreditation (as stated)" value={c.accreditation} />}
            </dl>
            <div className="mt-auto pt-4">
              {sent[c.courseId] ? (
                <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
                  {sent[c.courseId]}
                </p>
              ) : (
                <button type="button" className={secondaryButton} onClick={() => setInquiring(c)}>
                  <Send aria-hidden="true" className="h-4 w-4" /> Ask {c.instituteName} about it
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {inquiring && (
        <InquiryDialog
          course={inquiring}
          primaryTrack={primaryTrack}
          apiFetch={apiFetch}
          onClose={() => setInquiring(null)}
          onSent={(message) => {
            setSent((s) => ({ ...s, [inquiring.courseId]: message }));
            setInquiring(null);
          }}
        />
      )}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function InquiryDialog({
  course,
  primaryTrack,
  apiFetch,
  onClose,
  onSent,
}: {
  course: Course;
  primaryTrack: string;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const [shareQuiz, setShareQuiz] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiFetch("/api/me/overview");
        if (!res.ok || cancelled) return;
        const o = (await res.json()) as { profile?: { name?: string; email?: string } };
        if (cancelled) return;
        setName((n) => n || o.profile?.name || "");
        setEmail((e) => e || o.profile?.email || "");
      } catch {
        // the member types them in
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch("/api/quiz/counselling/refer-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instituteId: course.instituteId,
          courseId: course.courseId,
          candidateName: name.trim(),
          candidateEmail: email.trim(),
          candidatePhone: phone.trim() || null,
          notes: notes.trim() || null,
          primaryTrack,
          referralSource: "Counselling quiz",
          consent,
          shareQuizResult: shareQuiz,
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) onSent(body?.message ?? `Sent to ${course.instituteName}.`);
      else if (res.status === 429) setError("You've sent several inquiries in a short time. Please try again later.");
      else setError(body?.error ?? "The inquiry couldn't be sent. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const input = "mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-2 focus:outline-indigo-600";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cq-inquiry"
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cq-inquiry" className="text-base font-semibold">
          Ask {course.instituteName} about {course.courseName}
        </h3>
        <form onSubmit={send} className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Name</span>
            <input required value={name} maxLength={200} onChange={(e) => setName(e.target.value)} className={input} autoComplete="name" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Email</span>
            <input required type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Phone (optional)</span>
            <input type="tel" value={phone} maxLength={64} onChange={(e) => setPhone(e.target.value)} className={input} autoComplete="tel" />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Your question, or what you&apos;re unsure about (optional)</span>
            <textarea value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} className={input} />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
            <span>
              Send my name, email{phone.trim() ? ", phone" : ""}, my question and my result&apos;s area ({primaryTrack}) to {course.instituteName}, so they can
              contact me about this course.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={shareQuiz} onChange={(e) => setShareQuiz(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
            <span>
              Also share my quiz answers and result with {course.instituteName}, so an advisor can see what I&apos;m unsure about and help me choose.
              <span className="block text-xs text-muted-foreground">Optional. They see each question with the answer you picked, and your scores by area.</span>
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className={secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={primaryButton} disabled={!consent || sending}>
              {sending ? "Sending…" : "Send inquiry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

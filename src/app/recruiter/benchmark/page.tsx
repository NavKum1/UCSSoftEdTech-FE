"use client";

/**
 * Challenge results (phase C, 24 Oct 2026): how candidates did on each coding challenge, from graded results only (the
 * share of hidden tests passed, or a mentor's adjusted score), and a single submission compared with everyone else who
 * took the same challenge. Percentiles appear only once at least 20 others took it. Integrity signals and code overlap
 * are shown as reasons for a person to review, never as verdicts. ?submission= opens a submission.
 * (This page used to show scores made up from patterns in the code, a fake percentile and career-level tiers.)
 */

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Search } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface ChallengeCohort {
  sprintId: string;
  title: string | null;
  candidates: number;
  submissions: number;
  medianTestsPassedPercent: number | null;
  fullyPassed: number;
  reviewFlagged: number;
  distribution: Record<string, number>;
}
interface Analytics {
  instituteId: string;
  totalSubmissions: number;
  totalCandidates: number;
  minCohortForPercentiles: number;
  challenges: ChallengeCohort[];
}
interface Benchmark {
  submissionId: string;
  challengeTitle: string | null;
  status: string;
  passedTests: number;
  totalTests: number;
  testsPassedPercent: number | null;
  score: number | null;
  scoreSource: string;
  cohortSize: number;
  minCohort: number;
  percentile: number | null;
  cohortMedianPercent: number | null;
  reviewFlags: string[];
  submittedAt: string;
}
interface Similarity {
  compared: number;
  highestSimilarity: number;
  needsReview: boolean;
  matchedSubmissionId: string | null;
  note: string;
}

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const BUCKETS = ["0-49", "50-79", "80-99", "100"];
const BUCKET_LABEL: Record<string, string> = { "0-49": "Under 50%", "50-79": "50–79%", "80-99": "80–99%", "100": "All tests" };

export default function ChallengeResultsPage() {
  return (
    <Suspense fallback={null}>
      <ChallengeResults />
    </Suspense>
  );
}

function ChallengeResults() {
  const params = useSearchParams();
  const { apiFetch, ready, access } = useLegacyApi();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(params.get("submission") ?? "");
  const [benchmark, setBenchmark] = useState<Benchmark | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [similarity, setSimilarity] = useState<Similarity | null>(null);
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(
    async (id: string) => {
      setLookupError(null);
      setBenchmark(null);
      setSimilarity(null);
      if (!/^[0-9a-f-]{36}$/i.test(id.trim())) {
        setLookupError("Enter a submission id.");
        return;
      }
      setBusy(true);
      try {
        const res = await apiFetch(`/api/benchmark/submission/${id.trim()}`, {}, { quiet: true });
        if (res.ok) setBenchmark(((await res.json()) as { benchmark: Benchmark }).benchmark);
        else setLookupError("No submission with this id in your organisation.");
      } finally {
        setBusy(false);
      }
    },
    [apiFetch],
  );

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/benchmark/cohort/analytics");
      if (!res.ok) return setFailed(true);
      setAnalytics(((await res.json()) as { analytics: Analytics }).analytics);
      const initial = params.get("submission");
      if (initial) await lookup(initial);
    } catch {
      setFailed(true);
    }
  }, [apiFetch, lookup, params]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const checkSimilarity = async () => {
    if (!benchmark) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/benchmark/plagiarism-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: benchmark.submissionId }),
      });
      if (res.ok) setSimilarity(((await res.json()) as { report: Similarity }).report);
    } finally {
      setBusy(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="Challenge results" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Challenge results</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          How candidates did on each coding challenge, from graded results only: the share of hidden tests passed, or a mentor&apos;s adjusted score.
          Integrity signals are reasons to review a submission, not conclusions.
        </p>
      </header>

      <section aria-labelledby="cr-lookup" className={`${card} p-5`}>
        <h2 id="cr-lookup" className="text-base font-semibold">
          Look up a submission
        </h2>
        <form
          className="mt-3 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Submission id"
            aria-label="Submission id"
            className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm"
          />
          <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
            <Search aria-hidden="true" className="h-4 w-4" /> Show
          </button>
        </form>
        {lookupError && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{lookupError}</p>}
        {benchmark && (
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">{benchmark.challengeTitle ?? "Challenge"}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{benchmark.score != null ? `${benchmark.score}%` : "Not graded"}</p>
              <p className="text-xs text-muted-foreground">
                {benchmark.scoreSource === "mentor-adjusted" ? "Mentor-adjusted score" : benchmark.totalTests > 0 ? `${benchmark.passedTests} of ${benchmark.totalTests} hidden tests passed` : "No test results yet"}
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">Compared with others who took it</p>
              {benchmark.percentile != null ? (
                <>
                  <p className="mt-1 text-3xl font-semibold tabular-nums">{benchmark.percentile}th</p>
                  <p className="text-xs text-muted-foreground">
                    percentile of {benchmark.cohortSize} candidates (median {benchmark.cohortMedianPercent}%)
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">
                  Shown once at least {benchmark.minCohort} others have taken this challenge ({benchmark.cohortSize} so far
                  {benchmark.cohortMedianPercent != null ? `, median ${benchmark.cohortMedianPercent}%` : ""}).
                </p>
              )}
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground">For review</p>
              {benchmark.reviewFlags.length === 0 ? (
                <p className="mt-1 text-sm">No integrity signals were recorded.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm">
                  {benchmark.reviewFlags.map((f) => (
                    <li key={f} className="flex gap-1.5">
                      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> {f}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" onClick={() => void checkSimilarity()} disabled={busy} className="mt-3 text-sm font-semibold text-indigo-700 hover:underline disabled:opacity-50 dark:text-indigo-300">
                Compare with other submissions of this challenge
              </button>
              {similarity && (
                <p className={`mt-2 text-sm ${similarity.needsReview ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {similarity.note}
                  {similarity.matchedSubmissionId && (
                    <>
                      {" "}
                      <button type="button" className="font-mono text-xs underline" onClick={() => { setQuery(similarity.matchedSubmissionId!); void lookup(similarity.matchedSubmissionId!); }}>
                        Open the other submission
                      </button>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section aria-labelledby="cr-cohorts">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="cr-cohorts" className="text-base font-semibold">
            By challenge
          </h2>
          {analytics && (
            <p className="text-xs text-muted-foreground">
              {analytics.totalCandidates} candidate{analytics.totalCandidates === 1 ? "" : "s"}, {analytics.totalSubmissions} submission{analytics.totalSubmissions === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {failed ? (
          <p className={`${card} p-6 text-sm text-muted-foreground`}>The results couldn&apos;t be loaded. Please refresh the page.</p>
        ) : !analytics ? (
          <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" />
        ) : analytics.challenges.length === 0 ? (
          <p className={`${card} p-6 text-sm text-muted-foreground`}>No candidate has submitted a challenge yet.</p>
        ) : (
          <div className={`${card} overflow-x-auto`}>
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Challenge</th>
                  <th className="p-3 text-right font-medium">Candidates</th>
                  <th className="p-3 text-right font-medium">Median tests passed</th>
                  <th className="p-3 font-medium">Spread (best result per candidate)</th>
                  <th className="p-3 text-right font-medium">For review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {analytics.challenges.map((c) => {
                  const total = BUCKETS.reduce((n, b) => n + (c.distribution[b] ?? 0), 0);
                  return (
                    <tr key={c.sprintId}>
                      <td className="p-3 font-medium">{c.title ?? "Untitled challenge"}</td>
                      <td className="p-3 text-right tabular-nums">{c.candidates}</td>
                      <td className="p-3 text-right tabular-nums">{c.medianTestsPassedPercent != null ? `${c.medianTestsPassedPercent}%` : "—"}</td>
                      <td className="p-3">
                        {total === 0 ? (
                          <span className="text-muted-foreground">Not graded yet</span>
                        ) : (
                          <div className="flex h-3 w-48 overflow-hidden rounded-full bg-muted" role="img" aria-label={BUCKETS.map((b) => `${BUCKET_LABEL[b]}: ${c.distribution[b] ?? 0}`).join(", ")}>
                            {BUCKETS.map((b, i) => (
                              <span
                                key={b}
                                title={`${BUCKET_LABEL[b]}: ${c.distribution[b] ?? 0}`}
                                style={{ width: `${(100 * (c.distribution[b] ?? 0)) / total}%` }}
                                className={["bg-rose-400", "bg-amber-400", "bg-sky-500", "bg-emerald-500"][i]}
                              />
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">{c.reviewFlagged}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

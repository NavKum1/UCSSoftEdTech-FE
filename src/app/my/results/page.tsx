"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { AlertCircle, ChevronRight, ClipboardList, Inbox, Loader2, Lock } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { errorMessage, fmtDate, MySubmissionRow } from "@/lib/candidateExperience";

function Badge({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "good" | "warn" | "info" }) {
  const cls =
    tone === "good"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
        : tone === "info"
          ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30"
          : "bg-muted text-muted-foreground border-border";
  return <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cls}`}>{children}</span>;
}

export default function MyResultsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [rows, setRows] = useState<MySubmissionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let active = true;
    authenticatedFetch("/api/me/submissions", {}, getToken)
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res, "Could not load your results"));
        return (await res.json()) as MySubmissionRow[];
      })
      .then((data) => active && setRows(data))
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load your results."));
    return () => {
      active = false;
    };
  }, [isLoaded, isSignedIn, getToken]);

  if (isLoaded && !isSignedIn) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-3">
        <h1 className="text-xl font-bold text-foreground">My results</h1>
        <p className="text-sm text-muted-foreground">Sign in to see your assessment results.</p>
        <Link href="/login" className="inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
              My results
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every submission, your test results, your defense, personalised feedback and where the review stands.
            </p>
          </div>
          <Link href="/settings/privacy" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" /> Privacy and your data
          </Link>
        </div>

        <div className="glass-panel rounded-2xl p-4 border border-border text-xs text-muted-foreground">
          A person reviews every submission; nothing is decided automatically. If something went wrong, you can appeal from a
          submission&apos;s report, and a different reviewer will look at it.
        </div>

        {error ? (
          <div className="glass-panel rounded-2xl p-6 border border-border text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        ) : rows === null ? (
          <div className="p-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your results...
          </div>
        ) : rows.length === 0 ? (
          <div className="glass-panel rounded-2xl p-10 border border-border text-center space-y-2">
            <Inbox className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-foreground font-semibold">No submissions yet</p>
            <p className="text-xs text-muted-foreground">When you submit a coding sprint, its results appear here.</p>
            <Link href="/dashboard" className="inline-block mt-2 text-xs text-indigo-700 dark:text-indigo-400 underline">
              Find a sprint
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.submissionId}>
                <Link
                  href={`/my/results/${r.submissionId}`}
                  className="glass-panel rounded-2xl p-4 border border-border flex items-center justify-between gap-4 hover:bg-muted/40 transition-colors"
                >
                  <div className="min-w-0 space-y-1.5">
                    <div className="font-semibold text-foreground truncate">{r.sprintTitle}</div>
                    <div className="text-xs text-muted-foreground">Submitted {fmtDate(r.submittedAt)}</div>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={r.totalTests > 0 && r.passedTests === r.totalTests ? "good" : "muted"}>
                        Tests {r.passedTests}/{r.totalTests}
                      </Badge>
                      <Badge tone={r.defenseStatus === "Completed" ? "good" : "muted"}>Defense: {r.defenseStatus}</Badge>
                      <Badge tone={r.reviewStatus === "Reviewed" ? "info" : "warn"}>{r.reviewStatus}</Badge>
                      {r.outcome && <Badge tone={r.outcome === "Advanced" ? "good" : "muted"}>{r.outcome}</Badge>}
                      {r.hasOpenAppeal && <Badge tone="warn">Appeal open</Badge>}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

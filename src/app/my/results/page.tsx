"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { ChevronRight, Lock } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { errorMessage, fmtDate, MySubmissionRow } from "@/lib/candidateExperience";
import SignInRequired from "@/components/SignInRequired";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, buttonClass, EmptyState, ErrorBanner, Loading, PageHeader } from "@/components/career/ui";

export default function MyResultsPage() {
  const en = useEn();
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
      <SignInRequired title={en("My results")} message="Sign in to see your assessment results." />
    );
  }

  return (
    <div className="space-y-6 text-foreground">
      <PageHeader
        title={en("My results")}
        description={en("Every submission, your test results, your defense, personalised feedback and where the review stands.")}
        actions={
          <Link href="/settings/privacy" className={buttonClass("ghost")}>
            <Lock className="h-4 w-4" aria-hidden />
            {en("Privacy and your data")}
          </Link>
        }
      />

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        {en("A person reviews every submission; nothing is decided automatically. If something went wrong, you can appeal from a submission's report, and a different reviewer will look at it.")}
      </div>

      {error ? (
        <ErrorBanner error={error} />
      ) : rows === null ? (
        <Loading label={en("Loading your results...")} />
      ) : rows.length === 0 ? (
        <EmptyState title={en("No submissions yet")}>
          <p>{en("When you submit a coding sprint, its results appear here.")}</p>
          <Link href="/dashboard" className={`${buttonClass("secondary")} mt-4`}>
            {en("Find a sprint")}
          </Link>
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.submissionId}>
              <Link
                href={`/my/results/${r.submissionId}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="truncate font-semibold text-foreground">{r.sprintTitle}</div>
                  <div className="text-xs text-muted-foreground">{en("Submitted {date}", { date: fmtDate(r.submittedAt) })}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={r.totalTests > 0 && r.passedTests === r.totalTests ? "good" : "neutral"}>
                      {en("Tests {passedTests}/{totalTests}", { passedTests: r.passedTests, totalTests: r.totalTests })}
                    </Badge>
                    <Badge tone={r.defenseStatus === "Completed" ? "good" : "neutral"}>{en("Defense: {defenseStatus}", { defenseStatus: r.defenseStatus })}</Badge>
                    <Badge tone={r.reviewStatus === "Reviewed" ? "info" : "warn"}>{r.reviewStatus}</Badge>
                    {r.outcome && <Badge tone={r.outcome === "Advanced" ? "good" : "neutral"}>{r.outcome}</Badge>}
                    {r.hasOpenAppeal && <Badge tone="warn">{en("Appeal open")}</Badge>}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

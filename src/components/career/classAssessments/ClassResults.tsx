"use client";

/**
 * Build & Defend 1.0, 2.10: a class's results from the teachers' final decisions (never the AI's suggestions), the CSV
 * download, and each student's grade in the school's LMS (sent, waiting, failed with the reason, not linked yet), with "send
 * again". API: .../faculty/assessments/{id}/assignments/{assignmentId}/students (results, lmsLinked, students[].lms),
 * .../results.csv and .../faculty/attempts/{id}/lms/send.
 */
import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, StatTile } from "@/components/career/ui";
import { CA_API, formatWhen, type ClassResults, type StudentRow } from "@/components/career/classAssessments/types";

export function ResultsSummary({ results }: { results: ClassResults }) {
  const en = useEn();
  const decided = results.passed + results.resubmit + results.failed;
  if (decided === 0) return null;
  return (
    <section aria-labelledby="class-results" className="mb-6 space-y-3">
      <h2 id="class-results" className="text-base font-semibold">
        {en("Results")}
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={en("Passed")} value={results.passed} tone="good" />
        <StatTile label={en("Asked to resubmit")} value={results.resubmit} />
        <StatTile label={en("Not passed")} value={results.failed} tone={results.failed > 0 ? "bad" : undefined} />
        <StatTile
          label={en("Average score")}
          value={results.average == null ? "–" : en("{score} / 100", { score: results.average })}
          hint={results.median == null ? undefined : en("Middle score {score}", { score: results.median })}
        />
      </div>
      {results.criteria.some((c) => c.average != null) && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="mb-3 text-sm text-muted-foreground">{en("Average per rubric criterion, from passes and fails")}</p>
          <ul className="grid gap-x-8 gap-y-3 text-sm md:grid-cols-2">
            {results.criteria.map((c) => (
              <li key={c.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0">{c.name}</span>
                  <span className="shrink-0 font-medium tabular-nums">{c.average ?? "–"}</span>
                </div>
                {c.average != null && (
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-[var(--brand,#0e7490)]" style={{ width: `${c.average}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(results.waiting > 0 || results.working > 0 || results.notStarted > 0) && (
        <p className="text-xs text-muted-foreground">
          {en("Not counted yet: {waiting} waiting for a decision, {working} working on it, {notStarted} not started.", {
            waiting: results.waiting,
            working: results.working,
            notStarted: results.notStarted,
          })}
        </p>
      )}
    </section>
  );
}

/** Downloads the class's results as CSV */
export function CsvButton({ assessmentId, assignmentId, fileName }: { assessmentId: string; assignmentId: string; fileName: string }) {
  const en = useEn();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<Response>(`${CA_API}/faculty/assessments/${assessmentId}/assignments/${assignmentId}/results.csv`, { raw: true });
      // A refusal or error is shown, never saved as the file
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? body?.message ?? en("The results couldn't be downloaded ({status}).", { status: res.status }));
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      // Named here: the browser can't read the server's file name across origins
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button variant="secondary" busy={busy} onClick={() => void download()}>
        {en("Download results (CSV)")}
      </Button>
      {error && <span role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </span>
  );
}

/** One student's grade in the LMS, with "send again" after a failure */
export function LmsCell({ row, onSent }: { row: StudentRow; onSent: () => void }) {
  const en = useEn();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lms = row.lms;
  if (!lms || !row.attempt) return <span className="text-muted-foreground">—</span>;
  const label =
    lms.status === "Sent" ? en("Sent") : lms.status === "Pending" ? en("Waiting to send") : lms.status === "Failed" ? en("Not sent") : en("Not linked yet");
  const tone = lms.status === "Sent" ? "good" : lms.status === "Failed" ? "bad" : lms.status === "Pending" ? "info" : "neutral";
  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`${CA_API}/faculty/attempts/${row.attempt!.id}/lms/send`, { method: "POST" });
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-1">
      <Badge tone={tone}>{label}</Badge>
      {lms.status === "Sent" && lms.syncedAt && <span className="block text-xs text-muted-foreground">{formatWhen(lms.syncedAt)}</span>}
      {lms.status === "NotLinked" && <span className="block text-xs text-muted-foreground">{en("Hasn't opened it from the course")}</span>}
      {lms.status === "Failed" && (
        <>
          {lms.error && <span className="block max-w-56 text-xs text-muted-foreground [overflow-wrap:anywhere]">{lms.error}</span>}
          <Button variant="ghost" busy={busy} onClick={() => void send()} className="h-7 px-0 text-xs">
            {en("Send again")}
          </Button>
        </>
      )}
      {error && <span role="alert" className="block text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

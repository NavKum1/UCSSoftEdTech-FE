"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.7): one student's attempt, as their teacher reviews it. The work as handed in (a GitHub
 * repository, an uploaded project, a coding task with its tests, or a written exam), the viva question by question, the AI's
 * suggested score per rubric criterion with its reason and the student's own words, and points worth talking about. Nothing
 * here decides anything: the teacher does. Only the class's teachers and school admins see it, and each look is recorded.
 * 2.8: the decision (scores, pass, resubmit or fail, a comment) and the appeal, on the right (ReviewPanel).
 * API: /api/career/class-assessments/faculty/attempts/{id}/evidence.
 */
import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, ErrorBanner, Loading, PageHeader, useLoad } from "@/components/career/ui";
import { HelpLink } from "@/components/help/HelpLink";
import { downloadBlob } from "@/components/career/privacy/StudentPrivacyRights";
import {
  CA_API,
  formatWhen,
  type AttemptEvidence,
  type EvidenceChange,
  type EvidenceFile,
  type EvidenceViva,
  type EvidenceWork,
} from "@/components/career/classAssessments/types";
import {
  useAttemptStatusNames,
  useDecisionNames,
  useSignalText,
  useSkipReasonText,
  useSuggestionStateText,
  useWorkKindNames,
} from "@/components/career/classAssessments/evidenceText";
import { ReviewPanel } from "@/components/career/classAssessments/ReviewPanel";
import { useReviewTime } from "@/components/career/classAssessments/reviewTime";

const CODE = "max-h-96 overflow-auto whitespace-pre rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2";

export default function AttemptEvidencePage() {
  const en = useEn();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const { attemptId } = useParams<{ attemptId: string }>();
  const ev = useLoad(() => api<AttemptEvidence>(`${CA_API}/faculty/attempts/${attemptId}/evidence`), [api, attemptId, schoolId]);
  const statuses = useAttemptStatusNames();
  const decisions = useDecisionNames();
  // Stage 3: the active time spent reviewing, until the decision (for the pilot results)
  useReviewTime(api, attemptId, ev.data?.attempt.status === "Submitted");

  if (ev.loading) return <Loading />;
  if (!ev.data) return <ErrorBanner error={ev.error ?? en("This attempt couldn't be loaded.")} onRetry={ev.reload} />;
  const e = ev.data;
  const t = e.attempt;

  return (
    <div>
      <PageHeader
        title={e.student.name || e.student.email}
        description={en("{assessment}, {className}", { assessment: e.assessment.title, className: e.class.name ?? "" })}
        actions={
          <span className="flex items-center gap-4">
            <HelpLink slug="review-the-evidence" />
            <Link href={`/faculty/assessments/${e.assessment.id}/classes/${e.class.assignmentId}`} className="text-sm font-medium underline-offset-2 hover:underline">
              {en("All students")}
            </Link>
          </span>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Badge tone={t.status === "Submitted" ? "info" : t.status === "Decided" ? "good" : "neutral"}>
          {t.status === "Decided" && t.decision ? decisions[t.decision] : statuses[t.status]}
        </Badge>
        {t.late && <Badge tone="warn">{en("Late")}</Badge>}
        <span className="text-muted-foreground">{t.submittedAt ? en("Handed in {when}", { when: formatWhen(t.submittedAt) }) : en("Started {when}", { when: formatWhen(t.startedAt) })}</span>
        <span className="text-muted-foreground">{en("Due {when}", { when: formatWhen(e.class.dueAt) })}</span>
        <span className="break-all text-muted-foreground">{e.student.email}</span>
        {e.attempts.length > 1 && (
          <nav aria-label={en("Attempts")} className="flex flex-wrap gap-1">
            {e.attempts.map((a) =>
              a.id === e.id ? (
                <span key={a.id} aria-current="page" className="rounded-md bg-muted px-2 py-0.5 font-medium">
                  {en("Attempt {n}", { n: a.number })}
                </span>
              ) : (
                <Link key={a.id} href={`/faculty/attempts/${a.id}`} className="rounded-md px-2 py-0.5 underline-offset-2 hover:underline">
                  {en("Attempt {n}", { n: a.number })}
                </Link>
              ),
            )}
          </nav>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <WorkCard work={e.work} attemptId={e.id} />
          {e.change && <ChangeCard change={e.change} />}
          <VivaCard viva={e.viva} />
        </div>
        <div className="min-w-0 space-y-6">
          <ReviewPanel
            e={e}
            onChange={(review) => {
              const d = review.decision;
              ev.setData({
                ...e,
                review,
                evidenceChangedSinceDecision: false,
                attempt: { ...t, status: review.status, decision: d?.value ?? null, score: d?.score ?? null, comment: d?.comment ?? null, decidedBy: d?.by ?? null, decidedAt: d?.at ?? null },
                attempts: e.attempts.map((a) => (a.id === e.id ? { ...a, status: review.status } : a)),
              });
            }}
          />
          <SuggestionsCard e={e} />
          <SignalsCard e={e} />
        </div>
      </div>
    </div>
  );
}

function WorkCard({ work, attemptId }: { work: EvidenceWork | null; attemptId: string }) {
  const en = useEn();
  const kinds = useWorkKindNames();
  if (!work) return <Card title={en("The work")}><p className="text-sm text-muted-foreground">{en("Nothing handed in yet.")}</p></Card>;
  const title = kinds[work.kind];
  if (work.gone) {
    return (
      <Card title={title}>
        <p className="text-sm text-muted-foreground">{en("The work is no longer available. It may have been deleted at the student's request.")}</p>
      </Card>
    );
  }
  switch (work.kind) {
    case "repo":
      return (
        <Card title={title}>
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <a href={work.url} target="_blank" rel="noopener noreferrer" className="font-medium underline-offset-2 hover:underline" dir="ltr">
              {work.repository}
              {work.pullRequest !== null && ` #${work.pullRequest}`}
            </a>
            {work.ownershipVerified && <Badge tone="good">{en("Ownership checked")}</Badge>}
          </div>
          <Files files={work.files} />
        </Card>
      );
    case "upload":
      return (
        <Card title={title}>
          <p className="mb-4 text-sm text-muted-foreground">
            <span className="font-medium text-foreground" dir="ltr">{work.fileName}</span>
            {" · "}
            {en("{size} KB, {count} files", { size: Math.max(1, Math.round(work.sizeBytes / 1024)), count: work.listing.length })}
          </p>
          <Files files={work.files} />
          {work.listing.length > work.files.length && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">{en("Everything in the .zip ({count} files)", { count: work.listing.length })}</summary>
              <ul className="mt-2 max-h-64 overflow-auto font-mono text-xs" dir="ltr">
                {work.listing.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </details>
          )}
        </Card>
      );
    case "sprint":
      return (
        <Card title={work.title ? `${title}: ${work.title}` : title}>
          <TestsAndChanges tests={work.tests} changes={work.changes} />
          {work.aiUse && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-medium">
                {en("The AI assistant: {count} questions, {share}% of the final code", { count: work.aiUse.prompts, share: Math.round(work.aiUse.shareOfFinalCodeFromAssistant * 100) })}
              </summary>
              <ol className="mt-2 space-y-3">
                {work.aiUse.conversation.map((m, i) => (
                  <li key={i} className="rounded-lg bg-muted/50 p-3">
                    <p className="font-medium">{m.prompt}</p>
                    <p className="mt-1 whitespace-pre-line text-muted-foreground">{m.response}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </Card>
      );
    case "document":
      return <DocumentWork work={work} attemptId={attemptId} title={title} />;
    case "exam":
      return (
        <Card title={`${title}: ${work.title}`}>
          <p className="mb-4 text-sm">{en("{correct} of {total} correct", { correct: work.correct, total: work.total })}</p>
          <ol className="space-y-4">
            {work.answers.map((a) => (
              <li key={a.number} className="text-sm">
                <p className="font-medium">{en("Question {n}", { n: a.number })}: {a.question}</p>
                {a.code && <pre className={`${CODE} mt-2`} dir="ltr" tabIndex={0} aria-label={en("Code for question {n}", { n: a.number })}>{a.code}</pre>}
                <p className="mt-1 flex flex-wrap items-center gap-2">
                  <span>{a.answer ?? en("Not answered")}</span>
                  <Badge tone={a.correct ? "good" : "bad"}>{a.correct ? en("Correct") : en("Incorrect")}</Badge>
                </p>
                {!a.correct && a.correctAnswer && <p className="mt-1 text-xs text-muted-foreground">{en("The right answer: {answer}", { answer: a.correctAnswer })}</p>}
              </li>
            ))}
          </ol>
        </Card>
      );
  }
}

/** C1: the document as the viva read it (page and slide markers as small headings), and the original file to download */
function DocumentWork({ work, attemptId, title }: { work: Extract<EvidenceWork, { kind: "document" }>; attemptId: string; title: string }) {
  const en = useEn();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const format = work.format === "pdf" ? "PDF" : work.format === "docx" ? en("Word document") : work.format === "pptx" ? en("PowerPoint") : en("Pasted text");
  const download = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<Response>(`${CA_API}/faculty/attempts/${attemptId}/document`, { raw: true });
      await downloadBlob(res, work.fileName);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card title={title}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {work.format !== "text" && <span className="font-medium text-foreground" dir="auto">{work.fileName}</span>}
          {work.format !== "text" && " · "}
          {format}
          {work.pages > 0 && <> · {work.format === "pptx" ? en("{count} slides", { count: work.pages }) : en("{count} pages", { count: work.pages })}</>}
          {" · "}
          {en("{count} words", { count: work.words.toLocaleString() })}
        </p>
        {work.hasFile && (
          <Button variant="secondary" busy={busy} onClick={() => void download()}>
            {en("Download the original")}
          </Button>
        )}
      </div>
      {error && <ErrorBanner error={error} />}
      <p className="mb-2 text-xs text-muted-foreground">{en("The text read from the file. The viva and the suggested scores used this text, so check anything that looks wrong against the original.")}</p>
      <div className="max-h-[32rem] overflow-auto rounded-lg border border-border p-4 text-sm leading-relaxed" tabIndex={0} aria-label={en("The text of the work")}>
        {work.text.split("\n").map((line, i) => {
          const m = /^\[(Page|Slide) (\d+)\]$/.exec(line.trim());
          if (m)
            return (
              <p key={i} className="mb-1 mt-4 border-t border-border pt-3 text-xs font-semibold text-muted-foreground first:mt-0 first:border-t-0 first:pt-0">
                {m[1] === "Page" ? en("Page {n}", { n: m[2] }) : en("Slide {n}", { n: m[2] })}
              </p>
            );
          if (line.trim() === "[Speaker notes]") return <p key={i} className="mt-2 text-xs font-medium text-muted-foreground">{en("Speaker notes")}</p>;
          return line.trim() === "" ? <div key={i} className="h-2" aria-hidden /> : <p key={i} dir="auto" className="whitespace-pre-wrap [overflow-wrap:anywhere]">{line}</p>;
        })}
      </div>
    </Card>
  );
}

type Tests = { passed: number; total: number; cases: Record<string, boolean> };
type Changes = { file: string; linesAdded: number; linesRemoved: number; diff: string }[];

/** The tests (each case passed or failed) and the changed files with their diffs: a coding task, and the change task (2.12) */
function TestsAndChanges({ tests, changes }: { tests: Tests | null; changes: Changes | null }) {
  const en = useEn();
  return (
    <>
      <p className="mb-3 text-sm">{tests && tests.total > 0 ? en("{passed} of {total} tests passed", { passed: tests.passed, total: tests.total }) : en("No tests were run")}</p>
      {tests && Object.keys(tests.cases ?? {}).length > 0 && (
        <ul className="mb-4 grid gap-1 text-xs sm:grid-cols-2">
          {Object.entries(tests.cases).map(([name, ok]) => (
            <li key={name} className="flex items-center gap-2">
              <span aria-hidden className={ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{ok ? "✓" : "✕"}</span>
              <span className="font-mono" dir="ltr">{name}</span>
              <span className="sr-only">{ok ? en("Passed") : en("Failed")}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="space-y-2">
        {(changes ?? []).map((c) => (
          <details key={c.file} className="rounded-lg border border-border">
            <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
              <span className="font-mono" dir="ltr">{c.file}</span>
              <span className="text-xs text-muted-foreground">{en("{added} lines added, {removed} removed", { added: c.linesAdded, removed: c.linesRemoved })}</span>
            </summary>
            <Diff text={c.diff} label={c.file} />
          </details>
        ))}
      </div>
    </>
  );
}

/** 2.12: the change task: what was asked, how it went (or why there was none), the time taken, the tests and the change itself */
function ChangeCard({ change }: { change: EvidenceChange }) {
  const en = useEn();
  const skipReason = useSkipReasonText();
  const title = en("The change task");
  if (change.status === "Skipped")
    return (
      <Card title={title}>
        <p className="text-sm text-muted-foreground">{skipReason(change.reason)}</p>
      </Card>
    );
  if (change.status === "Preparing" || change.status === "Ready")
    return (
      <Card title={title}>
        <p className="text-sm text-muted-foreground">{change.status === "Preparing" ? en("Being prepared from the student's work.") : en("Ready; the student hasn't started it yet.")}</p>
      </Card>
    );
  return (
    <Card title={change.title ? `${title}: ${change.title}` : title}>
      <div className="space-y-3 text-sm">
        {change.request && <p className="whitespace-pre-line rounded-lg border border-border bg-muted/40 p-3">{change.request}</p>}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {change.status === "Started" ? (
            <Badge tone="info">{en("In progress")}</Badge>
          ) : change.submitted ? (
            <Badge tone="good">{en("Handed in")}</Badge>
          ) : (
            <Badge tone="warn">{en("Not handed in in time")}</Badge>
          )}
          {change.minutesTaken != null && (
            <span>
              {change.minutesTaken < 1
                ? en("Under a minute of {minutes}", { minutes: change.minutes })
                : en("{taken} of {minutes} minutes", { taken: change.minutesTaken, minutes: change.minutes })}
            </span>
          )}
          <span>{en("No AI assistant")}</span>
        </p>
        {/* Only the files the student changed (the starting files they left alone aren't part of the change) */}
        {change.testsTrusted === false && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-200">
            {en("The change uses the test machinery, so the test results below can't be trusted. See the points to talk about.")}
          </p>
        )}
        {change.submitted && <TestsAndChanges tests={change.tests} changes={(change.changes ?? []).filter((c) => c.linesAdded > 0 || c.linesRemoved > 0)} />}
      </div>
    </Card>
  );
}

function Files({ files }: { files: EvidenceFile[] }) {
  const en = useEn();
  if (files.length === 0) return <p className="text-sm text-muted-foreground">{en("No files were kept.")}</p>;
  return (
    <div className="space-y-2">
      {files.map((f, i) => (
        <details key={f.path} open={i === 0} className="rounded-lg border border-border">
          <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
            <span className="break-all font-mono" dir="ltr">{f.path}</span>
            {typeof f.linesByStudent === "number" && f.linesByStudent > 0 && (
              <span className="text-xs text-muted-foreground">{en("{count} lines by the student", { count: f.linesByStudent })}</span>
            )}
          </summary>
          <pre className={`${CODE} m-3 mt-0`} dir="ltr" tabIndex={0} aria-label={f.path}>{f.content}</pre>
        </details>
      ))}
    </div>
  );
}

function Diff({ text, label }: { text: string; label: string }) {
  return (
    <pre className={`${CODE} m-3 mt-0`} dir="ltr" tabIndex={0} aria-label={label}>
      {text.split("\n").map((line, i) => (
        <span
          key={i}
          className={
            "block " +
            (line.startsWith("+") ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : line.startsWith("-") ? "bg-red-500/10 text-red-800 dark:text-red-300" : "")
          }
        >
          {line || " "}
        </span>
      ))}
    </pre>
  );
}

function VivaCard({ viva }: { viva: EvidenceViva }) {
  const en = useEn();
  if (viva.state !== "done") {
    return (
      <Card title={en("The viva")}>
        <p className="text-sm text-muted-foreground">
          {viva.state === "not_done" ? en("The work is in; the viva hasn't happened yet.") : viva.state === "not_yet" ? en("The student hasn't handed in their work yet.") : en("The viva's record is no longer available.")}
        </p>
      </Card>
    );
  }
  const mode = viva.mode === "voice" ? en("By voice") : viva.mode === "typed" ? en("In writing") : en("In writing, after the voice viva didn't go through");
  const minutes = Math.max(1, Math.round(viva.seconds / 60));
  return (
    <Card title={en("The viva")}>
      <p className="mb-4 text-sm text-muted-foreground">
        {mode}
        {" · "}
        {en("{answered} of {asked} questions answered", { answered: viva.answered, asked: viva.asked })}
        {viva.seconds > 0 && <>{" · "}{en("{count} min", { count: minutes })}</>}
        {" · "}
        {formatWhen(viva.startedAt)}
      </p>
      {viva.mode === "voice" && <p className="mb-4 text-xs text-muted-foreground">{en("Spoken answers are transcribed automatically and may contain recognition errors.")}</p>}
      <ol className="space-y-3">
        {viva.turns.map((turn, i) => (
          <li key={i} className={turn.who === "ai" ? "max-w-[90%]" : "ms-auto max-w-[90%]"}>
            <span className={"mb-1 block text-xs text-muted-foreground " + (turn.who === "ai" ? "" : "text-end")}>{turn.who === "ai" ? en("Examiner (AI)") : en("Student")}</span>
            <p
              className={
                "whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm " +
                (turn.who === "ai" ? "rounded-ss-sm bg-muted" : "rounded-se-sm bg-[var(--brand,#0e7490)]/10 text-foreground")
              }
            >
              {turn.text}
            </p>
          </li>
        ))}
      </ol>
    </Card>
  );
}

function SuggestionsCard({ e }: { e: AttemptEvidence }) {
  const en = useEn();
  const states = useSuggestionStateText();
  const s = e.suggestions;
  const ready = s.state === "ready";
  return (
    <Card title={en("Suggested scores")}>
      <p className="mb-4 text-xs text-muted-foreground">
        {ready ? en("Suggested by AI from the work and the viva. You decide the score.") : states[s.state]}
      </p>
      <ul className="space-y-4">
        {s.criteria.map((c) => (
          <li key={c.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium">{c.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{en("{weight}% of the score", { weight: c.weight })}</span>
            </div>
            {ready && c.score !== null ? (
              <>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-[var(--brand,#0e7490)]" style={{ width: `${c.score}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-end text-sm font-semibold tabular-nums">{en("{score} / 100", { score: c.score })}</span>
                </div>
                {c.reason && <p className="mt-1.5 text-sm">{c.reason}</p>}
                {c.quote && (
                  <blockquote className="mt-2 border-s-2 border-[var(--brand,#0e7490)]/40 ps-3 text-sm italic text-muted-foreground">
                    “{c.quote}”
                    {c.quoteFrom && <span className="ms-1 not-italic">({c.quoteFrom === "viva" ? en("from the viva") : en("from the work")})</span>}
                  </blockquote>
                )}
              </>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">{c.description}</p>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function SignalsCard({ e }: { e: AttemptEvidence }) {
  const en = useEn();
  const text = useSignalText();
  return (
    <Card title={en("Points to talk about")}>
      {e.signals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{en("Nothing stands out.")}</p>
      ) : (
        <ul className="space-y-3 text-sm">
          {e.signals.map((s, i) => {
            const other = typeof s.values?.attemptId === "string" ? (s.values.attemptId as string) : null;
            return (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + (s.tone === "warn" ? "bg-amber-500" : "bg-slate-400 dark:bg-slate-500")} />
                <span>
                  {text(s)}
                  {other && (
                    <>
                      {" "}
                      <Link href={`/faculty/attempts/${other}`} className="underline underline-offset-2">
                        {en("Compare")}
                      </Link>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        {en("These are patterns worth asking the student about, not findings. Nothing here decides anything; you do.")}
      </p>
    </Card>
  );
}

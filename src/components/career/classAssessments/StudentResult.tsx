"use client";

/**
 * Build & Defend 1.0, 2.8: the student's result. The teacher's decision, the score per rubric criterion and the comment (never
 * the AI's suggestions), the appeal (once, within 14 days, with a reason; another teacher or a school admin answers), and
 * the feedback on the previous attempt while the student works on a resubmission.
 * API: /api/career/class-assessments/student/assessments/{assignmentId}/attempt and .../attempt/appeal.
 */
import React, { useId, useState } from "react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button } from "@/components/career/ui";
import { formatWhen, type Decision, type StudentResult } from "@/components/career/classAssessments/types";
import { useDecisionNames } from "@/components/career/classAssessments/evidenceText";

export type PreviousFeedback = Pick<StudentResult, "number" | "decision" | "score" | "comment" | "decidedAt" | "criteria">;

const MIN_REASON = 20;
const MAX_REASON = 2000;
const tone = (d: Decision) => (d === "pass" ? "good" : d === "fail" ? "bad" : "warn");

function Scores({ r }: { r: PreviousFeedback }) {
  const en = useEn();
  const decisions = useDecisionNames();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Badge tone={tone(r.decision)}>{decisions[r.decision]}</Badge>
        {r.score != null && <span className="text-lg font-semibold tabular-nums">{en("{score} / 100", { score: r.score })}</span>}
      </div>
      {r.criteria.some((c) => c.score != null) && (
        <ul className="space-y-2">
          {r.criteria.map((c) => (
            <li key={c.key}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">{c.name}</span>
                <span className="shrink-0 tabular-nums">{c.score ?? "—"}</span>
              </div>
              {c.score != null && (
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                  <div className="h-full rounded-full bg-[var(--brand,#0e7490)]" style={{ width: `${c.score}%` }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {r.comment && (
        <div className="rounded-lg border border-border bg-muted/40 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{en("Your teacher's comment")}</p>
          <p className="whitespace-pre-line">{r.comment}</p>
        </div>
      )}
      {r.decidedAt && <p className="text-xs text-muted-foreground">{en("Decided {when}", { when: formatWhen(r.decidedAt) })}</p>}
    </div>
  );
}

export function ResultView({
  result,
  canStart,
  busy,
  onStart,
  onAppeal,
}: {
  result: StudentResult;
  canStart: boolean;
  busy: string | null;
  onStart: () => void;
  onAppeal: (reason: string) => Promise<boolean>;
}) {
  const en = useEn();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const a = result.appeal;
  const short = reason.trim().length < MIN_REASON;

  return (
    <div className="space-y-4">
      <Scores r={result} />

      {canStart && (
        <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          <p>{en("Your teacher asked you to hand in again. Your feedback stays here while you work on it.")}</p>
          {result.canAppeal && <p className="text-xs">{en("Once you start again, you can no longer appeal this decision.")}</p>}
          <Button busy={busy === "start"} onClick={onStart}>
            {en("Start attempt {n}", { n: result.number + 1 })}
          </Button>
        </div>
      )}

      {a && (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{en("Your appeal")}</span>
            <Badge tone={a.status === "Open" ? "info" : a.status === "Changed" ? "good" : "neutral"}>
              {a.status === "Open" ? en("Waiting for an answer") : a.status === "Changed" ? en("Result changed") : en("Decision kept")}
            </Badge>
          </div>
          {a.reason && <blockquote className="whitespace-pre-line border-s-2 border-border ps-3 text-muted-foreground">{a.reason}</blockquote>}
          {a.status === "Open" && <p className="text-xs text-muted-foreground">{en("Another teacher of the class, or a school admin, looks at it and answers here.")}</p>}
          {a.response && (
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{en("The answer")}</p>
              <p className="whitespace-pre-line">{a.response}</p>
              {a.resolvedAt && <p className="mt-2 text-xs text-muted-foreground">{formatWhen(a.resolvedAt)}</p>}
            </div>
          )}
        </div>
      )}

      {result.canAppeal && !open && (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">
          {result.appealUntil
            ? en("Think the decision is wrong? You can appeal once, until {when}.", { when: formatWhen(result.appealUntil) })
            : en("Think the decision is wrong? You can appeal once.")}{" "}
          <button type="button" className="font-medium text-foreground underline underline-offset-2" onClick={() => setOpen(true)}>
            {en("Appeal")}
          </button>
        </p>
      )}

      {result.canAppeal && open && (
        <form
          noValidate
          className="space-y-2 border-t border-border pt-3"
          onSubmit={async (ev) => {
            ev.preventDefault();
            setTried(true);
            if (short) return;
            if (await onAppeal(reason.trim())) setOpen(false);
          }}
        >
          <label htmlFor={`${id}-reason`} className="block font-medium">
            {en("Why should the decision change?")}
          </label>
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {en("Point to what in your work or your viva shows it. You can appeal once; another teacher or a school admin answers.")}
          </p>
          <textarea
            id={`${id}-reason`}
            rows={4}
            maxLength={MAX_REASON}
            value={reason}
            aria-describedby={`${id}-hint`}
            aria-invalid={tried && short ? true : undefined}
            onChange={(ev) => setReason(ev.target.value)}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1"
          />
          {tried && short && <p className="text-xs text-red-600 dark:text-red-400">{en("Write at least {count} characters.", { count: MIN_REASON })}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={busy === "appeal"}>
              {en("Send appeal")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {en("Cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** The teacher's feedback on the attempt before this one, while the student works on a resubmission */
export function PreviousFeedbackView({ previous }: { previous: PreviousFeedback }) {
  const en = useEn();
  return (
    <details className="rounded-lg border border-border p-3 [&_summary]:cursor-pointer" open>
      <summary className="font-medium">{en("Feedback on attempt {n}", { n: previous.number })}</summary>
      <div className="mt-3">
        <Scores r={previous} />
      </div>
    </details>
  );
}


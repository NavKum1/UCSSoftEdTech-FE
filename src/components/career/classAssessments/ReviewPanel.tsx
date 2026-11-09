"use client";

/**
 * Build & Defend 1.0, 2.8: the teacher's side of a decision. Score every rubric criterion from 0 to 100 (starting from the AI's
 * suggestion when there is one), choose pass, resubmit or fail, and tell the student why. Once decided, the decision with the
 * suggestion next to each final score, and the student's appeal, which another teacher of the class (or a school admin)
 * resolves: keep the decision or change it, always with a response.
 * API: /api/career/class-assessments/faculty/attempts/{id}/decision and .../appeal.
 */
import React, { useId, useMemo, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, ErrorBanner } from "@/components/career/ui";
import { CA_API, formatWhen, type AttemptEvidence, type AttemptReview, type Decision } from "@/components/career/classAssessments/types";
import { useDecisionNames } from "@/components/career/classAssessments/evidenceText";

const MAX_COMMENT = 4000;
const INPUT = "rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1";

type Criterion = AttemptEvidence["suggestions"]["criteria"][number];

const decisionTone = (d: Decision) => (d === "pass" ? "good" : d === "fail" ? "bad" : "warn");

/** The weighted total, as the API works it out (weights add up to 100) */
function weighted(criteria: Criterion[], scores: Record<string, string>) {
  let sum = 0;
  let weights = 0;
  for (const c of criteria) {
    const v = Number(scores[c.key]);
    if (scores[c.key] === "" || !Number.isFinite(v)) return null;
    sum += v * c.weight;
    weights += c.weight;
  }
  return weights > 0 ? Math.round((sum / weights) * 10) / 10 : null;
}

export function ReviewPanel({ e, onChange }: { e: AttemptEvidence; onChange: (review: AttemptReview) => void }) {
  const en = useEn();
  const r = e.review;
  if (r.status === "Submitted") return <DecideCard e={e} onChange={onChange} />;
  if (r.status !== "Decided" || !r.decision) return null;
  return (
    <>
      <DecisionCard e={e} />
      {r.credential && <CredentialCard e={e} onChange={onChange} />}
      {r.appeal && <AppealCard e={e} onChange={onChange} />}
      {e.evidenceChangedSinceDecision && (
        <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {en("The work or the viva has changed since this decision was made.")}
        </p>
      )}
    </>
  );
}

function DecideCard({ e, onChange }: { e: AttemptEvidence; onChange: (review: AttemptReview) => void }) {
  const en = useEn();
  const api = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Card title={en("Your decision")}>
      <ErrorBanner error={error} />
      <ScoreForm
        criteria={e.suggestions.criteria}
        start={Object.fromEntries(e.suggestions.criteria.map((c) => [c.key, c.score]))}
        busy={busy}
        submitLabel={en("Save decision")}
        onSubmit={async (body) => {
          setBusy(true);
          setError(null);
          try {
            onChange(await api<AttemptReview>(`${CA_API}/faculty/attempts/${e.id}/decision`, { method: "POST", json: { ...body, evidenceHash: e.evidenceHash } }));
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}

interface ScoreBody {
  scores: { key: string; score: number }[];
  decision: Decision;
  comment: string;
}

function ScoreForm({
  criteria,
  start,
  startDecision,
  startComment,
  busy,
  submitLabel,
  onSubmit,
  children,
  afterAppeal,
}: {
  criteria: Criterion[];
  start: Record<string, number | null>;
  startDecision?: Decision;
  startComment?: string;
  busy: boolean;
  submitLabel: string;
  onSubmit: (body: ScoreBody) => void;
  children?: React.ReactNode;
  /** Changing a decision on appeal: the student can't appeal again */
  afterAppeal?: boolean;
}) {
  const en = useEn();
  const id = useId();
  const decisions = useDecisionNames();
  const [scores, setScores] = useState<Record<string, string>>(() => Object.fromEntries(criteria.map((c) => [c.key, start[c.key] == null ? "" : String(start[c.key])])));
  const [decision, setDecision] = useState<Decision | null>(startDecision ?? null);
  const [comment, setComment] = useState(startComment ?? "");
  const [tried, setTried] = useState(false);
  const total = useMemo(() => weighted(criteria, scores), [criteria, scores]);
  const bad = (k: string) => {
    const v = scores[k];
    const n = Number(v);
    return v === "" || !Number.isInteger(n) || n < 0 || n > 100;
  };
  const needsComment = decision !== null && decision !== "pass";
  const problems = [
    criteria.some((c) => bad(c.key)) && en("Give every criterion a whole number from 0 to 100."),
    decision === null && en("Choose pass, resubmit or fail."),
    needsComment && comment.trim() === "" && en("Tell the student why: a comment is needed to ask for a resubmission or to fail."),
  ].filter(Boolean) as string[];

  return (
    <form
      noValidate
      className="space-y-5 text-sm"
      onSubmit={(ev) => {
        ev.preventDefault();
        setTried(true);
        if (problems.length || !decision) return;
        onSubmit({ scores: criteria.map((c) => ({ key: c.key, score: Number(scores[c.key]) })), decision, comment: comment.trim() });
      }}
    >
      {children}
      <fieldset className="space-y-3">
        <legend className="mb-1 font-medium">{en("Scores")}</legend>
        {criteria.map((c) => {
          const inputId = `${id}-${c.key}`;
          return (
            <div key={c.key} className="flex items-center justify-between gap-3">
              <label htmlFor={inputId} className="min-w-0">
                <span className="block">{c.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {c.score != null ? en("{weight}% · AI suggested {score}", { weight: c.weight, score: c.score }) : en("{weight}% of the score", { weight: c.weight })}
                </span>
              </label>
              <input
                id={inputId}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                value={scores[c.key]}
                aria-invalid={tried && bad(c.key) ? true : undefined}
                onChange={(ev) => setScores((s) => ({ ...s, [c.key]: ev.target.value }))}
                className={INPUT + " w-20 shrink-0 text-end tabular-nums"}
              />
            </div>
          );
        })}
        <p className="flex items-baseline justify-between border-t border-border pt-3">
          <span className="text-muted-foreground">{en("Weighted score")}</span>
          <span className="text-lg font-semibold tabular-nums" aria-live="polite">
            {total == null ? "–" : en("{score} / 100", { score: total })}
          </span>
        </p>
      </fieldset>

      <fieldset>
        <legend className="mb-2 font-medium">{en("Decision")}</legend>
        <div className="grid grid-cols-3 gap-2">
          {(["pass", "resubmit", "fail"] as Decision[]).map((d) => (
            <label
              key={d}
              className={
                "flex cursor-pointer items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 sm:text-sm " +
                (decision === d ? "border-[var(--brand,#0e7490)] bg-[var(--brand,#0e7490)]/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              <input type="radio" name={`${id}-decision`} value={d} checked={decision === d} onChange={() => setDecision(d)} className="sr-only" />
              {d === "pass" ? en("Pass") : d === "resubmit" ? en("Resubmit") : en("Fail")}
            </label>
          ))}
        </div>
        {decision && <p className="mt-2 text-xs text-muted-foreground">{decisionHelp(en, decision, decisions, afterAppeal)}</p>}
      </fieldset>

      <div className="space-y-1">
        <label htmlFor={`${id}-comment`} className="block font-medium">
          {needsComment ? en("Comment for the student") : en("Comment for the student (optional)")}
        </label>
        <textarea
          id={`${id}-comment`}
          rows={4}
          maxLength={MAX_COMMENT}
          value={comment}
          onChange={(ev) => setComment(ev.target.value)}
          className={INPUT + " w-full"}
        />
      </div>

      {tried && problems.length > 0 && (
        <ul role="alert" className="list-disc space-y-1 ps-5 text-xs text-red-600 dark:text-red-400">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <Button type="submit" busy={busy} className="w-full">
        {submitLabel}
      </Button>
    </form>
  );
}

function decisionHelp(en: ReturnType<typeof useEn>, d: Decision, names: Record<Decision, string>, afterAppeal = false) {
  if (d === "pass") return en("The student is told they passed.");
  if (d === "resubmit") return en("{name}: the student can hand in again, even after the due date.", { name: names.resubmit });
  return afterAppeal ? en("The student is told they didn't pass.") : en("The student is told they didn't pass. They can appeal within 14 days.");
}

function DecisionCard({ e }: { e: AttemptEvidence }) {
  const en = useEn();
  const decisions = useDecisionNames();
  const d = e.review.decision!;
  const byKey = new Map(e.suggestions.criteria.map((c) => [c.key, c]));
  return (
    <Card title={en("Decision")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Badge tone={decisionTone(d.value)}>{decisions[d.value]}</Badge>
        {d.score != null && <span className="text-lg font-semibold tabular-nums">{en("{score} / 100", { score: d.score })}</span>}
      </div>
      {d.scores.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {d.scores.map((s) => (
            <li key={s.key} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">{byKey.get(s.key)?.name ?? s.key}</span>
              <span className="shrink-0 tabular-nums">
                <span className="font-medium">{s.score}</span>
                {s.suggested != null && s.suggested !== s.score && (
                  <span className="ms-2 text-xs text-muted-foreground">{en("AI suggested {score}", { score: s.suggested })}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {d.comment && <p className="mt-4 whitespace-pre-line border-t border-border pt-3 text-sm">{d.comment}</p>}
      {d.by && d.at && <p className="mt-3 text-xs text-muted-foreground">{en("By {name}, {when}", { name: d.by, when: formatWhen(d.at) })}</p>}
    </Card>
  );
}

/** 2.9: the credential the pass issued; a school admin can withdraw it with a reason (kept from the public) */
function CredentialCard({ e, onChange }: { e: AttemptEvidence; onChange: (review: AttemptReview) => void }) {
  const en = useEn();
  const api = useApi();
  const id = useId();
  const c = e.review.credential!;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = c.status === "Valid";
  const short = reason.trim().length < 10;

  const withdraw = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api<AttemptReview>(`${CA_API}/faculty/attempts/${e.id}/credential/withdraw`, { method: "POST", json: { reason: reason.trim() } }));
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={en("Credential")}>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={valid ? "good" : "bad"}>{valid ? en("Issued") : en("Revoked")}</Badge>
          <span className="text-xs text-muted-foreground">
            {valid ? en("Issued {when}", { when: formatWhen(c.issuedAt) }) : c.revokedAt ? en("Revoked {when}", { when: formatWhen(c.revokedAt) }) : null}
          </span>
        </div>
        {valid ? (
          <p className="text-muted-foreground">
            {en("The student's pass added a signed credential to their wallet. They decide whether to share it.")}{" "}
            <a href={`/credential/${c.slug}`} target="_blank" rel="noreferrer" className="font-medium text-foreground underline underline-offset-2">
              {en("View it")}
            </a>
          </p>
        ) : (
          c.reason && <p className="whitespace-pre-line text-muted-foreground">{c.reason}</p>
        )}
        {valid && e.review.canWithdrawCredential && !open && (
          <Button type="button" variant="ghost" onClick={() => setOpen(true)} className="px-0">
            {en("Withdraw the credential")}
          </Button>
        )}
        {valid && open && (
          <div className="space-y-2 border-t border-border pt-3">
            <ErrorBanner error={error} />
            <label htmlFor={`${id}-reason`} className="block font-medium">
              {en("Why is it withdrawn?")}
            </label>
            <p id={`${id}-hint`} className="text-xs text-muted-foreground">
              {en("Kept in the audit log and shown to teachers, never on the public page. The student is told it was withdrawn.")}
            </p>
            <textarea
              id={`${id}-reason`}
              rows={3}
              maxLength={300}
              value={reason}
              aria-describedby={`${id}-hint`}
              onChange={(ev) => setReason(ev.target.value)}
              className={INPUT + " w-full"}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="danger" busy={busy} disabled={short} onClick={() => void withdraw()}>
                {en("Withdraw")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {en("Cancel")}
              </Button>
            </div>
            {short && <p className="text-xs text-muted-foreground">{en("Write at least {count} characters.", { count: 10 })}</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

function AppealCard({ e, onChange }: { e: AttemptEvidence; onChange: (review: AttemptReview) => void }) {
  const en = useEn();
  const api = useApi();
  const id = useId();
  const a = e.review.appeal!;
  const d = e.review.decision!;
  const [outcome, setOutcome] = useState<"keep" | "change" | null>(null);
  const [response, setResponse] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api<AttemptReview>(`${CA_API}/faculty/attempts/${e.id}/appeal`, { method: "POST", json: body }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const responseOk = response.trim().length >= 3;

  return (
    <Card title={en("Appeal")}>
      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={a.status === "Open" ? "warn" : a.status === "Changed" ? "info" : "neutral"}>
            {a.status === "Open" ? en("Waiting for a teacher") : a.status === "Changed" ? en("Decision changed") : en("Decision kept")}
          </Badge>
          {a.at && <span className="text-xs text-muted-foreground">{en("Appealed {when}", { when: formatWhen(a.at) })}</span>}
        </div>
        {a.reason && (
          <blockquote className="whitespace-pre-line border-s-2 border-border ps-3 text-muted-foreground">{a.reason}</blockquote>
        )}
        {a.response && (
          <div className="border-t border-border pt-3">
            <p className="whitespace-pre-line">{a.response}</p>
            {a.by && a.resolvedAt && <p className="mt-2 text-xs text-muted-foreground">{en("By {name}, {when}", { name: a.by, when: formatWhen(a.resolvedAt) })}</p>}
          </div>
        )}
        {a.status === "Open" && !a.canResolve && (
          <p className="text-muted-foreground">{en("Another teacher of the class, or a school admin, resolves an appeal of your decision.")}</p>
        )}
        {a.status === "Open" && a.canResolve && (
          <div className="space-y-4 border-t border-border pt-3">
            <ErrorBanner error={error} />
            <div className="space-y-1">
              <label htmlFor={`${id}-response`} className="block font-medium">
                {en("Response to the student")}
              </label>
              <textarea id={`${id}-response`} rows={3} maxLength={MAX_COMMENT} value={response} onChange={(ev) => setResponse(ev.target.value)} className={INPUT + " w-full"} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" busy={busy && outcome === "keep"} disabled={!responseOk || busy} onClick={() => { setOutcome("keep"); void send({ outcome: "keep", response: response.trim() }); }}>
                {en("Keep the decision")}
              </Button>
              <Button type="button" variant="secondary" disabled={busy} aria-expanded={outcome === "change"} onClick={() => setOutcome(outcome === "change" ? null : "change")}>
                {en("Change it")}
              </Button>
            </div>
            {!responseOk && <p className="text-xs text-muted-foreground">{en("Write the student a response first.")}</p>}
            {outcome === "change" && (
              <ScoreForm
                criteria={e.suggestions.criteria}
                start={Object.fromEntries(d.scores.map((s) => [s.key, s.score]))}
                startDecision={d.value}
                startComment={d.comment ?? ""}
                busy={busy}
                submitLabel={en("Save the new decision")}
                afterAppeal
                onSubmit={(body) => {
                  if (!responseOk) {
                    setError(en("Write the student a response first."));
                    return;
                  }
                  void send({ outcome: "change", response: response.trim(), ...body });
                }}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

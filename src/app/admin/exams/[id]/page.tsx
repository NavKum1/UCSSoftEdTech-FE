"use client";

/**
 * H12 exam administration: one exam. Settings (attempts policy, time limit and grace, credential and answer key,
 * questions per attempt), the question pool (versioned questions, drafts, import), per-question statistics, per-student
 * exceptions (extra attempts, cooldown reset, voiding an attempt) and the audit trail. The API answers 404 for an exam
 * the caller doesn't manage.
 */

import React, { useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AccessNotice } from "@/lib/legacyApi";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader, ScrollArea, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { TabPanel, Tabs } from "@/components/career/appointments/shared";
import {
  ACTION_LABEL,
  ADMIN_BASE,
  FLAG_LABEL,
  KindBadge,
  PoolHealthBadge,
  SCOPE_LABEL,
  StatusBadge,
  minutesLabel,
  useExamAdminApi,
  type AuditEvent,
  type ExamDetail,
  type Question,
  type Statistics,
  type StudentDetail,
  type StudentRow,
} from "@/components/admin/exams/shared";
import { QuestionDialog } from "@/components/admin/exams/QuestionDialog";
import { ImportDialog } from "@/components/admin/exams/ImportDialog";

type Tab = "settings" | "questions" | "statistics" | "students" | "activity";
const TABS: { key: Tab; label: string }[] = [
  { key: "settings", label: "Settings" },
  { key: "questions", label: "Question pool" },
  { key: "statistics", label: "Statistics" },
  { key: "students", label: "Students" },
  { key: "activity", label: "Activity" },
];

// ---------------------------------------------------------------------------------------------------------------- settings

function Check({ label, hint, checked, disabled, onChange }: { label: string; hint?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} aria-describedby={hint ? `${id}-h` : undefined} />
      <div>
        <label htmlFor={id} className={`text-sm font-medium ${disabled ? "text-muted-foreground" : ""}`}>
          {label}
        </label>
        {hint && (
          <p id={`${id}-h`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

/** A number that can fall back to the configured default (sent as -1). */
function DefaultableNumber({ label, unit, value, isDefault, defaultValue, min, max, onChange }: {
  label: string; unit: string; value: string; isDefault: boolean; defaultValue: number; min: number; max: number;
  onChange: (value: string, isDefault: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <Field label={`${label} (${unit})`} hint={isDefault ? `Uses the default: ${defaultValue}${defaultValue === 0 && unit === "attempts" ? " (unlimited)" : ""}` : unit === "attempts" ? "0 = unlimited" : undefined}>
        {(p) => <input {...p} type="number" inputMode="numeric" min={min} max={max} value={isDefault ? String(defaultValue) : value} disabled={isDefault} onChange={(e) => onChange(e.target.value, false)} />}
      </Field>
      <label htmlFor={id} className="flex items-center gap-2 text-xs">
        <input id={id} type="checkbox" className="h-4 w-4" checked={isDefault} onChange={(e) => onChange(isDefault ? String(defaultValue) : value, e.target.checked)} />
        Use the default<span className="sr-only"> for {label.toLowerCase()}</span>
      </label>
    </div>
  );
}

function SettingsForm({ exam, onSaved }: { exam: ExamDetail; onSaved: (e: ExamDetail, msg: string) => void }) {
  const { call } = useExamAdminApi();
  const p = exam.policy;
  const [issues, setIssues] = useState(p.issuesCredential);
  const [reveal, setReveal] = useState(p.revealAnswerKey);
  const [max, setMax] = useState({ value: String(p.maxAttempts), isDefault: p.overrides.maxAttempts === null });
  const [cool, setCool] = useState({ value: String(p.cooldownMinutes), isDefault: p.overrides.cooldownMinutes === null });
  const [grace, setGrace] = useState({ value: String(p.graceMinutes), isDefault: p.overrides.graceMinutes === null });
  const [limit, setLimit] = useState(String(p.timeLimitMinutes));
  const [per, setPer] = useState(String(p.overrides.questionsPerAttempt ?? 0));
  const [shuffleQ, setShuffleQ] = useState(p.shuffleQuestions);
  const [shuffleO, setShuffleO] = useState(p.shuffleOptions);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const d = exam.defaults;
  const defMax = issues ? d.credentialMaxAttempts : d.practiceMaxAttempts;
  const defCool = issues ? d.credentialCooldownMinutes : d.practiceCooldownMinutes;
  const canCredential = exam.permissions.canIssueCredential || p.issuesCredential;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const num = (s: string) => (s.trim() === "" ? undefined : Number(s));
    try {
      const saved = await call<ExamDetail>(`${ADMIN_BASE}/exams/${encodeURIComponent(exam.id)}/policy`, {
        method: "PUT",
        json: {
          issuesCredential: issues,
          revealAnswerKey: issues ? false : reveal,
          maxAttempts: max.isDefault ? -1 : num(max.value),
          cooldownMinutes: cool.isDefault ? -1 : num(cool.value),
          graceMinutes: grace.isDefault ? -1 : num(grace.value),
          timeLimitMinutes: num(limit),
          questionsPerAttempt: num(per) ?? 0,
          shuffleQuestions: shuffleQ,
          shuffleOptions: shuffleO,
          expectedVersion: exam.version,
        },
      });
      onSaved(saved, "Settings saved.");
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <ErrorBanner error={err} />
      <Card title="Kind of exam">
        <div className="space-y-3">
          <Check
            label="Issues a credential"
            checked={issues}
            disabled={!canCredential || exam.scope === "Private"}
            onChange={(v) => {
              setIssues(v);
              if (v) setReveal(false);
            }}
            hint={
              exam.scope === "Private"
                ? "A private exam is for practice only: its creator wrote the answer key."
                : !canCredential
                  ? "Only institute staff or a platform admin can turn this on."
                  : "Credential exams never show the answer key and limit attempts."
            }
          />
          <Check
            label="Show the answer key after a submission"
            checked={!issues && reveal}
            disabled={issues}
            onChange={setReveal}
            hint={issues ? "Never for a credential exam." : "Practice exams only: correct answers and explanations after each submission."}
          />
        </div>
      </Card>
      <Card title="Attempts and timing">
        <div className="grid gap-4 sm:grid-cols-2">
          <DefaultableNumber label="Attempts per student" unit="attempts" value={max.value} isDefault={max.isDefault} defaultValue={defMax} min={0} max={100} onChange={(value, isDefault) => setMax({ value, isDefault })} />
          <DefaultableNumber label="Wait between attempts" unit="minutes" value={cool.value} isDefault={cool.isDefault} defaultValue={defCool} min={0} max={525600} onChange={(value, isDefault) => setCool({ value, isDefault })} />
          <Field label="Time limit (minutes)" hint="1 to 600">
            {(fp) => <input {...fp} type="number" inputMode="numeric" min={1} max={600} required value={limit} onChange={(e) => setLimit(e.target.value)} />}
          </Field>
          <DefaultableNumber label="Grace after the time limit" unit="minutes" value={grace.value} isDefault={grace.isDefault} defaultValue={d.graceMinutes} min={0} max={120} onChange={(value, isDefault) => setGrace({ value, isDefault })} />
        </div>
      </Card>
      <Card title="Questions">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Questions per attempt" hint={`0 = all ${exam.questions.approved} approved questions. Drawn at random from the pool for each attempt.`}>
            {(fp) => <input {...fp} type="number" inputMode="numeric" min={0} max={exam.questions.approved} value={per} onChange={(e) => setPer(e.target.value)} />}
          </Field>
          <div className="space-y-3">
            <Check label="Shuffle the question order" checked={shuffleQ} onChange={setShuffleQ} />
            <Check label="Shuffle the options of each question" checked={shuffleO} onChange={setShuffleO} />
          </div>
        </div>
      </Card>
      <div className="flex justify-end">
        <Button type="submit" busy={busy}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------------------------------------------- questions

function QuestionsTab({ exam, onChanged }: { exam: ExamDetail; onChanged: (msg: string) => void }) {
  const { call, ready } = useExamAdminApi();
  const base = `${ADMIN_BASE}/exams/${encodeURIComponent(exam.id)}`;
  const list = useLoad(() => (ready ? call<{ questions: Question[] }>(`${base}/questions`) : Promise.resolve(null)), [ready, call, base]);
  const [filter, setFilter] = useState<"active" | "Approved" | "Draft" | "Retired" | "all">("active");
  const [editing, setEditing] = useState<Question | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const act = async (q: Question, action: "approve" | "retire") => {
    setBusy(`${action}-${q.number}`);
    setErr(null);
    try {
      await call(`${base}/questions/${q.number}/${action}`, { method: "POST" });
      list.reload();
      onChanged(action === "approve" ? `Question ${q.number} approved.` : `Question ${q.number} retired.`);
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const done = (msg: string) => {
    setEditing(null);
    setImporting(false);
    list.reload();
    onChanged(msg);
  };

  const rows = (list.data?.questions ?? []).filter((q) => (filter === "all" ? true : filter === "active" ? q.status !== "Retired" : q.status === filter));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3 text-sm">
        <PoolHealthBadge health={exam.poolHealth} />
        <span>{exam.poolHealth.message}</span>
      </div>
      <ErrorBanner error={err ?? list.error} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="w-48">
          <Field label="Show">
            {(p) => (
              <select {...p} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
                <option value="active">Approved and drafts</option>
                <option value="Approved">Approved</option>
                <option value="Draft">Drafts</option>
                <option value="Retired">Retired</option>
                <option value="all">All versions</option>
              </select>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)}>
            Import CSV or JSON
          </Button>
          <Button onClick={() => setEditing("new")}>Add question</Button>
        </div>
      </div>
      {list.loading || !list.data ? (
        <Loading label="Loading questions" />
      ) : rows.length === 0 ? (
        <EmptyState title="No questions here" />
      ) : (
        <ScrollArea>
          <table className="w-full text-sm">
            <caption className="sr-only">Questions of {exam.title}</caption>
            <thead>
              <tr className="border-b border-border [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start">
                <th scope="col">No.</th>
                <th scope="col">Question</th>
                <th scope="col">Answer</th>
                <th scope="col">Status</th>
                <th scope="col">Served</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.number} className="border-b border-border align-top last:border-0 [&_td]:py-2 [&_td]:pe-3">
                  <td>{q.number}</td>
                  <td className="max-w-md">
                    <div className="whitespace-pre-wrap">{q.questionText}</div>
                    <div className="text-xs text-muted-foreground">
                      {q.topic && `${q.topic} · `}
                      {q.source === "AiDraft" ? "AI draft" : q.source} · version {q.revision}
                      {q.previousNumber !== null && ` (replaces ${q.previousNumber})`}
                      {q.supersededByNumber !== null && ` (replaced by ${q.supersededByNumber})`}
                    </div>
                  </td>
                  <td>{q.options[q.correctOptionIndex]}</td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                  <td>{q.timesServed}</td>
                  <td>
                    <div className="flex flex-wrap gap-2">
                      {q.status !== "Retired" && (
                        <Button variant="secondary" onClick={() => setEditing(q)} aria-label={`Edit question ${q.number}`}>
                          Edit
                        </Button>
                      )}
                      {q.status !== "Approved" && q.supersededByNumber === null && (
                        <Button variant="secondary" onClick={() => act(q, "approve")} busy={busy === `approve-${q.number}`} aria-label={`${q.status === "Draft" ? "Approve" : "Restore"} question ${q.number}`}>
                          {q.status === "Draft" ? "Approve" : "Restore"}
                        </Button>
                      )}
                      {q.status !== "Retired" && (
                        <Button variant="ghost" onClick={() => act(q, "retire")} busy={busy === `retire-${q.number}`} aria-label={`Retire question ${q.number}`}>
                          Retire
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      {editing && <QuestionDialog examId={exam.id} question={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={done} />}
      {importing && <ImportDialog examId={exam.id} onClose={() => setImporting(false)} onImported={done} />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------- statistics

function StatisticsTab({ exam }: { exam: ExamDetail }) {
  const { call, ready } = useExamAdminApi();
  const stats = useLoad(() => (ready ? call<Statistics>(`${ADMIN_BASE}/exams/${encodeURIComponent(exam.id)}/statistics`) : Promise.resolve(null)), [ready, call, exam.id]);
  if (stats.error) return <ErrorBanner error={stats.error} onRetry={stats.reload} />;
  if (stats.loading || !stats.data) return <Loading label="Loading statistics" />;
  const s = stats.data;
  const rows = s.questions.filter((q) => q.status !== "Retired" || q.timesServed > 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        From {s.gradedAttempts} graded attempt{s.gradedAttempts === 1 ? "" : "s"} (voided attempts left out). Discrimination compares the top and bottom{" "}
        {Math.round(s.thresholds.groupShare * 100)}% of attempts by score ({s.groupSize} each): +1 means only strong students get it right, below 0 means weaker students do
        better. Flags need {s.thresholds.minSample} answers: at least {s.thresholds.tooEasyPercent}% or at most {s.thresholds.tooHardPercent}% correct.
        {s.capped && " Only the most recent attempts are counted."}
      </p>
      {rows.length === 0 ? (
        <EmptyState title="No questions yet" />
      ) : (
        <ScrollArea>
          <table className="w-full text-sm">
            <caption className="sr-only">Statistics per question</caption>
            <thead>
              <tr className="border-b border-border [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start">
                <th scope="col">No.</th>
                <th scope="col">Question</th>
                <th scope="col">Served</th>
                <th scope="col">Correct</th>
                <th scope="col">Discrimination</th>
                <th scope="col">Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q) => (
                <tr key={q.number} className="border-b border-border align-top last:border-0 [&_td]:py-2 [&_td]:pe-3">
                  <td>{q.number}</td>
                  <td className="max-w-md">
                    {q.questionText}
                    {q.status !== "Approved" && (
                      <span className="ms-2">
                        <StatusBadge status={q.status} />
                      </span>
                    )}
                  </td>
                  <td>{q.timesServed}</td>
                  <td>{q.percentCorrect === null ? "—" : `${q.percentCorrect}% (${q.timesCorrect} of ${q.timesAnswered})`}</td>
                  <td>{q.discrimination === null ? "—" : q.discrimination.toFixed(2)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {q.flags.map((f) => (
                        <Badge key={f} tone={f === "low_sample" ? "neutral" : "warn"}>
                          {FLAG_LABEL[f] ?? f}
                        </Badge>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------- students

type StudentAction =
  | { kind: "extra"; userId: string; who: string }
  | { kind: "cooldown"; userId: string; who: string }
  | { kind: "void"; userId: string; who: string; attemptId: string; attemptNumber: number | null };

function StudentActionDialog({ examId, action, onClose, onDone }: { examId: string; action: StudentAction; onClose: () => void; onDone: (msg: string) => void }) {
  const { call } = useExamAdminApi();
  const titleId = useId();
  const [count, setCount] = useState("1");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const base = `${ADMIN_BASE}/exams/${encodeURIComponent(examId)}`;
  const title = action.kind === "extra" ? "Grant extra attempts" : action.kind === "cooldown" ? "Reset the cooldown" : `Void attempt ${action.attemptNumber ?? ""}`;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (action.kind === "extra") {
        await call(`${base}/students/${action.userId}/extra-attempts`, { method: "POST", json: { count: Number(count), reason } });
        onDone(`${Number(count) > 0 ? "Granted" : "Took back"} ${Math.abs(Number(count))} attempt${Math.abs(Number(count)) === 1 ? "" : "s"} for ${action.who}.`);
      } else if (action.kind === "cooldown") {
        await call(`${base}/students/${action.userId}/reset-cooldown`, { method: "POST", json: { reason } });
        onDone(`${action.who} can start the next attempt now.`);
      } else {
        const r = await call<{ credentialFlagged: boolean; certificateNumber: string | null }>(`${base}/attempts/${action.attemptId}/void`, { method: "POST", json: { reason } });
        onDone(r.credentialFlagged ? `Attempt voided. Certificate ${r.certificateNumber} is now under review.` : "Attempt voided.");
      }
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal labelledBy={titleId} onClose={onClose}>
      <form onSubmit={submit} className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {action.kind === "extra" && `Adds attempts on top of the exam's limit for ${action.who} only.`}
          {action.kind === "cooldown" && `${action.who} can start the next attempt right away; later attempts start a new wait.`}
          {action.kind === "void" &&
            `The attempt no longer counts against the limit and can't back a new credential. If a credential was issued for it, the credential is flagged for review, not revoked.`}
        </p>
        <ErrorBanner error={err} />
        {action.kind === "extra" && (
          <Field label="Attempts" hint="1 to 20 (a negative number takes extra attempts back)">
            {(p) => <input {...p} type="number" inputMode="numeric" min={-20} max={20} required value={count} onChange={(e) => setCount(e.target.value)} />}
          </Field>
        )}
        <Field label="Reason" hint="Required. Kept in the audit log.">
          {(p) => <textarea {...p} rows={3} required minLength={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={action.kind === "void" ? "danger" : "primary"} busy={busy}>
            {action.kind === "extra" ? "Save" : action.kind === "cooldown" ? "Reset cooldown" : "Void attempt"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StudentAttempts({ examId, userId, reloadKey, onAction }: { examId: string; userId: string; reloadKey: number; onAction: (a: StudentAction) => void }) {
  const { call, ready } = useExamAdminApi();
  const detail = useLoad(
    () => (ready ? call<StudentDetail>(`${ADMIN_BASE}/exams/${encodeURIComponent(examId)}/students/${userId}/attempts`) : Promise.resolve(null)),
    [ready, call, examId, userId, reloadKey],
  );
  if (detail.error) return <ErrorBanner error={detail.error} />;
  if (detail.loading || !detail.data) return <Loading label="Loading attempts" />;
  const d = detail.data;
  const who = d.name ?? d.email ?? "this student";
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {d.status.attemptsUsed} attempt{d.status.attemptsUsed === 1 ? "" : "s"} counted
        {d.status.maxAttempts > 0 ? ` of ${d.status.maxAttempts}` : " (no limit)"}
        {d.exceptions.extraAttempts > 0 && `, including ${d.exceptions.extraAttempts} extra`}.{" "}
        {d.status.nextAttemptAt ? `Next attempt from ${formatDate(d.status.nextAttemptAt, true)}.` : ""}
      </p>
      <ScrollArea>
        <table className="w-full text-sm">
          <caption className="sr-only">Attempts by {who}</caption>
          <thead>
            <tr className="border-b border-border [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start">
              <th scope="col">Attempt</th>
              <th scope="col">Status</th>
              <th scope="col">Score</th>
              <th scope="col">When</th>
              <th scope="col">Credential</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {d.attempts.map((a) => (
              <tr key={a.attemptId} className="border-b border-border align-top last:border-0 [&_td]:py-2 [&_td]:pe-3">
                <td>{a.attemptNumber ?? "imported"}</td>
                <td>
                  <StatusBadge status={a.status} />
                  {a.voidReason && <div className="text-xs text-muted-foreground">Reason: {a.voidReason}</div>}
                  {!a.countsTowardLimit && a.status !== "Voided" && <div className="text-xs text-muted-foreground">Doesn&apos;t count</div>}
                </td>
                <td>{a.status === "Submitted" || a.status === "Voided" ? `${a.percentage}% ${a.passed ? "(passed)" : ""}` : "—"}</td>
                <td>{formatDate(a.submittedAt ?? a.startedAt, true)}</td>
                <td>
                  {a.credential ? (
                    <>
                      <span className="font-mono text-xs">{a.credential.certificateNumber}</span>
                      {a.credential.reviewStatus && (
                        <div>
                          <Badge tone={a.credential.reviewStatus === "Revoked" ? "bad" : a.credential.reviewStatus === "Kept" ? "good" : "warn"}>
                            {a.credential.reviewStatus === "Flagged" ? "Under review" : a.credential.reviewStatus}
                          </Badge>
                        </div>
                      )}
                    </>
                  ) : (
                    a.certificateNumber ?? "—"
                  )}
                </td>
                <td>
                  {a.status !== "Voided" && (
                    <Button
                      variant="ghost"
                      onClick={() => onAction({ kind: "void", userId, who, attemptId: a.attemptId, attemptNumber: a.attemptNumber })}
                      aria-label={`Void attempt ${a.attemptNumber ?? ""} by ${who}`}
                    >
                      Void
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
    </div>
  );
}

function StudentsTab({ exam, onChanged }: { exam: ExamDetail; onChanged: (msg: string) => void }) {
  const { call, ready } = useExamAdminApi();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [action, setAction] = useState<StudentAction | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const base = `${ADMIN_BASE}/exams/${encodeURIComponent(exam.id)}`;
  const list = useLoad(
    () => (ready ? call<{ students: StudentRow[] }>(`${base}/students${query ? `?search=${encodeURIComponent(query)}` : ""}`) : Promise.resolve(null)),
    [ready, call, base, query, reloadKey],
  );
  const who = (s: StudentRow) => s.name ?? s.email ?? s.userId;
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search.trim());
        }}
        role="search"
      >
        <div className="w-72 max-w-full">
          <Field label="Find a student" hint="Name, email or user id">
            {(p) => <input {...p} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
          </Field>
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <ErrorBanner error={list.error} />
      {list.loading || !list.data ? (
        <Loading label="Loading students" />
      ) : list.data.students.length === 0 ? (
        <EmptyState title={query ? "No student matches your search" : "Nobody has attempted this exam yet"} />
      ) : (
        <ScrollArea>
          <table className="w-full text-sm">
            <caption className="sr-only">Students who attempted {exam.title}</caption>
            <thead>
              <tr className="border-b border-border [&_th]:py-2 [&_th]:pe-3 [&_th]:text-start">
                <th scope="col">Student</th>
                <th scope="col">Attempts</th>
                <th scope="col">Best score</th>
                <th scope="col">Next attempt</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.data.students.map((s) => (
                <React.Fragment key={s.userId}>
                  <tr className="border-b border-border align-top [&_td]:py-2 [&_td]:pe-3">
                    <td>
                      {s.name ?? s.email ?? <span className="font-mono text-xs">{s.userId}</span>}
                      {s.name && s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
                    </td>
                    <td>
                      {s.attemptsUsed}
                      {s.maxAttempts > 0 && ` of ${s.maxAttempts}`}
                      {(s.extraAttempts > 0 || s.voided > 0) && (
                        <div className="text-xs text-muted-foreground">
                          {s.extraAttempts > 0 && `${s.extraAttempts} extra`}
                          {s.extraAttempts > 0 && s.voided > 0 && ", "}
                          {s.voided > 0 && `${s.voided} voided`}
                        </div>
                      )}
                    </td>
                    <td>{s.bestPercentage === null ? "—" : `${s.bestPercentage}%${s.passed ? " (passed)" : ""}`}</td>
                    <td>{s.hasOpenAttempt ? "In progress" : s.nextAttemptAt ? formatDate(s.nextAttemptAt, true) : "Now"}</td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" onClick={() => setOpen(open === s.userId ? null : s.userId)} aria-expanded={open === s.userId} aria-label={`Attempts of ${who(s)}`}>
                          {open === s.userId ? "Hide attempts" : "Attempts"}
                        </Button>
                        <Button variant="secondary" onClick={() => setAction({ kind: "extra", userId: s.userId, who: who(s) })} aria-label={`Grant extra attempts to ${who(s)}`}>
                          Extra attempts
                        </Button>
                        {s.nextAttemptAt && (
                          <Button variant="secondary" onClick={() => setAction({ kind: "cooldown", userId: s.userId, who: who(s) })} aria-label={`Reset the cooldown of ${who(s)}`}>
                            Reset cooldown
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {open === s.userId && (
                    <tr className="border-b border-border">
                      <td colSpan={5} className="bg-muted/40 p-3">
                        <StudentAttempts examId={exam.id} userId={s.userId} reloadKey={reloadKey} onAction={setAction} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      {action && (
        <StudentActionDialog
          examId={exam.id}
          action={action}
          onClose={() => setAction(null)}
          onDone={(msg) => {
            setAction(null);
            setReloadKey((k) => k + 1);
            onChanged(msg);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------- activity

function describe(details: Record<string, unknown> | null) {
  if (!details) return null;
  const parts: string[] = [];
  const d = details as Record<string, unknown>;
  if (typeof d.reason === "string") parts.push(`Reason: ${d.reason}`);
  if (typeof d.number === "number") parts.push(`Question ${d.number}${typeof d.newNumber === "number" ? ` → ${d.newNumber}` : ""}`);
  if (Array.isArray(d.numbers)) parts.push(`Questions ${(d.numbers as number[]).join(", ")}`);
  if (typeof d.count === "number" && typeof d.after === "number") parts.push(`${d.count > 0 ? "+" : ""}${d.count} (now ${d.after} extra)`);
  if (typeof d.userId === "string") parts.push(`Student ${d.userId}`);
  if (d.credentialFlagged === true) parts.push("Credential flagged for review");
  if (typeof d.note === "string") parts.push(`Note: ${d.note}`);
  if (d.before && d.after && typeof d.before === "object" && typeof d.after === "object") {
    const b = d.before as Record<string, unknown>;
    const a = d.after as Record<string, unknown>;
    for (const k of Object.keys(a)) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) parts.push(`${k}: ${b[k] ?? "default"} → ${a[k] ?? "default"}`);
  }
  return parts.join(" · ");
}

function ActivityTab({ exam }: { exam: ExamDetail }) {
  const { call, ready } = useExamAdminApi();
  const audit = useLoad(() => (ready ? call<{ events: AuditEvent[] }>(`${ADMIN_BASE}/exams/${encodeURIComponent(exam.id)}/audit?take=200`) : Promise.resolve(null)), [ready, call, exam.id]);
  if (audit.error) return <ErrorBanner error={audit.error} onRetry={audit.reload} />;
  if (audit.loading || !audit.data) return <Loading label="Loading activity" />;
  if (audit.data.events.length === 0) return <EmptyState title="No changes recorded yet" />;
  return (
    <ol className="space-y-2">
      {audit.data.events.map((e) => (
        <li key={e.id} className="rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <span className="font-medium">{ACTION_LABEL[e.action] ?? e.action}</span>
            <time dateTime={e.at} className="text-muted-foreground">
              {formatDate(e.at, true)}
            </time>
          </div>
          <div className="text-xs text-muted-foreground">By {e.actorName ?? e.actorUserId ?? "unknown"}</div>
          {describe(e.details) && <div className="mt-1 wrap-break-word">{describe(e.details)}</div>}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------------------------------------------------------- page

const noSubscribe = () => () => {};
const isTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);

export default function ExamAdminDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { call, ready, access } = useExamAdminApi();
  // ?tab=questions (etc.) opens that section; the server render has no query, so it starts on Settings
  const linkedTab = useSyncExternalStore(noSubscribe, () => new URLSearchParams(window.location.search).get("tab"), () => null);
  const [chosenTab, setTab] = useState<Tab | null>(null);
  const tab: Tab = chosenTab ?? (isTab(linkedTab) ? linkedTab : "settings");
  const [message, setMessage] = useState<string | null>(null);
  const exam = useLoad(() => (ready ? call<ExamDetail>(`${ADMIN_BASE}/exams/${encodeURIComponent(id)}`) : Promise.resolve(null)), [ready, call, id]);

  if (access) return <AccessNotice problem={access} feature="exam administration" />;
  const e = exam.data;
  const changed = (msg: string) => {
    setMessage(msg);
    exam.reload();
  };

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link href="/admin/exams" className="underline">
          Exam administration
        </Link>
      </nav>
      {exam.error ? (
        <>
          <PageHeader title="Exam" />
          <ErrorBanner error={exam.error} onRetry={exam.reload} />
        </>
      ) : !e ? (
        <>
          <PageHeader title="Exam" />
          <Loading label="Loading the exam" />
        </>
      ) : (
        <>
          <PageHeader
            title={e.title}
            description={
              <span className="flex flex-wrap items-center gap-2">
                <KindBadge issuesCredential={e.policy.issuesCredential} />
                <span>{SCOPE_LABEL[e.scope] ?? e.scope}</span>
                {e.builtIn && <Badge tone="info">Built-in</Badge>}
                <span>
                  · {e.policy.questionsPerAttempt} of {e.questions.approved} questions per attempt · {e.policy.timeLimitMinutes} min · cooldown {minutesLabel(e.policy.cooldownMinutes)}
                </span>
              </span>
            }
          />
          <SuccessBanner message={message} />
          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              ["Attempts", String(e.attempts.total)],
              ["Students", String(e.attempts.students)],
              ["Pass rate", e.attempts.passRate === null ? "—" : `${e.attempts.passRate}%`],
              ["Credentials under review", String(e.credentialsUnderReview)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-card p-4">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="text-xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <Tabs label="Exam administration sections" tabs={TABS} value={tab} onChange={setTab} />
          <TabPanel id={tab}>
            {tab === "settings" && (
              <SettingsForm
                key={e.version}
                exam={e}
                onSaved={(saved, msg) => {
                  exam.setData(saved);
                  setMessage(msg);
                }}
              />
            )}
            {tab === "questions" && <QuestionsTab exam={e} onChanged={changed} />}
            {tab === "statistics" && <StatisticsTab exam={e} />}
            {tab === "students" && <StudentsTab exam={e} onChanged={changed} />}
            {tab === "activity" && <ActivityTab key={e.version + (message ?? "")} exam={e} />}
          </TabPanel>
        </>
      )}
    </div>
  );
}

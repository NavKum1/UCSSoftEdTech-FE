"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.5): the student's attempt at a class assessment. Start, hand in the work (a GitHub repository
 * whose ownership is checked, a project .zip, the coding task or the exam), then the viva by voice (OpenAI Realtime through
 * the API, which keeps the transcript) or in writing. Then it waits for the teacher, who decides. 2.12: when the assessment has a
 * change task, the student makes one small change to their own code in the workspace (timed, no AI assistant) before the viva.
 * C1 (any subject): an essay, report, lab report or presentation is handed in as a PDF, Word or PowerPoint file, or pasted in.
 * API: /api/career/class-assessments/student/assessments/{assignmentId}/attempt...
 */
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { openRealtimeCall, type RealtimeCall, type RealtimeCaption } from "@/lib/realtimeCall";
import { Badge, Button, Card, ErrorBanner, Field, Loading, buttonClass, formatDate, useLoad } from "@/components/career/ui";
import { CA_API, type StudentChange, type StudentResult } from "@/components/career/classAssessments/types";
import { PreviousFeedbackView, ResultView, type PreviousFeedback } from "@/components/career/classAssessments/StudentResult";
import { useSkipReasonText } from "@/components/career/classAssessments/evidenceText";

type Kind = "repo" | "upload" | "sprint" | "exam" | "document";

interface AttemptState {
  attempt: {
    id: string;
    status: "Started" | "Viva" | "Submitted" | "Decided";
    startedAt: string;
    submittedAt: string | null;
    late: boolean;
    work: { kind: Kind; title: string; files: number; tests?: string | null; format?: string; pages?: number; words?: number } | null;
    viva: { sessionId: string; mode: "voice" | "text"; finished: boolean; live: boolean; saving: boolean; questions: number; answered: number; turns: { role: "interviewer" | "student"; text: string }[] } | null;
  } | null;
  canStart: boolean;
  /** 2.8: the teacher's decision on this attempt, and the feedback on the one before while resubmitting */
  result: StudentResult | null;
  previous: PreviousFeedback | null;
  /** 2.12: the change task of this attempt (made after the hand-in), and whether the assessment has one */
  change: StudentChange | null;
  hasChangeTask: boolean;
  /** Stage 3: the questions after the viva (null until it's handed in) */
  feedback: { given: boolean } | null;
  submitWith: Kind[];
  task: { kind: Kind; title: string; href: string } | null;
  vivaModes: ("voice" | "text")[];
  voiceUnavailable: boolean;
}

interface RepoCheck {
  id: string;
  repository: string;
  pullRequestNumber: number | null;
  status: string;
  verificationToken: string | null;
  failureReason: string | null;
}

export function AttemptPanel({ assignmentId, onChange }: { assignmentId: string; onChange?: () => void }) {
  const en = useEn();
  const api = useApi();
  const base = `${CA_API}/student/assessments/${assignmentId}/attempt`;
  const state = useLoad(() => api<AttemptState>(base), [api, base]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fail = (e: unknown) =>
    setError(e instanceof TypeError ? en("We couldn't reach the server. Please check your connection and try again.") : (e as Error).message);

  const run = async (key: string, f: () => Promise<AttemptState>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const next = await f();
      const moved = next.attempt?.status !== state.data?.attempt?.status;
      state.setData(next);
      if (moved) onChange?.();
      return true;
    } catch (e) {
      fail(e);
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (state.loading) return <Loading />;
  if (!state.data) return <ErrorBanner error={state.error ?? en("Your attempt couldn't be loaded.")} onRetry={state.reload} />;
  const s = state.data;
  const t = s.attempt;
  // 2.12: the change task comes first, until it's done or skipped
  const changeOn = t?.status === "Viva" && !!s.change && (s.change.status === "Preparing" || s.change.status === "Ready" || s.change.status === "Started");

  return (
    <Card title={en("Your attempt")}>
      <div className="space-y-4 text-sm">
        <ErrorBanner error={error} />
        {notice && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{notice}</p>}
        <Steps status={t?.status ?? null} change={s.hasChangeTask} changeOn={changeOn} />
        {s.previous && t?.status !== "Decided" && <PreviousFeedbackView previous={s.previous} />}

        {!t && (
          s.canStart ? (
            <div className="space-y-2">
              <p>{en("Start when you're ready to hand in your work. The viva comes right after.")}</p>
              <Button busy={busy === "start"} onClick={() => void run("start", () => api<AttemptState>(base, { method: "POST" }))}>
                {en("Start")}
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground">{en("This assessment can't be started now.")}</p>
          )
        )}

        {t?.status === "Started" && (
          <HandIn
            state={s}
            base={base}
            busy={busy}
            run={run}
          />
        )}

        {t?.work && (
          <p className="rounded-lg border border-border bg-muted/40 p-3">
            <span className="font-medium">{en("Handed in:")}</span> {t.work.title}
            {t.work.files > 0 && <span className="text-muted-foreground"> · {en("{count} files", { count: t.work.files })}</span>}
            {t.work.tests && <span className="text-muted-foreground"> · {t.work.tests}</span>}
            {t.work.kind === "document" && !!t.work.pages && (
              <span className="text-muted-foreground"> · {t.work.format === "pptx" ? en("{count} slides", { count: t.work.pages }) : en("{count} pages", { count: t.work.pages })}</span>
            )}
            {t.work.kind === "document" && !!t.work.words && <span className="text-muted-foreground"> · {en("{count} words", { count: t.work.words.toLocaleString() })}</span>}
            {t.late && <> · <Badge tone="warn">{en("Late")}</Badge></>}
          </p>
        )}

        {changeOn && s.change && <ChangeStep change={s.change} assignmentId={assignmentId} base={base} busy={busy} run={run} onRefresh={state.setData} />}

        {(t?.status === "Viva" || t?.status === "Submitted") && !changeOn && s.change && <ChangeDone change={s.change} />}

        {t?.status === "Viva" && !changeOn && (
          <Viva state={s} base={base} busy={busy} setBusy={setBusy} run={run} setNotice={setNotice} setError={setError}
            onDone={(next) => {
              state.setData(next);
              if (next.attempt?.status !== "Viva") onChange?.();
            }}
          />
        )}

        {t?.status === "Submitted" && (
          <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {en("Handed in on {when}. Your teacher reviews your work and your viva, and decides.", { when: t.submittedAt ? formatDate(t.submittedAt, true) : "" })}
          </p>
        )}

        {s.feedback && (
          <FeedbackQuestions
            given={s.feedback.given}
            assignmentId={assignmentId}
            busy={busy === "feedback"}
            onSend={(answers) => run("feedback", () => api<AttemptState>(`${base}/feedback`, { method: "POST", json: answers }))}
          />
        )}

        {t?.status === "Decided" && s.result && (
          <section aria-labelledby="your-result" className="border-t border-border pt-4">
            <h3 id="your-result" className="mb-3 text-base font-semibold">
              {en("Your result")}
            </h3>
            <ResultView
              result={s.result}
              canStart={s.canStart}
              busy={busy}
              onStart={() => void run("start", () => api<AttemptState>(base, { method: "POST" }))}
              onAppeal={(reason) => run("appeal", () => api<AttemptState>(`${base}/appeal`, { method: "POST", json: { reason } }))}
            />
          </section>
        )}
      </div>
    </Card>
  );
}

/**
 * Stage 3: two questions after the viva for the school's pilot results. Anonymous: the answers aren't linked to the student,
 * and the school sees totals only. "Not now" hides them for this visit.
 */
function FeedbackQuestions({ given, assignmentId, busy, onSend }: {
  given: boolean;
  assignmentId: string;
  busy: boolean;
  onSend: (answers: { fair: number; ownWork: number; comment: string }) => Promise<boolean>;
}) {
  const en = useEn();
  const key = `ca-feedback-later:${assignmentId}`;
  const [later, setLater] = useState(() => {
    try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
  });
  const [fair, setFair] = useState<number | null>(null);
  const [ownWork, setOwnWork] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  if (given)
    return <p className="text-muted-foreground">{en("Thanks for answering the questions about this assessment.")}</p>;
  if (later) return null;
  const scale = [en("Not at all"), en("A little"), en("Partly"), en("Mostly"), en("Completely")];
  const question = (name: string, label: string, value: number | null, set: (v: number) => void) => (
    <fieldset className="space-y-2">
      <legend className="font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {scale.map((text, i) => (
          <label
            key={i}
            className={
              "cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring " +
              (value === i + 1 ? "border-[var(--brand)] bg-[var(--brand)]/10 font-medium text-foreground" : "border-border hover:bg-muted")
            }
          >
            <input type="radio" name={name} value={i + 1} checked={value === i + 1} onChange={() => set(i + 1)} className="sr-only" />
            {text}
          </label>
        ))}
      </div>
    </fieldset>
  );
  return (
    <section aria-labelledby="ca-feedback" className="space-y-3 rounded-lg border border-border p-3">
      <div>
        <h3 id="ca-feedback" className="font-semibold">{en("Two quick questions")}</h3>
        <p className="text-muted-foreground">{en("Your answers are anonymous: they aren't linked to you, and your school sees only the totals. They don't affect your result.")}</p>
      </div>
      {question("ca-fair", en("Was this assessment fair?"), fair, setFair)}
      {question("ca-own", en("Did the viva reflect your own work?"), ownWork, setOwnWork)}
      <Field label={en("Anything else? (optional)")}>
        {(p) => (
          <textarea {...p} value={comment} maxLength={1000} rows={3} onChange={(e) => setComment(e.target.value)} placeholder={en("Please don't include your name.")} />
        )}
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button busy={busy} disabled={fair == null || ownWork == null} onClick={() => void onSend({ fair: fair!, ownWork: ownWork!, comment })}>
          {en("Send answers")}
        </Button>
        <button
          type="button"
          className={buttonClass("secondary")}
          onClick={() => {
            try { sessionStorage.setItem(key, "1"); } catch { /* the page still hides them */ }
            setLater(true);
          }}
        >
          {en("Not now")}
        </button>
      </div>
    </section>
  );
}

function Steps({ status, change, changeOn }: { status: string | null; change: boolean; changeOn: boolean }) {
  const en = useEn();
  const steps = change
    ? [en("Hand in your work"), en("The change task"), en("The viva"), en("Your teacher decides")]
    : [en("Hand in your work"), en("The viva"), en("Your teacher decides")];
  const at = status == null || status === "Started" ? 0 : status === "Viva" ? (change && !changeOn ? 2 : 1) : steps.length - 1;
  return (
    <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
      {steps.map((label, i) => (
        <li key={label} className={i === at ? "font-semibold text-foreground" : i < at ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"} aria-current={i === at ? "step" : undefined}>
          {i + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

type Run = (key: string, f: () => Promise<AttemptState>) => Promise<boolean>;

function HandIn({ state, base, busy, run }: { state: AttemptState; base: string; busy: string | null; run: Run }) {
  const en = useEn();
  const api = useApi();
  const [file, setFile] = useState<File | null>(null);

  if (state.task && (state.submitWith.includes("sprint") || state.submitWith.includes("exam"))) {
    const sprint = state.task.kind === "sprint";
    return (
      <div className="space-y-3">
        <p>
          {sprint
            ? en("Do the coding task \"{title}\" and submit your solution there. Then come back and hand it in.", { title: state.task.title })
            : en("Take the exam \"{title}\". Then come back and hand it in.", { title: state.task.title })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={state.task.href} className={buttonClass("secondary")}>
            {sprint ? en("Open the coding task") : en("Open the exam")}
          </Link>
          <Button busy={busy === "attach"} onClick={() => void run("attach", () => api<AttemptState>(`${base}/${sprint ? "sprint" : "exam"}`, { method: "POST" }))}>
            {sprint ? en("Hand in my solution") : en("Hand in my exam")}
          </Button>
        </div>
      </div>
    );
  }

  if (state.submitWith.includes("document")) return <DocumentHandIn base={base} busy={busy} run={run} />;

  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await run("upload", () => api<AttemptState>(`${base}/upload`, { method: "POST", body: form }));
  };

  return (
    <div className="space-y-5">
      <RepoHandIn base={base} busy={busy} run={run} />
      <div className="space-y-2 border-t border-border pt-4">
        <p className="font-medium">{en("Or upload your project")}</p>
        <p className="text-muted-foreground">{en("A .zip of your project folder (25 MB at most). Leave out dependencies and build output such as node_modules.")}</p>
        <Field label={en("Project .zip")}>
          {(p) => <input {...p} type="file" accept=".zip,application/zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
        </Field>
        <Button variant="secondary" busy={busy === "upload"} disabled={!file} onClick={() => void upload()}>
          {en("Upload and hand in")}
        </Button>
      </div>
    </div>
  );
}

/** C1: the student's document (PDF, Word or PowerPoint), or its text pasted in */
function DocumentHandIn({ base, busy, run }: { base: string; busy: string | null; run: Run }) {
  const en = useEn();
  const api = useApi();
  const [file, setFile] = useState<File | null>(null);
  const [pasting, setPasting] = useState(false);
  const [text, setText] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  const upload = async () => {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    await run("document", () => api<AttemptState>(`${base}/document`, { method: "POST", body: form }));
  };
  const paste = () => run("paste", () => api<AttemptState>(`${base}/text`, { json: { text } }));

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground">
        {en("The viva's questions are about what's in your file, so it needs readable text: a scan or a photo of the pages can't be read.")}
      </p>
      {!pasting ? (
        <>
          <Field label={en("Your file (PDF, Word or PowerPoint, 25 MB at most)")}>
            {(p) => (
              <input
                {...p}
                type="file"
                accept=".pdf,.docx,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button busy={busy === "document"} disabled={!file} onClick={() => void upload()}>
              {en("Upload and hand in")}
            </Button>
            <button type="button" className="text-sm font-medium text-[var(--brand-text-light,var(--brand))] dark:text-[var(--brand-text-dark,var(--brand))] underline-offset-2 hover:underline" onClick={() => setPasting(true)}>
              {en("Paste the text instead")}
            </button>
          </div>
        </>
      ) : (
        <>
          <Field label={en("Your work")} hint={en("{count} words", { count: words.toLocaleString() })}>
            {(p) => <textarea {...p} rows={12} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button busy={busy === "paste"} disabled={words < 50} onClick={() => void paste()}>
              {en("Hand in this text")}
            </Button>
            <button type="button" className="text-sm font-medium text-[var(--brand-text-light,var(--brand))] dark:text-[var(--brand-text-dark,var(--brand))] underline-offset-2 hover:underline" onClick={() => setPasting(false)}>
              {en("Upload a file instead")}
            </button>
            {words > 0 && words < 50 && <span className="text-xs text-muted-foreground">{en("Paste your whole piece of work (50 words at least).")}</span>}
          </div>
        </>
      )}
    </div>
  );
}

/** A GitHub repository: the student shows it's theirs with a code in their GitHub profile (the existing ownership check) */
function RepoHandIn({ base, busy, run }: { base: string; busy: string | null; run: Run }) {
  const en = useEn();
  const api = useApi();
  const mine = useLoad(() => api<RepoCheck[]>("/api/repo-defense/mine"), [api]);
  const [login, setLogin] = useState("");
  const [repo, setRepo] = useState("");
  const [check, setCheck] = useState<RepoCheck | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = (mine.data ?? []).filter((r) => r.status === "Ready" || r.status === "Defended");

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const r = await api<{ id: string; verificationToken: string }>("/api/repo-defense", { json: { repository: repo, gitHubLogin: login } });
      setCheck({ id: r.id, repository: repo, pullRequestNumber: null, status: "PendingVerification", verificationToken: r.verificationToken, failureReason: null });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const verify = async () => {
    if (!check) return;
    setWorking(true);
    setError(null);
    try {
      const r = await api<RepoCheck>(`/api/repo-defense/${check.id}/verify`, { method: "POST" });
      setCheck(r);
      if (r.status === "Ready") mine.reload();
      else if (r.failureReason) setError(r.failureReason);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  const handIn = (id: string) => run("repo-" + id, () => api<AttemptState>(`${base}/repo`, { json: { repoDefenseId: id } }));

  return (
    <div className="space-y-3">
      <p className="font-medium">{en("Hand in a GitHub repository")}</p>
      {ready.length > 0 && (
        <ul className="space-y-2">
          {ready.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2.5">
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {r.repository}
                {r.pullRequestNumber ? ` #${r.pullRequestNumber}` : ""} <Badge tone="good">{en("Checked")}</Badge>
              </span>
              <Button busy={busy === "repo-" + r.id} onClick={() => void handIn(r.id)}>
                {en("Hand in")}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorBanner error={error} />
      {!check || check.status === "Ready" ? (
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Field label={en("Your GitHub username")}>
            {(p) => <input {...p} value={login} onChange={(e) => setLogin(e.target.value)} required autoComplete="username" />}
          </Field>
          <Field label={en("Repository")} hint={en("owner/name, or the repository or pull request link")}>
            {(p) => <input {...p} value={repo} onChange={(e) => setRepo(e.target.value)} required placeholder="octocat/term-project" />}
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary" busy={working}>
              {ready.length > 0 ? en("Check another repository") : en("Check the repository")}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-2 rounded-lg border border-border p-3">
          <p>{en("To show the repository is yours, add this code to your GitHub profile bio, or to the description of a public gist. You can remove it afterwards.")}</p>
          <p className="select-all rounded bg-muted px-2 py-1 font-mono text-sm">{check.verificationToken}</p>
          <Button busy={working} onClick={() => void verify()}>
            {en("I've added it, check now")}
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * 2.12: the change task before the viva. While it's being prepared the page checks again every few seconds; once ready, the
 * student starts the clock and only then sees the request (seen earlier, it could be worked out with no time limit); the
 * workspace opens on their own code, and they hand in what they submitted there (or the time runs out).
 */
function ChangeStep({
  change,
  assignmentId,
  base,
  busy,
  run,
  onRefresh,
}: {
  change: StudentChange;
  assignmentId: string;
  base: string;
  busy: string | null;
  run: Run;
  onRefresh: (s: AttemptState) => void;
}) {
  const en = useEn();
  const api = useApi();
  const [now, setNow] = useState(() => Date.now());
  // Bumped when a check fails, so the page keeps checking
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (change.status !== "Preparing") return;
    const timer = setTimeout(() => {
      api<AttemptState>(base)
        .then(onRefresh)
        .catch(() => setTries((n) => n + 1));
    }, 4000);
    return () => clearTimeout(timer);
  }, [change, tries, api, base, onRefresh]);

  useEffect(() => {
    if (change.status !== "Started") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [change.status]);

  if (change.status === "Preparing")
    return (
      <div className="space-y-2 rounded-lg border border-border p-3" role="status">
        <p className="flex items-center gap-2 font-medium">
          <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--brand)] motion-reduce:animate-none" aria-hidden />
          {en("Preparing your change task")}
        </p>
        <p className="text-muted-foreground">
          {en("The AI is writing a short change request from your own code, and checking it can be done. This usually takes a minute or two; this page updates by itself.")}
        </p>
      </div>
    );

  const request = (
    <div className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3">
      <p className="font-medium">{change.title}</p>
      <p className="whitespace-pre-line">{change.request}</p>
    </div>
  );

  if (change.status === "Ready")
    return (
      <div className="space-y-3">
        <p>{en("Before the viva, you make one small change to your own code. Your change task is ready. You see what to change when you start, and the clock runs from then.")}</p>
        <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
          <li>{en("You have {minutes} minutes once you start.", { minutes: change.minutes })}</li>
          <li>{en("You work in the coding workspace, on a copy of your code. The AI assistant is off.")}</li>
          <li>{en("Hidden tests check the change. Submit it in the workspace, then come back here and hand it in.")}</li>
          <li>{en("Do the change task and the viva within 48 hours of the due date. After that, your teacher's rules for late work apply.")}</li>
        </ul>
        <Button busy={busy === "change-start"} onClick={() => void run("change-start", () => api<AttemptState>(`${base}/change/start`, { method: "POST" }))}>
          {en("Start the change task ({minutes} minutes)", { minutes: change.minutes })}
        </Button>
      </div>
    );

  // Started: the clock runs
  const due = change.dueAt ? new Date(change.dueAt).getTime() : null;
  const left = due == null ? null : Math.max(0, Math.floor((due - now) / 1000));
  const over = left === 0;
  // The workspace sends the student back here once the change is submitted (assessment=)
  const href = change.sprintId
    ? `/sprint/${change.sprintId}?${new URLSearchParams({ ...(change.inviteCode ? { invite: change.inviteCode } : {}), assessment: assignmentId }).toString()}`
    : null;
  return (
    <div className="space-y-3">
      {request}
      <p className={`flex items-center gap-2 font-medium tabular-nums ${over ? "text-amber-800 dark:text-amber-300" : ""}`} role="timer" aria-live="off">
        <span className={`inline-block h-2.5 w-2.5 rounded-full ${over ? "bg-amber-500" : "bg-emerald-500"}`} aria-hidden />
        {left == null
          ? en("The clock is running.")
          : over
            ? en("Time's up. Hand in what you submitted in the workspace. A submission made in the next two minutes still counts.")
            : en("Time left: {time}", { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` })}
      </p>
      <div className="flex flex-wrap gap-2">
        {href && (
          <a href={href} target="_blank" rel="noopener" className={buttonClass("secondary")}>
            {en("Open the workspace (new tab)")}
          </a>
        )}
        <Button busy={busy === "change-hand-in"} onClick={() => void run("change-hand-in", () => api<AttemptState>(`${base}/change/hand-in`, { method: "POST" }))}>
          {en("Hand in the change")}
        </Button>
      </div>
    </div>
  );
}

/** 2.12: how the change task went (or why there was none), above the viva */
function ChangeDone({ change }: { change: StudentChange }) {
  const en = useEn();
  const skipReason = useSkipReasonText();
  if (change.status === "Skipped") return <p className="rounded-lg border border-border bg-muted/40 p-3">{skipReason(change.reason)}</p>;
  if (change.status !== "Done") return null;
  return (
    <p className="rounded-lg border border-border bg-muted/40 p-3">
      <span className="font-medium">{en("Change task:")}</span> {change.title}
      {change.submitted ? (
        change.tests && <span className="text-muted-foreground"> · {en("{passed} of {total} tests passed", { passed: change.tests.passed, total: change.tests.total })}</span>
      ) : (
        <span className="text-muted-foreground"> · {en("No change was handed in in time.")}</span>
      )}
    </p>
  );
}

function Viva({
  state,
  base,
  busy,
  setBusy,
  run,
  setNotice,
  setError,
  onDone,
}: {
  state: AttemptState;
  base: string;
  busy: string | null;
  setBusy: (b: string | null) => void;
  run: Run;
  setNotice: (m: string | null) => void;
  setError: (m: string | null) => void;
  onDone: (s: AttemptState) => void;
}) {
  const en = useEn();
  const api = useApi();
  const viva = state.attempt?.viva ?? null;
  const typed = viva?.mode === "text";
  const [answer, setAnswer] = useState("");
  const [call, setCall] = useState<"idle" | "connecting" | "live" | "ending">("idle");
  const [captions, setCaptions] = useState<RealtimeCaption[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const callRef = useRef<RealtimeCall | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const endingRef = useRef(false);

  useEffect(() => {
    if (call !== "live") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [call]);
  useEffect(() => () => callRef.current?.close(), []);

  // A call that has ended is being kept: check again until it's done
  const saving = !!viva && viva.mode === "voice" && viva.saving && call === "idle";
  useEffect(() => {
    if (!saving) return;
    const timer = setTimeout(() => {
      api<AttemptState>(base).then(onDone).catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [saving, state, api, base, onDone]);

  const finishVoice = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setCall("ending");
    callRef.current?.close();
    callRef.current = null;
    try {
      const next = await api<AttemptState>(`${base}/viva/voice/end`, { method: "POST" });
      onDone(next);
      if (next.attempt?.status === "Viva" && !next.attempt.viva)
        setNotice(en("No answers were recorded, so nothing was kept. Start the viva again, or answer in writing."));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCall("idle");
      endingRef.current = false;
    }
  };

  const startVoice = async () => {
    setError(null);
    setNotice(null);
    setCaptions([]);
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setNotice(en("Your browser didn't let us use the microphone. Allow it in the browser's settings, or answer in writing."));
      return;
    }
    setCall("connecting");
    try {
      callRef.current = await openRealtimeCall({
        mic,
        audio: audioRef.current,
        exchange: async (sdpOffer) => (await api<{ sdpAnswer: string }>(`${base}/viva/voice`, { json: { sdpOffer } })).sdpAnswer,
        onConnected: () => {
          setCall("live");
          setStartedAt(Date.now());
          setNow(Date.now());
        },
        onCaption: (c) => setCaptions((list) => [...list.slice(-30), c]),
        onEnded: () => void finishVoice(),
      });
    } catch (e) {
      callRef.current = null;
      setCall("idle");
      setError((e as Error).message);
      // A call that never connected leaves nothing to keep; the server offers writing after a voice problem
      void api<AttemptState>(`${base}`).then(onDone).catch(() => {});
    }
  };

  if (typed && viva) {
    const open = viva.turns.length > 0 && viva.turns[viva.turns.length - 1].role === "interviewer";
    return (
      <div className="space-y-3">
        <p className="font-medium">{en("The viva, in writing: question {n} of {total}", { n: Math.min(viva.answered + 1, viva.questions), total: viva.questions })}</p>
        <ol className="space-y-3">
          {viva.turns.map((x, i) => (
            <li key={i} className={x.role === "interviewer" ? "rounded-lg border border-border bg-muted/40 p-3" : "rounded-lg border border-[var(--brand)]/30 p-3"}>
              <span className="block text-xs text-muted-foreground">{x.role === "interviewer" ? en("Question") : en("Your answer")}</span>
              <span className="whitespace-pre-line">{x.text}</span>
            </li>
          ))}
        </ol>
        {open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("answer", () => api<AttemptState>(`${base}/viva/text/answer`, { json: { answer } })).then((ok) => {
                // Kept when sending failed, so nothing has to be typed again
                if (ok) setAnswer("");
              });
            }}
            className="space-y-2"
          >
            <Field label={en("Your answer")} hint={en("Explain in your own words. Spelling and grammar don't count.")}>
              {(p) => <textarea {...p} rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={4000} required />}
            </Field>
            <Button type="submit" busy={busy === "answer"} disabled={!answer.trim()}>
              {viva.answered + 1 >= viva.questions ? en("Send my last answer and hand in") : en("Send answer")}
            </Button>
          </form>
        )}
      </div>
    );
  }

  const canVoice = state.vivaModes.includes("voice");
  const canText = state.vivaModes.includes("text");
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  return (
    <div className="space-y-3">
      <audio ref={audioRef} autoPlay className="hidden" />
      {call === "idle" && viva?.mode === "voice" && (viva.saving || viva.live) ? (
        <p className="flex items-center gap-2" role="status">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
          {viva.saving
            ? en("We're saving your viva. This page updates in a moment.")
            : en("Your voice viva is on in another window or tab. End it there first.")}
        </p>
      ) : call === "idle" ? (
        <>
          <p>{en("Now explain your work. The interviewer asks about what you handed in, one question at a time.")}</p>
          {state.voiceUnavailable && <p className="text-muted-foreground">{en("Voice isn't available for this viva right now, so you answer in writing.")}</p>}
          <div className="flex flex-wrap gap-2">
            {canVoice && (
              <Button busy={busy === "voice"} onClick={() => void startVoice()}>
                {en("Start the viva by voice")}
              </Button>
            )}
            {canText && (
              <Button variant={canVoice ? "secondary" : "primary"} busy={busy === "typed"} onClick={() => void run("typed", () => api<AttemptState>(`${base}/viva/text`, { method: "POST" }))}>
                {en("Answer in writing")}
              </Button>
            )}
          </div>
          {canVoice && !canText && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2"
              onClick={() => {
                setBusy("typed");
                api<AttemptState>(`${base}/viva/text`, { method: "POST" })
                  .then(onDone)
                  .catch((e: Error) => setError(e.message))
                  .finally(() => setBusy(null));
              }}
            >
              {en("Voice didn't work? Answer in writing")}
            </button>
          )}
        </>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <p className="flex items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${call === "live" ? "bg-emerald-500" : "bg-amber-500"}`} aria-hidden />
            {call === "connecting" ? en("Connecting...") : call === "ending" ? en("Handing in...") : en("Live · {time}", { time: `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}` })}
          </p>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm" aria-live="polite">
            {captions.map((c, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{c.role === "student" ? en("You:") : en("Interviewer:")}</span> {c.text}
              </li>
            ))}
          </ul>
          <Button variant="secondary" busy={call === "ending"} disabled={call === "connecting"} onClick={() => void finishVoice()}>
            {en("End the viva and hand in")}
          </Button>
        </div>
      )}
    </div>
  );
}

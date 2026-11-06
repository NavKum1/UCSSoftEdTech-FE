"use client";

/**
 * Build & Defend 1.0 Stage 2 (2.5): the student's attempt at a class assessment. Start, hand in the work (a GitHub repository
 * whose ownership is checked, a project .zip, the coding task or the exam), then the viva by voice (OpenAI Realtime through
 * the API, which keeps the transcript) or in writing. Then it waits for the teacher, who decides.
 * API: /api/career/class-assessments/student/assessments/{assignmentId}/attempt...
 */
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { openRealtimeCall, type RealtimeCall, type RealtimeCaption } from "@/lib/realtimeCall";
import { Badge, Button, Card, ErrorBanner, Field, Loading, buttonClass, formatDate, useLoad } from "@/components/career/ui";
import { CA_API } from "@/components/career/classAssessments/types";

type Kind = "repo" | "upload" | "sprint" | "exam";

interface AttemptState {
  attempt: {
    id: string;
    status: "Started" | "Viva" | "Submitted" | "Decided";
    startedAt: string;
    submittedAt: string | null;
    late: boolean;
    work: { kind: Kind; title: string; files: number; tests?: string | null } | null;
    viva: { sessionId: string; mode: "voice" | "text"; finished: boolean; questions: number; answered: number; turns: { role: "interviewer" | "student"; text: string }[] } | null;
  } | null;
  canStart: boolean;
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
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  };

  if (state.loading) return <Loading />;
  if (!state.data) return <ErrorBanner error={state.error ?? en("Your attempt couldn't be loaded.")} onRetry={state.reload} />;
  const s = state.data;
  const t = s.attempt;

  return (
    <Card title={en("Your attempt")}>
      <div className="space-y-4 text-sm">
        <ErrorBanner error={error} />
        {notice && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{notice}</p>}
        <Steps status={t?.status ?? null} />

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
            {t.late && <> · <Badge tone="warn">{en("Late")}</Badge></>}
          </p>
        )}

        {t?.status === "Viva" && (
          <Viva state={s} base={base} busy={busy} setBusy={setBusy} run={run} setNotice={setNotice} setError={setError}
            onDone={(next) => {
              state.setData(next);
              if (next.attempt?.status !== "Viva") onChange?.();
            }}
          />
        )}

        {(t?.status === "Submitted" || t?.status === "Decided") && (
          <p className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {t.status === "Decided"
              ? en("Your teacher has decided. See your result above.")
              : en("Handed in on {when}. Your teacher reviews your work and your viva, and decides.", { when: t.submittedAt ? formatDate(t.submittedAt, true) : "" })}
          </p>
        )}
      </div>
    </Card>
  );
}

function Steps({ status }: { status: string | null }) {
  const en = useEn();
  const at = status == null || status === "Started" ? 0 : status === "Viva" ? 1 : 2;
  const steps = [en("Hand in your work"), en("The viva"), en("Your teacher decides")];
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

type Run = (key: string, f: () => Promise<AttemptState>) => Promise<void>;

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

  const finishVoice = async () => {
    if (endingRef.current) return;
    endingRef.current = true;
    setCall("ending");
    callRef.current?.close();
    callRef.current = null;
    try {
      const next = await api<AttemptState>(`${base}/viva/voice/end`, { method: "POST" });
      onDone(next);
      if (next.attempt?.status === "Viva")
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
            <li key={i} className={x.role === "interviewer" ? "rounded-lg border border-border bg-muted/40 p-3" : "rounded-lg border border-primary/30 p-3"}>
              <span className="block text-xs text-muted-foreground">{x.role === "interviewer" ? en("Question") : en("Your answer")}</span>
              <span className="whitespace-pre-line">{x.text}</span>
            </li>
          ))}
        </ol>
        {open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run("answer", () => api<AttemptState>(`${base}/viva/text/answer`, { json: { answer } })).then(() => setAnswer(""));
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
      {call === "idle" ? (
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

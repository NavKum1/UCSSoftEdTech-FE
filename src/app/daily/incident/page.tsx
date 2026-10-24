"use client";

/**
 * Daily incident drill (phase B, 24 Oct 2026). A production outage arrives without its answers (options carry opaque
 * keys); opening it starts an attempt timed on the server. The member reads the symptoms, metrics and logs, chooses the
 * root cause and the safe fix, and submits; the server grades it and only then shows which answers were right, the risk
 * of every action and the post-mortem. The first graded attempt at a drill earns points; later ones are practice.
 * ?accessCode= or ?id= opens a specific drill (e.g. a private team assessment). Members can also generate a drill for a
 * track; without the AI model it is a ready-made drill of that track, and the page says so.
 */

import React, { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Sparkles, XCircle } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

const TRACKS = [
  { id: "DevOps", label: "DevOps and SRE" },
  { id: "Backend", label: "Backend systems" },
  { id: "Frontend", label: "Frontend and web" },
  { id: "FullStack", label: "Full stack" },
  { id: "DataMLOps", label: "Data and MLOps" },
  { id: "Cybersecurity", label: "Cybersecurity" },
  { id: "Mobile", label: "Mobile" },
  { id: "CloudFinOps", label: "Cloud costs (FinOps)" },
  { id: "DatabaseRE", label: "Database reliability" },
];
const TIERS = ["Bronze", "Silver", "Gold", "Diamond"];

interface Option {
  key: string;
  label: string;
  detail: string | null;
}
interface Drill {
  id: string;
  title: string;
  track: string;
  difficultyTier: string;
  severity: string;
  category: string;
  topologyDescription: string;
  outageSymptoms: string;
  telemetryMetrics: Record<string, unknown>;
  terminalLogs: string;
  hypotheses: Option[];
  actions: Option[];
  isPrivateAssessment: boolean;
  organizationOrTeamName: string | null;
}
interface Status {
  openAttemptId: string | null;
  startedAt: string | null;
  completed: boolean;
  points: number | null;
}
interface Result {
  score: number;
  hypothesisCorrect: boolean;
  actionCorrect: boolean;
  resolved: boolean;
  timeSeconds: number;
  countsForPoints: boolean;
  points: number;
  speedBonus: number;
  feedback: string;
  hypotheses: { key: string; label: string; rationale: string; correct: boolean; chosen: boolean }[];
  actions: { key: string; label: string; command: string; risk: string; correct: boolean; chosen: boolean }[];
  postMortem: string;
}

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const primary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600";
const select = "mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm";

const metricLabel = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export default function IncidentDrillPage() {
  return (
    <Suspense fallback={null}>
      <IncidentDrill />
    </Suspense>
  );
}

function IncidentDrill() {
  const params = useSearchParams();
  const { apiFetch, ready, access } = useLegacyApi();
  const [track, setTrack] = useState("DevOps");
  const [tier, setTier] = useState("Bronze");
  const [drill, setDrill] = useState<Drill | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [attempt, setAttempt] = useState<{ id: string; startedAt: string } | null>(null);
  const [hypothesis, setHypothesis] = useState("");
  const [action, setAction] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  const show = (body: { incident: Drill; status?: Status }) => {
    setDrill(body.incident);
    setStatus(body.status ?? { openAttemptId: null, startedAt: null, completed: false, points: null });
    setAttempt(body.status?.openAttemptId && body.status.startedAt ? { id: body.status.openAttemptId, startedAt: body.status.startedAt } : null);
    setResult(null);
    setHypothesis("");
    setAction("");
    setNotes("");
  };

  const load = useCallback(
    async (t: string, d: string) => {
      setLoading(true);
      setError(null);
      try {
        const code = params.get("accessCode");
        const id = params.get("id");
        const url = code
          ? `/api/incidents/access/${encodeURIComponent(code)}`
          : id
            ? `/api/incidents/${encodeURIComponent(id)}`
            : `/api/incidents/today?track=${encodeURIComponent(t)}&difficultyTier=${encodeURIComponent(d)}`;
        const res = await apiFetch(url);
        if (res.ok) show(await res.json());
        else {
          setDrill(null);
          setError(res.status === 404 ? "No drill was found for this link or track." : "The drill couldn't be loaded. Please try again.");
        }
      } catch {
        setError("We couldn't reach the server. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    [apiFetch, params],
  );
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current("DevOps", "Bronze");
  }, [ready, loadRef]);

  useEffect(() => {
    if (!attempt || result) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [attempt, result]);

  const start = async () => {
    if (!drill) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/incidents/${drill.id}/start`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setAttempt({ id: body.attemptId, startedAt: body.startedAt });
        setResult(null);
        setHypothesis("");
        setAction("");
        setNotes("");
      } else setError(body?.error ?? "The drill couldn't be opened. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!attempt) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/incidents/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id, hypothesisKey: hypothesis, actionKey: action, notes: notes.trim() || null }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) {
        setResult(body as Result);
        setAttempt(null);
        if (body.countsForPoints) setStatus((s) => (s ? { ...s, completed: true, points: body.points } : s));
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setError(body?.error ?? "Your answer couldn't be submitted. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="The daily incident drill" />;

  const elapsed = attempt ? Math.max(0, Math.floor((now - new Date(attempt.startedAt).getTime()) / 1000)) : 0;
  const fromLink = !!(params.get("accessCode") || params.get("id"));

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <Link href="/daily" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" /> Daily practice
      </Link>

      {!fromLink && !attempt && (
        <form
          className={`${card} mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end`}
          onSubmit={(e) => {
            e.preventDefault();
            void load(track, tier);
          }}
        >
          <label className="text-sm">
            <span className="font-medium">Track</span>
            <select value={track} onChange={(e) => setTrack(e.target.value)} className={select}>
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Difficulty</span>
            <select value={tier} onChange={(e) => setTier(e.target.value)} className={select}>
              {TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
            Show today&apos;s drill
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm">
          {error}
        </p>
      )}
      {notice && <p className="mt-4 rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm">{notice}</p>}

      {loading ? (
        <div className={`${card} mt-6 h-64 animate-pulse motion-reduce:animate-none`} aria-busy="true" aria-label="Loading the drill" />
      ) : drill && status ? (
        <>
          <header className="mt-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {drill.severity} · {TRACKS.find((t) => t.id === drill.track)?.label ?? drill.track} · {drill.difficultyTier}
                {drill.isPrivateAssessment && drill.organizationOrTeamName ? ` · ${drill.organizationOrTeamName} assessment` : ""}
              </p>
              <h1 className="mt-1 text-xl font-semibold">{drill.title}</h1>
            </div>
            {attempt && (
              <p className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-sm tabular-nums">
                <Clock aria-hidden="true" className="h-4 w-4" /> {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}
              </p>
            )}
          </header>

          {status.completed && !result && (
            <p className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
              You completed this drill and earned {status.points ?? 0} points. You can practise it again; repeats don&apos;t earn points.
            </p>
          )}

          {result ? (
            <IncidentResultView result={result} onAgain={() => void start()} busy={busy} />
          ) : !attempt ? (
            <section className={`${card} mt-6 p-6`}>
              <h2 className="text-base font-semibold">How it works</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Read the symptoms, metrics and logs of the outage.</li>
                <li>Choose the root cause (50 points) and the safe fix (50 points).</li>
                <li>Both right within 5 minutes: 20 bonus points. The time is measured from when you open the drill.</li>
              </ul>
              <button type="button" className={`${primary} mt-5`} disabled={busy} onClick={() => void start()}>
                {status.completed ? "Practise again" : "Open the drill"}
              </button>
            </section>
          ) : (
            <div className="mt-6 grid gap-6 lg:grid-cols-5">
              <div className="space-y-4 lg:col-span-3">
                <section className={`${card} p-5`}>
                  <h2 className="text-sm font-semibold">Symptoms</h2>
                  <p className="mt-1 text-sm">{drill.outageSymptoms}</p>
                  <h2 className="mt-4 text-sm font-semibold">System</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{drill.topologyDescription}</p>
                </section>
                {Object.keys(drill.telemetryMetrics ?? {}).length > 0 && (
                  <section className={`${card} p-5`}>
                    <h2 className="text-sm font-semibold">Metrics</h2>
                    <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {Object.entries(drill.telemetryMetrics).map(([k, v]) => (
                        <div key={k} className="rounded-lg bg-muted/60 p-2.5">
                          <dt className="text-xs text-muted-foreground">{metricLabel(k)}</dt>
                          <dd className="font-mono text-sm font-semibold">{typeof v === "number" ? v.toLocaleString() : String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
                <section className={`${card} overflow-hidden`}>
                  <h2 className="border-b border-border px-5 py-2 text-sm font-semibold">Logs</h2>
                  <pre className="max-h-96 overflow-auto bg-neutral-950 p-4 text-xs leading-5 text-neutral-100">{drill.terminalLogs}</pre>
                </section>
              </div>

              <form
                className={`${card} space-y-5 p-5 lg:col-span-2`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <fieldset>
                  <legend className="text-sm font-semibold">Root cause</legend>
                  <div className="mt-2 space-y-2">
                    {drill.hypotheses.map((h) => (
                      <label key={h.key} className={`flex cursor-pointer gap-2.5 rounded-xl border p-3 text-sm ${hypothesis === h.key ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : "border-border"}`}>
                        <input type="radio" name="hypothesis" required value={h.key} checked={hypothesis === h.key} onChange={() => setHypothesis(h.key)} className="mt-0.5 accent-amber-600" />
                        {h.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="text-sm font-semibold">What do you do now?</legend>
                  <div className="mt-2 space-y-2">
                    {drill.actions.map((a) => (
                      <label key={a.key} className={`flex cursor-pointer gap-2.5 rounded-xl border p-3 text-sm ${action === a.key ? "border-amber-500 bg-amber-50 dark:bg-amber-500/10" : "border-border"}`}>
                        <input type="radio" name="action" required value={a.key} checked={action === a.key} onChange={() => setAction(a.key)} className="mt-0.5 accent-amber-600" />
                        <span>
                          <span className="block">{a.label}</span>
                          {a.detail && <code className="mt-1 block break-all text-xs text-muted-foreground">{a.detail}</code>}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-sm">
                  <span className="font-medium">Your notes (optional)</span>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} className={select} />
                </label>
                <button type="submit" className={`${primary} w-full`} disabled={busy || !hypothesis || !action}>
                  {busy ? "Submitting…" : "Submit"}
                </button>
              </form>
            </div>
          )}
        </>
      ) : null}

      {!attempt && <GenerateDrill apiFetch={apiFetch} onGenerated={(body, message) => { show(body); setNotice(message); }} />}
    </main>
  );
}

function IncidentResultView({ result, onAgain, busy }: { result: Result; onAgain: () => void; busy: boolean }) {
  return (
    <div className="mt-6 space-y-4" aria-live="polite">
      <section className={`${card} p-6`}>
        <p className="text-3xl font-semibold tabular-nums">{result.score} / 100</p>
        <p className="text-sm text-muted-foreground">
          {result.countsForPoints ? `${result.points} points${result.speedBonus ? `, including a ${result.speedBonus}-point speed bonus` : ""}.` : "Practice: no points for a repeat."} Time:{" "}
          {Math.floor(result.timeSeconds / 60)}m {result.timeSeconds % 60}s.
        </p>
        <p className="mt-3 text-sm">{result.feedback}</p>
        <button type="button" className="mt-4 text-sm font-semibold text-amber-700 hover:underline disabled:opacity-50 dark:text-amber-400" disabled={busy} onClick={onAgain}>
          Practise again (no points)
        </button>
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-semibold">Root cause</h2>
          <ul className="mt-2 space-y-3">
            {result.hypotheses.map((h) => (
              <li key={h.key} className="flex gap-2 text-sm">
                {h.correct ? <CheckCircle2 aria-label="The root cause" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle aria-label="Not the root cause" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <span>
                  <span className={`block ${h.correct ? "font-semibold" : ""}`}>
                    {h.label}
                    {h.chosen && <span className="ml-1 text-xs font-normal text-muted-foreground">(your answer)</span>}
                  </span>
                  {h.rationale && <span className="mt-0.5 block text-xs text-muted-foreground">{h.rationale}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-semibold">Actions and their risk</h2>
          <ul className="mt-2 space-y-3">
            {result.actions.map((a) => (
              <li key={a.key} className="flex gap-2 text-sm">
                {a.correct ? <CheckCircle2 aria-label="The safe fix" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle aria-label="Not the safe fix" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <span>
                  <span className={`block ${a.correct ? "font-semibold" : ""}`}>
                    {a.label}
                    {a.chosen && <span className="ml-1 text-xs font-normal text-muted-foreground">(your answer)</span>}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Risk: {a.risk}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      {result.postMortem && (
        <section className={`${card} p-5`}>
          <h2 className="text-sm font-semibold">Post-mortem</h2>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{result.postMortem}</p>
        </section>
      )}
    </div>
  );
}

function GenerateDrill({
  apiFetch,
  onGenerated,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  onGenerated: (body: { incident: Drill }, message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState("Backend");
  const [tier, setTier] = useState("Silver");
  const [stack, setStack] = useState("");
  const [failure, setFailure] = useState("");
  const [team, setTeam] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [share, setShare] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setShare(null);
    try {
      const res = await apiFetch("/api/incidents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          track,
          difficultyTier: tier,
          customTechStack: stack.trim() || undefined,
          failureMode: failure.trim() || undefined,
          isPrivateAssessment: isPrivate,
          organizationOrTeamName: isPrivate ? team.trim() || undefined : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "The drill couldn't be generated. Please try again later.");
        return;
      }
      if (body.accessCode) setShare(`${window.location.origin}/daily/incident?accessCode=${encodeURIComponent(body.accessCode)}`);
      onGenerated(
        body,
        body.generatedBy === "ai"
          ? "A new drill was written for you."
          : "The AI model isn't available right now, so this is a ready-made drill for the track (your stack and failure mode weren't used).",
      );
      setOpen(false);
    } catch {
      setError("We couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`${card} mt-8 p-5`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles aria-hidden="true" className="h-4 w-4 text-amber-500" /> Generate a drill for your own stack
      </button>
      {share && (
        <p className="mt-3 text-sm">
          Share this link with your team: <code className="break-all text-xs">{share}</code>
        </p>
      )}
      {open && (
        <form onSubmit={generate} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="font-medium">Track</span>
            <select value={track} onChange={(e) => setTrack(e.target.value)} className={select}>
              {TRACKS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Difficulty</span>
            <select value={tier} onChange={(e) => setTier(e.target.value)} className={select}>
              {TIERS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="font-medium">Your stack (optional)</span>
            <input value={stack} onChange={(e) => setStack(e.target.value)} maxLength={300} placeholder="e.g. Go services on Kubernetes with PostgreSQL" className={select} />
          </label>
          <label className="text-sm">
            <span className="font-medium">Kind of failure (optional)</span>
            <input value={failure} onChange={(e) => setFailure(e.target.value)} maxLength={300} placeholder="e.g. connection pool exhaustion" className={select} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} className="accent-amber-600" />
            Private drill for my team (shared by link, not shown to others)
          </label>
          {isPrivate && (
            <label className="text-sm sm:col-span-2">
              <span className="font-medium">Team name</span>
              <input value={team} onChange={(e) => setTeam(e.target.value)} maxLength={120} className={select} />
            </label>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400 sm:col-span-2">
              {error}
            </p>
          )}
          <div className="sm:col-span-2">
            <button type="submit" className={primary} disabled={busy}>
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

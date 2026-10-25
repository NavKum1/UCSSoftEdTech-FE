"use client";

/**
 * Practice scenarios (phase E, 24 Oct 2026): leadership conversations, the promotion case and failover incident command.
 * At each turn the member picks a response; the server scores it on the track's dimensions and reveals the feedback and
 * the strongest response. Simulated roles only; the result is practice, not an assessment of readiness for any level.
 */

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Dimension {
  key: string;
  label: string;
  description: string;
}
interface ScenarioSummary {
  code: string;
  track: string;
  title: string;
  context: string;
  turns: number;
}
interface Catalogue {
  tracks: { key: string; label: string; dimensions: Dimension[] }[];
  scenarios: ScenarioSummary[];
  note: string;
}
interface Revealed {
  turn: number;
  speaker: string;
  message: string;
  chosen: { text: string; feedback: string };
  strongest: { text: string; feedback: string };
  chosenStrongest: boolean;
}
interface Attempt {
  id: string;
  scenario: ScenarioSummary & { label: string };
  dimensions: Dimension[];
  answered: Revealed[];
  justAnswered: Revealed | null;
  current: { turn: number; speaker: string; message: string; options: { key: string; text: string }[] } | null;
  result: { overall: number; scores: Record<string, number> } | null;
  note: string;
}
interface HistoryRow {
  id: string;
  title: string;
  overall: number;
  completedAt: string;
}

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const button = "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60";

function RevealedTurn({ r }: { r: Revealed }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="flex items-start gap-2">
        {r.chosenStrongest ? (
          <Check aria-label="Strongest response" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <X aria-label="Not the strongest response" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        )}
        <span>
          <span className="font-medium">You said:</span> {r.chosen.text}
          <span className="mt-1 block text-muted-foreground">{r.chosen.feedback}</span>
        </span>
      </p>
      {!r.chosenStrongest && (
        <p className="rounded-xl bg-muted/60 p-3">
          <span className="font-medium">Strongest response:</span> {r.strongest.text}
          <span className="mt-1 block text-muted-foreground">{r.strongest.feedback}</span>
        </p>
      )}
    </div>
  );
}

export default function ScenarioPractice({ track, title, intro }: { track: string; title: string; intro: string }) {
  const { apiFetch, ready, access } = useLegacyApi();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    const h = await apiFetch(`/api/practice/scenarios/attempts?track=${track}`, {}, { quiet: true });
    if (h.ok) setHistory((await h.json()) as HistoryRow[]);
  }, [apiFetch, track]);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/practice/scenarios?track=${track}`);
      if (!res.ok) return setFailed(true);
      setCatalogue((await res.json()) as Catalogue);
      await loadHistory();
    } catch {
      setFailed(true);
    }
  }, [apiFetch, track, loadHistory]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const post = async (path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "That didn't go through. Please try again.");
      setAttempt(data as Attempt);
      if ((data as Attempt).result) await loadHistory();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature={title} />;
  if (failed)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-xl font-semibold">We couldn&apos;t load the scenarios</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh the page to try again.</p>
      </main>
    );
  if (!catalogue)
    return (
      <main className="mx-auto max-w-4xl px-4 py-10" aria-busy="true" aria-label="Loading scenarios">
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const dims = catalogue.tracks.find((t) => t.key === track)?.dimensions ?? [];

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Practice scenario</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {intro} {catalogue.note}
        </p>
      </header>
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {!attempt && (
        <section className="grid gap-4 sm:grid-cols-2" aria-label="Scenarios">
          {catalogue.scenarios.map((s) => (
            <div key={s.code} className={`${card} flex flex-col p-5`}>
              <h2 className="text-base font-semibold">{s.title}</h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{s.context}</p>
              <button className={`${button} mt-4 self-start`} disabled={busy} onClick={() => void post(`/api/practice/scenarios/${s.code}/start`)}>
                Start ({s.turns} turns)
              </button>
            </div>
          ))}
        </section>
      )}

      {attempt && (
        <section className={`${card} space-y-5 p-5`} aria-labelledby="sc-title">
          <div>
            <h2 id="sc-title" className="text-base font-semibold">
              {attempt.scenario.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{attempt.scenario.context}</p>
          </div>

          {attempt.answered.map((r) => (
            <div key={r.turn} className="space-y-2 border-t border-border pt-4">
              <p className="text-sm">
                <span className="font-medium">{r.speaker}:</span> {r.message}
              </p>
              <RevealedTurn r={r} />
            </div>
          ))}

          {attempt.current && (
            <fieldset className="space-y-3 border-t border-border pt-4" aria-live="polite">
              <legend className="text-sm">
                <span className="font-medium">{attempt.current.speaker}:</span> {attempt.current.message}
              </legend>
              <p className="text-xs text-muted-foreground">
                Turn {attempt.current.turn + 1} of {attempt.scenario.turns}. Choose your response.
              </p>
              <ul className="space-y-2">
                {attempt.current.options.map((o) => (
                  <li key={o.key}>
                    <button
                      className="w-full rounded-xl border border-border p-3 text-left text-sm hover:border-indigo-400 hover:bg-muted/40 disabled:opacity-60"
                      disabled={busy}
                      onClick={() => void post(`/api/practice/scenarios/attempts/${attempt.id}/answer`, { key: o.key })}
                    >
                      {o.text}
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {attempt.result && (
            <div className="space-y-3 border-t border-border pt-4" aria-live="polite">
              <h3 className="text-base font-semibold">Your result: {Math.round(attempt.result.overall)}%</h3>
              <dl className="grid gap-3 sm:grid-cols-2">
                {dims.map((d) => (
                  <div key={d.key} className="rounded-xl bg-muted/60 p-3">
                    <dt className="text-sm font-medium">
                      {d.label}: {Math.round(attempt.result!.scores[d.key] ?? 0)}%
                    </dt>
                    <dd className="mt-1 text-xs text-muted-foreground">{d.description}</dd>
                  </div>
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <button className={button} disabled={busy} onClick={() => void post(`/api/practice/scenarios/${attempt.scenario.code}/start`)}>
                  <RotateCcw aria-hidden="true" className="h-4 w-4" /> Try again
                </button>
                <button className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted" onClick={() => setAttempt(null)}>
                  Other scenarios
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className={`${card} p-5`} aria-labelledby="sc-history">
          <h2 id="sc-history" className="text-base font-semibold">
            Your past attempts
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex justify-between gap-3 border-t border-border pt-1">
                <span>{h.title}</span>
                <span className="tabular-nums text-muted-foreground">
                  {Math.round(h.overall)}% · {new Date(h.completedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

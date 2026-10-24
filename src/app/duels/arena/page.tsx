"use client";

/**
 * System design duels (phase E, 24 Oct 2026, owner decision 2). The member builds a topology for a practice scenario
 * (components with replicas and regions, and the connections between them) against a clearly labelled practice bot. The
 * server grades it against the scenario's rubric and explains every check; the result moves the member's Elo rating.
 * The leaderboard shows real members' ratings; bots are listed separately with their fixed ratings.
 * (This page used to pit everyone against an invented "principal architect" with fixed scores and invented players.)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Plus, Swords, Trash2, Trophy, X } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Scenario {
  code: string;
  title: string;
  problem: string;
  targets: string;
  chaosEvent: string;
  durationSeconds: number;
  required: string[];
  stateful: string[];
  minReplicas: number;
  multiRegion: boolean;
}
interface Component {
  type: string;
  label: string;
  group: string;
  description: string;
}
interface Bot {
  level: string;
  name: string;
  rating: number;
  score: number;
}
interface Catalogue {
  scenarios: Scenario[];
  components: Component[];
  bots: Bot[];
  scoring: string;
  note: string;
}
interface Match {
  id: string;
  scenario: Scenario;
  bot: { name: string; rating: number };
  status: string;
  startedAt: string;
  deadline: string;
  ratingAtStart: number;
}
interface CheckRow {
  area: string;
  passed: boolean;
  text: string;
}
interface Result {
  verdict: string;
  late: boolean;
  reason: string;
  grade: { coverage: number; resilience: number; flow: number; economy: number; overall: number; checks: CheckRow[] };
  bot: { name: string; rating: number; score: number };
  rating: { before: number; delta: number; after: number; provisional: boolean };
}
interface Row {
  rank: number;
  name: string;
  rating: number;
  provisional: boolean;
  duels: number;
  wins: number;
  draws: number;
  losses: number;
  isYou: boolean;
}
interface Board {
  entries: Row[];
  you: Row | null;
  youAreVisible: boolean;
  players: number;
  bots: { name: string; rating: number; score: number }[];
  note: string;
}
interface Node {
  id: string;
  type: string;
  replicas: number;
  regions: string[];
}
interface Edge {
  from: string;
  to: string;
}

const REGIONS = ["region-a", "region-b", "region-c"];
const AREA: Record<string, string> = { components: "Components", resilience: "Handling the chaos event", flow: "Flows", economy: "Economy" };
const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const button = "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60";
const ghost = "inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60";
const input = "rounded-lg border border-border bg-background px-2 py-1 text-sm";

export default function DuelArenaPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const [scenario, setScenario] = useState("");
  const [bot, setBot] = useState("mid");
  const [match, setMatch] = useState<Match | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seq = useRef(0);

  const load = useCallback(async () => {
    try {
      const [c, b] = await Promise.all([apiFetch("/api/duels/presets"), apiFetch("/api/duels/leaderboard")]);
      if (!c.ok) return setFailed(true);
      const cat = (await c.json()) as Catalogue;
      setCatalogue(cat);
      setScenario((s) => s || cat.scenarios[0]?.code || "");
      if (b.ok) setBoard((await b.json()) as Board);
    } catch {
      setFailed(true);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  useEffect(() => {
    if (!match || result) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [match, result]);

  const label = useMemo(() => Object.fromEntries((catalogue?.components ?? []).map((c) => [c.type, c.label])), [catalogue]);
  const groups = useMemo(() => {
    const g: Record<string, Component[]> = {};
    for (const c of catalogue?.components ?? []) (g[c.group] ??= []).push(c);
    return g;
  }, [catalogue]);

  const start = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await apiFetch("/api/duels/matchmake", { method: "POST", body: JSON.stringify({ scenarioCode: scenario, bot }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error);
      setMatch(body as Match);
      setNodes([]);
      setEdges([]);
      setNow(Date.now());
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't start the duel.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!match) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/duels/submit", { method: "POST", body: JSON.stringify({ matchId: match.id, topology: { nodes, edges } }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error);
      setResult(body as Result);
      const b = await apiFetch("/api/duels/leaderboard");
      if (b.ok) setBoard((await b.json()) as Board);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't submit your design.");
    } finally {
      setBusy(false);
    }
  };

  const addNode = (type: string) => {
    seq.current += 1;
    setNodes([...nodes, { id: `${type}-${seq.current}`, type, replicas: 1, regions: ["region-a"] }]);
  };
  const nodeName = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    if (!n) return id;
    const same = nodes.filter((x) => x.type === n.type);
    return same.length > 1 ? `${label[n.type]} ${same.indexOf(n) + 1}` : label[n.type];
  };

  if (access) return <AccessNotice problem={access} feature="System design duels" />;
  if (failed)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-xl font-semibold">We couldn&apos;t load duels</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh the page to try again.</p>
      </main>
    );
  if (!catalogue)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-label="Loading duels">
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const remaining = match ? Math.max(0, Math.floor((new Date(match.deadline).getTime() - now) / 1000)) : 0;
  const sc = match?.scenario ?? catalogue.scenarios.find((s) => s.code === scenario);

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">System design duels</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Build a design for a practice scenario before the time runs out, then see how it scores against a practice bot. {catalogue.note}
        </p>
      </header>

      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

      {!match || result ? (
        <section className={`${card} space-y-4 p-5`} aria-labelledby="duel-start">
          <h2 id="duel-start" className="flex items-center gap-2 text-base font-semibold">
            <Swords aria-hidden="true" className="h-4 w-4 text-indigo-600" /> Start a duel
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium">Scenario</span>
              <select className={`${input} mt-1 w-full py-2`} value={scenario} onChange={(e) => setScenario(e.target.value)}>
                {catalogue.scenarios.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Opponent</span>
              <select className={`${input} mt-1 w-full py-2`} value={bot} onChange={(e) => setBot(e.target.value)}>
                {catalogue.bots.map((b) => (
                  <option key={b.level} value={b.level}>
                    {b.name}: rating {b.rating}, scores {b.score}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {sc && (
            <div className="text-sm">
              <p>{sc.problem}</p>
              <p className="mt-1 text-muted-foreground">Goals: {sc.targets}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{catalogue.scoring}</p>
          <button className={button} disabled={busy || !scenario} onClick={() => void start()}>
            Start ({Math.round((sc?.durationSeconds ?? 300) / 60)} minutes)
          </button>
        </section>
      ) : null}

      {match && !result && (
        <section className={`${card} space-y-5 p-5`} aria-labelledby="duel-build">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="duel-build" className="text-base font-semibold">
              {match.scenario.title} <span className="text-sm font-normal text-muted-foreground">vs {match.bot.name}</span>
            </h2>
            <span role="timer" aria-live="off" className={`tabular-nums text-sm font-semibold ${remaining < 60 ? "text-red-700 dark:text-red-400" : ""}`}>
              {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} left
            </span>
          </div>
          <div className="space-y-1 text-sm">
            <p>{match.scenario.problem}</p>
            <p className="font-medium text-amber-800 dark:text-amber-300">Chaos event: {match.scenario.chaosEvent}</p>
            <p className="text-muted-foreground">It needs at least: {match.scenario.required.map((t) => label[t] ?? t).join(", ")}.</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold">Components</h3>
              <div className="mt-2 space-y-3">
                {Object.entries(groups).map(([g, list]) => (
                  <div key={g}>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{g}</p>
                    <ul className="mt-1 space-y-1">
                      {list.map((c) => (
                        <li key={c.type}>
                          <button className={`${ghost} w-full justify-between`} onClick={() => addNode(c.type)} title={c.description}>
                            {c.label} <Plus aria-hidden="true" className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Your design ({nodes.length})</h3>
              {nodes.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Add components from the list.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {nodes.map((n) => (
                    <li key={n.id} className="rounded-lg border border-border p-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{nodeName(n.id)}</span>
                        <button
                          className={ghost}
                          aria-label={`Remove ${nodeName(n.id)}`}
                          onClick={() => {
                            setNodes(nodes.filter((x) => x.id !== n.id));
                            setEdges(edges.filter((e) => e.from !== n.id && e.to !== n.id));
                          }}
                        >
                          <Trash2 aria-hidden="true" className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <label className="flex items-center gap-1">
                          Replicas
                          <input
                            className={`${input} w-14`}
                            type="number"
                            min={1}
                            max={20}
                            value={n.replicas}
                            onChange={(e) => setNodes(nodes.map((x) => (x.id === n.id ? { ...x, replicas: Math.max(1, Math.min(20, Number(e.target.value) || 1)) } : x)))}
                          />
                        </label>
                        {REGIONS.map((r) => (
                          <label key={r} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={n.regions.includes(r)}
                              onChange={(e) =>
                                setNodes(nodes.map((x) => (x.id === n.id ? { ...x, regions: e.target.checked ? [...x.regions, r] : x.regions.filter((y) => y !== r) } : x)))
                              }
                            />
                            {r}
                          </label>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold">Connections ({edges.length})</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <select className={input} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From">
                  <option value="">From…</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {nodeName(n.id)}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">→</span>
                <select className={input} value={to} onChange={(e) => setTo(e.target.value)} aria-label="To">
                  <option value="">To…</option>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {nodeName(n.id)}
                    </option>
                  ))}
                </select>
                <button
                  className={ghost}
                  disabled={!from || !to || from === to || edges.some((e) => e.from === from && e.to === to)}
                  onClick={() => setEdges([...edges, { from, to }])}
                >
                  <Plus aria-hidden="true" className="h-3 w-3" /> Connect
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm">
                {edges.map((e, i) => (
                  <li key={`${e.from}-${e.to}`} className="flex items-center justify-between gap-2">
                    <span>
                      {nodeName(e.from)} → {nodeName(e.to)}
                    </span>
                    <button className={ghost} aria-label="Remove connection" onClick={() => setEdges(edges.filter((_, j) => j !== i))}>
                      <X aria-hidden="true" className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <button className={button} disabled={busy || nodes.length === 0} onClick={() => void submit()}>
            Submit design
          </button>
        </section>
      )}

      {result && (
        <section className={`${card} space-y-4 p-5`} aria-labelledby="duel-result" aria-live="polite">
          <h2 id="duel-result" className="flex items-center gap-2 text-base font-semibold">
            <Trophy aria-hidden="true" className="h-4 w-4 text-indigo-600" /> {result.verdict}
          </h2>
          <p className="text-sm">{result.reason}</p>
          <dl className="grid grid-cols-2 gap-3 text-center sm:grid-cols-5">
            {[
              ["Overall", result.grade.overall],
              ["Components", result.grade.coverage],
              ["Chaos event", result.grade.resilience],
              ["Flows", result.grade.flow],
              ["Economy", result.grade.economy],
            ].map(([k, v]) => (
              <div key={k as string} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-1 font-semibold tabular-nums">{Math.round(v as number)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-sm">
            Rating: {result.rating.before} → <span className="font-semibold">{result.rating.after}</span> ({result.rating.delta >= 0 ? "+" : ""}
            {result.rating.delta}){result.rating.provisional ? ", provisional" : ""}
          </p>
          {Object.entries(AREA).map(([area, title]) => {
            const rows = result.grade.checks.filter((c) => c.area === area);
            if (rows.length === 0) return null;
            return (
              <div key={area}>
                <h3 className="text-sm font-semibold">{title}</h3>
                <ul className="mt-1 space-y-1 text-sm">
                  {rows.map((c) => (
                    <li key={c.text} className="flex items-start gap-2">
                      {c.passed ? (
                        <Check aria-label="Passed" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <X aria-label="Not met" className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      )}
                      {c.text}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {board && (
        <section className={`${card} overflow-x-auto p-5`} aria-labelledby="duel-board">
          <h2 id="duel-board" className="text-base font-semibold">
            Ratings
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{board.note}</p>
          {board.you && (
            <p className="mt-2 text-sm">
              You: rank {board.you.rank} of {board.players}, rating {board.you.rating}
              {board.you.provisional ? " (provisional)" : ""}
              {!board.youAreVisible && ". You're hidden from the public list (leaderboard privacy setting)"}.
            </p>
          )}
          {board.entries.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No rated members yet.</p>
          ) : (
            <table className="mt-3 w-full min-w-140 text-left text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-medium">Rank</th>
                  <th className="py-2 pr-3 font-medium">Member</th>
                  <th className="py-2 pr-3 font-medium">Rating</th>
                  <th className="py-2 font-medium">Won / drawn / lost</th>
                </tr>
              </thead>
              <tbody>
                {board.entries.map((r) => (
                  <tr key={`${r.rank}-${r.name}-${r.rating}`} className={`border-t border-border ${r.isYou ? "font-semibold" : ""}`}>
                    <td className="py-2 pr-3 tabular-nums">{r.rank}</td>
                    <td className="py-2 pr-3">{r.name}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {r.rating}
                      {r.provisional ? <span className="ml-1 text-xs font-normal text-muted-foreground">provisional</span> : null}
                    </td>
                    <td className="py-2 tabular-nums">
                      {r.wins} / {r.draws} / {r.losses}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Practice bots (fixed): {board.bots.map((b) => `${b.name}, rating ${b.rating}, scores ${b.score}`).join("; ")}.
          </p>
        </section>
      )}
    </main>
  );
}

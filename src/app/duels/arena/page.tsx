"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";

interface ArchitecturalPreset {
  id: string;
  presetCode: string;
  title: string;
  problemStatement: string;
  targetMetrics: string;
  duelDurationSeconds: number;
  injectedChaosEvent: string;
  requiredComponents: string[];
}

interface DuelMatch {
  id: string;
  player1UserId: string;
  player1Name: string;
  player1Elo: number;
  player2UserId: string;
  player2Name: string;
  player2Elo: number;
  presetId: string;
  preset?: ArchitecturalPreset;
  status: string;
  startedAt: string;
}

interface DuelSubmissionResult {
  submissionId: string;
  matchId: string;
  throughputScore: number;
  resilienceScore: number;
  latencyScore: number;
  costEfficiencyScore: number;
  overallScore: number;
  chaosConstraintHandled: boolean;
  eloDelta: number;
  newElo: number;
  matchVerdict: string;
  evaluationFeedback: string;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  playerName: string;
  currentElo: number;
  leagueTier: string;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  currentWinStreak: number;
  winRate: number;
}

interface TopologyNode {
  id: string;
  name: string;
  type: string;
  tier: string;
}

export default function SpeedArchitectArenaPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [presets, setPresets] = useState<ArchitecturalPreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState<ArchitecturalPreset | null>(null);
  const [currentMatch, setCurrentMatch] = useState<DuelMatch | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [placedNodes, setPlacedNodes] = useState<TopologyNode[]>([]);
  const [chaosHandled, setChaosHandled] = useState<boolean>(true);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(294);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [duelResult, setDuelResult] = useState<DuelSubmissionResult | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  const defaultUserId = "6d940ce2-2fc7-4525-9aff-af62f1956550";

  useEffect(() => {
    if (!ready) return;
    initializeArena();
  }, [ready]);

  // Timer countdown simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function initializeArena() {
    try {
      await apiFetch(`/api/duels/seed`, { method: "POST" });
      const [presetsRes, lbRes] = await Promise.all([
        apiFetch(`/api/duels/presets`),
        apiFetch(`/api/duels/leaderboard`)
      ]);

      if (presetsRes.ok) {
        const presetsData: ArchitecturalPreset[] = await presetsRes.json();
        setPresets(presetsData);
        if (presetsData.length > 0) {
          setSelectedPreset(presetsData[0]);
          setDefaultNodes(presetsData[0]);
          // Initialize active match on load
          startMatchmake(presetsData[0].presetCode);
        }
      }

      if (lbRes.ok) {
        const lbData: LeaderboardEntry[] = await lbRes.json();
        setLeaderboard(lbData);
      }
    } catch (err) {
      console.error("Arena initialization failed", err);
    }
  }

  function setDefaultNodes(preset: ArchitecturalPreset) {
    const defaultNodes: TopologyNode[] = [
      { id: "node-1", name: "Global Anycast Gateway", type: "API_Gateway", tier: "Ingress" },
      { id: "node-2", name: "Multi-Region Redis Shards", type: "Distributed_Cache_Redis", tier: "Memory" },
      { id: "node-3", name: "Transactional WAL Buffer", type: "Transactional_Outbox_WAL", tier: "Streaming" },
      { id: "node-4", name: "Raft Quorum (3/5 Nodes)", type: "Raft_Consensus_Cluster", tier: "Consensus" },
      { id: "node-5", name: "Spanner Active-Active DB", type: "Distributed_SQL_Spanner", tier: "Storage" }
    ];
    setPlacedNodes(defaultNodes);
  }

  async function startMatchmake(presetCode?: string) {
    setIsMatching(true);
    setDuelResult(null);
    setNotification(null);
    try {
      const payload = {
        userId: defaultUserId,
        playerName: "Alex Chen",
        preferredPresetCode: presetCode || selectedPreset?.presetCode,
        matchWithAiOpponent: true
      };
      const res = await apiFetch(`/api/duels/matchmake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const matchData: DuelMatch = await res.json();
        setCurrentMatch(matchData);
        setSecondsRemaining(300);
        setNotification(`Matched against ${matchData.player2Name} (${matchData.player2Elo} Elo)! 5-minute timer started.`);
      }
    } catch (err) {
      console.error("Matchmaking error", err);
    } finally {
      setIsMatching(false);
    }
  }

  async function handleDeployTopology() {
    if (!currentMatch) {
      await startMatchmake();
      return;
    }

    setIsDeploying(true);
    setNotification(null);
    try {
      const payload = {
        matchId: currentMatch.id,
        userId: defaultUserId,
        topologyGraph_JSON: JSON.stringify({ nodes: placedNodes }),
        addressedChaosConstraint: chaosHandled
      };
      const res = await apiFetch(`/api/duels/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result: DuelSubmissionResult = await res.json();
        setDuelResult(result);
        
        // Refresh leaderboard
        const lbRes = await apiFetch(`/api/duels/leaderboard`);
        if (lbRes.ok) {
          setLeaderboard(await lbRes.json());
        }
      }
    } catch (err) {
      console.error("Deployment evaluation failed", err);
    } finally {
      setIsDeploying(false);
    }
  }

  function addNodeToCanvas(componentType: string) {
    const newNode: TopologyNode = {
      id: `node-${Date.now()}`,
      name: componentType.replace(/_/g, " "),
      type: componentType,
      tier: "Active Service"
    };
    setPlacedNodes([...placedNodes, newNode]);
  }

  function removeNode(id: string) {
    setPlacedNodes(placedNodes.filter((n) => n.id !== id));
  }

  function formatTime(secs: number) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  }

  const availableComponents = [
    { type: "API_Gateway", label: "Anycast Edge Gateway", color: "border-cyan-500/40 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300" },
    { type: "Distributed_Cache_Redis", label: "Redis Cluster", color: "border-purple-500/40 bg-purple-500/10 text-purple-800 dark:text-purple-300" },
    { type: "Transactional_Outbox_WAL", label: "Transactional WAL Outbox", color: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" },
    { type: "Raft_Consensus_Cluster", label: "Raft Consensus Quorum", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" },
    { type: "Distributed_SQL_Spanner", label: "Spanner Distributed SQL", color: "border-indigo-500/40 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300" },
    { type: "Kafka_Event_Backplane", label: "Kafka Event Stream", color: "border-rose-500/40 bg-rose-500/10 text-rose-800 dark:text-rose-300" }
  ];

  if (access) return <AccessNotice problem={access} feature="The system design duel arena" />;

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 font-sans">
      {/* Top Breadcrumb & Actions */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-indigo-600 dark:text-indigo-400 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/passport" className="hover:text-indigo-600 dark:text-indigo-400 transition-colors">
            Career OS
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">1v1 Speed-Architecting Flash-Wars</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="px-3.5 py-1.5 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted transition-all flex items-center space-x-1.5"
          >
            <span>🏆 Global Elo Leaderboard</span>
          </button>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>FIDE Elo Matchmaking Online</span>
          </span>
        </div>
      </div>

      {/* Duel Arena Header Banner */}
      <div className="max-w-7xl mx-auto mb-6 bg-card/90 backdrop-blur-xl border border-border shadow-lg p-6 md:p-8 rounded-2xl relative overflow-hidden dark:bg-gradient-to-r dark:from-slate-900 dark:via-indigo-950/30 dark:to-purple-950/40">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-wider">
                Phase 37 • Live Multiplayer
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-bold uppercase tracking-wider">
                5-Minute Flash-War
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-2">
              1v1 System Design Speed-Architecting Flash-Wars
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl leading-relaxed">
              Go head-to-head in real time against peers or calibrated AI Principal Architects. Draw distributed topologies under dynamic chaos constraints (e.g. 10M QPS with regional datacenter blackout).
            </p>
          </div>

          {/* Countdown Clock HUD */}
          <div className="flex items-center space-x-4 bg-background/90 border border-border p-4 rounded-2xl shadow-sm">
            <div className="text-center px-4 border-r border-border">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Duel Time</div>
              <div className={`text-3xl font-black font-mono tracking-tight ${secondsRemaining < 60 ? "text-rose-500 animate-pulse" : "text-amber-600 dark:text-amber-400"}`}>
                {formatTime(secondsRemaining)}
              </div>
            </div>
            <div className="text-center px-2">
              <button
                onClick={() => startMatchmake()}
                disabled={isMatching}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-slate-950 font-black text-sm transition-all shadow-md flex items-center space-x-2 cursor-pointer"
              >
                {isMatching ? "Finding Opponent..." : "New 1v1 Match"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Chaos Alert Warning Bar */}
      <div className="max-w-7xl mx-auto mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-900 dark:text-rose-200 text-xs md:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center space-x-3">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          <span className="font-bold text-rose-800 dark:text-rose-300">
            ⚠️ INJECTED CHAOS EVENT:
          </span>
          <span className="text-rose-900 dark:text-rose-200">{selectedPreset?.injectedChaosEvent || "Minute 3: US-East-1 datacenter goes dark + 10M QPS cache stampede injected into US-West-2."}</span>
        </div>
        <div className="flex items-center space-x-2 shrink-0">
          <label className="text-xs font-semibold flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={chaosHandled}
              onChange={(e) => setChaosHandled(e.target.checked)}
              className="rounded bg-card border-border text-amber-500 focus:ring-0"
            />
            <span className="text-rose-800 dark:text-rose-300 font-bold">Chaos Auto-Failover Route Engaged</span>
          </label>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="max-w-7xl mx-auto mb-6 p-4 rounded-xl bg-cyan-950/50 border border-cyan-800 text-cyan-600 dark:text-cyan-300 text-sm flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-cyan-700 dark:text-cyan-400 hover:text-foreground font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* 1v1 Matchup Duel Cards */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-11 items-center gap-4">
        {/* Player 1 Card */}
        <div className="md:col-span-5 bg-card border border-cyan-500/40 p-4 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-700 dark:text-cyan-400 text-lg">
              AC
            </div>
            <div>
              <div className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 uppercase">You (Player 1)</div>
              <div className="text-base font-bold text-foreground">{currentMatch?.player1Name || "Alex Chen"}</div>
              <div className="text-xs text-muted-foreground">Gold Tier • 5 Win Streak</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">Elo Rating</div>
            <div className="text-2xl font-black text-cyan-700 dark:text-cyan-400">
              {duelResult ? duelResult.newElo : (currentMatch?.player1Elo || 1580)}
            </div>
          </div>
        </div>

        {/* VS Divider */}
        <div className="md:col-span-1 text-center py-2">
          <span className="px-3 py-1 rounded-full bg-muted text-amber-700 dark:text-amber-400 font-black text-xs border border-amber-500/30">
            VS
          </span>
        </div>

        {/* Player 2 Card */}
        <div className="md:col-span-5 bg-card border border-purple-500/40 p-4 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center font-bold text-purple-700 dark:text-purple-400 text-lg">
              ER
            </div>
            <div>
              <div className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase">Opponent</div>
              <div className="text-base font-bold text-foreground">
                {currentMatch?.player2Name || "Dr. Elena Rostova (AI Principal)"}
              </div>
              <div className="text-xs text-muted-foreground">Diamond Tier • 85.2% WinRate</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase font-semibold">Elo Rating</div>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-400">
              {currentMatch?.player2Elo || 1890}
            </div>
          </div>
        </div>
      </div>

      {/* Main Duel Studio Grid: Left Canvas & Toolbox (8 Cols) vs Right Inspector & Scenarios (4 Cols) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: 8 Cols - Topology Canvas */}
        <div className="lg:col-span-8 space-y-6">
          {/* Component Palette */}
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Add Component to Active Topology
            </div>
            <div className="flex flex-wrap gap-2">
              {availableComponents.map((comp) => (
                <button
                  key={comp.type}
                  onClick={() => addNodeToCanvas(comp.type)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all hover:scale-105 active:scale-95 ${comp.color}`}
                >
                  + {comp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Topology Graph Canvas */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl relative min-h-[420px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-foreground">Distributed Topology Canvas</h2>
                  <p className="text-xs text-muted-foreground">
                    Arranged pipeline flow with failover routing & state replication
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-muted text-cyan-600 dark:text-cyan-300 border border-border">
                  {placedNodes.length} Active Nodes
                </span>
              </div>

              {/* Topology Flow Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {placedNodes.map((node, idx) => (
                  <div
                    key={node.id}
                    className="p-3 rounded-xl bg-background border border-border hover:border-cyan-500/50 transition-all relative group"
                  >
                    <button
                      onClick={() => removeNode(node.id)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="text-[10px] text-cyan-700 dark:text-cyan-400 font-semibold uppercase">{node.tier}</span>
                    </div>
                    <div className="text-sm font-bold text-foreground truncate">{node.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-1 font-mono">{node.type}</div>
                    <div className="mt-2 text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                      <span>✓ Connected (Failover Ready)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Deployment Control Bar */}
            <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-muted-foreground">
                <span>Active Objective: </span>
                <span className="text-foreground font-semibold">
                  {selectedPreset?.targetMetrics || "P99 < 15ms, Zero Transaction Loss"}
                </span>
              </div>
              <button
                onClick={handleDeployTopology}
                disabled={isDeploying}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-cyan-500 hover:from-amber-400 hover:to-cyan-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center space-x-2"
              >
                {isDeploying ? (
                  <>
                    <svg className="w-4 h-4 animate-spin text-slate-950" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Evaluating Topology under Chaos...</span>
                  </>
                ) : (
                  <>
                    <span>⚔️ Deploy Topology to Battle</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: 4 Cols - Preset Objectives & Match Results */}
        <div className="lg:col-span-4 space-y-6">
          {/* Preset Selector */}
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Duel Arena Scenarios
            </h3>
            <div className="space-y-2">
              {presets.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPreset(p);
                    setDefaultNodes(p);
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedPreset?.id === p.id
                      ? "bg-muted/90 border-amber-500 shadow-md shadow-amber-500/10"
                      : "bg-background/60 border-border hover:border-border"
                  }`}
                >
                  <div className="font-bold text-foreground text-xs">{p.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                    {p.problemStatement}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Duel Result Modal / Card */}
          {duelResult && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Match Outcome</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    duelResult.matchVerdict === "VICTORY"
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {duelResult.matchVerdict}
                </span>
              </div>

              {/* Elo Delta Pill */}
              <div className="p-3 rounded-xl bg-background border border-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase">Elo Rating Shift</div>
                  <div className="text-xl font-black text-amber-700 dark:text-amber-400">
                    {duelResult.newElo}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-xs">
                  +{duelResult.eloDelta} Elo
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Throughput</div>
                  <div className="font-bold text-cyan-700 dark:text-cyan-400">{duelResult.throughputScore}%</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Resilience</div>
                  <div className="font-bold text-emerald-700 dark:text-emerald-400">{duelResult.resilienceScore}%</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Latency</div>
                  <div className="font-bold text-purple-700 dark:text-purple-400">{duelResult.latencyScore}%</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border">
                  <div className="text-[10px] text-muted-foreground uppercase">Overall Score</div>
                  <div className="font-bold text-amber-700 dark:text-amber-400">{duelResult.overallScore}%</div>
                </div>
              </div>

              {/* Feedback Quote */}
              <div className="p-3 rounded-xl bg-background border border-border text-xs text-muted-foreground italic">
                &quot;{duelResult.evaluationFeedback}&quot;
              </div>
            </div>
          )}

          {/* Global Leaderboard Standings Drawer */}
          {showLeaderboard && (
            <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-foreground flex items-center justify-between">
                <span>Top Speed Architects</span>
                <span className="text-xs text-muted-foreground">Season 2026</span>
              </h3>
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-amber-700 dark:text-amber-400">#{entry.rank}</span>
                      <span className="font-bold text-foreground">{entry.playerName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                        {entry.leagueTier}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-cyan-700 dark:text-cyan-400">{entry.currentElo} Elo</span>
                      <span className="text-[10px] text-muted-foreground ml-2">({entry.winRate}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

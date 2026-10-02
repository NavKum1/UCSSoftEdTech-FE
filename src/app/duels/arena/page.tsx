"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

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
    initializeArena();
  }, []);

  // Timer countdown simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  async function initializeArena() {
    try {
      await fetch("http://localhost:5000/api/duels/seed", { method: "POST" });
      const [presetsRes, lbRes] = await Promise.all([
        fetch("http://localhost:5000/api/duels/presets"),
        fetch("http://localhost:5000/api/duels/leaderboard")
      ]);

      if (presetsRes.ok) {
        const presetsData: ArchitecturalPreset[] = await presetsRes.json();
        setPresets(presetsData);
        if (presetsData.length > 0) {
          setSelectedPreset(presetsData[0]);
          setDefaultNodes(presetsData[0]);
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
      const res = await fetch("http://localhost:5000/api/duels/matchmake", {
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
      const res = await fetch("http://localhost:5000/api/duels/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const result: DuelSubmissionResult = await res.json();
        setDuelResult(result);
        
        // Refresh leaderboard
        const lbRes = await fetch("http://localhost:5000/api/duels/leaderboard");
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
    { type: "API_Gateway", label: "Anycast Edge Gateway", color: "border-cyan-500/50 bg-cyan-950/20 text-cyan-300" },
    { type: "Distributed_Cache_Redis", label: "Redis Cluster", color: "border-purple-500/50 bg-purple-950/20 text-purple-300" },
    { type: "Transactional_Outbox_WAL", label: "Transactional WAL Outbox", color: "border-amber-500/50 bg-amber-950/20 text-amber-300" },
    { type: "Raft_Consensus_Cluster", label: "Raft Consensus Quorum", color: "border-emerald-500/50 bg-emerald-950/20 text-emerald-300" },
    { type: "Distributed_SQL_Spanner", label: "Spanner Distributed SQL", color: "border-blue-500/50 bg-blue-950/20 text-blue-300" },
    { type: "Kafka_Event_Backplane", label: "Kafka Event Stream", color: "border-rose-500/50 bg-rose-950/20 text-rose-300" }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Breadcrumb & Actions */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-sm text-slate-400">
          <Link href="/" className="hover:text-cyan-400 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/passport" className="hover:text-cyan-400 transition-colors">
            Career OS
          </Link>
          <span>/</span>
          <span className="text-amber-400 font-medium">1v1 Speed-Architecting Flash-Wars</span>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all flex items-center space-x-1.5"
          >
            <span>🏆 Global Elo Leaderboard</span>
          </button>
          <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>FIDE Elo Matchmaking Online</span>
          </span>
        </div>
      </div>

      {/* Duel Arena Header Banner */}
      <div className="max-w-7xl mx-auto mb-6 bg-gradient-to-r from-slate-900 via-amber-950/30 to-purple-950/40 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-xs font-bold uppercase tracking-wider border border-amber-500/30">
                Phase 37 • Live Multiplayer
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-500/30">
                5-Minute Flash-War
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              1v1 System Design Speed-Architecting Flash-Wars
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              Go head-to-head in real time against peers or calibrated AI Principal Architects. Draw distributed topologies under dynamic chaos constraints (e.g. 10M QPS with regional datacenter blackout).
            </p>
          </div>

          {/* Countdown Clock HUD */}
          <div className="flex items-center space-x-4 bg-slate-950/80 border border-slate-800 p-4 rounded-2xl shadow-inner">
            <div className="text-center px-4 border-r border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Duel Time</div>
              <div className={`text-3xl font-black font-mono tracking-tight ${secondsRemaining < 60 ? "text-rose-400 animate-pulse" : "text-amber-400"}`}>
                {formatTime(secondsRemaining)}
              </div>
            </div>
            <div className="text-center px-2">
              <button
                onClick={() => startMatchmake()}
                disabled={isMatching}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center space-x-2"
              >
                {isMatching ? "Finding Opponent..." : "New 1v1 Match"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Chaos Alert Warning Bar */}
      <div className="max-w-7xl mx-auto mb-6 p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-xs md:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
          <span className="font-bold text-rose-200">
            ⚠️ INJECTED CHAOS EVENT:
          </span>
          <span>{selectedPreset?.injectedChaosEvent || "Minute 3: US-East-1 datacenter goes dark + 10M QPS cache stampede injected into US-West-2."}</span>
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={chaosHandled}
              onChange={(e) => setChaosHandled(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-amber-500 focus:ring-0"
            />
            <span className="text-amber-400 font-bold">Chaos Auto-Failover Route Engaged</span>
          </label>
        </div>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="max-w-7xl mx-auto mb-6 p-4 rounded-xl bg-cyan-950/50 border border-cyan-800 text-cyan-300 text-sm flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-cyan-400 hover:text-white font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* 1v1 Matchup Duel Cards */}
      <div className="max-w-7xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-11 items-center gap-4">
        {/* Player 1 Card */}
        <div className="md:col-span-5 bg-slate-900 border border-cyan-500/40 p-4 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center font-bold text-cyan-400 text-lg">
              AC
            </div>
            <div>
              <div className="text-xs font-semibold text-cyan-400 uppercase">You (Player 1)</div>
              <div className="text-base font-bold text-white">Alex Chen</div>
              <div className="text-xs text-slate-400">Gold Tier • 5 Win Streak</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Elo Rating</div>
            <div className="text-2xl font-black text-cyan-400">1598</div>
          </div>
        </div>

        {/* VS Divider */}
        <div className="md:col-span-1 text-center py-2">
          <span className="px-3 py-1 rounded-full bg-slate-800 text-amber-400 font-black text-xs border border-amber-500/30">
            VS
          </span>
        </div>

        {/* Player 2 Card */}
        <div className="md:col-span-5 bg-slate-900 border border-purple-500/40 p-4 rounded-2xl shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center font-bold text-purple-400 text-lg">
              ER
            </div>
            <div>
              <div className="text-xs font-semibold text-purple-400 uppercase">Opponent</div>
              <div className="text-base font-bold text-white">
                {currentMatch?.player2Name || "Dr. Elena Rostova (AI Principal)"}
              </div>
              <div className="text-xs text-slate-400">Diamond Tier • 85.2% WinRate</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Elo Rating</div>
            <div className="text-2xl font-black text-purple-400">
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative min-h-[420px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Distributed Topology Canvas</h2>
                  <p className="text-xs text-slate-400">
                    Arranged pipeline flow with failover routing & state replication
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                  {placedNodes.length} Active Nodes
                </span>
              </div>

              {/* Topology Flow Items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {placedNodes.map((node, idx) => (
                  <div
                    key={node.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 transition-all relative group"
                  >
                    <button
                      onClick={() => removeNode(node.id)}
                      className="absolute top-2 right-2 text-slate-500 hover:text-rose-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="text-[10px] text-cyan-400 font-semibold uppercase">{node.tier}</span>
                    </div>
                    <div className="text-sm font-bold text-white truncate">{node.name}</div>
                    <div className="text-[10px] text-slate-400 mt-1 font-mono">{node.type}</div>
                    <div className="mt-2 text-[10px] text-emerald-400 flex items-center space-x-1">
                      <span>✓ Connected (Failover Ready)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Deployment Control Bar */}
            <div className="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs text-slate-400">
                <span>Active Objective: </span>
                <span className="text-slate-200 font-semibold">
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
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
                      ? "bg-slate-800/90 border-amber-500 shadow-md shadow-amber-500/10"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="font-bold text-slate-200 text-xs">{p.title}</div>
                  <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    {p.problemStatement}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Duel Result Modal / Card */}
          {duelResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Match Outcome</span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    duelResult.matchVerdict === "VICTORY"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  }`}
                >
                  {duelResult.matchVerdict}
                </span>
              </div>

              {/* Elo Delta Pill */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold uppercase">Elo Rating Shift</div>
                  <div className="text-xl font-black text-amber-400">
                    {duelResult.newElo}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                  +{duelResult.eloDelta} Elo
                </span>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Throughput</div>
                  <div className="font-bold text-cyan-400">{duelResult.throughputScore}%</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Resilience</div>
                  <div className="font-bold text-emerald-400">{duelResult.resilienceScore}%</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Latency</div>
                  <div className="font-bold text-purple-400">{duelResult.latencyScore}%</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Overall Score</div>
                  <div className="font-bold text-amber-400">{duelResult.overallScore}%</div>
                </div>
              </div>

              {/* Feedback Quote */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 italic">
                "{duelResult.evaluationFeedback}"
              </div>
            </div>
          )}

          {/* Global Leaderboard Standings Drawer */}
          {showLeaderboard && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center justify-between">
                <span>Top Speed Architects</span>
                <span className="text-xs text-slate-400">Season 2026</span>
              </h3>
              <div className="space-y-2">
                {leaderboard.map((entry) => (
                  <div
                    key={entry.userId}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-amber-400">#{entry.rank}</span>
                      <span className="font-bold text-slate-200">{entry.playerName}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400">
                        {entry.leagueTier}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-cyan-400">{entry.currentElo} Elo</span>
                      <span className="text-[10px] text-slate-500 ml-2">({entry.winRate}%)</span>
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

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface TelemetryMetrics {
  p99LatencyMs?: number;
  errorRatePercent?: number;
  consumerLagRecords?: number;
  rebalanceEventsPerMin?: number;
  redisCacheMissRatePercent?: number;
  databaseConnectionsActive?: number;
  txidRemainingUntilStop?: number;
  tombstonesScannedAvg?: number;
  jvmGcPauseMs?: number;
  walDiskUsagePercent?: number;
  jvmHeapUsagePercent?: number;
  activeDistributedLocks?: number;
  deadlockCount?: number;
  cpuLoadPercent?: number;
  activeConsumerPods?: number;
  throughputRps?: number;
}

interface Hypothesis {
  id: string;
  label: string;
  rationale: string;
}

interface RemediationAction {
  id: string;
  label: string;
  command: string;
  risk: string;
}

interface IncidentKata {
  id: string;
  dayIndex: number;
  title: string;
  severity: string;
  category: string;
  topologyDescription: string;
  outageSymptoms: string;
  telemetryMetrics_JSON: string;
  terminalLogs: string;
  hypotheses_JSON: string;
  remediationActions_JSON: string;
  postMortemAnalysis: string;
  baseXp: number;
}

interface UserStreak {
  userId: string;
  currentStreak: number;
  highestStreak: number;
  lastTriageDate: string;
  streakFreezeShields: number;
  totalXp: number;
  weeklyXp: number;
  currentLeague: string;
  totalIncidentsResolved: number;
  averageMttrSeconds: number;
  completedToday: boolean;
  streakStatusDescription: string;
}

interface TriageResult {
  submissionId: string;
  incidentId: string;
  isResolved: boolean;
  score: number;
  hypothesisCorrect: boolean;
  actionCorrect: boolean;
  baseXp: number;
  speedBonusXp: number;
  streakMultiplier: number;
  totalXpAwarded: number;
  currentStreak: number;
  highestStreak: number;
  shieldConsumed: boolean;
  remainingShields: number;
  currentLeague: string;
  postMortemAnalysis: string;
  seniorArchitectRecommendation: string;
}

interface LeagueEntry {
  rank: number;
  userId: string;
  userName: string;
  avatarUrl: string;
  weeklyXp: number;
  streakCount: number;
  tierStatus: string;
  isCurrentUser: boolean;
}

interface WeeklyLeagues {
  weekIdentifier: string;
  league: string;
  promotionCutoffRank: number;
  demotionCutoffRank: number;
  currentUserRank: number | null;
  entries: LeagueEntry[];
}

export default function DailyIncidentPage() {
  const [incident, setIncident] = useState<IncidentKata | null>(null);
  const [metrics, setMetrics] = useState<TelemetryMetrics>({});
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [actions, setActions] = useState<RemediationAction[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [leagues, setLeagues] = useState<WeeklyLeagues | null>(null);

  const [selectedHypothesis, setSelectedHypothesis] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [activeTab, setActiveTab] = useState<"briefing" | "telemetry" | "logs" | "leagues">("briefing");

  // Simulated constant user ID for local browser session
  const [userId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("daily_incident_user_id");
      if (stored) return stored;
      const created = "a8f3b201-1122-3344-5566-778899aabbcc";
      localStorage.setItem("daily_incident_user_id", created);
      return created;
    }
    return "a8f3b201-1122-3344-5566-778899aabbcc";
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && !triageResult) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, triageResult]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Today's Incident
      const incRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/incidents/today`);
      if (incRes.ok) {
        const incData: IncidentKata = await incRes.json();
        setIncident(incData);
        if (incData.telemetryMetrics_JSON) {
          try {
            setMetrics(JSON.parse(incData.telemetryMetrics_JSON));
          } catch {
            setMetrics({});
          }
        }
        if (incData.hypotheses_JSON) {
          try {
            setHypotheses(JSON.parse(incData.hypotheses_JSON));
          } catch {
            setHypotheses([]);
          }
        }
        if (incData.remediationActions_JSON) {
          try {
            setActions(JSON.parse(incData.remediationActions_JSON));
          } catch {
            setActions([]);
          }
        }
      }

      // 2. Fetch User Streak
      const streakRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/incidents/streak/${userId}`);
      if (streakRes.ok) {
        const streakData = await streakRes.json();
        setStreak(streakData);
      }

      // 3. Fetch Weekly Leagues
      const leagueRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/incidents/leagues?userId=${userId}`);
      if (leagueRes.ok) {
        const leagueData = await leagueRes.json();
        setLeagues(leagueData);
      }
    } catch (err) {
      console.error("Failed to load daily incident war-room data", err);
    } finally {
      setLoading(false);
    }
  };

  const handleTriageSubmit = async () => {
    if (!incident || !selectedHypothesis || !selectedAction) {
      alert("Please select both a Root Cause Hypothesis and a Surgical Remediation Action.");
      return;
    }

    setSubmitting(true);
    setTimerActive(false);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/incidents/triage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incidentId: incident.id,
          userId,
          selectedHypothesisId: selectedHypothesis,
          selectedActionId: selectedAction,
          customNotes,
          triageTimeSeconds: timerSeconds,
        }),
      });

      if (res.ok) {
        const result: TriageResult = await res.json();
        setTriageResult(result);

        // Refresh streak and league stats
        const streakRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/incidents/streak/${userId}`);
        if (streakRes.ok) setStreak(await streakRes.json());

        const leagueRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/incidents/leagues?userId=${userId}`);
        if (leagueRes.ok) setLeagues(await leagueRes.json());
      } else {
        alert("Triage submission evaluation encountered an error.");
      }
    } catch (err) {
      console.error("Submission failed", err);
      alert("Network error submitting incident remediation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEquipFreezeShield = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/incidents/streak/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const updated = await res.json();
        setStreak(updated);
      }
    } catch (err) {
      console.error("Failed to equip shield", err);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-mono text-sm tracking-wide">
            Loading Daily Incident Scenario & Live System Metrics...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 antialiased selection:bg-amber-500 selection:text-black">
      {/* Top Navigation HUD */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-white transition"
            >
              ← System Dashboard
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-amber-400 via-orange-400 to-red-400 bg-clip-text text-transparent">
                Daily Incident War-Room
              </h1>
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-red-950/80 text-red-400 border border-red-800/60 rounded">
                {incident?.severity || "SEV-1"}
              </span>
            </div>
          </div>

          {/* Gamification & Streak HUD */}
          <div className="flex items-center gap-4 text-xs font-mono">
            {/* Daily Streak */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-amber-500/30 px-3 py-1.5 rounded-lg shadow-sm">
              <span className="text-base">🔥</span>
              <div>
                <span className="text-amber-400 font-bold text-sm">
                  {streak?.currentStreak ?? 1} Day Streak
                </span>
                <span className="text-slate-400 text-[10px] block">
                  Best: {streak?.highestStreak ?? 1}d
                </span>
              </div>
            </div>

            {/* Streak Freeze Shields */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-cyan-500/30 px-3 py-1.5 rounded-lg">
              <span className="text-base">🛡️</span>
              <div>
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((idx) => (
                    <span
                      key={idx}
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        idx < (streak?.streakFreezeShields ?? 0)
                          ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                          : "bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-slate-400 text-[10px] block">
                  {streak?.streakFreezeShields ?? 0}/3 Shields
                </span>
              </div>
              {(streak?.streakFreezeShields ?? 0) < 3 && (
                <button
                  onClick={handleEquipFreezeShield}
                  className="ml-1 text-[10px] px-2 py-0.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/50 rounded transition"
                  title="Equip an additional freeze shield"
                >
                  +Shield
                </button>
              )}
            </div>

            {/* Weekly League */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-indigo-500/30 px-3 py-1.5 rounded-lg">
              <span className="text-base">🏆</span>
              <div>
                <span className="text-indigo-400 font-bold text-sm">
                  {streak?.currentLeague ?? "Bronze"} League
                </span>
                <span className="text-slate-400 text-[10px] block">
                  {streak?.weeklyXp ?? 0} Weekly XP
                </span>
              </div>
            </div>

            {/* Triage Elapsed Stopwatch */}
            <div className="flex items-center gap-2 bg-slate-800/80 border border-emerald-500/30 px-3 py-1.5 rounded-lg">
              <span className="text-base">⏱️</span>
              <div>
                <span className="text-emerald-400 font-bold text-sm">
                  {formatTimer(timerSeconds)}
                </span>
                <span className="text-slate-400 text-[10px] block">
                  {timerSeconds <= 180 ? "+50 XP Rapid SRE" : "+25 XP"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main War-Room Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Outage Banner Alert */}
        <div className="bg-gradient-to-r from-red-950/60 via-slate-900 to-slate-900 border border-red-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 rounded">
                  08:00 AM Daily Incident Kata #{incident?.dayIndex ?? 0}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-400 rounded border border-slate-800">
                  Category: {incident?.category}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-slate-200">{incident?.title}</h2>
              <p className="text-sm text-slate-400 leading-relaxed max-w-4xl">
                {incident?.outageSymptoms}
              </p>
            </div>

            {streak?.completedToday && (
              <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 px-4 py-3 rounded-xl text-center shrink-0">
                <span className="text-base block">✅ Today&apos;s Kata Completed</span>
                <span className="text-xs text-slate-400 font-mono">
                  Next outage arrives tomorrow at 08:00 AM
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("briefing")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "briefing"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📋 Outage Briefing & Topology
          </button>
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "telemetry"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📊 Live System Metrics
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "logs"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            💻 Terminal Crash Logs
          </button>
          <button
            onClick={() => setActiveTab("leagues")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "leagues"
                ? "border-amber-500 text-amber-400 bg-amber-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🏆 Weekly Promotion League
          </button>
        </div>

        {/* Tab 1: Briefing & Topology */}
        {activeTab === "briefing" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-mono text-slate-400 uppercase tracking-wider">
                  🏗️ Production Topology Under Fire
                </h3>
                <p className="text-slate-200 text-sm leading-relaxed font-sans bg-slate-950 p-4 rounded-lg border border-slate-800/80">
                  {incident?.topologyDescription}
                </p>
              </div>

              {/* Triage Decision Canvas */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <span>🔬</span> Step 1: Diagnose Root Cause Hypothesis
                  </h3>
                  <span className="text-xs font-mono text-slate-400">Select 1 Hypothesis</span>
                </div>

                <div className="space-y-3">
                  {hypotheses.map((hyp) => (
                    <label
                      key={hyp.id}
                      className={`block p-4 rounded-xl border cursor-pointer transition ${
                        selectedHypothesis === hyp.id
                          ? "bg-amber-950/30 border-amber-500 text-slate-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                          : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-800"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="radio"
                          name="hypothesis"
                          value={hyp.id}
                          checked={selectedHypothesis === hyp.id}
                          onChange={(e) => setSelectedHypothesis(e.target.value)}
                          className="mt-1 text-amber-500 focus:ring-amber-500"
                        />
                        <div className="space-y-1">
                          <span className="font-semibold text-sm block">{hyp.label}</span>
                          <span className="text-xs text-slate-400 leading-normal block">
                            {hyp.rationale}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="border-t border-slate-800 pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <span>⚡</span> Step 2: Select Surgical Mitigation Action
                    </h3>
                    <span className="text-xs font-mono text-slate-400">Assess Blast Radius Risk</span>
                  </div>

                  <div className="space-y-3">
                    {actions.map((act) => (
                      <label
                        key={act.id}
                        className={`block p-4 rounded-xl border cursor-pointer transition ${
                          selectedAction === act.id
                            ? "bg-amber-950/30 border-amber-500 text-slate-200 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                            : "bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-800"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="remediation"
                            value={act.id}
                            checked={selectedAction === act.id}
                            onChange={(e) => setSelectedAction(e.target.value)}
                            className="mt-1 text-amber-500 focus:ring-amber-500"
                          />
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-sm">{act.label}</span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                  act.risk.startsWith("Low")
                                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                    : act.risk.startsWith("Catastrophic")
                                    ? "bg-red-950 text-red-400 border border-red-800"
                                    : "bg-yellow-950 text-yellow-400 border border-yellow-800"
                                }`}
                              >
                                {act.risk.split(" ")[0]} Risk
                              </span>
                            </div>
                            <pre className="text-[11px] font-mono bg-slate-950 p-2.5 rounded border border-slate-800 text-amber-300/90 overflow-x-auto">
                              $ {act.command}
                            </pre>
                            <span className="text-[11px] text-slate-400 block">{act.risk}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-6 space-y-2">
                  <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block">
                    📝 Optional Architect Post-Mortem Notes
                  </label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Provide additional architectural reasoning, long-term SRE prevention recommendations..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleTriageSubmit}
                    disabled={submitting || !selectedHypothesis || !selectedAction}
                    className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition flex items-center justify-center gap-2 ${
                      submitting || !selectedHypothesis || !selectedAction
                        ? "bg-slate-800 text-slate-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 text-black hover:from-amber-400 hover:to-orange-400 shadow-lg shadow-orange-500/20"
                    }`}
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        <span>Evaluating Blast Radius & Applying Patch...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>
                          Deploy Surgical Patch ({formatTimer(timerSeconds)} Elapsed)
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar: Real-Time SRE Telemetry & Status HUD */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                  ⚡ Outage System Metrics
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block">P99 Latency</span>
                    <span className="text-lg font-bold text-red-400">
                      {metrics.p99LatencyMs ? `${metrics.p99LatencyMs}ms` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block">Error Rate</span>
                    <span className="text-lg font-bold text-red-400">
                      {metrics.errorRatePercent ? `${metrics.errorRatePercent}%` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block">CPU Load</span>
                    <span className="text-lg font-bold text-amber-400">
                      {metrics.cpuLoadPercent ? `${metrics.cpuLoadPercent}%` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 block">Active Pods</span>
                    <span className="text-lg font-bold text-cyan-400">
                      {metrics.activeConsumerPods ?? 1}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 block">
                    Throughput Under Outage
                  </span>
                  <span className="text-sm font-bold text-slate-200">
                    {metrics.throughputRps ?? 0} Requests/sec
                  </span>
                </div>
              </div>

              {/* Habit & Retention Motivation Card */}
              <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-800/40 rounded-xl p-5 space-y-3">
                <span className="text-xs font-mono text-indigo-400 uppercase tracking-wider block">
                  🛡️ Anti-Decay Credential Engine
                </span>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Maintaining your daily morning streak keeps your{" "}
                  <strong className="text-amber-400">Gold Verified Staff Architect</strong>{" "}
                  credential from decaying. Active streak subscribers are ranked at the top of the
                  Fortune 500 Headhunter Talent Ticker.
                </p>
                <div className="text-[11px] font-mono text-slate-400 bg-slate-950/80 p-2.5 rounded border border-indigo-900/50">
                  {streak?.streakStatusDescription}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full Telemetry Dials */}
        {activeTab === "telemetry" && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <h3 className="text-base font-bold text-slate-200 flex items-center gap-2">
              <span>📈</span> Distributed Cluster System Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(metrics).map(([key, val]) => (
                <div key={key} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, " $1")}
                  </span>
                  <div className="text-xl font-bold text-amber-400 font-mono">
                    {typeof val === "number" ? val.toLocaleString() : String(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Terminal Crash Logs */}
        {activeTab === "logs" && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-slate-400 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                Live Container Crashdump (/var/log/syslog & stderr)
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(incident?.terminalLogs || "")}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 rounded text-[11px] transition"
              >
                Copy Logs
              </button>
            </div>
            <pre className="text-red-300/90 leading-relaxed whitespace-pre-wrap overflow-x-auto p-2 bg-black/40 rounded border border-slate-900">
              {incident?.terminalLogs}
            </pre>
          </div>
        )}

        {/* Tab 4: Weekly Leagues */}
        {activeTab === "leagues" && leagues && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  <span>🏆</span> {leagues.league} League Leaderboard
                </h3>
                <p className="text-xs text-slate-400">
                  Week identifier: {leagues.weekIdentifier} • Top 3 engineers promote to next tier on
                  Sunday 23:59 UTC
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded">
                  ▲ Top 3: Promotion Zone
                </span>
                <span className="px-2.5 py-1 bg-red-950 text-red-400 border border-red-800 rounded">
                  ▼ Bottom 2: Demotion Zone
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-slate-400 bg-slate-950/60 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Rank</th>
                    <th className="py-3 px-4">Engineer</th>
                    <th className="py-3 px-4">Streak</th>
                    <th className="py-3 px-4">Weekly XP</th>
                    <th className="py-3 px-4">Zone Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {leagues.entries.map((entry) => (
                    <tr
                      key={entry.userId}
                      className={
                        entry.isCurrentUser
                          ? "bg-amber-950/30 border-l-4 border-amber-500 font-bold"
                          : "hover:bg-slate-800/40"
                      }
                    >
                      <td className="py-3 px-4">
                        {entry.rank === 1 && "🥇 "}
                        {entry.rank === 2 && "🥈 "}
                        {entry.rank === 3 && "🥉 "}#{entry.rank}
                      </td>
                      <td className="py-3 px-4 flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={entry.avatarUrl}
                          alt="avatar"
                          className="w-6 h-6 rounded-full bg-slate-800"
                        />
                        <span className={entry.isCurrentUser ? "text-amber-400" : "text-slate-200"}>
                          {entry.userName} {entry.isCurrentUser && "(You)"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-amber-400">🔥 {entry.streakCount}d</td>
                      <td className="py-3 px-4 text-emerald-400">{entry.weeklyXp} XP</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            entry.tierStatus === "PromotionZone"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                              : entry.tierStatus === "DemotionZone"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {entry.tierStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Triage Post-Mortem Modal */}
        {triageResult && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {triageResult.isResolved ? "🎉" : "⚠️"}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-slate-200">
                      {triageResult.isResolved
                        ? "Outage Successfully Mitigated!"
                        : "Outage Partial Resolution"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Triage Score: {triageResult.score}/100 • MTTR: {formatTimer(timerSeconds)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setTriageResult(null)}
                  className="text-slate-400 hover:text-white text-lg font-mono p-1"
                >
                  ✕
                </button>
              </div>

              {/* XP & Streak Rewards */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block">Total XP Earned</span>
                  <span className="text-xl font-bold text-emerald-400">
                    +{triageResult.totalXpAwarded} XP
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    ({triageResult.baseXp} base + {triageResult.speedBonusXp} speed) × {triageResult.streakMultiplier}x
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block">Daily Streak</span>
                  <span className="text-xl font-bold text-amber-400">
                    🔥 {triageResult.currentStreak} Days
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {triageResult.shieldConsumed ? "Shield Saved Streak!" : "Consecutive"}
                  </span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 block">Current League</span>
                  <span className="text-xl font-bold text-indigo-400">
                    🏆 {triageResult.currentLeague}
                  </span>
                  <span className="text-[10px] text-slate-400 block">Weekly Promotion Active</span>
                </div>
              </div>

              {/* Senior Principal Architect Feedback */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                  👔 Senior Principal SRE Feedback
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {triageResult.seniorArchitectRecommendation}
                </p>
              </div>

              {/* Comprehensive Post-Mortem Analysis */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <h4 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                  📑 Google/Meta Caliber Post-Mortem Root Cause & Prevention
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed font-sans">
                  {triageResult.postMortemAnalysis}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setTriageResult(null);
                    setActiveTab("leagues");
                  }}
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition"
                >
                  View Weekly League Standings
                </button>
                <button
                  onClick={() => setTriageResult(null)}
                  className="py-3 px-5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider rounded-xl transition"
                >
                  Close War-Room
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";

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

const ENTERPRISE_TRACKS = [
  { id: "DevOps", label: "🚀 DevOps & SRE", desc: "Kubernetes, DNS, Kafka, Core Services" },
  { id: "Backend", label: "⚙️ Backend Systems", desc: "Distributed Locks, Goroutines, Postgres, Redis" },
  { id: "Frontend", label: "💻 Frontend & Web", desc: "React 19, SSR Hydration, ServiceWorkers, CDNs" },
  { id: "FullStack", label: "🌐 FullStack (Next.js)", desc: "Server Actions, Optimistic UI, Webhooks" },
  { id: "DataMLOps", label: "🧠 Data & MLOps", desc: "Vector DBs, RAG, Quantization, GPU/RAM OOM" },
  { id: "Cybersecurity", label: "🛡️ Cybersecurity", desc: "SSRF, IMDSv2, JWT Exploits, Auth Bypass" },
  { id: "Mobile", label: "📱 Mobile Architecture", desc: "React Native, ANRs, Room SQLite, JSI Bridge" },
  { id: "CloudFinOps", label: "💰 Cloud FinOps", desc: "Runaway Lambdas, NAT Gateway Egress, AWS Spend" },
  { id: "DatabaseRE", label: "🗄️ Database Reliability", desc: "Postgres XID Wraparound, Replica Lag, Locks" },
];

interface IncidentKata {
  id: string;
  dayIndex: number;
  title: string;
  track?: string;
  difficultyTier?: string;
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
  isPrivateAssessment?: boolean;
  organizationOrTeamName?: string;
  customAccessCode?: string;
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
  const { apiFetch, ready, access } = useLegacyApi();
  const [incident, setIncident] = useState<IncidentKata | null>(null);
  const [metrics, setMetrics] = useState<TelemetryMetrics>({});
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [actions, setActions] = useState<RemediationAction[]>([]);
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [leagues, setLeagues] = useState<WeeklyLeagues | null>(null);

  const [track, setTrack] = useState<string>("DevOps");
  const [difficultyTier, setDifficultyTier] = useState<string>("Bronze");

  const [selectedHypothesis, setSelectedHypothesis] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");
  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(true);

  // AI Outage Synthesizer state
  const [showAiSynthesizer, setShowAiSynthesizer] = useState<boolean>(false);
  const [aiTrack, setAiTrack] = useState<string>("Backend");
  const [aiTier, setAiTier] = useState<string>("Silver");
  const [aiCustomStack, setAiCustomStack] = useState<string>("");
  const [aiFailureMode, setAiFailureMode] = useState<string>("");
  const [synthesizing, setSynthesizing] = useState<boolean>(false);
  const [aiSuccessMessage, setAiSuccessMessage] = useState<string | null>(null);

  // Enterprise Assessment Mode states
  const [isPrivateAssessment, setIsPrivateAssessment] = useState<boolean>(false);
  const [organizationOrTeamName, setOrganizationOrTeamName] = useState<string>("");
  const [customAccessCode, setCustomAccessCode] = useState<string>("");
  const [generatedShareLink, setGeneratedShareLink] = useState<{ link: string; code?: string; team?: string } | null>(null);
  const [isAssessmentMode, setIsAssessmentMode] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [activeTab, setActiveTab] = useState<"briefing" | "telemetry" | "logs" | "leagues">("briefing");

  // Unique user ID for local browser session
  const [userId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("daily_incident_user_id");
      if (stored) return stored;
      const created = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "a8f3b201-1122-3344-5566-778899aabbcc";
      localStorage.setItem("daily_incident_user_id", created);
      return created;
    }
    return "a8f3b201-1122-3344-5566-778899aabbcc";
  });

  const [hasLoadedUrlParams, setHasLoadedUrlParams] = useState<boolean>(false);

  useEffect(() => {
    if (!ready) return;
    fetchInitialData();
  }, [track, difficultyTier, ready]);

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
      let url = `/api/incidents/today?track=${encodeURIComponent(track)}&difficultyTier=${encodeURIComponent(difficultyTier)}`;

      if (typeof window !== "undefined" && !hasLoadedUrlParams) {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("accessCode");
        const id = params.get("id");
        if (code) {
          url = `/api/incidents/access/${encodeURIComponent(code)}`;
          setIsAssessmentMode(true);
          setHasLoadedUrlParams(true);
        } else if (id) {
          url = `/api/incidents/${encodeURIComponent(id)}`;
          setIsAssessmentMode(true);
          setHasLoadedUrlParams(true);
        }
      }

      // 1. Fetch Today's Incident or Assessment Kata
      const incRes = await apiFetch(url);
      if (incRes.ok) {
        const incData: IncidentKata = await incRes.json();
        setIncident(incData);
        if (!hasLoadedUrlParams && (incData.isPrivateAssessment || incData.organizationOrTeamName)) {
          setIsAssessmentMode(true);
        }
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
      const streakRes = await apiFetch(`/api/incidents/streak/${userId}`);
      if (streakRes.ok) {
        const streakData = await streakRes.json();
        setStreak(streakData);
      }

      // 3. Fetch Weekly Leagues
      const leagueRes = await apiFetch(`/api/incidents/leagues?userId=${userId}`);
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
      const res = await apiFetch(`/api/incidents/triage`, {
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
        const streakRes = await apiFetch(`/api/incidents/streak/${userId}`);
        if (streakRes.ok) setStreak(await streakRes.json());

        const leagueRes = await apiFetch(`/api/incidents/leagues?userId=${userId}`);
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
      const res = await apiFetch(`/api/incidents/streak/freeze`, {
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

  const handleSynthesizeOutage = async () => {
    setSynthesizing(true);
    try {
      const res = await apiFetch(
        `/api/incidents/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            track: aiTrack,
            difficultyTier: aiTier,
            customTechStack: aiCustomStack.trim() || undefined,
            failureMode: aiFailureMode.trim() || undefined,
            isPrivateAssessment: isPrivateAssessment,
            organizationOrTeamName: organizationOrTeamName.trim() || undefined,
            customAccessCode: customAccessCode.trim() || undefined,
          }),
        }
      );

      if (res.ok) {
        const generated: IncidentKata = await res.json();
        setTrack(generated.track || aiTrack);
        setDifficultyTier(generated.difficultyTier || aiTier);
        setIncident(generated);
        if (generated.isPrivateAssessment || isPrivateAssessment) {
          setIsAssessmentMode(true);
        }
        if (generated.telemetryMetrics_JSON) {
          try {
            setMetrics(JSON.parse(generated.telemetryMetrics_JSON));
          } catch {
            setMetrics({});
          }
        }
        if (generated.hypotheses_JSON) {
          try {
            setHypotheses(JSON.parse(generated.hypotheses_JSON));
          } catch {
            setHypotheses([]);
          }
        }
        if (generated.remediationActions_JSON) {
          try {
            setActions(JSON.parse(generated.remediationActions_JSON));
          } catch {
            setActions([]);
          }
        }

        // Reset triage attempt state for the fresh outage
        setTimerSeconds(0);
        setTimerActive(true);
        setTriageResult(null);
        setSelectedHypothesis("");
        setSelectedAction("");
        setCustomNotes("");
        setActiveTab("briefing");

        const shareUrl = generated.customAccessCode
          ? `${window.location.origin}/daily/incident?accessCode=${encodeURIComponent(generated.customAccessCode)}`
          : `${window.location.origin}/daily/incident?id=${generated.id}`;

        if (isPrivateAssessment) {
          setGeneratedShareLink({
            link: shareUrl,
            code: generated.customAccessCode,
            team: generated.organizationOrTeamName || organizationOrTeamName,
          });
        } else {
          setShowAiSynthesizer(false);
          setAiSuccessMessage(`⚡ Production Outage "${generated.title}" synthesized and loaded!`);
          setTimeout(() => setAiSuccessMessage(null), 6000);
        }
      } else {
        alert("Failed to synthesize custom incident. Please try again.");
      }
    } catch (err) {
      console.error("AI Synthesizer error", err);
      alert("Error contacting the incident synthesis engine.");
    } finally {
      setSynthesizing(false);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  // Owner decision 19 Oct 2026 (H7b): shared incident links (?accessCode=) stay sign-in only. The notice renders only on
  // the client (auth is never loaded on the server), so reading the URL here can't cause a hydration mismatch.
  if (access) {
    const shared = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("accessCode");
    return shared ? (
      <AccessNotice
        problem={access}
        feature="This shared incident"
        title="Sign in to open this incident"
        message="Shared incident drills open for signed-in users only. Sign in or create a free account, and you'll come straight back to this incident."
      />
    ) : (
      <AccessNotice problem={access} feature="The daily incident drill" />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-mono text-sm tracking-wide">
            Loading Daily Incident Scenario & Live System Metrics...
          </p>
        </div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-lg">
          <div className="text-6xl mb-4">🛡️</div>
          <h2 className="text-2xl font-bold text-foreground">No Incident Kata Available</h2>
          <p className="text-muted-foreground font-mono text-sm tracking-wide">
            No active outage found for <span className="text-amber-500 font-bold">{track}</span> at the <span className="text-amber-500 font-bold">{difficultyTier}</span> tier. Synthesize an on-demand chaos scenario with Gemini AI or explore other tracks:
          </p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {ENTERPRISE_TRACKS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTrack(t.id)}
                className={`px-3 py-1.5 rounded-lg transition text-xs font-mono font-medium ${
                  track === t.id
                    ? "bg-amber-500 text-black font-bold shadow-md"
                    : "bg-card border border-border hover:bg-muted text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <button
              onClick={() => {
                setAiTrack(track);
                setAiTier(difficultyTier);
                setShowAiSynthesizer(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white rounded-xl font-bold text-sm shadow-lg hover:shadow-purple-500/25 transition transform active:scale-95"
            >
              ⚡ Synthesize Custom Outage with AI
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-amber-500 selection:text-black">
      {/* Enterprise / Team War-Room Banner */}
      {(isAssessmentMode || incident?.isPrivateAssessment || incident?.organizationOrTeamName) && (
        <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-b border-purple-500/30 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md">
          <div className="flex items-center gap-2.5">
            <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold uppercase tracking-wider text-[10px] border border-purple-500/40 flex items-center gap-1">
              <span>🏢</span> Team Assessment
            </span>
            <span className="font-semibold text-white tracking-wide">
              {incident.organizationOrTeamName || "Enterprise Technical Assessment War-Room"}
            </span>
            {incident.customAccessCode && (
              <span className="font-mono text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-500/30 text-[11px]">
                🔑 Code: <strong className="text-white">{incident.customAccessCode}</strong>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const url = incident.customAccessCode
                  ? `${window.location.origin}/daily/incident?accessCode=${encodeURIComponent(incident.customAccessCode)}`
                  : `${window.location.origin}/daily/incident?id=${incident.id}`;
                navigator.clipboard.writeText(url);
                alert("📋 Shareable War-Room link copied to clipboard!");
              }}
              className="text-purple-300 hover:text-white underline font-mono text-[11px] flex items-center gap-1 transition"
            >
              <span>📋</span> Copy War-Room Link
            </button>
            <span className="text-slate-600">|</span>
            <Link
              href="/daily/incident"
              onClick={() => {
                setIsAssessmentMode(false);
              }}
              className="text-muted-foreground hover:text-foreground text-[11px] transition"
            >
              Exit to Daily Rotation →
            </Link>
          </div>
        </div>
      )}

      {/* Top Navigation HUD */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-16 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
            >
              ← System Dashboard
            </Link>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 dark:from-amber-400 dark:via-orange-400 dark:to-red-400 bg-clip-text text-transparent">
                Daily Incident War-Room
              </h1>
              <span className="px-2 py-0.5 text-xs font-mono font-bold bg-red-100 text-red-700 border-red-300 dark:bg-red-950/80 dark:text-red-400 dark:border-red-800/60 rounded">
                {incident?.severity || "SEV-1"}
              </span>
            </div>
            
            <div className="flex items-center gap-2 ml-4">
              <select
                value={track}
                onChange={(e) => setTrack(e.target.value)}
                className="bg-card border border-border text-foreground text-xs rounded px-2.5 py-1 outline-none focus:border-amber-500 transition font-medium"
              >
                {ENTERPRISE_TRACKS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
              <select
                value={difficultyTier}
                onChange={(e) => setDifficultyTier(e.target.value)}
                className="bg-card border border-border text-foreground text-xs rounded px-2.5 py-1 outline-none focus:border-amber-500 transition font-medium"
              >
                <option value="Bronze">Bronze (L3)</option>
                <option value="Silver">Silver (L4)</option>
                <option value="Gold">Gold (L5)</option>
                <option value="Diamond">Diamond (L6+)</option>
              </select>
              <button
                onClick={() => {
                  setAiTrack(track);
                  setAiTier(difficultyTier);
                  setShowAiSynthesizer(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white text-xs font-semibold rounded shadow-md hover:shadow-purple-500/20 transition transform active:scale-95 cursor-pointer ml-1"
                title="Synthesize an on-demand custom production outage with Gemini AI"
              >
                <span className="animate-pulse">⚡</span> AI Synthesizer
              </button>
            </div>
          </div>

          {/* Gamification & Streak HUD */}
          <div className="flex items-center gap-4 text-xs font-mono">
            {/* Daily Streak */}
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg shadow-sm">
              <span className="text-base">🔥</span>
              <div>
                <span className="text-amber-700 dark:text-amber-400 font-bold text-sm">
                  {streak?.currentStreak ?? 1} Day Streak
                </span>
                <span className="text-muted-foreground text-[10px] block">
                  Best: {streak?.highestStreak ?? 1}d
                </span>
              </div>
            </div>

            {/* Streak Freeze Shields */}
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg">
              <span className="text-base">🛡️</span>
              <div>
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((idx) => (
                    <span
                      key={idx}
                      className={`inline-block w-2.5 h-2.5 rounded-full ${
                        idx < (streak?.streakFreezeShields ?? 0)
                          ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                          : "bg-muted border border-border"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-muted-foreground text-[10px] block">
                  {streak?.streakFreezeShields ?? 0}/3 Shields
                </span>
              </div>
              {(streak?.streakFreezeShields ?? 0) < 3 && (
                <button
                  onClick={handleEquipFreezeShield}
                  className="ml-1 text-[10px] px-2 py-0.5 bg-cyan-100 hover:bg-cyan-200 dark:bg-cyan-950 dark:hover:bg-cyan-900 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700/50 rounded transition font-medium"
                  title="Equip an additional freeze shield"
                >
                  +Shield
                </button>
              )}
            </div>

            {/* Weekly League */}
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg">
              <span className="text-base">🏆</span>
              <div>
                <span className="text-indigo-700 dark:text-indigo-400 font-bold text-sm">
                  {streak?.currentLeague ?? "Bronze"} League
                </span>
                <span className="text-muted-foreground text-[10px] block">
                  {streak?.weeklyXp ?? 0} Weekly XP
                </span>
              </div>
            </div>

            {/* Triage Elapsed Stopwatch */}
            <div className="flex items-center gap-2 bg-card border border-border px-3 py-1.5 rounded-lg">
              <span className="text-base">⏱️</span>
              <div>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                  {formatTimer(timerSeconds)}
                </span>
                <span className="text-muted-foreground text-[10px] block">
                  {timerSeconds <= 180 ? "+50 XP Rapid SRE" : "+25 XP"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* AI Synthesizer Success Notification */}
      {aiSuccessMessage && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/30 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-base">🚀</span>
            <span className="font-semibold">{aiSuccessMessage}</span>
          </div>
          <button onClick={() => setAiSuccessMessage(null)} className="hover:text-emerald-300 text-sm font-bold">✕</button>
        </div>
      )}

      {/* Main War-Room Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Outage Banner Alert */}
        <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-900 border border-red-800/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded">
                  08:00 AM Daily Incident Kata #{incident?.dayIndex ?? 0}
                </span>
                <span className="px-2 py-0.5 text-[10px] font-mono bg-slate-800 text-slate-200 rounded border border-slate-700">
                  Category: {incident?.category}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">{incident?.title}</h2>
              <p className="text-sm text-slate-200 leading-relaxed max-w-4xl">
                {incident?.outageSymptoms}
              </p>
            </div>

            {streak?.completedToday && (
              <div className="bg-emerald-950/90 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl text-center shrink-0">
                <span className="text-base font-semibold block">✅ Today&apos;s Kata Completed</span>
                <span className="text-xs text-emerald-400/80 font-mono">
                  Next outage arrives tomorrow at 08:00 AM
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-border">
          <button
            onClick={() => setActiveTab("briefing")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "briefing"
                ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            📋 Outage Briefing & Topology
          </button>
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "telemetry"
                ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            📊 Live System Metrics
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "logs"
                ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            💻 Terminal Crash Logs
          </button>
          <button
            onClick={() => setActiveTab("leagues")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "leagues"
                ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/5"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            🏆 Weekly Promotion League
          </button>
        </div>

        {/* Tab 1: Briefing & Topology */}
        {activeTab === "briefing" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <h3 className="text-sm font-mono text-muted-foreground uppercase tracking-wider">
                  🏗️ Production Topology Under Fire
                </h3>
                <p className="text-foreground text-sm leading-relaxed font-sans bg-background p-4 rounded-lg border border-border/80">
                  {incident?.topologyDescription}
                </p>
              </div>

              {/* Triage Decision Canvas */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <span>🔬</span> Step 1: Diagnose Root Cause Hypothesis
                  </h3>
                  <span className="text-xs font-mono text-muted-foreground">Select 1 Hypothesis</span>
                </div>

                <div className="space-y-3">
                  {hypotheses.map((hyp) => (
                    <label
                      key={hyp.id}
                      className={`block p-4 rounded-xl border cursor-pointer transition ${
                        selectedHypothesis === hyp.id
                          ? "bg-amber-500/10 border-amber-500 text-foreground shadow-sm shadow-amber-500/10"
                          : "bg-card border-border text-foreground hover:border-amber-500/40"
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
                          <span className="text-xs text-muted-foreground leading-normal block">
                            {hyp.rationale}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="border-t border-border pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                      <span>⚡</span> Step 2: Select Surgical Mitigation Action
                    </h3>
                    <span className="text-xs font-mono text-muted-foreground">Assess Blast Radius Risk</span>
                  </div>

                  <div className="space-y-3">
                    {actions.map((act) => (
                      <label
                        key={act.id}
                        className={`block p-4 rounded-xl border cursor-pointer transition ${
                          selectedAction === act.id
                            ? "bg-amber-500/10 border-amber-500 text-foreground shadow-sm shadow-amber-500/10"
                            : "bg-card border-border text-foreground hover:border-amber-500/40"
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
                                className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                                  act.risk.startsWith("Low")
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                    : act.risk.startsWith("Catastrophic")
                                    ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                }`}
                              >
                                {act.risk.split(" ")[0]} Risk
                              </span>
                            </div>
                            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] font-mono shadow-inner overflow-x-auto flex items-center justify-between">
                              <span className="text-amber-300 font-mono tracking-tight">$ {act.command}</span>
                              <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider shrink-0 ml-2">bash</span>
                            </div>
                            <span className="text-[11px] text-muted-foreground block">{act.risk}</span>
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border pt-6 space-y-2">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                    📝 Optional Architect Post-Mortem Notes
                  </label>
                  <textarea
                    rows={2}
                    value={customNotes}
                    onChange={(e) => setCustomNotes(e.target.value)}
                    placeholder="Provide additional architectural reasoning, long-term SRE prevention recommendations..."
                    className="w-full bg-background border border-border rounded-lg p-3 text-xs text-foreground font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleTriageSubmit}
                    disabled={submitting || !selectedHypothesis || !selectedAction}
                    className={`w-full py-4 rounded-xl font-bold text-sm tracking-wide transition flex items-center justify-center gap-2 ${
                      submitting || !selectedHypothesis || !selectedAction
                        ? "bg-muted text-muted-foreground cursor-not-allowed"
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
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <h4 className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  ⚡ Outage System Metrics
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-background p-3 rounded-lg border border-border">
                    <span className="text-[10px] font-mono text-muted-foreground block">P99 Latency</span>
                    <span className="text-lg font-bold text-red-700 dark:text-red-400">
                      {metrics.p99LatencyMs ? `${metrics.p99LatencyMs}ms` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border">
                    <span className="text-[10px] font-mono text-muted-foreground block">Error Rate</span>
                    <span className="text-lg font-bold text-red-700 dark:text-red-400">
                      {metrics.errorRatePercent ? `${metrics.errorRatePercent}%` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border">
                    <span className="text-[10px] font-mono text-muted-foreground block">CPU Load</span>
                    <span className="text-lg font-bold text-amber-700 dark:text-amber-400">
                      {metrics.cpuLoadPercent ? `${metrics.cpuLoadPercent}%` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border">
                    <span className="text-[10px] font-mono text-muted-foreground block">Active Pods</span>
                    <span className="text-lg font-bold text-cyan-700 dark:text-cyan-400">
                      {metrics.activeConsumerPods ?? 1}
                    </span>
                  </div>
                </div>

                <div className="bg-background p-3 rounded-lg border border-border space-y-1">
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    Throughput Under Outage
                  </span>
                  <span className="text-sm font-bold text-foreground">
                    {metrics.throughputRps ?? 0} Requests/sec
                  </span>
                </div>
              </div>

              {/* Habit & Retention Motivation Card */}
              <div className="bg-card border border-border dark:bg-gradient-to-br dark:from-indigo-950/40 dark:to-slate-900 dark:border-indigo-800/40 rounded-xl p-5 space-y-3">
                <span className="text-xs font-mono text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block font-semibold">
                  🛡️ Anti-Decay Credential Engine
                </span>
                <p className="text-xs text-foreground/80 dark:text-slate-300 leading-relaxed">
                  Maintaining your daily morning streak keeps your{" "}
                  <strong className="text-amber-700 dark:text-amber-400 font-bold">Gold Verified Staff Architect</strong>{" "}
                  credential from decaying. Active streak subscribers are ranked at the top of the
                  Fortune 500 Headhunter Talent Ticker.
                </p>
                <div className="text-[11px] font-mono text-muted-foreground bg-muted/80 p-2.5 rounded border border-border">
                  {streak?.streakStatusDescription}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Full Telemetry Dials */}
        {activeTab === "telemetry" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <span>📈</span> Distributed Cluster System Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(metrics).map(([key, val]) => (
                <div key={key} className="bg-background p-4 rounded-xl border border-border space-y-1">
                  <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    {key.replace(/([A-Z])/g, " $1")}
                  </span>
                  <div className="text-xl font-bold text-amber-700 dark:text-amber-400 font-mono">
                    {typeof val === "number" ? val.toLocaleString() : String(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Terminal Crash Logs */}
        {activeTab === "logs" && (
          <div className="bg-background border border-border rounded-xl p-6 font-mono text-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="text-muted-foreground flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                Live Container Crashdump (/var/log/syslog & stderr)
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(incident?.terminalLogs || "")}
                className="px-2.5 py-1 bg-card hover:bg-muted text-muted-foreground border border-border rounded text-[11px] transition"
              >
                Copy Logs
              </button>
            </div>
            <pre className="text-red-400 dark:text-red-300/90 leading-relaxed whitespace-pre-wrap overflow-x-auto p-2 bg-black/80 rounded border border-slate-900">
              {incident?.terminalLogs}
            </pre>
          </div>
        )}

        {/* Tab 4: Weekly Leagues */}
        {activeTab === "leagues" && leagues && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span>🏆</span> {leagues.league} League Leaderboard
                </h3>
                <p className="text-xs text-muted-foreground">
                  Week identifier: {leagues.weekIdentifier} • Top 3 engineers promote to next tier on
                  Sunday 23:59 UTC
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2.5 py-1 bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-800 rounded">
                  ▲ Top 3: Promotion Zone
                </span>
                <span className="px-2.5 py-1 bg-red-950 text-red-700 dark:text-red-400 border border-red-800 rounded">
                  ▼ Bottom 2: Demotion Zone
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="text-muted-foreground bg-background/60 border-b border-border">
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
                          : "hover:bg-muted/40"
                      }
                    >
                      <td className="py-3 px-4">
                        {entry.rank === 1 && "🥇 "}
                        {entry.rank === 2 && "🥈 "}
                        {entry.rank === 3 && "🥉 "}#{entry.rank}
                      </td>
                      <td className="py-3 px-4 flex items-center gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {entry.avatarUrl ? (
                          <img
                            src={entry.avatarUrl}
                            alt="avatar"
                            className="w-6 h-6 rounded-full bg-muted"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-[10px] text-foreground font-bold">
                            {entry.userName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={entry.isCurrentUser ? "text-amber-700 dark:text-amber-400" : "text-foreground"}>
                          {entry.userName} {entry.isCurrentUser && "(You)"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-amber-700 dark:text-amber-400">🔥 {entry.streakCount}d</td>
                      <td className="py-3 px-4 text-emerald-700 dark:text-emerald-400">{entry.weeklyXp} XP</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] ${
                            entry.tierStatus === "PromotionZone"
                              ? "bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-800"
                              : entry.tierStatus === "DemotionZone"
                              ? "bg-red-950 text-red-700 dark:text-red-400 border border-red-800"
                              : "bg-muted text-muted-foreground"
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
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {triageResult.isResolved ? "🎉" : "⚠️"}
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      {triageResult.isResolved
                        ? "Outage Successfully Mitigated!"
                        : triageResult.score >= 60
                        ? "Outage Partial Resolution"
                        : "Outage Triage Failed (Unresolved)"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Triage Score: {triageResult.score}/100 • MTTR: {formatTimer(timerSeconds)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border ${
                        triageResult.hypothesisCorrect
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                      }`}>
                        {triageResult.hypothesisCorrect ? "✓ Step 1: Hypothesis Accurate" : "✕ Step 1: Hypothesis Misdiagnosed"}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5 border ${
                        triageResult.actionCorrect
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30"
                      }`}>
                        {triageResult.actionCorrect ? "✓ Step 2: Mitigation Safe & Surgical" : "✕ Step 2: High Blast Radius / Wrong Action"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setTriageResult(null)}
                  className="text-muted-foreground hover:text-foreground text-lg font-mono p-1"
                >
                  ✕
                </button>
              </div>

              {/* XP & Streak Rewards */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-background p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-muted-foreground block">Total XP Earned</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    +{triageResult.totalXpAwarded} XP
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    ({triageResult.baseXp} base + {triageResult.speedBonusXp} speed) × {triageResult.streakMultiplier}x
                  </span>
                </div>
                <div className="bg-background p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-muted-foreground block">Daily Streak</span>
                  <span className="text-xl font-bold text-amber-700 dark:text-amber-400">
                    🔥 {triageResult.currentStreak} Days
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {triageResult.shieldConsumed ? "Shield Saved Streak!" : "Consecutive"}
                  </span>
                </div>
                <div className="bg-background p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-muted-foreground block">Current League</span>
                  <span className="text-xl font-bold text-indigo-700 dark:text-indigo-400">
                    🏆 {triageResult.currentLeague}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Weekly Promotion Active</span>
                </div>
              </div>

              {/* Senior Principal Architect Feedback */}
              <div className="bg-background p-4 rounded-xl border border-border space-y-2">
                <h4 className="text-xs font-mono text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  👔 Senior Principal SRE Feedback
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {triageResult.seniorArchitectRecommendation}
                </p>
              </div>

              {/* Comprehensive Post-Mortem Analysis */}
              <div className="bg-background p-4 rounded-xl border border-border space-y-2">
                <h4 className="text-xs font-mono text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  📑 Google/Meta Caliber Post-Mortem Root Cause & Prevention
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  {triageResult.postMortemAnalysis}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                {!triageResult.isResolved && (
                  <button
                    onClick={() => {
                      setTriageResult(null);
                      setTimerActive(true);
                    }}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl transition shadow-md flex items-center justify-center gap-1.5"
                  >
                    <span>🔄</span>
                    <span>Re-Attempt Triage With New Options</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setTriageResult(null);
                    setActiveTab("leagues");
                  }}
                  className="flex-1 py-3 bg-card hover:bg-muted text-foreground border border-border font-bold text-xs uppercase tracking-wider rounded-xl transition"
                >
                  View Weekly League Standings
                </button>
                <button
                  onClick={() => setTriageResult(null)}
                  className="py-3 px-5 bg-muted hover:bg-muted/80 text-foreground border border-border font-bold text-xs uppercase tracking-wider rounded-xl transition"
                >
                  Close War-Room
                </button>
              </div>
            </div>
          </div>
        )}

        {/* AI Outage Synthesizer Modal */}
        {showAiSynthesizer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
              {/* Modal Top Accent */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-amber-500" />
              
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⚡</span>
                    <h3 className="text-xl font-bold tracking-tight text-foreground">
                      AI Production Outage Synthesizer
                    </h3>
                    <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30 rounded-full">
                      Gemini Chaos Engine
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Generate authentic, mission-critical chaos engineering incidents tailored to custom technology stacks and failure modes on-demand.
                  </p>
                </div>
                <button
                  onClick={() => setShowAiSynthesizer(false)}
                  disabled={synthesizing}
                  className="text-muted-foreground hover:text-foreground text-sm font-bold p-1 rounded-lg hover:bg-muted transition"
                >
                  ✕
                </button>
              </div>

              {/* Form Content */}
              {generatedShareLink ? (
                /* Generated Share Link Card */
                <div className="bg-gradient-to-br from-purple-950/60 via-slate-900 to-indigo-950/60 border border-purple-500/40 rounded-2xl p-6 space-y-5 text-center">
                  <div className="w-14 h-14 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-lg shadow-purple-500/25">
                    🏢
                  </div>
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-[10px] font-bold uppercase tracking-wider border border-purple-500/40">
                      Private Assessment Commissioned
                    </span>
                    <h4 className="text-lg font-bold text-white">
                      {generatedShareLink.team || "Enterprise Team Assessment"} War-Room Ready
                    </h4>
                    <p className="text-xs text-slate-300 max-w-md mx-auto">
                      Candidates accessing this private war-room will experience the isolated triage simulation without altering the public catalog rotation.
                    </p>
                  </div>

                  {generatedShareLink.code && (
                    <div className="inline-flex items-center gap-2 bg-slate-950/80 border border-purple-500/30 px-4 py-2 rounded-xl text-xs font-mono">
                      <span className="text-slate-400">Access Code:</span>
                      <strong className="text-purple-300 tracking-wider text-sm">{generatedShareLink.code}</strong>
                    </div>
                  )}

                  <div className="space-y-2 text-left">
                    <label className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                      🔗 Shareable Candidate Link
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedShareLink.link}
                        className="flex-1 bg-slate-950 border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground font-mono select-all outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedShareLink.link);
                          alert("War-Room Assessment link copied to clipboard!");
                        }}
                        className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs rounded-xl shadow transition shrink-0"
                      >
                        Copy Link
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-purple-500/20">
                    <button
                      type="button"
                      onClick={() => {
                        setGeneratedShareLink(null);
                        setShowAiSynthesizer(false);
                      }}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition"
                    >
                      Close Modal
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setGeneratedShareLink(null);
                        setShowAiSynthesizer(false);
                      }}
                      className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition"
                    >
                      Enter War-Room Now →
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 text-xs max-h-[75vh] overflow-y-auto pr-1">
                  {/* Track Selection - All 9 Enterprise Tracks */}
                  <div>
                    <label className="block font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      1. Select Technical Track (9 Enterprise Specializations)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {ENTERPRISE_TRACKS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAiTrack(t.id)}
                          className={`p-2.5 rounded-xl border text-left transition font-medium text-xs flex flex-col gap-0.5 ${
                            aiTrack === t.id
                              ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-sm font-bold"
                              : "border-border bg-card hover:bg-muted text-foreground"
                          }`}
                        >
                          <span>{t.label}</span>
                          <span className="text-[10px] text-muted-foreground font-normal line-clamp-1">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Difficulty Tier */}
                  <div>
                    <label className="block font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      2. Target Difficulty Level
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: "Bronze", label: "Bronze (L3)" },
                        { id: "Silver", label: "Silver (L4)" },
                        { id: "Gold", label: "Gold (L5)" },
                        { id: "Diamond", label: "Diamond (L6+)" },
                      ].map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setAiTier(tier.id)}
                          className={`p-2 rounded-xl border text-center transition font-mono text-xs ${
                            aiTier === tier.id
                              ? "border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold"
                              : "border-border bg-card hover:bg-muted text-foreground"
                          }`}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assessment & Distribution Mode */}
                  <div className="p-3.5 rounded-xl bg-card border border-border space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        3. Distribution & Assessment Mode
                      </label>
                      <div className="flex items-center gap-1 bg-muted p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setIsPrivateAssessment(false)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                            !isPrivateAssessment
                              ? "bg-background text-foreground shadow font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          🌐 Public Daily
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsPrivateAssessment(true)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                            isPrivateAssessment
                              ? "bg-purple-600 text-white shadow font-semibold"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          🔒 Team Assessment
                        </button>
                      </div>
                    </div>

                    {isPrivateAssessment && (
                      <div className="space-y-3 pt-2 border-t border-border animate-in fade-in duration-150">
                        <div>
                          <label className="block text-[11px] font-medium text-foreground mb-1">
                            🏢 Organization / Squad Name
                          </label>
                          <input
                            type="text"
                            value={organizationOrTeamName}
                            onChange={(e) => setOrganizationOrTeamName(e.target.value)}
                            placeholder="e.g. Uber Freight SRE Squad, Stripe Core Payments"
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-purple-500 font-mono transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-foreground mb-1">
                            🔑 Custom War-Room Access Code (Optional)
                          </label>
                          <input
                            type="text"
                            value={customAccessCode}
                            onChange={(e) => setCustomAccessCode(e.target.value)}
                            placeholder="e.g. UBER-SRE-2026 (leave empty to auto-generate)"
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-purple-500 font-mono uppercase transition"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Tech Stack */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        4. Custom Architecture & Tech Stack (Optional)
                      </label>
                      <span className="text-[10px] text-muted-foreground">Click a preset or type custom</span>
                    </div>
                    <input
                      type="text"
                      value={aiCustomStack}
                      onChange={(e) => setAiCustomStack(e.target.value)}
                      placeholder="e.g., Next.js 15, React Native JSI, AWS Lambda S3, Postgres Aurora"
                      className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-amber-500 transition font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        "React Native + Kotlin JSI + BLE",
                        "AWS Lambda + S3 EventBridge + DynamoDB",
                        "PostgreSQL 16 + pgBouncer + Aurora",
                        "Next.js 15 + Prisma + Supabase",
                        "Go + gRPC + Redis Redlock + K8s",
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAiCustomStack(preset)}
                          className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-[10px] font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Specific Failure Mode */}
                  <div>
                    <label className="block font-mono text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                      5. Specific Failure Mode or Chaos Pattern (Optional)
                    </label>
                    <input
                      type="text"
                      value={aiFailureMode}
                      onChange={(e) => setAiFailureMode(e.target.value)}
                      placeholder="e.g., React Native Bridge ANR, S3 Lambda Storm, Postgres XID Wraparound"
                      className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-amber-500 transition font-mono"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {[
                        "React Native Bridge ANR",
                        "Recursive S3 Lambda Storm",
                        "PostgreSQL XID Wraparound",
                        "SSR Hydration Mismatch",
                        "Distributed Lock Deadlock",
                      ].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setAiFailureMode(mode)}
                          className="px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-[10px] font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
                        >
                          + {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowAiSynthesizer(false)}
                      disabled={synthesizing}
                      className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSynthesizeOutage}
                      disabled={synthesizing}
                      className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg hover:shadow-purple-500/25 transition transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {synthesizing ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Synthesizing Cluster Outage...</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span>
                          <span>{isPrivateAssessment ? "Create Team Assessment War-Room" : "Synthesize Outage with AI"}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface StakeholderPersona {
  code: string;
  name: string;
  role: string;
  stance: string;
  primaryConcern: string;
  voiceTone: string;
}

interface RubricCriteria {
  executivePresence: string;
  stakeholderAlignment: string;
  strategicClarity: string;
  blamelessRca: string;
}

interface ExecutiveScenario {
  id: string;
  scenarioCode: string;
  title: string;
  scenarioType: string;
  targetLevel: string;
  contextBackground: string;
  stakeholders: StakeholderPersona[];
  keyTradeoffs: string[];
  rubric: RubricCriteria;
}

interface TranscriptItem {
  turnIndex: number;
  speaker: string;
  role: string;
  message: string;
  timestamp: string;
}

interface ExecutiveSession {
  id: string;
  userId: string;
  scenarioId: string;
  scenarioTitle: string;
  targetLevel: string;
  turnsCompleted: number;
  maxTurns: number;
  transcript: TranscriptItem[];
  overallLeadershipScore: number;
  staffReadinessTier: string;
}

interface ExecutiveEvaluationReport {
  sessionId: string;
  scenarioTitle: string;
  targetLevel: string;
  executivePresenceScore: number;
  stakeholderAlignmentScore: number;
  strategicClarityScore: number;
  blamelessRcaScore: number;
  overallLeadershipScore: number;
  staffReadinessTier: string;
  executiveStrengths: string[];
  competencyBlindspots: string[];
  committeeRecommendation: string;
}

interface PromotionDossier {
  id: string;
  candidateName: string;
  targetLevel: string;
  ambiguityHandlingScore: number;
  orgInfluenceScore: number;
  technicalVisionScore: number;
  overallDefenseScore: number;
  committeeVerdict: string;
  promotionCommitteeFeedback: string;
  keyEvaluationRubrics: string[];
}

export default function ExecutiveLeadershipSimulatorPage() {
  const [scenarios, setScenarios] = useState<ExecutiveScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ExecutiveScenario | null>(null);
  const [session, setSession] = useState<ExecutiveSession | null>(null);
  const [candidateInput, setCandidateInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingTurn, setSubmittingTurn] = useState(false);
  const [coachingTip, setCoachingTip] = useState<string | null>(null);
  const [evaluationReport, setEvaluationReport] = useState<ExecutiveEvaluationReport | null>(null);
  const [promotionDossier, setPromotionDossier] = useState<PromotionDossier | null>(null);
  const [generatingDossier, setGeneratingDossier] = useState(false);

  useEffect(() => {
    fetchScenarios();
  }, []);

  const fetchScenarios = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/leadership/scenarios`);
      if (res.ok) {
        const data = await res.json();
        setScenarios(data);
        if (data.length > 0) {
          setSelectedScenario(data[0]);
          await startSession(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load executive scenarios", err);
    } finally {
      setLoading(false);
    }
  };

  const startSession = async (scenarioId: string) => {
    try {
      setEvaluationReport(null);
      setCoachingTip(null);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/leadership/session/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenarioId,
          userId: "5a6f76a1-9aef-4cc0-b19c-e3592f87a33a"
        })
      });
      if (res.ok) {
        const sessionData = await res.json();
        setSession(sessionData);
      }
    } catch (err) {
      console.error("Failed to start simulation session", err);
    }
  };

  const handleScenarioChange = async (scenario: ExecutiveScenario) => {
    setSelectedScenario(scenario);
    await startSession(scenario.id);
  };

  const handleSubmitTurn = async () => {
    if (!session || !candidateInput.trim()) return;

    try {
      setSubmittingTurn(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/leadership/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          candidateResponse: candidateInput,
          decisionStrategy: "Blameless_RCA_Ownership"
        })
      });

      if (res.ok) {
        const result = await res.json();
        setCoachingTip(result.realTimeCoachingTip);
        setCandidateInput("");

        // Refresh session transcript
        const sessionRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/leadership/session/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenarioId: session.scenarioId,
            userId: session.userId
          })
        });
        if (sessionRes.ok) {
          const updatedSession = await sessionRes.json();
          setSession(updatedSession);
        }

        if (result.isSimulationFinished) {
          // Finalize session
          const finalizeRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/leadership/session/${session.id}/finalize`, {
            method: "POST"
          });
          if (finalizeRes.ok) {
            const report = await finalizeRes.json();
            setEvaluationReport(report);
          }
        }
      }
    } catch (err) {
      console.error("Failed to submit executive turn", err);
    } finally {
      setSubmittingTurn(false);
    }
  };

  const handleGeneratePromotionDossier = async () => {
    try {
      setGeneratingDossier(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/leadership/promotion/defense`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "5a6f76a1-9aef-4cc0-b19c-e3592f87a33a",
          candidateName: "Alex Chen",
          targetLevel: "L6_Staff",
          projectScopeSummary: "Led cross-regional partition tolerance and idempotency architecture across Payments, Core API, and Data Engineering.",
          ambiguityDefenseStatement: "Handled undefined network partition split-brain under 50,000 RPS chaos traffic with zero data loss.",
          crossSquadInfluenceDefense: "Aligned Product, SRE, and Compliance leadership on unified blameless SLA and error budget policy."
        })
      });

      if (res.ok) {
        const dossier = await res.json();
        setPromotionDossier(dossier);
      }
    } catch (err) {
      console.error("Failed to evaluate promotion defense", err);
    } finally {
      setGeneratingDossier(false);
    }
  };

  const applyResponsePreset = (preset: string) => {
    if (preset === "blameless") {
      setCandidateInput(
        "I understand the severe customer impact and take full ownership of the system architecture. This was a systemic failure of our split-brain fencing mechanism during network partitions, not an individual on-call oversight. Our blameless analysis reveals that our heartbeats timed out before leader lease expiry. My immediate action item is deploying quorum-based Raft leases with cryptographic idempotency keys, bounding our blast radius with zero financial leakage."
      );
    } else if (preset === "data") {
      setCandidateInput(
        "Looking at the telemetry, our write replica lag spiked past 1,200ms right before the partition. To prevent regressions, we will enforce automated circuit breakers that reject non-idempotent writes if lag exceeds 500ms. SRE's P99 latency will stay protected under 15ms because checkout read traffic falls back to regional caches."
      );
    } else if (preset === "alignment") {
      setCandidateInput(
        "We are aligning Product and Compliance by generating automated reconciliation proofs every 15 minutes. For Compliance, our audit ledger guarantees zero duplicate charges. For Product, we are scheduling a chaos game-day next Tuesday to mathematically prove our zero-downtime failover before holiday traffic."
      );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Header */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-400 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-indigo-500/20">
              👔
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-200 to-indigo-500 bg-clip-text text-transparent">
                Build & Defend
              </span>
              <span className="text-xs text-indigo-400/80 font-mono ml-2 uppercase tracking-widest border border-indigo-500/30 px-2 py-0.5 rounded-full">
                Staff+ Leadership OS
              </span>
            </div>
          </div>

          <nav className="flex items-center space-x-6 text-sm font-medium text-muted-foreground">
            <Link href="/leadership/simulator" className="text-indigo-400 font-semibold flex items-center space-x-1.5">
              <span>👔</span>
              <span>Staff Simulator</span>
            </Link>
            <Link href="/passport" className="hover:text-foreground transition-colors flex items-center space-x-1.5">
              <span>🪪</span>
              <span>Skill Passport</span>
            </Link>
            <Link href="/daily/incident" className="hover:text-foreground transition-colors flex items-center space-x-1.5">
              <span>🚨</span>
              <span>Incident Kata</span>
            </Link>
            <Link href="/daily/review" className="hover:text-foreground transition-colors flex items-center space-x-1.5">
              <span>🔍</span>
              <span>PR Dojo</span>
            </Link>
            <Link href="/guilds/battles" className="hover:text-foreground transition-colors flex items-center space-x-1.5">
              <span>⚔️</span>
              <span>Guild Battles</span>
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Level: L6 Staff / L7 Principal
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <p className="text-sm font-mono text-muted-foreground">Loading executive simulation scenarios...</p>
          </div>
        )}

        {!loading && (
          <>
            {/* Scenario Selection Hub */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-white tracking-tight">Executive Staff & Tech Lead Management Simulator</h1>
                  <p className="text-xs text-muted-foreground mt-1">
                    Defend post-mortems in front of skeptical C-suite stakeholders, arbitrate cross-squad architecture deadlocks, and defend your Staff promotion case.
                  </p>
                </div>
                <button
                  onClick={handleGeneratePromotionDossier}
                  disabled={generatingDossier}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-2"
                >
                  <span>🏛️</span>
                  <span>{generatingDossier ? "Evaluating Defense..." : "Staff Promotion Defense Panel"}</span>
                </button>
              </div>

              {/* Scenario Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {scenarios.map((sc) => {
                  const isSelected = selectedScenario?.id === sc.id;
                  return (
                    <button
                      key={sc.id}
                      onClick={() => handleScenarioChange(sc)}
                      className={`text-left p-4 rounded-xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-indigo-950/40 border-indigo-500 shadow-lg shadow-indigo-500/10"
                          : "bg-card/60 border-border hover:border-border"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {sc.targetLevel}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">{sc.scenarioType}</span>
                        </div>
                        <h3 className="font-bold text-sm text-foreground leading-snug line-clamp-2">{sc.title}</h3>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-2">{sc.contextBackground}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Promotion Dossier Modal (If Generated) */}
            {promotionDossier && (
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-purple-950/30 border border-purple-500/40 rounded-2xl p-6 shadow-2xl space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🏛️</span>
                    <div>
                      <h3 className="text-lg font-bold text-white">Staff Promotion Committee Defense Dossier</h3>
                      <p className="text-xs text-purple-300/80 font-mono">
                        Target Level: {promotionDossier.targetLevel} | Evaluated by Calibrated Meta/Google Staff Panel
                      </p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider">
                    {promotionDossier.committeeVerdict.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-background/80 border border-border rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-indigo-400">{promotionDossier.ambiguityHandlingScore}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">
                      Ambiguity Handling
                    </div>
                  </div>
                  <div className="bg-background/80 border border-border rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-purple-400">{promotionDossier.orgInfluenceScore}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">
                      Org Influence (3+ Squads)
                    </div>
                  </div>
                  <div className="bg-background/80 border border-border rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-cyan-400">{promotionDossier.technicalVisionScore}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">
                      Technical Vision Depth
                    </div>
                  </div>
                  <div className="bg-background/80 border border-border rounded-xl p-3 text-center">
                    <div className="text-2xl font-black text-emerald-400">{promotionDossier.overallDefenseScore}%</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">
                      Overall Committee Score
                    </div>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed bg-background/60 p-3 rounded-lg border border-border">
                  <strong className="text-purple-300 font-bold">Committee Feedback: </strong>
                  {promotionDossier.promotionCommitteeFeedback}
                </p>

                <div className="flex justify-end">
                  <button
                    onClick={() => setPromotionDossier(null)}
                    className="text-xs text-muted-foreground hover:text-white font-semibold"
                  >
                    Dismiss Dossier
                  </button>
                </div>
              </div>
            )}

            {/* Live Interactive Cockpit: Stakeholders & Transcript */}
            {selectedScenario && session && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stakeholder Personas & Rubric */}
                <div className="space-y-6">
                  {/* Stakeholders Card */}
                  <div className="bg-card/60 border border-border rounded-xl p-5 space-y-4">
                    <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                      <span>👥 Active Executive Stakeholders</span>
                    </h3>
                    <div className="space-y-3">
                      {selectedScenario.stakeholders.map((sh) => (
                        <div
                          key={sh.code}
                          className="bg-background/80 border border-border/80 rounded-lg p-3 space-y-1.5 shadow-inner"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-foreground">{sh.name}</h4>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-muted text-indigo-300">
                              {sh.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-400/90 font-medium">Stance: {sh.stance}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <strong className="text-muted-foreground">Concern: </strong>
                            {sh.primaryConcern}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Rubric Criteria Card */}
                  <div className="bg-card/60 border border-border rounded-xl p-5 space-y-3">
                    <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                      <span>🎯 Staff Evaluation Rubric</span>
                    </h3>
                    <div className="text-xs space-y-2.5 text-muted-foreground">
                      <div>
                        <strong className="text-indigo-400 block mb-0.5">Executive Presence:</strong>
                        <p className="text-[11px] text-muted-foreground">{selectedScenario.rubric.executivePresence}</p>
                      </div>
                      <div>
                        <strong className="text-purple-400 block mb-0.5">Blameless RCA Depth:</strong>
                        <p className="text-[11px] text-muted-foreground">{selectedScenario.rubric.blamelessRca}</p>
                      </div>
                      <div>
                        <strong className="text-emerald-400 block mb-0.5">Stakeholder Alignment:</strong>
                        <p className="text-[11px] text-muted-foreground">{selectedScenario.rubric.stakeholderAlignment}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Dialogue Stream & Response Editor */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Dialogue Stream */}
                  <div className="bg-card/60 border border-border rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-border">
                      <div>
                        <h2 className="text-base font-bold text-white">{selectedScenario.title}</h2>
                        <span className="text-xs text-muted-foreground">
                          Turn {session.turnsCompleted} of {session.maxTurns} | Status: {session.staffReadinessTier}
                        </span>
                      </div>
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    </div>

                    {/* Chat Bubble Stream */}
                    <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                      {session.transcript.map((item, idx) => {
                        const isCandidate = item.speaker.includes("Candidate");
                        return (
                          <div
                            key={idx}
                            className={`flex flex-col ${isCandidate ? "items-end" : "items-start"}`}
                          >
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="text-[11px] font-bold text-muted-foreground">{item.speaker}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{item.role}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">{item.timestamp}</span>
                            </div>
                            <div
                              className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed shadow-md ${
                                isCandidate
                                  ? "bg-indigo-600 text-white rounded-tr-none"
                                  : "bg-background border border-border text-foreground rounded-tl-none"
                              }`}
                            >
                              {item.message}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Coaching Tip Alert */}
                    {coachingTip && (
                      <div className="bg-amber-950/40 border border-amber-600/40 rounded-xl p-3 flex items-start space-x-3">
                        <span className="text-lg">💡</span>
                        <div className="text-xs">
                          <strong className="text-amber-300 block mb-0.5">Staff Coach Live Tip:</strong>
                          <span className="text-amber-200/90">{coachingTip}</span>
                        </div>
                      </div>
                    )}

                    {/* Response Console */}
                    {session.turnsCompleted < session.maxTurns ? (
                      <div className="pt-4 border-t border-border space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-bold text-muted-foreground">Strategy Presets:</span>
                          <button
                            onClick={() => applyResponsePreset("blameless")}
                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 transition-all"
                          >
                            🛡️ Blameless RCA Framing
                          </button>
                          <button
                            onClick={() => applyResponsePreset("data")}
                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/30 transition-all"
                          >
                            📊 Quantified P99 SLA Bounds
                          </button>
                          <button
                            onClick={() => applyResponsePreset("alignment")}
                            className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                          >
                            🤝 Multi-Stakeholder Consensus
                          </button>
                        </div>

                        <textarea
                          rows={4}
                          value={candidateInput}
                          onChange={(e) => setCandidateInput(e.target.value)}
                          placeholder="Formulate your Staff+ response addressing stakeholder trade-offs, blameless architecture, and concrete action items..."
                          className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 transition-all font-mono leading-relaxed"
                        ></textarea>

                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Press Submit to progress simulation dialogue
                          </span>
                          <button
                            onClick={handleSubmitTurn}
                            disabled={submittingTurn || !candidateInput.trim()}
                            className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-2"
                          >
                            <span>🚀</span>
                            <span>{submittingTurn ? "Evaluating Defense..." : "Submit Executive Turn"}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-emerald-950/40 border border-emerald-600/40 rounded-xl text-center space-y-2">
                        <span className="text-2xl">🎉</span>
                        <h4 className="text-sm font-bold text-emerald-300">Executive Simulation Completed!</h4>
                        <p className="text-xs text-emerald-200/80">
                          You navigated all cross-functional stakeholder turns. See your evaluation scorecard below.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Evaluation Report Scorecard (If Finalized) */}
                  {evaluationReport && (
                    <div className="bg-card/80 border border-border rounded-xl p-6 space-y-5 animate-fadeIn shadow-2xl">
                      <div className="flex items-center justify-between pb-3 border-b border-border">
                        <div>
                          <h3 className="text-base font-bold text-white">Staff Readiness Evaluation Scorecard</h3>
                          <p className="text-xs text-muted-foreground">{evaluationReport.scenarioTitle}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 uppercase tracking-wider">
                          {evaluationReport.staffReadinessTier.replace(/_/g, " ")}
                        </span>
                      </div>

                      {/* Metric Quad */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-background/80 border border-border rounded-lg p-3 text-center">
                          <div className="text-xl font-black text-indigo-400">{evaluationReport.executivePresenceScore}%</div>
                          <div className="text-[10px] uppercase text-muted-foreground font-semibold mt-0.5">Presence</div>
                        </div>
                        <div className="bg-background/80 border border-border rounded-lg p-3 text-center">
                          <div className="text-xl font-black text-emerald-400">{evaluationReport.stakeholderAlignmentScore}%</div>
                          <div className="text-[10px] uppercase text-muted-foreground font-semibold mt-0.5">Alignment</div>
                        </div>
                        <div className="bg-background/80 border border-border rounded-lg p-3 text-center">
                          <div className="text-xl font-black text-cyan-400">{evaluationReport.strategicClarityScore}%</div>
                          <div className="text-[10px] uppercase text-muted-foreground font-semibold mt-0.5">Clarity</div>
                        </div>
                        <div className="bg-background/80 border border-border rounded-lg p-3 text-center">
                          <div className="text-xl font-black text-purple-400">{evaluationReport.blamelessRcaScore}%</div>
                          <div className="text-[10px] uppercase text-muted-foreground font-semibold mt-0.5">Blameless RCA</div>
                        </div>
                      </div>

                      {/* Strengths & Blindspots */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="bg-background/60 border border-border/80 rounded-lg p-3 space-y-1.5">
                          <span className="text-emerald-400 font-bold flex items-center space-x-1">
                            <span>✅</span>
                            <span>Key Executive Strengths</span>
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                            {evaluationReport.executiveStrengths.map((s, idx) => (
                              <li key={idx} className="leading-relaxed">{s}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="bg-background/60 border border-border/80 rounded-lg p-3 space-y-1.5">
                          <span className="text-amber-400 font-bold flex items-center space-x-1">
                            <span>🔍</span>
                            <span>Staff Competency Blindspots</span>
                          </span>
                          <ul className="list-disc list-inside space-y-1 text-muted-foreground pl-1">
                            {evaluationReport.competencyBlindspots.map((b, idx) => (
                              <li key={idx} className="leading-relaxed">{b}</li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-lg text-xs text-indigo-200">
                        <strong className="text-indigo-300">Recommendation: </strong>
                        {evaluationReport.committeeRecommendation}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";

interface SynthesizedChallenge {
  id: string;
  baseChallengeSlug: string;
  title: string;
  mutatedStoryNarrative: string;
  language: string;
  starterCode: string;
  synthesizedTestHarness: string;
  targetedWeakness: string;
  difficultyRating: string;
  antiCheatEntropyHash: string;
  generatedAt: string;
}

interface EvaluationResult {
  evaluationId: string;
  challengeId: string;
  testsPassed: number;
  totalTests: number;
  executionStatus: string;
  performanceMs: number;
  weaknessExploited: boolean;
  remediationHint: string;
  selfHealingGuidance: string;
  evaluatedAt: string;
}

export default function ChallengeSynthesizerPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [baseSlug, setBaseSlug] = useState<string>("distributed-lru");
  const [language, setLanguage] = useState<string>("csharp");
  const [weakness, setWeakness] = useState<string>("ConcurrentRaceCondition");
  const [difficulty, setDifficulty] = useState<string>("Hard");

  const [activeChallenge, setActiveChallenge] = useState<SynthesizedChallenge | null>(null);
  const [candidateCode, setCandidateCode] = useState<string>("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSynthesize = async () => {
    setLoading(true);
    setMessage(null);
    setEvaluation(null);
    try {
      const res = await apiFetch(`/api/challenges/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseChallengeSlug: baseSlug,
          language,
          targetedWeakness: weakness,
          difficultyRating: difficulty,
        }),
      });

      const data = await res.json();
      if (data.success && data.challenge) {
        setActiveChallenge(data.challenge);
        setCandidateCode(data.challenge.starterCode);
        setMessage(`Synthesized challenge '${data.challenge.title}' with anti-cheat entropy.`);
      }
    } catch (e) {
      console.error("Error synthesizing challenge:", e);
      setMessage("Failed to synthesize challenge. Ensure backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!activeChallenge) return;
    setEvaluating(true);
    try {
      const res = await apiFetch(`/api/challenges/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          challengeId: activeChallenge.id,
          candidateCode,
        }),
      });

      const data = await res.json();
      if (data.success && data.evaluation) {
        setEvaluation(data.evaluation);
      }
    } catch (e) {
      console.error("Error evaluating submission:", e);
    } finally {
      setEvaluating(false);
    }
  };

  // Auto-synthesize on initial load
  useEffect(() => {
    if (!ready) return;
    handleSynthesize();
  }, [ready]);

  if (access) return <AccessNotice problem={access} feature="The challenge synthesizer" />;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-border gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 rounded">
              Phase 30 Dynamic Synthesizer
            </span>
            <span className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Zero-Day Anti-Cheat Active
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1">
            Autonomous Self-Healing Coding Challenges
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generates novel algorithmic story narratives, mutated variables, and weakness-targeted test harnesses rendering cheat repos obsolete.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/prep/career"
            className="px-4 py-2 bg-muted hover:bg-slate-700 text-foreground text-sm font-medium rounded-lg transition border border-border"
          >
            Career Trajectory
          </Link>
          <Link
            href="/admin/resilience"
            className="px-4 py-2 bg-muted hover:bg-slate-700 text-foreground text-sm font-medium rounded-lg transition border border-border"
          >
            Resilience Hub
          </Link>
        </div>
      </div>

      {message && (
        <div className="max-w-7xl mx-auto mt-4 p-3.5 bg-indigo-950/40 border border-indigo-700/50 rounded-lg text-indigo-200 text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-xs text-indigo-700 dark:text-indigo-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Synthesis Config Bar */}
      <div className="max-w-7xl mx-auto mt-6 bg-card border border-border rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div>
            <label className="text-muted-foreground block mb-1">Base Archetype</label>
            <select
              value={baseSlug}
              onChange={(e) => setBaseSlug(e.target.value)}
              className="bg-background border border-border text-white rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="distributed-lru">Distributed LRU Cache</option>
              <option value="rate-limiter">Sliding Token Rate Limiter</option>
              <option value="stream-top-k">Subsea Telemetry Top-K Ranker</option>
            </select>
          </div>

          <div>
            <label className="text-muted-foreground block mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-background border border-border text-white rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="csharp">C# (.NET 10)</option>
              <option value="typescript">TypeScript (Node.js)</option>
              <option value="go">Go (Golang)</option>
              <option value="python">Python 3.12</option>
              <option value="rust">Rust (Cargo)</option>
            </select>
          </div>

          <div>
            <label className="text-muted-foreground block mb-1">Targeted Weakness Trap</label>
            <select
              value={weakness}
              onChange={(e) => setWeakness(e.target.value)}
              className="bg-background border border-border text-amber-600 dark:text-amber-300 font-medium rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="ConcurrentRaceCondition">Concurrent Race Condition</option>
              <option value="OffByOneBoundary">Off-By-One Boundary Flaw</option>
              <option value="MemoryLeakUnderChurn">Memory Leak Under Churn</option>
              <option value="FloatingPointPrecision">Floating Point Drift</option>
            </select>
          </div>

          <div>
            <label className="text-muted-foreground block mb-1">Seniority Tier</label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="bg-background border border-border text-white rounded px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="Medium">Senior (L5)</option>
              <option value="Hard">Staff Architect (L6)</option>
              <option value="Staff_Principal">Principal Fellow (L7)</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleSynthesize}
          disabled={loading}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs rounded-lg transition shadow disabled:opacity-50"
        >
          {loading ? "Synthesizing Novel Variant..." : "⚡ Synthesize Novel Challenge"}
        </button>
      </div>

      {/* Main Studio Viewport */}
      {activeChallenge && (
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Left Column: Mission Narrative & Synthesized Test Harness */}
          <div className="space-y-6">
            {/* Story Card */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <span className="text-xs uppercase font-bold tracking-wider text-indigo-700 dark:text-indigo-400">
                  {activeChallenge.difficultyRating} Engineering Challenge
                </span>
                <span className="text-[11px] font-mono text-muted-foreground bg-background px-2 py-0.5 rounded border border-border">
                  Entropy: {activeChallenge.antiCheatEntropyHash.slice(0, 16)}...
                </span>
              </div>

              <h2 className="text-lg font-bold text-foreground mt-3">{activeChallenge.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed bg-background/60 p-4 rounded-lg border border-border">
                {activeChallenge.mutatedStoryNarrative}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 rounded">
                  Targeted Weakness: {activeChallenge.targetedWeakness}
                </span>
                <span className="px-2.5 py-1 text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 rounded">
                  Language: {activeChallenge.language.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Synthesized Test Harness */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Synthesized Torture Test Suite
              </h3>
              <pre className="p-3 bg-background rounded-lg text-xs font-mono text-muted-foreground border border-border overflow-x-auto whitespace-pre-wrap">
                {activeChallenge.synthesizedTestHarness}
              </pre>
            </div>
          </div>

          {/* Right Column: Code Editor & Self-Healing Evaluation */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-5 shadow-lg flex flex-col h-[520px]">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Candidate Implementation ({activeChallenge.language})
                </span>
                <button
                  onClick={handleEvaluate}
                  disabled={evaluating}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-lg transition shadow disabled:opacity-50"
                >
                  {evaluating ? "Running Test Suite..." : "▶ Execute Against Harness"}
                </button>
              </div>

              <textarea
                value={candidateCode}
                onChange={(e) => setCandidateCode(e.target.value)}
                className="w-full flex-1 bg-background text-emerald-600 dark:text-emerald-300 font-mono text-xs p-4 rounded-lg border border-border focus:outline-none focus:border-indigo-500 resize-none"
                spellCheck={false}
              />
            </div>

            {/* Evaluation Result & Self-Healing Guidance */}
            {evaluation && (
              <div
                className={`p-5 rounded-xl border shadow-lg ${
                  evaluation.executionStatus === "Passed"
                    ? "bg-emerald-950/20 border-emerald-700/50"
                    : "bg-rose-950/20 border-rose-700/50"
                }`}
              >
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        evaluation.executionStatus === "Passed" ? "bg-emerald-400" : "bg-rose-400 animate-pulse"
                      }`}
                    ></span>
                    <span className="text-sm font-bold text-foreground">
                      {evaluation.executionStatus === "Passed"
                        ? "ALL TESTS PASSED (100%)"
                        : "SELF-HEALING VARIATION TRIGGERED"}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {evaluation.testsPassed} / {evaluation.totalTests} Passed ({evaluation.performanceMs}ms)
                  </span>
                </div>

                <div className="mt-3 text-xs space-y-2">
                  <div className="text-muted-foreground">
                    <strong className="text-foreground">Diagnostic Output:</strong> {evaluation.remediationHint}
                  </div>
                  {evaluation.selfHealingGuidance && (
                    <div className="p-3 bg-background rounded border border-border text-amber-600 dark:text-amber-300">
                      <strong className="text-foreground">Self-Healing Guidance:</strong> {evaluation.selfHealingGuidance}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

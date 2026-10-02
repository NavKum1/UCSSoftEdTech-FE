"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface DeveloperGitIntegration {
  id: string;
  userId: string;
  provider: string;
  repositoryOwner: string;
  repositoryName: string;
  branchTracked: string;
  connectedAt: string;
  lastSyncedAt: string | null;
  syncStatus: string;
  totalPrsIngested: number;
}

interface IngestedPrArtifact {
  id: string;
  integrationId: string;
  prNumber: string;
  title: string;
  prUrl: string;
  author: string;
  filesChanged: number;
  additions: number;
  deletions: number;
  blastRadiusScore: number;
  complexityScore: number;
  architecturalCategory: string;
  designDocSummary: string;
  mergedAt: string;
}

interface PeerFeedbackItem {
  peerRole: string;
  peerName: string;
  sentiment: string;
  commentary: string;
}

interface PromotionEvaluation {
  id: string;
  userId: string;
  candidateName: string;
  targetLevel: string;
  reviewPeriod: string;
  architecturalImpactScore: number;
  orgInfluenceScore: number;
  technicalLeadershipScore: number;
  executionVelocityScore: number;
  overallReadinessScore: number;
  committeeVerdict: string;
  levelingGaps: string[];
  peerFeedback360: PeerFeedbackItem[];
  evaluatedAt: string;
}

export default function PromotionReviewPage() {
  const [integrations, setIntegrations] = useState<DeveloperGitIntegration[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<DeveloperGitIntegration | null>(null);
  const [prs, setPrs] = useState<IngestedPrArtifact[]>([]);
  const [evaluation, setEvaluation] = useState<PromotionEvaluation | null>(null);
  const [targetLevel, setTargetLevel] = useState<string>("L6_Staff");
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [newOwner, setNewOwner] = useState<string>("enterprise-core");
  const [newRepo, setNewRepo] = useState<string>("distributed-consensus-engine");
  const [newBranch, setNewBranch] = useState<string>("main");
  const [message, setMessage] = useState<string | null>(null);

  const defaultUserId = "6d940ce2-2fc7-4525-9aff-af62f1956550";

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Seed first
      await fetch("http://localhost:5000/api/promotion/seed", { method: "POST" });
      
      const res = await fetch(`http://localhost:5000/api/promotion/integrations?userId=${defaultUserId}`);
      if (res.ok) {
        const data: DeveloperGitIntegration[] = await res.json();
        setIntegrations(data);
        if (data.length > 0) {
          setSelectedIntegration(data[0]);
          loadPrs(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load initial data", err);
    }
  }

  async function loadPrs(integrationId: string) {
    try {
      const res = await fetch(`http://localhost:5000/api/promotion/github/prs/${integrationId}`);
      if (res.ok) {
        const data = await res.json();
        setPrs(data);
      }
    } catch (err) {
      console.error("Failed to load PRs", err);
    }
  }

  async function handleSync() {
    if (!selectedIntegration) return;
    setIsSyncing(true);
    setMessage(null);
    try {
      const res = await fetch(`http://localhost:5000/api/promotion/github/sync/${selectedIntegration.id}`, {
        method: "POST"
      });
      if (res.ok) {
        const result = await res.json();
        setMessage(`Sync complete! Ingested ${result.prsIngested} PRs with average blast radius ${result.averageBlastRadius}%.`);
        loadPrs(selectedIntegration.id);
      }
    } catch (err) {
      console.error("Failed to sync repository", err);
      setMessage("Sync encountered an error.");
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleEvaluate() {
    setIsEvaluating(true);
    setMessage(null);
    try {
      const payload = {
        userId: defaultUserId,
        candidateName: "Alex Chen",
        targetLevel: targetLevel,
        reviewPeriod: "H1_2026",
        integrationId: selectedIntegration?.id
      };
      const res = await fetch("http://localhost:5000/api/promotion/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data: PromotionEvaluation = await res.json();
        setEvaluation(data);
        setMessage(`Promotion review committee completed evaluation for ${targetLevel}! Overall readiness: ${data.overallReadinessScore}%.`);
      }
    } catch (err) {
      console.error("Evaluation failed", err);
      setMessage("Promotion review failed.");
    } finally {
      setIsEvaluating(false);
    }
  }

  async function handleConnectRepo(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = {
        userId: defaultUserId,
        provider: "GitHub",
        repositoryOwner: newOwner,
        repositoryName: newRepo,
        branchTracked: newBranch,
        personalAccessToken: "ghp_simulated_token_" + Math.random().toString(36).substring(7)
      };
      const res = await fetch("http://localhost:5000/api/promotion/github/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setShowConnectModal(false);
        await loadData();
        setMessage(`Connected repository ${newOwner}/${newRepo} successfully.`);
      }
    } catch (err) {
      console.error("Failed to connect repo", err);
    }
  }

  function getVerdictColor(verdict: string) {
    if (verdict === "Ready_For_Promotion") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (verdict === "On_Track") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-rose-500/20 text-rose-400 border-rose-500/30";
  }

  function getCategoryColor(cat: string) {
    switch (cat) {
      case "Distributed_Consensus":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30";
      case "Security_CVE":
        return "bg-rose-500/20 text-rose-400 border-rose-500/30";
      case "Core_Infrastructure":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Performance_Optimization":
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      default:
        return "bg-slate-700/30 text-slate-300 border-slate-700/50";
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Breadcrumb & Navigation */}
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
          <span className="text-cyan-400 font-medium">Promotion Review Simulator</span>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            href="/leadership/simulator"
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-all"
          >
            ← Staff Management Simulator
          </Link>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>GitHub Live Sync Active</span>
          </span>
        </div>
      </div>

      {/* Main Header / Banner */}
      <div className="max-w-7xl mx-auto mb-8 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/40 p-6 md:p-8 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 text-xs font-bold uppercase tracking-wider border border-cyan-500/30">
                Phase 36 • Lifelong Career OS
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-500/30">
                Google/Meta Leveling Rubrics
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
              Continuous Promotion Review & Git Impact Simulator
            </h1>
            <p className="text-slate-400 text-sm md:text-base max-w-2xl">
              Ingest real-world GitHub merged PRs, architectural decision records (ADRs), and cross-team RFCs.
              Benchmark your technical blast radius against Staff (L6) and Principal (L7) promotion committee rubrics before the real review.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setShowConnectModal(true)}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-all shadow-md flex items-center justify-center space-x-2"
            >
              <svg className="w-4 h-4 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Connect Repo</span>
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing || !selectedIntegration}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-cyan-600/20 flex items-center justify-center space-x-2"
            >
              {isSyncing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Syncing PRs...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Sync Ingested PRs</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Global Notification Banner */}
      {message && (
        <div className="max-w-7xl mx-auto mb-6 p-4 rounded-xl bg-cyan-950/50 border border-cyan-800 text-cyan-300 text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-cyan-400 hover:text-white font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* Grid: Left Column (Repos & Ingested PRs) vs Right Column (Review Board Simulator) */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: 7 Cols */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Repository Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Tracked Repositories</span>
                <span className="px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-300">
                  {integrations.length}
                </span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {integrations.map((i) => (
                <div
                  key={i.id}
                  onClick={() => {
                    setSelectedIntegration(i);
                    loadPrs(i.id);
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedIntegration?.id === i.id
                      ? "bg-slate-800/90 border-cyan-500 shadow-md shadow-cyan-500/10"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-cyan-400">{i.provider}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {i.syncStatus}
                    </span>
                  </div>
                  <div className="font-bold text-slate-200 text-sm truncate">
                    {i.repositoryOwner}/{i.repositoryName}
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-slate-400">
                    <span>Branch: <span className="text-slate-300">{i.branchTracked}</span></span>
                    <span>{i.totalPrsIngested} PRs Ingested</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ingested Merged PR Artifacts Timeline */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Merged PR Impact Timeline</h2>
                <p className="text-xs text-slate-400">
                  Real code complexity, cross-module blast radius, and architectural design docs
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">
                {prs.length} Artifacts Verified
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {prs.map((pr) => (
                <div
                  key={pr.id}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 font-mono text-cyan-400 font-bold text-xs">
                        {pr.prNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getCategoryColor(pr.architecturalCategory)}`}>
                        {pr.architecturalCategory.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Merged {new Date(pr.mergedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-200 text-sm">
                    {pr.title}
                  </h3>

                  {/* Metrics Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Blast Radius</div>
                      <div className="text-sm font-bold text-cyan-400">{pr.blastRadiusScore}%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Complexity</div>
                      <div className="text-sm font-bold text-purple-400">{pr.complexityScore}%</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Files Changed</div>
                      <div className="text-sm font-bold text-slate-300">{pr.filesChanged} files</div>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Lines Diff</div>
                      <div className="text-sm font-bold">
                        <span className="text-emerald-400">+{pr.additions}</span>{" "}
                        <span className="text-rose-400">-{pr.deletions}</span>
                      </div>
                    </div>
                  </div>

                  {/* Design Doc RFC Tag */}
                  {pr.designDocSummary && (
                    <div className="p-2.5 rounded-lg bg-cyan-950/20 border border-cyan-900/40 text-xs text-cyan-300 flex items-start space-x-2">
                      <span className="font-bold text-cyan-400">RFC/ADR:</span>
                      <span>{pr.designDocSummary}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 5 Cols (Promotion Committee Simulator) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5 sticky top-8">
            <div>
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-xs font-bold uppercase tracking-wider border border-purple-500/30">
                Annual Review Simulator
              </span>
              <h2 className="text-xl font-bold text-white mt-1">
                Promotion Committee Hearing
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Calibrated against Google, Meta, and Stripe Staff/Principal leveling criteria
              </p>
            </div>

            {/* Level Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Target Promotion Level
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "L5_Senior", label: "L5 Senior" },
                  { id: "L6_Staff", label: "L6 Staff" },
                  { id: "L7_Principal", label: "L7 Principal" }
                ].map((lvl) => (
                  <button
                    key={lvl.id}
                    onClick={() => setTargetLevel(lvl.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      targetLevel === lvl.id
                        ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                    }`}
                  >
                    {lvl.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleEvaluate}
              disabled={isEvaluating}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-sm shadow-xl shadow-purple-900/30 transition-all flex items-center justify-center space-x-2"
            >
              {isEvaluating ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Convening Promotion Committee...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Simulate Committee Hearing</span>
                </>
              )}
            </button>

            {/* Evaluation Scorecard Results */}
            {evaluation && (
              <div className="space-y-5 pt-4 border-t border-slate-800">
                {/* Verdict Pill & Overall Score */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Committee Verdict</div>
                    <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${getVerdictColor(evaluation.committeeVerdict)}`}>
                      {evaluation.committeeVerdict.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-slate-400 font-semibold uppercase">Readiness Score</div>
                    <div className="text-2xl font-black text-cyan-400">
                      {evaluation.overallReadinessScore}%
                    </div>
                  </div>
                </div>

                {/* 4-Vector Breakdown */}
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Architectural Impact (35%)</span>
                    <span className="font-bold text-cyan-400">{evaluation.architecturalImpactScore}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-cyan-500 h-full rounded-full" style={{ width: `${evaluation.architecturalImpactScore}%` }} />
                  </div>

                  <div className="flex justify-between text-slate-300 pt-2">
                    <span>Organizational Influence (30%)</span>
                    <span className="font-bold text-purple-400">{evaluation.orgInfluenceScore}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${evaluation.orgInfluenceScore}%` }} />
                  </div>

                  <div className="flex justify-between text-slate-300 pt-2">
                    <span>Technical Leadership (25%)</span>
                    <span className="font-bold text-amber-400">{evaluation.technicalLeadershipScore}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${evaluation.technicalLeadershipScore}%` }} />
                  </div>

                  <div className="flex justify-between text-slate-300 pt-2">
                    <span>Execution Velocity (10%)</span>
                    <span className="font-bold text-emerald-400">{evaluation.executionVelocityScore}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${evaluation.executionVelocityScore}%` }} />
                  </div>
                </div>

                {/* Leveling Gaps Checklist */}
                {evaluation.levelingGaps.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1">
                      <span>Leveling Gaps to Close</span>
                    </div>
                    <div className="space-y-1.5">
                      {evaluation.levelingGaps.map((gap, idx) => (
                        <div key={idx} className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 flex items-start space-x-2">
                          <span className="text-amber-400 font-bold">•</span>
                          <span>{gap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 360 Peer Feedback Committee */}
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Calibrated 360 Peer Feedback
                  </div>
                  <div className="space-y-2.5">
                    {evaluation.peerFeedback360.map((peer, idx) => (
                      <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-200">{peer.peerName}</span>
                          <span className="text-[10px] font-semibold text-cyan-400">{peer.sentiment}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">{peer.peerRole}</div>
                        <p className="text-xs text-slate-300 italic pt-1 border-t border-slate-900">
                          "{peer.commentary}"
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Connect Repo Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-white">Connect GitHub Repository</h3>
              <button onClick={() => setShowConnectModal(false)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>
            <form onSubmit={handleConnectRepo} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Repository Owner</label>
                <input
                  type="text"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Repository Name</label>
                <input
                  type="text"
                  value={newRepo}
                  onChange={(e) => setNewRepo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Branch Tracked</label>
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
                >
                  Connect & Sync
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

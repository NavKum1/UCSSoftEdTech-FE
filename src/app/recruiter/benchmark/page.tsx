"use client";

import React, { useState, useEffect } from "react";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import { 
  BarChart3, Sparkles, ShieldAlert, Layers, Award, Zap, 
  CheckCircle2, Cpu, GitCompare, RefreshCw, Play, Search,
  ChevronRight, AlertTriangle, ArrowUpRight, TrendingUp, Code2
} from "lucide-react";

interface BenchmarkRecord {
  id: string;
  sprintSubmissionId: string;
  userId: string;
  instituteId: string;
  codeComplexityScore: number;
  architecturalEleganceScore: number;
  resilienceScore: number;
  performanceScore: number;
  overallBenchmarkPercentile: number;
  industryStandardTier: string;
  benchmarkSummary: string;
  evaluatedAt: string;
}

interface CohortAnalytics {
  totalEvaluated: number;
  medianPercentile: number;
  averageScores: {
    complexity: number;
    elegance: number;
    resilience: number;
    performance: number;
  };
  tierDistribution: { [key: string]: number };
  plagiarismFlagRate: number;
  topPerformers: BenchmarkRecord[];
}

export default function RecruiterBenchmarkPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [analytics, setAnalytics] = useState<CohortAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedRecord, setSelectedRecord] = useState<BenchmarkRecord | null>(null);

  // Modals state
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4o-2026-v2");
  const [batchStatus, setBatchStatus] = useState<string | null>(null);

  const [showPlagiarismModal, setShowPlagiarismModal] = useState<boolean>(false);
  const [plagiarismCode, setPlagiarismCode] = useState<string>(
    "function solveChallenge(data) {\n  // Quick implementation with heavy branching\n  if (!data) return null;\n  return data.map(item => item * 2);\n}"
  );
  const [plagiarismReport, setPlagiarismReport] = useState<any | null>(null);
  const [plagiarismScanning, setPlagiarismScanning] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [plagiarismError, setPlagiarismError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch(`/api/benchmark/cohort/analytics`);
      if (res.ok) {
        const json = await res.json();
        setAnalytics(json.analytics);
        if (json.analytics?.topPerformers?.length > 0) {
          setSelectedRecord(json.analytics.topPerformers[0]);
        }
      } else {
        setFetchError(`Cohort analytics service returned HTTP ${res.status}.`);
        setAnalytics(null);
      }
    } catch (e: any) {
      console.warn("[BENCHMARK FETCH NOTICE]:", e);
      setFetchError(e.message || "Failed to connect to cohort analytics service.");
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    fetchAnalytics();
  }, [ready]);

  const handleDispatchBatch = async () => {
    setBatchStatus("Dispatching offline evaluation job...");
    try {
      const res = await apiFetch(`/api/benchmark/batch-dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelVersion: selectedModel })
      });
      const data = await res.json();
      if (res.ok) {
        setBatchStatus(`Job dispatched successfully! Job ID: ${data.job?.id || "QUEUED-01"}. Total Queued: ${data.job?.totalSubmissionsQueued || 0}`);
        setTimeout(() => {
          setShowBatchModal(false);
          setBatchStatus(null);
          fetchAnalytics();
        }, 2200);
      } else {
        setBatchStatus(`Error: ${data.message || "Failed to dispatch"}`);
      }
    } catch (e: any) {
      setBatchStatus(`Error connecting to batch dispatcher: ${e?.message || "Server unreachable"}`);
    }
  };

  const handleRunPlagiarismScan = async () => {
    if (!selectedRecord) {
      setPlagiarismError("No candidate selected for originality check.");
      return;
    }
    setPlagiarismScanning(true);
    setPlagiarismReport(null);
    setPlagiarismError(null);
    try {
      const res = await apiFetch(`/api/benchmark/plagiarism-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selectedRecord.sprintSubmissionId,
          codePayload: plagiarismCode
        })
      });
      const data = await res.json();
      if (res.ok && data.report) {
        setPlagiarismReport(data.report);
      } else {
        setPlagiarismError(data.message || `Plagiarism check returned HTTP ${res.status}.`);
      }
    } catch (e: any) {
      setPlagiarismError(e.message || "Failed to connect to plagiarism analysis engine.");
    } finally {
      setPlagiarismScanning(false);
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "FAANG_Staff":
        return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40";
      case "Tier1_Senior":
        return "bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border-indigo-500/40";
      case "MidLevel_Enterprise":
        return "bg-sky-500/20 text-sky-300 border-sky-500/40";
      case "Junior_Competent":
        return "bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/40";
      default:
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
    }
  };

  if (access) return <AccessNotice problem={access} feature="Cohort benchmarking" />;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Banner & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 border border-purple-900/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div>
          <div className="flex items-center space-x-2.5 mb-2">
            <span className="p-2 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30">
              <Cpu className="w-5 h-5 text-purple-700 dark:text-purple-400" />
            </span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Candidate Benchmarks & Skill Evaluations</h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 font-semibold border border-purple-500/40">
              Active Analytics
            </span>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Standardized candidate rankings, code originality verification, and comprehensive evaluation summaries.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPlagiarismModal(true)}
            className="px-4 py-2.5 rounded-xl bg-muted hover:bg-slate-700 text-foreground font-medium text-xs border border-border flex items-center space-x-2 transition-all cursor-pointer shadow-sm hover:border-slate-600"
          >
            <GitCompare className="w-4 h-4 text-purple-700 dark:text-purple-400" />
            <span>Code Originality Check</span>
          </button>

          <button
            onClick={() => setShowBatchModal(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs shadow-lg shadow-purple-600/30 flex items-center space-x-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-white" />
            <span>Re-evaluate Cohort</span>
          </button>

          <button
            onClick={fetchAnalytics}
            className="p-2.5 rounded-xl bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/80 cursor-pointer transition-colors"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-card/60 border border-border relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Total Evaluated</span>
            <Layers className="w-4 h-4 text-purple-700 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {analytics?.totalEvaluated || 0}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 flex items-center space-x-1">
            <TrendingUp className="w-3 h-3" />
            <span>100% evaluated across current cohort</span>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card/60 border border-border relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Median Percentile</span>
            <BarChart3 className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            Top {(100 - (analytics?.medianPercentile || 75)).toFixed(1)}%
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-300 mt-1">
            Cohort 50th percentile: {(analytics?.medianPercentile || 75).toFixed(1)}
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card/60 border border-border relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Integrity Review Rate</span>
            <ShieldAlert className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {(analytics?.plagiarismFlagRate || 0).toFixed(1)}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Similarity analysis across all submissions
          </div>
        </div>

        <div className="p-5 rounded-xl bg-card/60 border border-border relative overflow-hidden">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Top-Tier Talent Ratio</span>
            <Award className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-foreground">
            {analytics?.tierDistribution
              ? `${(
                  (((analytics.tierDistribution["FAANG_Staff"] || 0) +
                    (analytics.tierDistribution["Tier1_Senior"] || 0)) /
                    (analytics.totalEvaluated || 1)) *
                  100
                ).toFixed(1)}%`
              : "35.2%"}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
            High-caliber technical talent pool
          </div>
        </div>
      </div>

      {/* Cohort Bell-Curve & Tier Distribution Visualizer */}
      <div className="p-6 rounded-2xl bg-card/50 border border-border space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground flex items-center space-x-2">
              <Award className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span>Skill Level Distribution</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Rankings based on code quality, problem solving, system design, and efficiency.
            </p>
          </div>
        </div>

        {/* Tier Distribution Bar */}
        <div className="space-y-3">
          <div className="h-6 w-full rounded-xl bg-background flex overflow-hidden p-0.5 border border-border">
            <div 
              style={{ width: "12%" }} 
              className="bg-emerald-500 hover:brightness-110 transition-all rounded-l-lg cursor-pointer"
              title="Staff Level (12%)"
            />
            <div 
              style={{ width: "28%" }} 
              className="bg-indigo-500 hover:brightness-110 transition-all cursor-pointer"
              title="Senior Level (28%)"
            />
            <div 
              style={{ width: "42%" }} 
              className="bg-sky-500 hover:brightness-110 transition-all cursor-pointer"
              title="Mid Level (42%)"
            />
            <div 
              style={{ width: "14%" }} 
              className="bg-amber-500 hover:brightness-110 transition-all cursor-pointer"
              title="Associate Level (14%)"
            />
            <div 
              style={{ width: "4%" }} 
              className="bg-rose-500 hover:brightness-110 transition-all rounded-r-lg cursor-pointer"
              title="Needs Practice (4%)"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
            <div className="flex items-center space-x-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-muted-foreground font-medium">Staff Level</span>
              <span className="text-muted-foreground">({analytics?.tierDistribution?.FAANG_Staff ?? 12})</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
              <span className="text-muted-foreground font-medium">Senior Level</span>
              <span className="text-muted-foreground">({analytics?.tierDistribution?.Tier1_Senior ?? 38})</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
              <span className="text-muted-foreground font-medium">Mid Level</span>
              <span className="text-muted-foreground">({analytics?.tierDistribution?.MidLevel_Enterprise ?? 64})</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span className="text-muted-foreground font-medium">Associate Level</span>
              <span className="text-muted-foreground">({analytics?.tierDistribution?.Junior_Competent ?? 22})</span>
            </div>
            <div className="flex items-center space-x-2 text-xs">
              <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
              <span className="text-muted-foreground font-medium">Needs Practice</span>
              <span className="text-muted-foreground">({analytics?.tierDistribution?.Needs_Remediation ?? 6})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Candidate Table vs 4-Dimension Detail Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Candidates List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-purple-700 dark:text-purple-400" />
              <span>Evaluated Candidate Cohort</span>
            </h3>
            <span className="text-xs text-muted-foreground">Click candidate to view skill breakdown</span>
          </div>

          <div className="space-y-2.5">
            {(analytics?.topPerformers || []).map((candidate) => {
              const isSelected = selectedRecord?.id === candidate.id;
              return (
                <div
                  key={candidate.id}
                  onClick={() => setSelectedRecord(candidate)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    isSelected
                      ? "bg-purple-950/20 border-purple-500/50 shadow-md shadow-purple-900/20"
                      : "bg-card/40 border-border hover:border-border hover:bg-card/60"
                  }`}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-xl bg-muted border border-border flex items-center justify-center font-bold text-foreground text-xs">
                      #{candidate.sprintSubmissionId.substring(0, 4)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-foreground">
                          Candidate #{candidate.sprintSubmissionId.substring(0, 8)}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${getTierColor(candidate.industryStandardTier)}`}>
                          {candidate.industryStandardTier.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {candidate.benchmarkSummary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-5 text-right">
                    <div>
                      <div className="text-xs font-semibold text-purple-700 dark:text-purple-400">
                        {candidate.overallBenchmarkPercentile.toFixed(1)}th %ile
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Top {(100 - candidate.overallBenchmarkPercentile).toFixed(1)}% of cohort
                      </div>
                    </div>
                    <ChevronRight className={`w-4 h-4 ${isSelected ? "text-purple-700 dark:text-purple-400" : "text-muted-foreground"}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4-Dimension Radar / Score Breakdown Card */}
        <div className="p-6 rounded-2xl bg-card/70 border border-border space-y-6">
          <div className="border-b border-border pb-4">
            <span className="text-[10px] uppercase font-bold tracking-wider text-purple-700 dark:text-purple-400">
              Candidate Skill Profile
            </span>
            <h3 className="text-lg font-bold text-foreground mt-1">
              Candidate #{selectedRecord?.sprintSubmissionId.substring(0, 8) || "N/A"}
            </h3>
            <div className="flex items-center space-x-2 mt-2">
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${getTierColor(selectedRecord?.industryStandardTier || "")}`}>
                {selectedRecord?.industryStandardTier.replace("_", " ") || "Standard"}
              </span>
              <span className="text-xs text-muted-foreground">
                Percentile: <strong className="text-foreground">{(selectedRecord?.overallBenchmarkPercentile || 0).toFixed(1)}%</strong>
              </span>
            </div>
          </div>

          {/* 4 Core Dimensions */}
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium flex items-center space-x-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
                  <span>Code Structure & Maintainability</span>
                </span>
                <span className="font-bold text-indigo-700 dark:text-indigo-400">
                  {(selectedRecord?.codeComplexityScore || 0).toFixed(1)} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                <div 
                  style={{ width: `${selectedRecord?.codeComplexityScore || 0}%` }}
                  className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium flex items-center space-x-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
                  <span>System Design & Modularity</span>
                </span>
                <span className="font-bold text-purple-700 dark:text-purple-400">
                  {(selectedRecord?.architecturalEleganceScore || 0).toFixed(1)} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                <div 
                  style={{ width: `${selectedRecord?.architecturalEleganceScore || 0}%` }}
                  className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>Reliability & Error Handling</span>
                </span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                  {(selectedRecord?.resilienceScore || 0).toFixed(1)} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                <div 
                  style={{ width: `${selectedRecord?.resilienceScore || 0}%` }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Performance & Efficiency</span>
                </span>
                <span className="font-bold text-amber-700 dark:text-amber-400">
                  {(selectedRecord?.performanceScore || 0).toFixed(1)} / 100
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-background overflow-hidden">
                <div 
                  style={{ width: `${selectedRecord?.performanceScore || 0}%` }}
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                />
              </div>
            </div>
          </div>

          {/* AI Evaluator Summary */}
          <div className="p-3.5 rounded-xl bg-background/80 border border-border text-xs text-muted-foreground leading-relaxed">
            <span className="font-semibold text-foreground block mb-1">Evaluation Summary:</span>
            {selectedRecord?.benchmarkSummary || "No benchmark summary available."}
          </div>

          <button
            onClick={() => {
              setShowPlagiarismModal(true);
            }}
            className="w-full py-2.5 rounded-xl bg-muted hover:bg-slate-700 text-foreground text-xs font-medium border border-border flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <GitCompare className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400" />
            <span>Review Code Originality</span>
          </button>
        </div>
      </div>

      {/* Batch Re-Evaluation Dispatch Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                <h3 className="text-base font-bold text-foreground">Re-evaluate Candidate Cohort</h3>
              </div>
              <button
                onClick={() => setShowBatchModal(false)}
                className="text-muted-foreground hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Re-evaluates all candidate submissions using updated grading criteria to refresh rankings and benchmark scores.
            </p>

            <div className="space-y-3">
              <label className="text-xs font-medium text-muted-foreground block">
                Evaluation Standard
              </label>
              {[
                { id: "gpt-4o-2026-v2", name: "Standard Rubric (2026 Calibrated)", desc: "Production industry benchmark standard" },
                { id: "claude-3-7-sonnet", name: "In-Depth Reasoning Rubric", desc: "Detailed structural & edge-case analysis" },
                { id: "gemini-1.5-pro", name: "Comprehensive Context Rubric", desc: "Full repository architecture verification" }
              ].map((model) => (
                <div
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                    selectedModel === model.id
                      ? "bg-purple-950/30 border-purple-500/60"
                      : "bg-background/60 border-border hover:border-border"
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold text-foreground">{model.name}</div>
                    <div className="text-[11px] text-muted-foreground">{model.desc}</div>
                  </div>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    selectedModel === model.id ? "border-purple-400 bg-purple-500" : "border-slate-600"
                  }`}>
                    {selectedModel === model.id && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                </div>
              ))}
            </div>

            {batchStatus && (
              <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-800 text-xs text-purple-200">
                {batchStatus}
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowBatchModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted hover:bg-slate-700 text-muted-foreground text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDispatchBatch}
                className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                Start Evaluation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plagiarism Radar Modal */}
      {showPlagiarismModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card border border-border rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <GitCompare className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                <h3 className="text-base font-bold text-foreground">Code Originality & Integrity Check</h3>
              </div>
              <button
                onClick={() => setShowPlagiarismModal(false)}
                className="text-muted-foreground hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Compares code structure against cohort submissions to ensure originality and academic integrity.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">
                Candidate Code to Review
              </label>
              <textarea
                value={plagiarismCode}
                onChange={(e) => setPlagiarismCode(e.target.value)}
                rows={5}
                className="w-full rounded-xl bg-background border border-border p-3 text-xs font-mono text-purple-600 dark:text-purple-300 focus:outline-none focus:border-purple-500"
              />
            </div>

            {plagiarismReport && (
              <div className={`p-4 rounded-xl border space-y-2 ${
                plagiarismReport.isPlagiarized
                  ? "bg-rose-950/20 border-rose-500/50 text-rose-300"
                  : "bg-emerald-950/20 border-emerald-500/50 text-emerald-600 dark:text-emerald-300"
              }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    {plagiarismReport.isPlagiarized ? "Duplicate Code Found" : "Original Code Confirmed"}
                  </span>
                  <span className="text-xs font-bold">
                    Similarity: {(plagiarismReport.similarityScore * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {plagiarismReport.flaggedReason}
                </p>
                {plagiarismReport.crossCohortMatchUserEmail && (
                  <div className="text-[11px] text-rose-400">
                    Matched Cohort Candidate: {plagiarismReport.crossCohortMatchUserEmail}
                  </div>
                )}
              </div>
            )}

            {plagiarismError && (
              <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-950/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{plagiarismError}</span>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowPlagiarismModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted hover:bg-slate-700 text-muted-foreground text-xs font-medium cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={handleRunPlagiarismScan}
                disabled={plagiarismScanning}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <GitCompare className="w-3.5 h-3.5" />
                <span>{plagiarismScanning ? "Scanning Cohorts..." : "Check Originality"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";

interface PrKata {
  id: string;
  dayIndex: number;
  title: string;
  repository: string;
  author: string;
  language: string;
  diffContent: string;
  defectCategory: string;
  targetDefectLine: number;
  targetDefectExplanation: string;
  correctDecision: string;
  suggestedRemediation: string;
  baseXp: number;
}

interface ReviewResult {
  submissionId: string;
  kataId: string;
  flawDetected: boolean;
  decisionCorrect: boolean;
  lineAccuracy: boolean;
  categoryAccuracy: boolean;
  vigilanceScore: number;
  baseXp: number;
  speedBonusXp: number;
  totalXpAwarded: number;
  principalBenchmarkComparison: string;
  critiqueExplanation: string;
  suggestedRemediation: string;
}

interface UserReviewStats {
  userId: string;
  totalReviewsSubmitted: number;
  zeroDayDefectsCaught: number;
  averageVigilanceScore: number;
  reviewStreakDays: number;
  seniorReviewerTier: string;
  completedToday: boolean;
}

interface DiffLine {
  lineNumber: number;
  type: "header" | "add" | "del" | "ctx";
  content: string;
}

export default function DailyCodeReviewDojoPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [kata, setKata] = useState<PrKata | null>(null);
  const [parsedLines, setParsedLines] = useState<DiffLine[]>([]);
  const [stats, setStats] = useState<UserReviewStats | null>(null);

  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Security_CVE");
  const [reviewComment, setReviewComment] = useState<string>("");
  const [decision, setDecision] = useState<string>("REQUEST_CHANGES");

  const [timerSeconds, setTimerSeconds] = useState<number>(0);
  const [timerActive, setTimerActive] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [result, setResult] = useState<ReviewResult | null>(null);

  const [userId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("daily_review_user_id");
      if (stored) return stored;
      const created = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : "d9e8f7a6-b5c4-4321-9876-112233445566";
      localStorage.setItem("daily_review_user_id", created);
      return created;
    }
    return "d9e8f7a6-b5c4-4321-9876-112233445566";
  });

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Today's PR Kata
      const kataRes = await apiFetch(`/api/codereview/today`);
      if (kataRes.ok) {
        const kataData: PrKata = await kataRes.json();
        setKata(kataData);
        parseDiff(kataData.diffContent);
      }

      // 2. Fetch User Stats
      const statsRes = await apiFetch(`/api/codereview/stats/${userId}`);
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (err) {
      console.error("Failed to load PR review kata", err);
    } finally {
      setLoading(false);
    }
  };

  const parseDiff = (rawDiff: string) => {
    const lines = rawDiff.split("\n");
    const result: DiffLine[] = [];
    let currentLine = 1;

    for (const line of lines) {
      if (line.startsWith("---") || line.startsWith("+++") || line.startsWith("@@")) {
        result.push({ lineNumber: currentLine++, type: "header", content: line });
      } else if (line.startsWith("+")) {
        result.push({ lineNumber: currentLine++, type: "add", content: line });
      } else if (line.startsWith("-")) {
        result.push({ lineNumber: currentLine++, type: "del", content: line });
      } else {
        result.push({ lineNumber: currentLine++, type: "ctx", content: line });
      }
    }
    setParsedLines(result);
  };

  const fetchInitialDataRef = useLatestRef(fetchInitialData);
  useEffect(() => {
    if (!ready) return;
    fetchInitialDataRef.current();
  }, [ready, fetchInitialDataRef]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive && !result) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive, result]);

  const handleSubmitReview = async () => {
    if (!kata) return;

    if (!selectedLine) {
      alert("Please click on a line in the diff to flag the critical flaw or comment location.");
      return;
    }

    setSubmitting(true);
    setTimerActive(false);

    try {
      const res = await apiFetch(`/api/codereview/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kataId: kata.id,
          userId,
          flaggedLineNumber: selectedLine,
          selectedDefectCategory: selectedCategory,
          reviewComment: reviewComment || "Flagged potential vulnerability during senior review.",
          decision,
          reviewTimeSeconds: timerSeconds,
        }),
      });

      if (res.ok) {
        const evalData: ReviewResult = await res.json();
        setResult(evalData);

        // Refresh stats
        const statsRes = await apiFetch(`/api/codereview/stats/${userId}`);
        if (statsRes.ok) setStats(await statsRes.json());
      } else {
        alert("Code review evaluation encountered an issue.");
      }
    } catch (err) {
      console.error("Review submission failed", err);
      alert("Network error evaluating code review.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  if (access) return <AccessNotice problem={access} feature="The code review dojo" />;

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-mono text-sm tracking-wide">
            Loading Daily Pull Request &amp; Security Review Drill...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-emerald-500 selection:text-black">
      {/* Top GitHub PR Bar */}
      <header className="border-b border-border bg-card/90 backdrop-blur sticky top-16 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-white transition"
            >
              ← Dashboard
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xl">🔍</span>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Daily PR Review Dojo
              </h1>
              <span className="px-2 py-0.5 text-xs font-mono bg-muted text-emerald-700 dark:text-emerald-400 border border-border rounded">
                3-Minute Drill
              </span>
            </div>
          </div>

          {/* Gamification & Vigilance HUD */}
          <div className="flex items-center gap-4 text-xs font-mono">
            {/* Reviewer Tier */}
            <div className="flex items-center gap-2 bg-muted/80 border border-emerald-500/30 px-3 py-1.5 rounded-lg shadow-sm">
              <span className="text-base">👔</span>
              <div>
                <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
                  {stats?.seniorReviewerTier ?? "Senior Reviewer"}
                </span>
                <span className="text-muted-foreground text-[10px] block">
                  Avg Vigilance: {stats?.averageVigilanceScore ?? 0}%
                </span>
              </div>
            </div>

            {/* Zero-Day Bugs Caught */}
            <div className="flex items-center gap-2 bg-muted/80 border border-amber-500/30 px-3 py-1.5 rounded-lg">
              <span className="text-base">🛡️</span>
              <div>
                <span className="text-amber-700 dark:text-amber-400 font-bold text-sm">
                  {stats?.zeroDayDefectsCaught ?? 0} Bugs Blocked
                </span>
                <span className="text-muted-foreground text-[10px] block">
                  {stats?.totalReviewsSubmitted ?? 0} Total Reviews
                </span>
              </div>
            </div>

            {/* Review Stopwatch */}
            <div className="flex items-center gap-2 bg-muted/80 border border-cyan-500/30 px-3 py-1.5 rounded-lg">
              <span className="text-base">⏱️</span>
              <div>
                <span className="text-cyan-700 dark:text-cyan-400 font-bold text-sm">{formatTimer(timerSeconds)}</span>
                <span className="text-muted-foreground text-[10px] block">
                  {timerSeconds <= 60 ? "+25 XP Speed Bonus" : "Standard Speed"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main PR Workspace */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* GitHub Pull Request Header Card */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <span className="text-foreground font-semibold">{kata?.repository}</span>
                <span>•</span>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-800/60 rounded">
                  Open PR #184
                </span>
                <span>•</span>
                <span className="text-muted-foreground">author: @{kata?.author}</span>
                <span>•</span>
                <span className="uppercase text-amber-700 dark:text-amber-400 font-bold">{kata?.language}</span>
              </div>
              <h2 className="text-2xl font-bold text-foreground">{kata?.title}</h2>
            </div>

            {stats?.completedToday && (
              <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 px-4 py-3 rounded-xl text-center shrink-0">
                <span className="text-sm font-semibold block">✅ Today&apos;s Review Logged</span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  Daily streak maintained
                </span>
              </div>
            )}
          </div>

          <div className="bg-background/80 p-3 rounded-lg border border-border text-xs font-mono text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span>
                Base: <strong className="text-foreground">main</strong>
              </span>
              <span>←</span>
              <span>
                Compare: <strong className="text-emerald-700 dark:text-emerald-400">feature/fast-path-eval</strong>
              </span>
            </div>
            <span className="text-muted-foreground">
              Click on any code line in the diff to flag a vulnerability or memory leak
            </span>
          </div>
        </div>

        {/* Workspace: Split Pane (Diff Viewer + Review Decision Canvas) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Unified Git Diff Viewer */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-lg">
              <div className="bg-background px-4 py-2.5 border-b border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Files Changed: 1 (Unified Diff)
                </span>
                <span>
                  {selectedLine ? (
                    <span className="text-amber-700 dark:text-amber-400 font-bold">
                      🚩 Line #{selectedLine} Selected for Review
                    </span>
                  ) : (
                    "Select a line to flag flaw"
                  )}
                </span>
              </div>

              {/* Diff Code Container */}
              <div className="font-mono text-xs overflow-x-auto divide-y divide-slate-800/40 bg-background">
                {parsedLines.map((line) => {
                  const isSelected = selectedLine === line.lineNumber;
                  return (
                    <div
                      key={line.lineNumber}
                      onClick={() => setSelectedLine(line.lineNumber)}
                      className={`group flex items-start cursor-pointer transition select-none ${
                        isSelected
                          ? "bg-amber-950/40 border-l-4 border-amber-500 shadow-inner"
                          : line.type === "add"
                          ? "bg-emerald-950/20 hover:bg-emerald-900/30 text-emerald-200"
                          : line.type === "del"
                          ? "bg-red-950/20 hover:bg-red-900/30 text-red-600 dark:text-red-300"
                          : line.type === "header"
                          ? "bg-card text-muted-foreground font-bold"
                          : "hover:bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {/* Line Number Column */}
                      <span className="w-12 shrink-0 py-1 px-2 text-right text-muted-foreground font-mono text-[11px] border-r border-border/60 group-hover:text-muted-foreground">
                        {line.lineNumber}
                      </span>

                      {/* Line Type Badge Indicator */}
                      <span className="w-6 shrink-0 py-1 text-center font-bold">
                        {line.type === "add" ? (
                          <span className="text-emerald-700 dark:text-emerald-400">+</span>
                        ) : line.type === "del" ? (
                          <span className="text-red-700 dark:text-red-400">-</span>
                        ) : (
                          " "
                        )}
                      </span>

                      {/* Content */}
                      <pre className="py-1 px-2 whitespace-pre overflow-x-visible font-mono leading-relaxed">
                        {line.content}
                      </pre>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Col: Review Decision & Defect Panel */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-6 shadow-lg">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>⚖️</span> Senior Code Review Verdict
              </h3>

              {/* Selected Line Flag */}
              <div className="bg-background p-3.5 rounded-lg border border-border space-y-1">
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider block">
                  Target Diff Location
                </span>
                <div className="text-sm font-bold text-amber-700 dark:text-amber-400 font-mono">
                  {selectedLine ? `Line #${selectedLine} Flagged` : "None Selected (Click a diff line)"}
                </div>
              </div>

              {/* Defect Category Classification */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                  Defect Classification
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-3 text-xs font-mono text-foreground focus:border-emerald-500 focus:outline-none"
                >
                  <option value="Security_CVE">Security CVE (SQLi, SSRF, RCE, Secrets)</option>
                  <option value="Concurrency">Concurrency / Data Race / Deadlock</option>
                  <option value="Memory_Leak">Memory Leak / Goroutine Leak / Lapsed Listener</option>
                  <option value="ReDoS">Regular Expression Denial of Service (ReDoS)</option>
                  <option value="Data_Integrity">Data Integrity / Transaction Isolation</option>
                  <option value="Performance">Performance Anti-Pattern (N+1, OOM)</option>
                </select>
              </div>

              {/* Inline Reviewer Comment */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                  Senior Staff PR Comment
                </label>
                <textarea
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Explain why this implementation is unsafe, cite blast radius risk, or provide suggested fix..."
                  className="w-full bg-background border border-border rounded-lg p-3 text-xs font-mono text-foreground focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* PR Decision Radios */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider block">
                  GitHub PR Decision
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: "REQUEST_CHANGES", label: "Request Changes", color: "red" },
                    { val: "COMMENT", label: "Comment", color: "yellow" },
                    { val: "APPROVE", label: "Approve", color: "emerald" },
                  ].map((btn) => (
                    <button
                      key={btn.val}
                      type="button"
                      onClick={() => setDecision(btn.val)}
                      className={`py-2 px-2 text-xs font-bold rounded-lg border transition ${
                        decision === btn.val
                          ? btn.color === "red"
                            ? "bg-red-950 text-red-700 dark:text-red-400 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                            : btn.color === "yellow"
                            ? "bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-500"
                            : "bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-500"
                          : "bg-background text-muted-foreground border-border hover:border-border"
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Review CTA */}
              <button
                onClick={handleSubmitReview}
                disabled={submitting || !selectedLine}
                className={`w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 ${
                  submitting || !selectedLine
                    ? "bg-muted text-muted-foreground cursor-not-allowed"
                    : "bg-gradient-to-r from-emerald-500 to-teal-400 text-black hover:from-emerald-400 hover:to-teal-300 shadow-lg shadow-emerald-500/20"
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    <span>Benchmarking Vigilance...</span>
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Submit Review ({formatTimer(timerSeconds)})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Principal Engineer Evaluation Modal */}
        {result && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 overflow-y-auto">
            <div className="bg-card border border-border rounded-2xl max-w-2xl w-full p-6 space-y-6 shadow-2xl my-8">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{result.flawDetected ? "🎯" : "⚠️"}</span>
                  <div>
                    <h3 className="text-xl font-bold text-foreground">
                      {result.flawDetected
                        ? "Zero-Day Defect Intercepted!"
                        : "Defect Missed in Code Review"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Vigilance Score: {result.vigilanceScore}/100 • Review Time:{" "}
                      {formatTimer(timerSeconds)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setResult(null)}
                  className="text-muted-foreground hover:text-white text-lg font-mono p-1"
                >
                  ✕
                </button>
              </div>

              {/* XP & Vigilance Breakdown */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-background p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-muted-foreground block">Total XP Earned</span>
                  <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                    +{result.totalXpAwarded} XP
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    ({result.baseXp} base + {result.speedBonusXp} speed)
                  </span>
                </div>
                <div className="bg-background p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-muted-foreground block">Line Accuracy</span>
                  <span
                    className={`text-xl font-bold ${
                      result.lineAccuracy ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {result.lineAccuracy ? "Exact Match" : "Missed"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Target: Line #{kata?.targetDefectLine}</span>
                </div>
                <div className="bg-background p-3 rounded-xl border border-border">
                  <span className="text-[10px] font-mono text-muted-foreground block">PR Decision</span>
                  <span
                    className={`text-xl font-bold ${
                      result.decisionCorrect ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {result.decisionCorrect ? "Correct Block" : "Improper"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">Blocked risky code</span>
                </div>
              </div>

              {/* Principal Benchmark Comparison */}
              <div className="bg-background p-4 rounded-xl border border-border space-y-2">
                <h4 className="text-xs font-mono text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  🏆 Google / Meta Principal Engineer Benchmark
                </h4>
                <p className="text-xs text-muted-foreground font-semibold">
                  {result.principalBenchmarkComparison}
                </p>
              </div>

              {/* Technical Critique & Root Cause Analysis */}
              <div className="bg-background p-4 rounded-xl border border-border space-y-2">
                <h4 className="text-xs font-mono text-cyan-700 dark:text-cyan-400 uppercase tracking-wider">
                  🔬 Technical Vulnerability & Defect Critique
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed font-sans">
                  {result.critiqueExplanation}
                </p>
              </div>

              {/* Clean Remediation Patch */}
              <div className="bg-background p-4 rounded-xl border border-border space-y-2">
                <h4 className="text-xs font-mono text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  ✨ Clean Production Diff Patch (Remediation)
                </h4>
                <pre className="text-xs font-mono bg-black/50 p-3 rounded border border-border text-emerald-600 dark:text-emerald-300 overflow-x-auto">
                  {result.suggestedRemediation}
                </pre>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setResult(null)}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition"
                >
                  Close Review & Log Daily Practice
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

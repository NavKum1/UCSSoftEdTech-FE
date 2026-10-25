"use client";

import React, { useState, useEffect } from "react";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import {
  Server,
  Zap,
  Database,
  RefreshCw,
  Layers,
  Trash2,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Flame,
} from "lucide-react";

interface QueueStats {
  workerNodeId: string;
  pendingHighPriorityCount: number;
  pendingStandardCount: number;
  totalPending: number;
  totalJobsProcessed: number;
  totalDeadLetterCount: number;
  operationalMode: string;
}

interface CacheStats {
  hitsCount: number;
  missesCount: number;
  hitRatioPercentage: number;
  totalKeysCount: number;
  activeTagsCount: number;
  evictionsCount: number;
  lastInvalidationTimestamp: string | null;
}

export default function SystemOperationsDashboard() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLog, setActionLog] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);


  const fetchMetrics = async () => {
    try {
      const [queueRes, cacheRes] = await Promise.all([
        apiFetch(`/api/system/queue/status`),
        apiFetch(`/api/system/cache/stats`),
      ]);

      if (queueRes.ok) {
        setQueueStats(await queueRes.json());
      }
      if (cacheRes.ok) {
        setCacheStats(await cacheRes.json());
      }
    } catch (err) {
      console.error("Failed to fetch system operations metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetricsRef = useLatestRef(fetchMetrics);
  useEffect(() => {
    if (!ready) return;
    fetchMetricsRef.current();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, [ready, fetchMetricsRef]);

  const handleInvalidateCache = async (tag?: string, flushAll: boolean = false) => {
    setIsProcessing(true);
    try {
      const res = await apiFetch(`/api/system/cache/invalidate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tag, flushAll }),
      });

      const data = await res.json();
      setActionLog(data.message || "Cache action completed successfully.");
      await fetchMetrics();
    } catch {
      setActionLog("We couldn't clear the cache. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEnqueueBenchmarkJob = async (priority: "HighPriority" | "Standard") => {
    setIsProcessing(true);
    try {
      const res = await apiFetch(`/api/system/queue/enqueue-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority, taskName: `Synthetic ${priority} Benchmark` }),
      });

      const data = await res.json();
      setActionLog(`Test job added to the ${data.priority === "HighPriority" ? "high priority" : "standard"} queue.`);
      await fetchMetrics();
    } catch {
      setActionLog("We couldn't add the test job. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryDLQ = async () => {
    setIsProcessing(true);
    try {
      const res = await apiFetch(`/api/system/queue/retry-dlq`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      setActionLog(data.message || `Retried ${data.reEnqueuedCount} failed jobs.`);
      await fetchMetrics();
    } catch {
      setActionLog("We couldn't retry the failed jobs. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="System operations" />;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
                <Cpu className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Distributed Operations & Edge Cache Hub
              </h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Zero-polling priority channels, BullMQ-compatible execution queue, and multi-region edge caching.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Node: {queueStats?.workerNodeId || "Worker-01"}
            </span>
            <button
              onClick={fetchMetrics}
              className="p-2 rounded-lg bg-card border border-border hover:bg-muted text-muted-foreground transition-colors"
              title="Refresh Metrics"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Action Log Banner */}
        {actionLog && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-600 dark:text-indigo-300 text-xs font-mono">
            <CheckCircle2 className="w-4 h-4 text-indigo-700 dark:text-indigo-400 shrink-0" />
            <span>{actionLog}</span>
          </div>
        )}

        {/* Primary Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Edge Cache Hit Ratio */}
          <div className="glass-panel p-6 rounded-2xl border border-border bg-card/40 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="uppercase tracking-wider font-semibold">Cache Hit Ratio</span>
              <Flame className="w-4 h-4 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="text-3xl font-black text-foreground">
              {cacheStats ? `${cacheStats.hitRatioPercentage}%` : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {cacheStats?.hitsCount || 0} hits vs {cacheStats?.missesCount || 0} misses
            </p>
          </div>

          {/* Card 2: High Priority Queue Backlog */}
          <div className="glass-panel p-6 rounded-2xl border border-border bg-card/40 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="uppercase tracking-wider font-semibold">High-Priority Queue</span>
              <Zap className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
            </div>
            <div className="text-3xl font-black text-indigo-700 dark:text-indigo-400">
              {queueStats?.pendingHighPriorityCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pro Subscribers, Recruiters & LMS Exams
            </p>
          </div>

          {/* Card 3: Standard Priority Backlog */}
          <div className="glass-panel p-6 rounded-2xl border border-border bg-card/40 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="uppercase tracking-wider font-semibold">Standard Backlog</span>
              <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-foreground">
              {queueStats?.pendingStandardCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Free-Tier Candidate Sandbox Runs
            </p>
          </div>

          {/* Card 4: Dead Letter Queue Incidents */}
          <div className="glass-panel p-6 rounded-2xl border border-border bg-card/40 space-y-2">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span className="uppercase tracking-wider font-semibold">Dead Letter Queue</span>
              <AlertTriangle className="w-4 h-4 text-red-700 dark:text-red-400" />
            </div>
            <div className="text-3xl font-black text-red-700 dark:text-red-400">
              {queueStats?.totalDeadLetterCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Failed executions (&gt; 3 retry attempts)
            </p>
          </div>
        </div>

        {/* Detailed Operations Control Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel: Edge Cache Engine Operations */}
          <div className="p-6 rounded-2xl border border-border bg-card/50 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                <h2 className="text-lg font-bold text-foreground">Edge Caching Control Center</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 font-mono">
                {cacheStats?.totalKeysCount || 0} Keys Active
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block mb-1">Active Cache Tags</span>
                <span className="text-lg font-bold text-foreground font-mono">
                  {cacheStats?.activeTagsCount || 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-muted-foreground block mb-1">Eviction / Flush Count</span>
                <span className="text-lg font-bold text-foreground font-mono">
                  {cacheStats?.evictionsCount || 0}
                </span>
              </div>
            </div>

            {/* Invalidation Actions */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">
                Instant Tag-Based Invalidation
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={isProcessing}
                  onClick={() => handleInvalidateCache("credential")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-slate-700 text-xs text-white border border-border transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Purge &apos;credential&apos; Tag</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleInvalidateCache("leaderboard")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-slate-700 text-xs text-white border border-border transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Purge &apos;leaderboard&apos; Tag</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleInvalidateCache(undefined, true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/60 text-xs text-red-600 dark:text-red-300 border border-red-800/60 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-700 dark:text-red-400" />
                  <span>Flush All Edge Keys</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Distributed Job Queue Operations */}
          <div className="p-6 rounded-2xl border border-border bg-card/50 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <h2 className="text-lg font-bold text-foreground">Distributed Job Queue Dispatcher</h2>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 font-mono">
                {queueStats?.totalJobsProcessed || 0} Processed Total
              </span>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Asynchronous worker backplane with strict priority scheduling. High-priority jobs automatically supersede standard jobs without polling delays.
            </p>

            {/* Queue Actions */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold block">
                Queue Simulation & Benchmark Dispatch
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  disabled={isProcessing}
                  onClick={() => handleEnqueueBenchmarkJob("HighPriority")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium transition-colors"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Enqueue High-Priority Job</span>
                </button>
                <button
                  disabled={isProcessing}
                  onClick={() => handleEnqueueBenchmarkJob("Standard")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted hover:bg-slate-700 text-xs text-white border border-border transition-colors"
                >
                  <Play className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>Enqueue Standard Job</span>
                </button>
                <button
                  disabled={isProcessing || (queueStats?.totalDeadLetterCount ?? 0) === 0}
                  onClick={handleRetryDLQ}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600/30 hover:bg-amber-600/50 text-amber-600 dark:text-amber-300 border border-amber-600/40 text-xs transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                  <span>Retry Dead Letter Queue ({queueStats?.totalDeadLetterCount || 0})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import { Zap, Database, RefreshCw, Layers, Trash2, Play, RotateCcw, AlertTriangle, Flame } from "lucide-react";
import { Badge, Button, Card, PageHeader, StatTile } from "@/components/career/ui";
import LiveCheckCard from "@/components/admin/LiveCheckCard";
import AiUsageCard from "@/components/admin/AiUsageCard";

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

  const dash = loading ? "…" : "—";

  return (
    <div className="space-y-6 text-foreground">
      <PageHeader
        title="System status"
        description="A live check of every service an assessment needs, AI usage per school, and the background job queues and cache."
        actions={
          <>
            {queueStats?.workerNodeId && (
              <Badge tone="good">
                Worker <span className="ml-1 font-mono">{queueStats.workerNodeId}</span>
              </Badge>
            )}
            <Button variant="secondary" onClick={fetchMetrics} title="Refresh metrics">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
          </>
        }
      />

      <LiveCheckCard />

      <AiUsageCard />

      {actionLog && (
        <div role="status" className="rounded-lg border border-border bg-card p-3 text-sm text-foreground shadow-sm">
          {actionLog}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={<Flame />}
          label="Cache hit rate"
          value={cacheStats ? `${cacheStats.hitRatioPercentage}%` : dash}
          hint={cacheStats ? `${cacheStats.hitsCount} hits, ${cacheStats.missesCount} misses` : undefined}
        />
        <StatTile
          icon={<Zap />}
          label="High-priority queue"
          value={queueStats ? queueStats.pendingHighPriorityCount : dash}
          hint="Pro members, recruiters and exams"
        />
        <StatTile
          icon={<Layers />}
          label="Standard queue"
          value={queueStats ? queueStats.pendingStandardCount : dash}
          hint="Free-plan practice runs"
        />
        <StatTile
          icon={<AlertTriangle />}
          label="Failed jobs"
          value={queueStats ? queueStats.totalDeadLetterCount : dash}
          hint="Failed after 3 retries"
          tone={(queueStats?.totalDeadLetterCount ?? 0) > 0 ? "bad" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Cache" actions={cacheStats ? <Badge>{cacheStats.totalKeysCount} keys stored</Badge> : undefined}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Active tags</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{cacheStats ? cacheStats.activeTagsCount : dash}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Evictions and flushes</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{cacheStats ? cacheStats.evictionsCount : dash}</p>
            </div>
          </div>

          <h3 className="mb-2 mt-5 text-sm font-medium">Clear cached data</h3>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={isProcessing} onClick={() => handleInvalidateCache("credential")}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Clear credentials
            </Button>
            <Button variant="secondary" disabled={isProcessing} onClick={() => handleInvalidateCache("leaderboard")}>
              <Trash2 className="h-4 w-4" aria-hidden />
              Clear leaderboard
            </Button>
            <Button variant="danger" disabled={isProcessing} onClick={() => handleInvalidateCache(undefined, true)}>
              <Database className="h-4 w-4" aria-hidden />
              Clear entire cache
            </Button>
          </div>
        </Card>

        <Card title="Job queue" actions={queueStats ? <Badge>{queueStats.totalJobsProcessed} processed</Badge> : undefined}>
          <p className="text-sm text-muted-foreground">Background jobs run in priority order: high-priority jobs always go before standard ones.</p>

          <h3 className="mb-2 mt-5 text-sm font-medium">Test and recover</h3>
          <div className="flex flex-wrap gap-2">
            <Button disabled={isProcessing} onClick={() => handleEnqueueBenchmarkJob("HighPriority")}>
              <Play className="h-4 w-4" aria-hidden />
              Add high-priority test job
            </Button>
            <Button variant="secondary" disabled={isProcessing} onClick={() => handleEnqueueBenchmarkJob("Standard")}>
              <Play className="h-4 w-4" aria-hidden />
              Add standard test job
            </Button>
            <Button variant="secondary" disabled={isProcessing || (queueStats?.totalDeadLetterCount ?? 0) === 0} onClick={handleRetryDLQ}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Retry failed jobs ({queueStats?.totalDeadLetterCount ?? 0})
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

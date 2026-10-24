"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { AlertCircle, CheckCircle2, ClipboardList, Filter, Loader2, Mic, RefreshCw } from "lucide-react";

interface QueueRow {
  submissionId: string;
  candidateName: string | null;
  sprintTitle: string | null;
  submittedAt: string;
  status: string;
  passedTestsCount: number;
  totalTestsCount: number;
  integrityRiskLevel: string | null;
  defenseCompleted: boolean;
  latestDecision: string | null;
}

const RISK_STYLES: Record<string, { label: string; className: string }> = {
  Clear: { label: "Clear", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  Review: { label: "Review", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  HighRisk: { label: "High risk", className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  Unknown: { label: "Unknown", className: "bg-muted text-muted-foreground border-border" },
};

const DECISION_STYLES: Record<string, string> = {
  Advance: "text-emerald-700 dark:text-emerald-400",
  Hold: "text-amber-700 dark:text-amber-400",
  Decline: "text-rose-700 dark:text-rose-400",
};

function IntegrityBadge({ level }: { level: string | null | undefined }) {
  const style = RISK_STYLES[level ?? "Unknown"] ?? RISK_STYLES.Unknown;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style.className}`}>
      {style.label}
    </span>
  );
}

export default function EvidenceQueuePage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState<"all" | "undecided" | "decided">("undecided");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await authenticatedFetch("/api/evidence/queue?take=200", {}, getToken);
      if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? "You need recruiter access to view the review queue." : `Could not load the queue (HTTP ${res.status}).`);
      return (await res.json()) as QueueRow[];
    })()
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load the queue."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getToken, reloadKey]);

  const refresh = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const sprints = useMemo(
    () => Array.from(new Set(rows.map((r) => r.sprintTitle ?? "Untitled sprint"))).sort(),
    [rows]
  );

  const filtered = rows.filter((r) => {
    if (sprintFilter !== "all" && (r.sprintTitle ?? "Untitled sprint") !== sprintFilter) return false;
    if (riskFilter !== "all" && (r.integrityRiskLevel ?? "Unknown") !== riskFilter) return false;
    if (decisionFilter === "undecided" && r.latestDecision) return false;
    if (decisionFilter === "decided" && !r.latestDecision) return false;
    return true;
  });

  const selectClass = "px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
            <ClipboardList className="w-4 h-4" />
            Human review
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mt-1">Evidence review queue</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Each submission has an evidence pack: tests, code changes, AI usage, integrity signals and the voice defense.
            The platform does not advance or reject anyone; a reviewer records every decision with a rationale.
          </p>
        </div>
        <button
          onClick={refresh}
          className="self-start md:self-auto py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-medium text-muted-foreground flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Sprint
          <select className={selectClass} value={sprintFilter} onChange={(e) => setSprintFilter(e.target.value)}>
            <option value="all">All sprints</option>
            {sprints.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Integrity signals
          <select className={selectClass} value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
            <option value="all">Any level</option>
            <option value="Clear">Clear</option>
            <option value="Review">Review</option>
            <option value="HighRisk">High risk</option>
            <option value="Unknown">Unknown</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Decision
          <select className={selectClass} value={decisionFilter} onChange={(e) => setDecisionFilter(e.target.value as typeof decisionFilter)}>
            <option value="undecided">Awaiting decision</option>
            <option value="decided">Decided</option>
            <option value="all">All</option>
          </select>
        </label>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {rows.length} submissions
        </span>
      </div>

      <div className="glass-panel rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading submissions...
          </div>
        ) : error ? (
          <div className="p-8 flex flex-col items-center gap-3 text-sm text-rose-700 dark:text-rose-400">
            <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</div>
            <button onClick={refresh} className="text-xs underline text-muted-foreground hover:text-foreground cursor-pointer">Try again</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            {rows.length === 0 ? "No submissions yet." : "No submissions match these filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-border bg-muted/40">
                  <th className="py-3 px-4 font-semibold">Candidate</th>
                  <th className="py-3 px-4 font-semibold">Sprint</th>
                  <th className="py-3 px-4 font-semibold">Submitted</th>
                  <th className="py-3 px-4 font-semibold">Tests</th>
                  <th className="py-3 px-4 font-semibold">Integrity signals</th>
                  <th className="py-3 px-4 font-semibold">Defense</th>
                  <th className="py-3 px-4 font-semibold">Latest decision</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.submissionId}
                    onClick={() => router.push(`/recruiter/evidence/${r.submissionId}`)}
                    className="border-b border-border last:border-0 hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-foreground">
                      <Link href={`/recruiter/evidence/${r.submissionId}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                        {r.candidateName || "Unnamed candidate"}
                      </Link>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{r.sprintTitle || "Untitled sprint"}</td>
                    <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{new Date(r.submittedAt).toLocaleString()}</td>
                    <td className="py-3 px-4 text-foreground whitespace-nowrap">
                      {r.passedTestsCount}/{r.totalTestsCount}
                    </td>
                    <td className="py-3 px-4"><IntegrityBadge level={r.integrityRiskLevel} /></td>
                    <td className="py-3 px-4">
                      {r.defenseCompleted ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400"><Mic className="w-3.5 h-3.5" /> Completed</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not yet</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.latestDecision ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${DECISION_STYLES[r.latestDecision] ?? "text-foreground"}`}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> {r.latestDecision}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Awaiting review</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

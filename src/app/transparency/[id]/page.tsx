"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowLeft, Loader2 } from "lucide-react";
import TransparencyReportView from "@/components/transparency/TransparencyReportView";
import { TransparencyArchive, TransparencyIntro } from "@/components/transparency/TransparencyArchive";
import { fetchPublic, formatDate, formatPeriod, type ArchiveEntry, type PublicFetchResult, type PublishedReport } from "@/lib/transparency";

export default function TransparencyArchiveReportPage() {
  const params = useParams();
  const id = typeof params?.id === "string" ? params.id : "";
  const [result, setResult] = useState<{ id: string; value: PublicFetchResult<PublishedReport> } | null>(null);
  const [archive, setArchive] = useState<ArchiveEntry[]>([]);

  useEffect(() => {
    let active = true;
    fetchPublic<PublishedReport>(`/api/transparency/published/${encodeURIComponent(id)}`).then((value) => active && setResult({ id, value }));
    fetchPublic<ArchiveEntry[]>("/api/transparency/published").then((r) => active && r.kind === "ok" && setArchive(r.data));
    return () => {
      active = false;
    };
  }, [id]);

  const current = result?.id === id ? result.value : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <Link href="/transparency" className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
        <ArrowLeft className="w-3.5 h-3.5" /> Latest report
      </Link>
      <TransparencyIntro />

      {current == null ? (
        <div className="glass-panel rounded-2xl border border-border py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading report...
        </div>
      ) : current.kind === "ok" && current.data.report ? (
        <TransparencyReportView report={current.data.report} meta={current.data} />
      ) : current.kind === "withdrawn" ? (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6 text-sm text-foreground flex gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              The report for {formatPeriod(current.data.periodStart, current.data.periodEnd)} was withdrawn on {formatDate(current.data.withdrawnAt)}.
            </p>
            {current.data.withdrawalReason && <p className="text-muted-foreground mt-1">Reason: {current.data.withdrawalReason}</p>}
            <p className="text-muted-foreground mt-1">Its figures are no longer shown. A corrected report, if issued, appears in the archive.</p>
          </div>
        </div>
      ) : current.kind === "error" ? (
        <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Could not load the report. {current.message}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-muted-foreground">This report does not exist or has not been published.</div>
      )}

      <TransparencyArchive entries={archive} currentId={id} />
    </div>
  );
}

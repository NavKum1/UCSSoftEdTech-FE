"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import TransparencyReportView from "@/components/transparency/TransparencyReportView";
import { TransparencyArchive, TransparencyIntro } from "@/components/transparency/TransparencyArchive";
import { fetchPublic, formatDate, formatPeriod, type ArchiveEntry, type PublicFetchResult, type PublishedReport } from "@/lib/transparency";
import { useEn } from "@/lib/english/EnglishProvider";
import { EmptyState, Loading } from "@/components/career/ui";

export default function TransparencyArchiveReportPage() {
  const en = useEn();
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
    <div className="space-y-6">
      <Link href="/transparency" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden /> {en("Latest report")}
      </Link>
      <TransparencyIntro />

      {current == null ? (
        <Loading label={en("Loading report...")} />
      ) : current.kind === "ok" && current.data.report ? (
        <TransparencyReportView report={current.data.report} meta={current.data} />
      ) : current.kind === "withdrawn" ? (
        <div role="status" className="flex gap-3 rounded-lg border border-red-300 bg-red-50 p-5 text-sm text-foreground dark:border-red-900 dark:bg-red-950/40">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" aria-hidden />
          <div>
            <p className="font-semibold">
              {en("The report for {amount} was withdrawn on {date}.", {
                amount: formatPeriod(current.data.periodStart, current.data.periodEnd),
                date: formatDate(current.data.withdrawnAt),
              })}
            </p>
            {current.data.withdrawalReason && (
              <p className="mt-1 text-muted-foreground">{en("Reason: {withdrawalReason}", { withdrawalReason: current.data.withdrawalReason })}</p>
            )}
            <p className="mt-1 text-muted-foreground">{en("Its figures are no longer shown. A corrected report, if issued, appears in the archive.")}</p>
          </div>
        </div>
      ) : current.kind === "error" ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {en("Could not load the report. {message}", { message: current.message })}
        </div>
      ) : (
        <EmptyState title={en("Report not found")}>{en("This report does not exist or has not been published.")}</EmptyState>
      )}

      <TransparencyArchive entries={archive} currentId={id} />
    </div>
  );
}

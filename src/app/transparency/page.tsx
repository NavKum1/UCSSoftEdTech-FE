"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import TransparencyReportView from "@/components/transparency/TransparencyReportView";
import { TransparencyArchive, TransparencyIntro } from "@/components/transparency/TransparencyArchive";
import { fetchPublic, type ArchiveEntry, type PublicFetchResult, type PublishedReport } from "@/lib/transparency";
import { useEn } from "@/lib/english/EnglishProvider";
import { EmptyState, Loading } from "@/components/career/ui";

export default function TransparencyPage() {
  const en = useEn();
  const [latest, setLatest] = useState<PublicFetchResult<PublishedReport> | null>(null);
  const [archive, setArchive] = useState<PublicFetchResult<ArchiveEntry[]> | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublic<PublishedReport>("/api/transparency/published/latest").then((r) => active && setLatest(r));
    fetchPublic<ArchiveEntry[]>("/api/transparency/published").then((r) => active && setArchive(r));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <TransparencyIntro />

      {latest == null ? (
        <Loading label={en("Loading the latest report...")} />
      ) : latest.kind === "ok" && latest.data.report ? (
        <TransparencyReportView report={latest.data.report} meta={latest.data} />
      ) : latest.kind === "error" ? (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {en("Could not load the report. {message}", { message: latest.message })}
        </div>
      ) : (
        <EmptyState title={en("No report published yet")}>
          {en("No transparency report has been published yet. The first one will appear here once it has been reviewed.")}
        </EmptyState>
      )}

      {archive?.kind === "ok" && <TransparencyArchive entries={archive.data} />}
      {archive?.kind === "error" && (
        <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="h-4 w-4" aria-hidden /> {en("Could not load the archive. {message}", { message: archive.message })}
        </p>
      )}
    </div>
  );
}

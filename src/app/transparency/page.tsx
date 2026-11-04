"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import TransparencyReportView from "@/components/transparency/TransparencyReportView";
import { TransparencyArchive, TransparencyIntro } from "@/components/transparency/TransparencyArchive";
import { fetchPublic, type ArchiveEntry, type PublicFetchResult, type PublishedReport } from "@/lib/transparency";
import { useEn } from "@/lib/english/EnglishProvider";

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
        <div className="glass-panel rounded-2xl border border-border py-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />{en(" Loading the latest report...")}
        </div>
      ) : latest.kind === "ok" && latest.data.report ? (
        <TransparencyReportView report={latest.data.report} meta={latest.data} />
      ) : latest.kind === "error" ? (
        <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />{" "}{en("Could not load the report. {message}", { message: latest.message })}
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-muted-foreground">
          {en("No transparency report has been published yet. The first one will appear here once it has been reviewed.")}
        </div>
      )}

      {archive?.kind === "ok" && <TransparencyArchive entries={archive.data} />}
      {archive?.kind === "error" && (
        <p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{" "}{en("Could not load the archive. {message}", { message: archive.message })}</p>
      )}
    </div>
  );
}

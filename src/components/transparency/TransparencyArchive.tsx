"use client";

import React from "react";
import Link from "next/link";
import { Archive, FileBarChart } from "lucide-react";
import { formatDate, formatPeriod, type ArchiveEntry } from "@/lib/transparency";
import { useEn } from "@/lib/english/EnglishProvider";

export function TransparencyArchive({ entries, currentId }: { entries: ArchiveEntry[]; currentId?: string }) {
  const en = useEn();
  return (
    <section aria-labelledby="tr-archive" className="glass-panel rounded-2xl border border-border p-5 sm:p-6 space-y-3">
      <h2 id="tr-archive" className="text-lg font-bold text-foreground flex items-center gap-2">
        <Archive className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />{en(" Archive")}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{en("No reports have been published yet.")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="py-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <Link href={`/transparency/${e.id}`} className="text-sm font-semibold text-indigo-700 dark:text-indigo-400 hover:underline" aria-current={e.id === currentId ? "page" : undefined}>
                  {formatPeriod(e.periodStart, e.periodEnd)}
                </Link>
                {e.status === "Withdrawn" && (
                  <span className="ms-2 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30">{en("Withdrawn")}</span>
                )}
                {e.status === "Withdrawn" && e.withdrawalReason && <p className="text-xs text-muted-foreground mt-0.5">{en("Reason: {withdrawalReason}", { withdrawalReason: e.withdrawalReason })}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{en("Published {date} · v{methodologyVersion}", { date: formatDate(e.publishedAt), methodologyVersion: e.methodologyVersion })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function TransparencyIntro() {
  const en = useEn();
  return (
    <div className="pb-4 border-b border-border">
      <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
        <FileBarChart className="w-4 h-4" />{en(" Transparency report")}
      </div>
      <h1 className="text-3xl font-extrabold text-foreground mt-1">{en("How well and how fairly our assessments work")}</h1>
      <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
        {en("We publish platform-wide numbers on assessment volume, integrity signals and human oversight, appeals, whether scores predict job outcomes, and whether outcomes differ across self-identified groups. Figures are aggregate only; small groups are suppressed and no person or employer is named. Where there is not enough data, we say so rather than show a number.")}
      </p>
    </div>
  );
}

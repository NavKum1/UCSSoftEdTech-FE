"use client";

import React from "react";
import Link from "next/link";
import { formatDate, formatPeriod, type ArchiveEntry } from "@/lib/transparency";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, PageHeader } from "@/components/career/ui";

export function TransparencyArchive({ entries, currentId }: { entries: ArchiveEntry[]; currentId?: string }) {
  const en = useEn();
  return (
    <section aria-labelledby="tr-archive" className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 id="tr-archive" className="text-base font-semibold text-foreground">
        {en("Archive")}
      </h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{en("No reports have been published yet.")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
              <div>
                <Link
                  href={`/transparency/${e.id}`}
                  className="text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-400"
                  aria-current={e.id === currentId ? "page" : undefined}
                >
                  {formatPeriod(e.periodStart, e.periodEnd)}
                </Link>
                {e.status === "Withdrawn" && (
                  <span className="ms-2">
                    <Badge tone="bad">{en("Withdrawn")}</Badge>
                  </span>
                )}
                {e.status === "Withdrawn" && e.withdrawalReason && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{en("Reason: {withdrawalReason}", { withdrawalReason: e.withdrawalReason })}</p>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {en("Published {date} · v{methodologyVersion}", { date: formatDate(e.publishedAt), methodologyVersion: e.methodologyVersion })}
              </span>
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
    <PageHeader
      title={en("How well and how fairly our assessments work")}
      description={en(
        "We publish platform-wide numbers on assessment volume, integrity signals and human oversight, appeals, whether scores predict job outcomes, and whether outcomes differ across self-identified groups. Figures are aggregate only; small groups are suppressed and no person or employer is named. Where there is not enough data, we say so rather than show a number.",
      )}
    />
  );
}

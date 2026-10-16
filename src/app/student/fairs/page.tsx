"use client";

import React from "react";
import { useApi } from "@/lib/appAuth";
import { EmptyState, ErrorBanner, Loading, PageHeader, formatDate, useLoad, useCareerT } from "@/components/career/ui";

interface Fair {
  id: string;
  name: string;
  startsAt?: string | null;
  venue?: string | null;
  locationType?: string | null;
  publicUrl?: string | null;
  directoryUrl?: string | null;
}

/** Upcoming career fairs at the student's school, linking out to the event pages to register. */
export default function StudentFairsPage() {
  const t = useCareerT("studentFairs");
  const api = useApi();
  const fairs = useLoad(() => api<{ configured: boolean; events: Fair[] }>("/api/career/events/student/fairs"), [api]);

  return (
    <div className="space-y-6">
      <PageHeader title={t("careerFairs")} description={t("upcomingCareerFairsAtYour")} />
      {fairs.loading && !fairs.data ? (
        <Loading />
      ) : fairs.error ? (
        <ErrorBanner error={fairs.error} onRetry={fairs.reload} />
      ) : !fairs.data?.configured || fairs.data.events.length === 0 ? (
        <EmptyState title={t("noUpcomingCareerFairs")}>{t("checkBackLaterYourCareer")}</EmptyState>
      ) : (
        <ul className="space-y-3">
          {fairs.data.events.map((f) => (
            <li key={f.id} className="rounded-lg border p-4">
              <h2 className="text-base font-semibold">{f.name}</h2>
              <p className="text-sm text-muted-foreground">
                {formatDate(f.startsAt, true)}
                {f.venue ? ` · ${f.venue}` : f.locationType === "virtual" ? t("online") : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-sm">
                {f.publicUrl && (
                  <a className="underline" href={f.publicUrl} target="_blank" rel="noopener noreferrer">
                    {t.rich("registerForNameOpensIn", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: f.name })}
                  </a>
                )}
                {f.directoryUrl && (
                  <a className="underline" href={f.directoryUrl} target="_blank" rel="noopener noreferrer">
                    {t.rich("employersAttendingNameOpensIn", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: f.name })}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

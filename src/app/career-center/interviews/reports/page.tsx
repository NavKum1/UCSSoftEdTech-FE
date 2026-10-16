"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";
import { useDownload } from "@/components/career/appointments/shared";

interface Summary {
  schedulesByStatus: Record<string, number>;
  employers: number;
  slotsOffered: number;
  interviewsBooked: number;
  fillRate: number;
  cancellations: number;
  promotedFromAlternates: number;
  attended: number;
  noShows: number;
  uniqueStudents: number;
  outcomes: Record<string, number>;
  byEmployer: { employer: string; interviews: number; noShows: number; offers: number }[];
}

export default function InterviewReportsPage() {
  const t = useCareerT("careerCenterInterviewsReports");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const download = useDownload();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = [from && `from=${from}`, to && `to=${to}`].filter(Boolean).join("&");
  const r = useLoad(() => api<Summary>(`/api/career/ocr/staff/reports/summary${qs ? `?${qs}` : ""}`), [api, schoolId, qs]);
  const [err, setErr] = useState<string | null>(null);

  const stats: [string, string | number][] = r.data
    ? [
        [t("statEmployers"), r.data.employers],
        [t("statSlotsOffered"), r.data.slotsOffered],
        [t("statInterviewsBooked"), r.data.interviewsBooked],
        [t("statFillRate"), `${r.data.fillRate}%`],
        [t("statStudentsInterviewed"), r.data.uniqueStudents],
        [t("statAttended"), r.data.attended],
        [t("statNoShows"), r.data.noShows],
        [t("statCancellations"), r.data.cancellations],
        [t("statFilledFromAlternates"), r.data.promotedFromAlternates],
        [t("statOffers"), r.data.outcomes.Offer ?? 0],
        [t("statNoOffer"), r.data.outcomes.NoOffer ?? 0],
        [t("statPending"), r.data.outcomes.Pending ?? 0],
      ]
    : [];

  return (
    <div>
      <PageHeader
        title={t("interviewReports")}
        description={t("onCampusRecruitingActivityAt")}
        actions={<Link className="text-sm underline" href="/career-center/interviews">{t("backToInterviews")}</Link>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label={t("from")}>{(p) => <input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label={t("to")}>{(p) => <input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
        <Button
          variant="secondary"
          onClick={async () => {
            setErr(null);
            try {
              await download(`/api/career/ocr/staff/reports/interviews.csv${qs ? `?${qs}` : ""}`, "interviews-report.csv");
            } catch (e) {
              setErr((e as Error).message);
            }
          }}
        >
          {t("downloadCSV")}
        </Button>
      </div>
      <ErrorBanner error={err} />
      <div aria-live="polite">
        {r.loading ? (
          <Loading />
        ) : r.error ? (
          <ErrorBanner error={r.error} onRetry={r.reload} />
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {stats.map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-xl font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <Card title={t("schedulesByStatus")}>
              <p className="text-sm">{Object.entries(r.data!.schedulesByStatus).map(([k, v]) => `${k}: ${v}`).join(" · ") || t("noneYet")}</p>
            </Card>
            <Card title={t("byEmployer")}>
              {r.data!.byEmployer.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noInterviewsInThisRange")}</p>
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t("interviewsByEmployer")}</caption>
                    <thead><tr className="text-start [&_th]:text-start"><th scope="col">{t("employer")}</th><th scope="col">{t("interviews")}</th><th scope="col">{t("noShows")}</th><th scope="col">{t("offers")}</th></tr></thead>
                    <tbody>
                      {r.data!.byEmployer.map((e) => (
                        <tr key={e.employer} className="border-t border-border"><td>{e.employer}</td><td>{e.interviews}</td><td>{e.noShows}</td><td>{e.offers}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

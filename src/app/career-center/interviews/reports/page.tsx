"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, useLoad } from "@/components/career/ui";
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
        ["Employers", r.data.employers],
        ["Slots offered", r.data.slotsOffered],
        ["Interviews booked", r.data.interviewsBooked],
        ["Fill rate", `${r.data.fillRate}%`],
        ["Students interviewed", r.data.uniqueStudents],
        ["Attended", r.data.attended],
        ["No-shows", r.data.noShows],
        ["Cancellations", r.data.cancellations],
        ["Filled from alternates", r.data.promotedFromAlternates],
        ["Offers", r.data.outcomes.Offer ?? 0],
        ["No offer", r.data.outcomes.NoOffer ?? 0],
        ["Pending", r.data.outcomes.Pending ?? 0],
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Interview reports"
        description="On-campus recruiting activity at your school, by interview date."
        actions={<Link className="text-sm underline" href="/career-center/interviews">Back to interviews</Link>}
      />
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="From">{(p) => <input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label="To">{(p) => <input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
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
          Download CSV
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
            <Card title="Schedules by status">
              <p className="text-sm">{Object.entries(r.data!.schedulesByStatus).map(([k, v]) => `${k}: ${v}`).join(" · ") || "None yet"}</p>
            </Card>
            <Card title="By employer">
              {r.data!.byEmployer.length === 0 ? (
                <p className="text-sm text-muted-foreground">No interviews in this range.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Interviews by employer</caption>
                    <thead><tr className="text-left"><th scope="col">Employer</th><th scope="col">Interviews</th><th scope="col">No-shows</th><th scope="col">Offers</th></tr></thead>
                    <tbody>
                      {r.data!.byEmployer.map((e) => (
                        <tr key={e.employer} className="border-t border-border"><td>{e.employer}</td><td>{e.interviews}</td><td>{e.noShows}</td><td>{e.offers}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

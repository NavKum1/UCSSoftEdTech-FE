"use client";

/**
 * A person's own report for a guidance form they sent (the private link in the form's emails to them, kept 180 days):
 * their results when the form shows them results (never the counsellor's notes), their meeting, and their answers.
 */

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, XCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiClient";
import { ResultsView } from "@/components/guidance/form/GuidanceForm";
import { onAccent, type FormResult } from "@/components/guidance/form/model";
import { UI } from "@/components/guidance/form/uiText";

interface Report {
  instituteName: string | null;
  form: string;
  title: string | null;
  accent: string | null;
  logoUrl: string | null;
  sentAt: string;
  language: string;
  result: {
    outcomeTitle: string | null;
    outcome: { id: string; name: string; summary: string | null } | null;
    matchTitle: string | null;
    match: { percent: number; label: string | null; message: string | null } | null;
  } | null;
  answers: { question: string | null; answer: string | null; table: { columns: string[]; rows: string[][] } | null }[];
  meeting: { status: string; mode: string; when: string | null; counsellor: string | null; meetingUrl: string | null; location: string | null } | null;
}

const MODE: Record<string, string> = { Phone: "Phone call", Video: "Video call", InPerson: "In person" };

export default function GuidanceReportPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-2xl animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />}>
      <ReportView />
    </Suspense>
  );
}

function ReportView() {
  const token = useSearchParams().get("token") ?? "";
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl().replace(/\/$/, "")}/api/public/guidance-report/${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok) setReport(body as Report);
        else setError(res.status === 429 ? "Too many requests from here just now. Please try again in a while." : (body?.error ?? "This link has expired or isn't valid."));
      })
      .catch(() => !cancelled && setError("We couldn't reach the server. Please check your connection and try again."));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error)
    return (
      <div className="mx-auto mt-10 max-w-md p-6 text-center" role="alert">
        <XCircle aria-hidden="true" className="mx-auto h-10 w-10 text-red-600" />
        <h1 className="mt-3 text-lg font-semibold">This link didn&apos;t work</h1>
        <p className="mt-1 text-sm text-muted-foreground">{error}</p>
      </div>
    );
  if (!report) return <div className="mx-auto mt-10 h-64 max-w-2xl animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />;

  const accent = report.accent || "#4f46e5";
  const t = (k: string) => (UI[report.language]?.[k as keyof typeof UI.en] ?? UI.en[k as keyof typeof UI.en] ?? k) as string;
  const result: FormResult | null = report.result
    ? {
        outcomeTitle: report.result.outcomeTitle,
        outcome: report.result.outcome ? { id: report.result.outcome.id, name: report.result.outcome.name, summary: report.result.outcome.summary } : null,
        points: [],
        matchTitle: report.result.matchTitle,
        match: report.result.match,
      }
    : null;

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-8" style={{ "--gf-accent": accent, "--gf-on": onAccent(accent) } as React.CSSProperties} lang={report.language}>
      <header>
        {report.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={report.logoUrl} alt={report.instituteName ?? ""} className="mb-4 h-10 w-auto max-w-48 object-contain" />
        )}
        <p className="text-sm text-muted-foreground">{report.instituteName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{report.title || report.form}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sent {new Date(report.sentAt).toLocaleDateString(undefined, { dateStyle: "long" })}</p>
      </header>

      {result && (
        <section aria-labelledby="results">
          <h2 id="results" className="mb-3 text-lg font-semibold">
            {t("yourResults")}
          </h2>
          <ResultsView result={result} accent={accent} t={t} />
        </section>
      )}

      {report.meeting && (
        <section className="flex items-start gap-3 rounded-2xl border border-border p-4 text-sm">
          <CalendarCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} />
          <div>
            {report.meeting.status === "Booked" && report.meeting.when ? (
              <>
                <p className="font-semibold">Your meeting: {report.meeting.when}</p>
                <p className="text-muted-foreground">
                  {MODE[report.meeting.mode] ?? report.meeting.mode}
                  {report.meeting.counsellor ? ` with ${report.meeting.counsellor}` : ""}
                  {report.meeting.location ? ` · ${report.meeting.location}` : ""}
                </p>
                {report.meeting.meetingUrl && (
                  <a href={report.meeting.meetingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-medium underline-offset-2 hover:underline" style={{ color: accent }}>
                    Join the video call
                  </a>
                )}
              </>
            ) : (
              <p>You asked for a meeting; {report.instituteName ?? "they"} will confirm the time by email.</p>
            )}
          </div>
        </section>
      )}

      <section aria-labelledby="answers">
        <h2 id="answers" className="text-lg font-semibold">
          Your answers
        </h2>
        {report.answers.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Your answers are no longer kept.</p>
        ) : (
          <dl className="mt-3 divide-y divide-border rounded-2xl border border-border text-sm">
            {report.answers.map((a, i) => (
              <div key={i} className="px-4 py-3">
                <dt className="text-muted-foreground">{a.question}</dt>
                <dd className="mt-0.5 font-medium">
                  {a.table && a.table.rows.length > 0 ? (
                    <ul className="space-y-0.5">
                      {a.table.rows.map((r, ri) => (
                        <li key={ri}>{r.filter(Boolean).join(" · ")}</li>
                      ))}
                    </ul>
                  ) : (
                    a.answer
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <p className="text-xs text-muted-foreground">This page is private to you. Anyone with the link can see it, so keep it to yourself. It stops working 180 days after you sent the form.</p>
    </main>
  );
}

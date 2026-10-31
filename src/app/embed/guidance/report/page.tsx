"use client";

/**
 * A person's own report for a guidance form they sent (the private link in the form's emails to them and on its
 * thank-you page, kept 180 days): their score on a dial with the school's next steps and share buttons, the school's
 * introduction, one part per form section with their answers and what the form says about each, the work-style grid,
 * their meeting, and every answer at the end. Never the counsellor's notes. Built by the server (GuidanceReport.cs).
 */

import React, { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarCheck, ChevronDown, Download, XCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiClient";
import { onAccent } from "@/components/guidance/form/model";
import { NextStepsBlock, ScoreDial, ShareRow, StyleGrid, type GridView } from "@/components/guidance/form/ReportParts";
import { UI } from "@/components/guidance/form/uiText";

interface Item {
  question: string | null;
  answer: string | null;
  table: { columns: string[]; rows: string[][] } | null;
  explain: string[];
  values?: string[] | null;
}

interface Report {
  instituteName: string | null;
  form: string;
  title: string | null;
  accent: string | null;
  logoUrl: string | null;
  sentAt: string;
  language: string;
  reportTitle: string | null;
  intro: string | null;
  result: {
    outcomeTitle: string | null;
    outcome: { id: string; name: string; summary: string | null } | null;
    matchTitle: string | null;
    match: { percent: number; label: string | null; message: string | null } | null;
  } | null;
  next: { title: string | null; text: string | null; label: string | null; url: string | null } | null;
  shareUrl: string | null;
  grid: GridView | null;
  parts: { title: string; text: string | null; items: Item[]; grid: boolean }[];
  answers: Item[];
  meeting: { status: string; mode: string; when: string | null; counsellor: string | null; meetingUrl: string | null; location: string | null } | null;
}

const MODE: Record<string, string> = { Phone: "Phone call", Video: "Video call", InPerson: "In person" };

export default function GuidanceReportPage() {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-64 max-w-3xl animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" aria-busy="true" />}>
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
  if (!report) return <div className="mx-auto mt-10 h-64 max-w-3xl animate-pulse rounded-3xl bg-muted motion-reduce:animate-none" aria-busy="true" />;

  const accent = report.accent || "#4f46e5";
  const t = (k: string) => (UI[report.language]?.[k as keyof typeof UI.en] ?? UI.en[k as keyof typeof UI.en] ?? k) as string;
  const match = report.result?.match;
  const outcome = report.result?.outcome;
  const heading = report.title || report.form;
  const sent = new Date(report.sentAt).toLocaleDateString(report.language, { dateStyle: "long" });
  const share = report.shareUrl && match ? { url: report.shareUrl, text: t("shareText").replace("{n}", String(match.percent)).replace("{form}", heading) } : null;
  // The outcome goes beside the grid when there is one, else in a card of its own
  const outcomeInParts = report.parts.some((p) => p.grid);

  return (
    <div
      className="min-h-dvh bg-[color-mix(in_srgb,var(--gf-accent)_5%,var(--background))] px-3 py-6 sm:px-6 sm:py-10 print:bg-transparent print:p-0"
      style={{ "--gf-accent": accent, "--gf-on": onAccent(accent), "--gf-tint": `color-mix(in srgb, ${accent} 8%, transparent)` } as React.CSSProperties}
      lang={report.language}
    >
      <main className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-border bg-background shadow-sm print:rounded-none print:border-0 print:shadow-none">
        {/* The school, and the score with what comes next */}
        <header className="bg-[color-mix(in_srgb,var(--gf-accent)_7%,transparent)] px-5 pb-8 pt-6 sm:px-10 sm:pb-10 sm:pt-8">
          <div className="flex items-center justify-between gap-4">
            {report.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={report.logoUrl} alt={report.instituteName ?? ""} className="h-9 w-auto max-w-44 object-contain sm:h-11" />
            ) : (
              <p className="text-[15px] font-semibold">{report.instituteName}</p>
            )}
            <div className="text-right text-sm">
              <p className="text-muted-foreground">{t("sent").replace("{date}", sent)}</p>
              <a
                href={`${getApiBaseUrl().replace(/\/$/, "")}/api/public/guidance-report/${encodeURIComponent(token)}/pdf`}
                className="mt-1 inline-flex items-center gap-1 font-medium text-[var(--gf-accent)] underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gf-accent)] print:hidden"
              >
                <Download aria-hidden="true" className="h-3.5 w-3.5" /> {t("downloadPdf")}
              </a>
            </div>
          </div>
          <p className="mt-6 text-center text-sm font-medium text-muted-foreground">{heading}</p>
          {match ? (
            <div className="mt-4 space-y-5">
              <ScoreDial percent={match.percent} label={match.label} title={report.result?.matchTitle || t("yourScore")} />
              {match.message && <p className="mx-auto max-w-prose text-pretty text-center leading-relaxed text-muted-foreground">{match.message}</p>}
              {report.next && <NextStepsBlock next={report.next} />}
              {share && (
                <div className="print:hidden">
                  <ShareRow url={share.url} text={share.text} t={t} />
                </div>
              )}
            </div>
          ) : (
            <h1 className="mt-2 text-center text-2xl font-semibold tracking-tight sm:text-3xl">{report.reportTitle || t("yourResults")}</h1>
          )}
          {!match && report.next && (
            <div className="mt-6">
              <NextStepsBlock next={report.next} />
            </div>
          )}
        </header>

        <div className="space-y-10 px-5 py-8 sm:px-10 sm:py-10">
          {(match && report.reportTitle) || report.intro ? (
            <section>
              {match && report.reportTitle && <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-[28px]">{report.reportTitle}</h1>}
              {report.intro && <p className="mt-3 whitespace-pre-wrap text-pretty text-[17px] leading-relaxed text-muted-foreground">{report.intro}</p>}
            </section>
          ) : null}

          {outcome && !outcomeInParts && <OutcomeCard title={report.result?.outcomeTitle} name={outcome.name} summary={outcome.summary} />}

          {report.parts.map((p, i) => (
            <section key={i} aria-labelledby={`part-${i}`} className="space-y-5">
              <div className="border-l-4 border-[var(--gf-accent)] pl-4">
                <h2 id={`part-${i}`} className="text-xl font-semibold tracking-tight">
                  {p.title}
                </h2>
                {p.text && <p className="mt-1.5 whitespace-pre-wrap text-pretty leading-relaxed text-muted-foreground">{p.text}</p>}
              </div>
              {p.items.length > 0 && (
                <dl className="space-y-5">
                  {p.items.map((a, j) => (
                    <Answer key={j} a={a} />
                  ))}
                </dl>
              )}
              {p.grid && report.grid && (
                <div className="space-y-5 rounded-2xl border border-border p-5 sm:p-7">
                  <StyleGrid grid={report.grid} t={t} />
                  {outcome && (
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">{report.result?.outcomeTitle || t("yourStyle")}</p>
                      <p className="text-2xl font-semibold tracking-tight text-[var(--gf-accent)]">{outcome.name}</p>
                      {outcome.summary && <p className="mx-auto mt-2 max-w-prose whitespace-pre-wrap text-pretty text-left leading-relaxed">{outcome.summary}</p>}
                    </div>
                  )}
                </div>
              )}
            </section>
          ))}

          {report.meeting && <MeetingCard meeting={report.meeting} institute={report.instituteName} accent={accent} />}

          <details className="group rounded-2xl border border-border print:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gf-accent)] [&::-webkit-details-marker]:hidden">
              {t("allAnswers")}
              <ChevronDown aria-hidden="true" className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            {report.answers.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">{t("noAnswersKept")}</p>
            ) : (
              <dl className="divide-y divide-border border-t border-border text-sm">
                {report.answers.map((a, i) => (
                  <div key={i} className="px-5 py-3">
                    <dt className="text-muted-foreground">{a.question}</dt>
                    <dd className="mt-0.5 font-medium">
                      {a.table && a.table.rows.length > 0 ? a.table.rows.map((r, ri) => <p key={ri}>{r.filter(Boolean).join(" · ")}</p>) : a.answer}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </details>
        </div>
      </main>
      <p className="mx-auto mt-4 max-w-3xl px-2 text-center text-xs leading-relaxed text-muted-foreground">{t("privateNote")}</p>
    </div>
  );
}

/** One answer: the question, what they said (picks as a list, a table's rows), and what the form says about it */
function Answer({ a }: { a: Item }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{a.question}</dt>
      <dd className="mt-1">
        {a.table && a.table.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {a.table.columns.map((c) => (
                    <th key={c} scope="col" className="px-3 py-2 font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.table.rows.map((r, ri) => (
                  <tr key={ri} className="border-t border-border">
                    {r.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 font-medium">
                        {cell || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : a.values && a.values.length > 1 ? (
          <ul className="flex flex-wrap gap-1.5">
            {a.values.map((v) => (
              <li key={v} className="rounded-full bg-[var(--gf-tint)] px-3 py-1 text-[15px] font-medium">
                {v}
              </li>
            ))}
          </ul>
        ) : (
          <p className="whitespace-pre-wrap text-[17px] font-semibold">{a.answer}</p>
        )}
        {a.explain.length > 0 && (
          <div className="mt-3 space-y-2 rounded-xl bg-[var(--gf-tint)] px-4 py-3">
            {a.explain.map((x, i) => (
              <p key={i} className="whitespace-pre-wrap text-pretty leading-relaxed">
                {x}
              </p>
            ))}
          </div>
        )}
      </dd>
    </div>
  );
}

function OutcomeCard({ title, name, summary }: { title?: string | null; name: string; summary: string | null }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border">
      <div className="bg-[var(--gf-tint)] px-6 py-5">
        <h2 className="text-sm font-medium text-[var(--gf-accent)]">{title}</h2>
        <p className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">{name}</p>
      </div>
      {summary && <p className="whitespace-pre-wrap px-6 py-5 leading-relaxed">{summary}</p>}
    </section>
  );
}

function MeetingCard({ meeting, institute, accent }: { meeting: NonNullable<Report["meeting"]>; institute: string | null; accent: string }) {
  return (
    <section className="flex items-start gap-3 rounded-2xl border border-border p-5 text-[15px]">
      <CalendarCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" style={{ color: accent }} />
      <div>
        {meeting.status === "Booked" && meeting.when ? (
          <>
            <p className="font-semibold">Your meeting: {meeting.when}</p>
            <p className="text-muted-foreground">
              {MODE[meeting.mode] ?? meeting.mode}
              {meeting.counsellor ? ` with ${meeting.counsellor}` : ""}
              {meeting.location ? `, ${meeting.location}` : ""}
            </p>
            {meeting.meetingUrl && (
              <a href={meeting.meetingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-medium underline-offset-2 hover:underline" style={{ color: accent }}>
                Join the video call
              </a>
            )}
          </>
        ) : (
          <p>You asked for a meeting; {institute ?? "they"} will confirm the time by email.</p>
        )}
      </div>
    </section>
  );
}

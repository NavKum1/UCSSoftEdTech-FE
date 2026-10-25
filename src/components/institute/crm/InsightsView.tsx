"use client";

/**
 * Admissions insights from the institute's own leads: totals and conversion, the funnel (how many reached each stage),
 * how fast leads hear back, leads per week, and where enrolments come from (source, course, owner) and why leads are lost.
 */

import React, { useEffect, useState } from "react";
import { crm, STAGE_LABEL, type GetToken } from "./api";

interface Group {
  key: string;
  leads: number;
  enrolled: number;
  conversion: number;
}
interface Insights {
  total: number;
  enrolled: number;
  lost: number;
  conversion: number;
  funnel: { stage: string; reached: number }[];
  medianFirstResponseHours: number | null;
  unanswered: number;
  bySource: Group[];
  byCourse: Group[];
  byOwner: Group[];
  lostReasons: { reason: string; count: number }[];
  weekly: { week: string; leads: number }[];
}

const RANGES: [string, number | null][] = [
  ["Last 30 days", 30],
  ["Last 90 days", 90],
  ["Last 12 months", 365],
  ["All time", null],
];

function hours(h: number | null) {
  if (h === null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${h.toFixed(h < 10 ? 1 : 0)} h`;
  return `${Math.round(h / 24)} days`;
}

export default function InsightsView({ getToken }: { getToken: GetToken }) {
  const [days, setDays] = useState<number | null>(90);
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const from = days ? new Date(Date.now() - days * 86400e3).toISOString() : null;
    crm<Insights>(getToken, `/analytics${from ? `?from=${encodeURIComponent(from)}` : ""}`)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError((e as Error).message));
  }, [getToken, days]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map(([label, d]) => (
          <button key={label} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${days === d ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">{error}</p>}
      {!data && !error && <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />}
      {data && data.total === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No leads in this period yet.</p>}
      {data && data.total > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Leads received" value={data.total.toLocaleString()} />
            <Tile label="Enrolled" value={data.enrolled.toLocaleString()} sub={`${data.conversion}% of leads`} />
            <Tile label="Typical time to first contact" value={hours(data.medianFirstResponseHours)} sub="median, received to first call, email or message" />
            <Tile label="Not contacted yet" value={data.unanswered.toLocaleString()} sub="new leads with no response" warn={data.unanswered > 0} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Funnel" note="How many leads reached each stage (or went further).">
              <ul className="space-y-2.5">
                {data.funnel.map((f, i) => {
                  const pct = data.total ? (100 * f.reached) / data.total : 0;
                  const prev = i > 0 ? data.funnel[i - 1].reached : null;
                  return (
                    <li key={f.stage}>
                      <div className="flex justify-between text-sm">
                        <span>{STAGE_LABEL[f.stage]}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {f.reached}
                          {prev ? ` · ${Math.round((100 * f.reached) / prev)}% of previous` : ""}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-cyan-600" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Leads per week" note="The last 12 weeks.">
              <Weekly weeks={data.weekly} />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Breakdown title="By source" rows={data.bySource} />
            <Breakdown title="By course" rows={data.byCourse} />
            <Breakdown title="By owner" rows={data.byOwner} />
          </div>

          {data.lostReasons.length > 0 && (
            <Card title={`Why leads were lost (${data.lost})`}>
              <ul className="space-y-1.5 text-sm">
                {data.lostReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-3">
                    <span>{r.reason || "No reason given"}</span>
                    <span className="tabular-nums text-muted-foreground">{r.count}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Weekly({ weeks }: { weeks: { week: string; leads: number }[] }) {
  const max = Math.max(1, ...weeks.map((w) => w.leads));
  return (
    <div>
      <div className="flex h-36 items-end gap-1.5" role="img" aria-label={`Leads per week: ${weeks.map((w) => `${w.week} ${w.leads}`).join(", ")}`}>
        {weeks.map((w) => (
          <div key={w.week} className="flex flex-1 flex-col items-center justify-end gap-1" title={`Week of ${w.week}: ${w.leads}`}>
            <span className="text-[10px] tabular-nums text-muted-foreground">{w.leads || ""}</span>
            <div className="w-full rounded-t bg-cyan-600" style={{ height: `${(100 * w.leads) / max}%`, minHeight: w.leads ? 2 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{new Date(weeks[0]?.week).toLocaleDateString([], { day: "numeric", month: "short" })}</span>
        <span>this week</span>
      </div>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: Group[] }) {
  return (
    <Card title={title}>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="pb-1.5 text-left font-medium"> </th>
            <th className="pb-1.5 text-right font-medium">Leads</th>
            <th className="pb-1.5 text-right font-medium">Enrolled</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((r) => (
            <tr key={r.key} className="border-t border-border">
              <td className="max-w-40 truncate py-1.5" title={r.key}>{r.key}</td>
              <td className="py-1.5 text-right tabular-nums">{r.leads}</td>
              <td className="py-1.5 text-right tabular-nums">
                {r.enrolled} <span className="text-xs text-muted-foreground">({r.conversion}%)</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

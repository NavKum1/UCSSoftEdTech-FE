"use client";

/**
 * Statistics across an institute's guidance forms: visits, starts, sends and where leads got to, per form and in all;
 * for forms with results, how the outcomes and the match scores spread; and which campaigns brought people who enrolled.
 * Possible spam is left out.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface FormStats {
  formId: string;
  form: string;
  archived: boolean;
  views: number;
  starts: number;
  sent: number;
  stoppedPartWay: number;
  startRate: number;
  completionRate: number;
  medianSeconds: number | null;
  outcomes: { name: string; count: number }[];
  noOutcome: number;
  match: { from: number; to: number; count: number }[] | null;
  averageMatch: number | null;
  meetingsAsked: number;
  meetingsBooked: number;
  messagesSent: number;
  emailsOpened: number;
  leads: number;
  counsellingBooked: number;
  applied: number;
  enrolled: number;
}
interface Stats {
  days: number;
  totals: {
    views: number;
    starts: number;
    sent: number;
    stoppedPartWay: number;
    possibleSpam: number;
    meetingsAsked: number;
    meetingsBooked: number;
    messagesSent: number;
    emailsOpened: number;
    leads: number;
    counsellingBooked: number;
    applied: number;
    enrolled: number;
  };
  forms: FormStats[];
  byCampaign: { key: string; sent: number; enrolled: number }[];
}

const pct = (n: number, of: number) => (of === 0 ? "—" : `${Math.round((100 * n) / of)}%`);
const minutes = (s: number | null) => (s == null ? "—" : s < 60 ? "<1 min" : `${Math.round(s / 60)} min`);

/** Horizontal bars of counts (one series, one hue), each labelled with its value */
function Bars({ rows, label }: { rows: { name: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5" aria-label={label}>
      {rows.map((r) => (
        <li key={r.name} className="grid grid-cols-[8rem_minmax(0,1fr)_2.5rem] items-center gap-2 text-xs" title={`${r.name}: ${r.count}`}>
          <span className="truncate text-muted-foreground">{r.name}</span>
          <span className="h-2.5 rounded-sm bg-muted" aria-hidden="true">
            <span className="block h-full rounded-r bg-cyan-600 dark:bg-cyan-500" style={{ width: `${(r.count / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}

export default function StatisticsView({ instituteId }: { instituteId?: string }) {
  const { apiFetch, ready } = useLegacyApi();
  const [days, setDays] = useState(90);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/guidance-forms/statistics?days=${days}${instituteId ? `&instituteId=${instituteId}` : ""}`);
    if (!res.ok) return setError("We couldn't load the statistics.");
    setError(null);
    setStats(await res.json());
  }, [apiFetch, days, instituteId]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) loadRef.current();
  }, [ready, loadRef, days]);

  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
        {error}
      </p>
    );
  if (!stats) return <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />;
  const t = stats.totals;
  const withResults = stats.forms.filter((f) => f.outcomes.length > 0 || f.match);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">All your forms, last {stats.days} days. Possible spam is left out{t.possibleSpam ? ` (${t.possibleSpam})` : ""}.</p>
        <select aria-label="Period" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm">
          {[7, 30, 90, 365].map((d) => (
            <option key={d} value={d}>
              Last {d} days
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Sent" value={t.sent.toLocaleString()} note={`${pct(t.sent, t.starts)} of those who started`} />
        <Tile label="Stopped part way (saved)" value={t.stoppedPartWay.toLocaleString()} />
        <Tile label="Meetings" value={t.meetingsBooked.toLocaleString()} note={`booked, of ${t.meetingsAsked} asked for`} />
        <Tile label="Enrolled" value={t.enrolled.toLocaleString()} note={`${pct(t.enrolled, t.leads)} of ${t.leads} leads`} />
      </div>

      <section>
        <h2 className="text-base font-semibold">Each form</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Form</th>
                <th className="px-3 py-2 text-right font-medium">Visits</th>
                <th className="px-3 py-2 text-right font-medium">Started</th>
                <th className="px-3 py-2 text-right font-medium">Sent</th>
                <th className="px-3 py-2 text-right font-medium">Time</th>
                <th className="px-3 py-2 text-right font-medium">Meetings</th>
                <th className="px-3 py-2 text-right font-medium">Messages</th>
                <th className="px-3 py-2 text-right font-medium">Counselling booked</th>
                <th className="px-3 py-2 text-right font-medium">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {stats.forms.map((f) => (
                <tr key={f.formId} className="border-t border-border tabular-nums">
                  <td className="px-3 py-2 font-medium">
                    {f.form}
                    {f.archived && <span className="ml-1 text-xs font-normal text-muted-foreground">(removed)</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{f.views}</td>
                  <td className="px-3 py-2 text-right">
                    {f.starts} <span className="text-xs text-muted-foreground">{f.views ? `${f.startRate}%` : ""}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {f.sent} <span className="text-xs text-muted-foreground">{f.starts ? `${f.completionRate}%` : ""}</span>
                  </td>
                  <td className="px-3 py-2 text-right">{minutes(f.medianSeconds)}</td>
                  <td className="px-3 py-2 text-right">
                    {f.meetingsBooked}/{f.meetingsAsked}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {f.messagesSent}
                    {f.emailsOpened ? <span className="text-xs text-muted-foreground"> · {f.emailsOpened} opened</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {f.counsellingBooked} <span className="text-xs text-muted-foreground">{pct(f.counsellingBooked, f.leads)}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {f.enrolled} <span className="text-xs text-muted-foreground">{pct(f.enrolled, f.leads)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Started and sent show the share of the step before. Meetings: booked of asked for. The last two count leads that reached that stage or further.</p>
      </section>

      {withResults.length > 0 && (
        <section>
          <h2 className="text-base font-semibold">Results</h2>
          <div className="mt-2 grid gap-3 md:grid-cols-2">
            {withResults.map((f) => (
              <div key={f.formId} className="space-y-4 rounded-2xl border border-border bg-card p-4">
                <h3 className="text-sm font-semibold">{f.form}</h3>
                {f.outcomes.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Outcomes</p>
                    <Bars label={`Outcomes of ${f.form}`} rows={[...f.outcomes, ...(f.noOutcome ? [{ name: "No clear outcome", count: f.noOutcome }] : [])]} />
                  </div>
                )}
                {f.match && (
                  <div>
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">Match scores{f.averageMatch != null ? ` · average ${f.averageMatch}%` : ""}</p>
                    <Bars label={`Match scores of ${f.form}`} rows={f.match.map((m) => ({ name: `${m.from}–${m.to}%`, count: m.count }))} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {stats.byCampaign.length > 0 && (
        <section>
          <h2 className="text-base font-semibold">Where they came from</h2>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Campaign</th>
                  <th className="px-3 py-2 text-right font-medium">Sent</th>
                  <th className="px-3 py-2 text-right font-medium">Enrolled</th>
                </tr>
              </thead>
              <tbody>
                {stats.byCampaign.map((c) => (
                  <tr key={c.key} className="border-t border-border tabular-nums">
                    <td className="px-3 py-2">{c.key}</td>
                    <td className="px-3 py-2 text-right">{c.sent}</td>
                    <td className="px-3 py-2 text-right">
                      {c.enrolled} <span className="text-xs text-muted-foreground">{pct(c.enrolled, c.sent)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

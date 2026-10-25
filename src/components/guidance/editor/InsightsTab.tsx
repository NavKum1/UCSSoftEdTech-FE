"use client";

/**
 * A form's insights: visits, how many started and sent it, the typical time taken, where people stopped (the last question
 * they reached), sources and campaigns, languages, sends per day, and the latest inquiries with links to them.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Insights {
  views: number;
  starts: number;
  completed: number;
  startRate: number;
  completionRate: number;
  medianSeconds: number | null;
  awaitingConfirmation?: number;
  possibleSpam?: number;
  dropOff: { questionId: string; question: string; stopped: number }[];
  bySource: { key: string; count: number }[];
  byPage: { key: string; count: number }[];
  byLanguage: { key: string; name: string; count: number }[];
  daily: { day: string; count: number }[];
}
interface Submission {
  id: string;
  leadId: string | null;
  requestId: string | null;
  name: string | null;
  formVersion: number;
  language: string;
  channel: string;
  campaign: string | null;
  createdAt: string;
  answers: { question: string; answer: string }[];
}

const RANGES = [7, 30, 90, 365];
const PLATFORM = "ceacdd2c-975f-41fd-959e-cc530240931c";

export default function InsightsTab({ formId, apiFetch, instituteId }: { formId: string; apiFetch: (p: string, i?: RequestInit) => Promise<Response>; instituteId: string }) {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Insights | null>(null);
  const [subs, setSubs] = useState<Submission[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiFetch(`/api/guidance-forms/${formId}/insights?days=${days}`), apiFetch(`/api/guidance-forms/${formId}/submissions?take=20`)])
      .then(async ([a, b]) => {
        if (cancelled) return;
        if (!a.ok) return setError("Insights couldn't be loaded.");
        setData(await a.json());
        if (b.ok) setSubs(await b.json());
      })
      .catch(() => !cancelled && setError("Insights couldn't be loaded."));
    return () => {
      cancelled = true;
    };
  }, [apiFetch, formId, days]);

  if (error) return <p className="text-sm text-red-700 dark:text-red-400">{error}</p>;
  if (!data) return <div className="h-48 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />;
  const maxStop = Math.max(1, ...data.dropOff.map((d) => d.stopped));
  const maxDay = Math.max(1, ...data.daily.map((d) => d.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1.5">
        {RANGES.map((d) => (
          <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${days === d ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}>
            Last {d === 365 ? "12 months" : `${d} days`}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Opened" value={data.views} />
        <Tile label="Started" value={data.starts} sub={`${data.startRate}% of visits`} />
        <Tile label="Sent" value={data.completed} sub={`${data.completionRate}% of those who started`} />
        <Tile label="Typical time to fill in" value={data.medianSeconds == null ? "—" : data.medianSeconds < 90 ? `${data.medianSeconds} s` : `${Math.round(data.medianSeconds / 60)} min`} />
        <Tile label="Stopped part way" value={Math.max(0, data.starts - data.completed)} />
      </div>
      {((data.awaitingConfirmation ?? 0) > 0 || (data.possibleSpam ?? 0) > 0) && (
        <p className="text-sm text-muted-foreground">
          {data.awaitingConfirmation ? `${data.awaitingConfirmation} waiting for the person to confirm their email. ` : ""}
          {data.possibleSpam ? `${data.possibleSpam} in Possible spam in your CRM.` : ""}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Where people stopped" note="The last question reached by people who started but didn't send.">
          {data.dropOff.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody has stopped part way in this period.</p>
          ) : (
            <ul className="space-y-2">
              {data.dropOff.map((d) => (
                <li key={d.questionId}>
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">{d.question}</span>
                    <span className="tabular-nums text-muted-foreground">{d.stopped}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${(100 * d.stopped) / maxStop}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Sent per day">
          {data.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing sent in this period yet.</p>
          ) : (
            <div className="flex h-32 items-end gap-0.5" role="img" aria-label={`Sent per day: ${data.daily.map((d) => `${d.day} ${d.count}`).join(", ")}`}>
              {data.daily.map((d) => (
                <div key={d.day} className="flex-1 rounded-t bg-cyan-600" title={`${d.day}: ${d.count}`} style={{ height: `${(100 * d.count) / maxDay}%`, minHeight: 2 }} />
              ))}
            </div>
          )}
        </Card>
        <Card title="Sources and campaigns">
          <List rows={data.bySource.map((x) => [x.key === "website" ? "Website / link" : x.key === "app" ? "Inside Edulexa" : x.key, x.count])} />
        </Card>
        <Card title="Pages it was sent from" note="Where the form sits on your website (or the site people came from).">
          <List rows={(data.byPage ?? []).map((x) => [x.key, x.count])} />
        </Card>
        <Card title="Languages">
          <List rows={data.byLanguage.map((x) => [x.name, x.count])} />
        </Card>
      </div>

      <Card title="Latest inquiries from this form">
        {subs.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {subs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium">{s.name ?? (s.requestId ? "Ask Edulexa request" : "Inquiry")}</span>{" "}
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} · version {s.formVersion} · {s.campaign ?? (s.channel === "app" ? "inside Edulexa" : "website")}
                  </span>
                </span>
                {s.leadId && instituteId !== PLATFORM && (
                  <Link href={`/institute/dashboard?lead=${s.leadId}`} className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted">
                    Open in CRM
                  </Link>
                )}
                {s.requestId && (
                  <Link href={`/advisor/guidance?request=${s.requestId}`} className="rounded-lg border border-border px-2.5 py-1 text-xs hover:bg-muted">
                    Open request
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function List({ rows }: { rows: [string, number][] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing yet.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {rows.map(([k, n]) => (
        <li key={k} className="flex justify-between gap-3">
          <span className="truncate">{k}</span>
          <span className="tabular-nums text-muted-foreground">{n}</span>
        </li>
      ))}
    </ul>
  );
}

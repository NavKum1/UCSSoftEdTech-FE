"use client";

/**
 * People: one row per person (their inquiries joined by email, else phone), with their furthest stage, result and
 * meeting; opening one shows their profile: cards built from the answers the forms tag (background, logistics,
 * motivation), every form they touched with how far they got and their result (pathways), their inquiries and a timeline.
 */

import React, { useCallback, useEffect, useState } from "react";
import { CalendarCheck, CalendarClock, CheckCircle2, CircleSlash, Clock, FileText, Mail, Search, Send, UserRound, X } from "lucide-react";
import { useLatestRef } from "@/lib/legacyApi";
import { crm, relative, StageBadge, type GetToken } from "./api";

interface PersonRow {
  leadId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  inquiries: number;
  stage: string;
  forms: number;
  incomplete: boolean;
  outcome: string | null;
  match: number | null;
  meeting: { status: string; start: string | null } | null;
  firstSeen: string;
  lastActivity: string;
}

interface Person {
  leadId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
  firstSeen: string;
  lastActivity: string;
  inquiries: { leadId: string; source: string | null; stage: string; createdAt: string; incomplete: boolean; spam: boolean; isGuidance: boolean; course: string | null }[];
  cards: { card: string; answers: { question: string; answer: string; table: { columns: string[]; rows: string[][] } | null; form: string; at: string }[] }[];
  pathways: {
    formId: string;
    form: string;
    status: string;
    steps: number;
    reached: number | null;
    percent: number;
    outcome: string | null;
    outcomeTitle: string | null;
    match: number | null;
    matchLabel: string | null;
    at: string | null;
  }[];
  timeline: { at: string; kind: string; text: string; leadId: string | null }[];
}

const CARD: Record<string, string> = { background: "Background", logistics: "Logistics", motivation: "Motivation" };
const KIND_ICON: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>> = {
  inquiry: UserRound,
  form: FileText,
  meeting: CalendarCheck,
  message: Send,
};

export default function PeopleView({ getToken, openLead }: { getToken: GetToken; openLead: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PersonRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(
    async (p: number) => {
      try {
        const d = await crm<{ people: PersonRow[]; total: number; page: number; hasMore: boolean }>(getToken, `/people?page=${p}${search ? `&q=${encodeURIComponent(search)}` : ""}`);
        setRows((x) => (p === 1 ? d.people : [...(x ?? []), ...d.people]));
        setTotal(d.total);
        setPage(p);
        setMore(d.hasMore);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    },
    [getToken, search],
  );
  const loadRef = useLatestRef(load);
  useEffect(() => {
    loadRef.current(1);
  }, [loadRef, search]);

  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim());
        }}
      >
        <label className="relative min-w-64 flex-1">
          <span className="sr-only">Search people</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, email, phone or what they asked about" className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm" />
        </label>
        <button type="submit" className="rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800">
          Search
        </button>
        <span className="text-xs text-muted-foreground">{total.toLocaleString()} {total === 1 ? "person" : "people"}</span>
      </form>
      <p className="text-xs text-muted-foreground">One profile per person: their inquiries are joined by email (or phone). Possible spam is left out.</p>

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </p>
      )}

      {!rows ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{search ? "Nobody matches that search." : "No people yet."}</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Person</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Result</th>
                <th className="px-3 py-2 font-medium">Meeting</th>
                <th className="px-3 py-2 font-medium">Inquiries</th>
                <th className="px-3 py-2 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.leadId} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => setOpen(p.leadId)}>
                  <td className="px-3 py-2">
                    <button type="button" className="text-left font-medium hover:underline" onClick={(e) => (e.stopPropagation(), setOpen(p.leadId))}>
                      {p.name || p.email || p.phone}
                    </button>
                    <span className="block text-xs text-muted-foreground">{[p.email, p.phone].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="px-3 py-2">{p.incomplete ? <span className="text-xs text-amber-800 dark:text-amber-300">Incomplete</span> : <StageBadge stage={p.stage} />}</td>
                  <td className="px-3 py-2 text-xs">
                    {p.outcome && <span className="block font-medium">{p.outcome}</span>}
                    {p.match != null && <span className="text-muted-foreground">{p.match}% match</span>}
                    {!p.outcome && p.match == null && <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {p.meeting ? (
                      p.meeting.status === "Booked" && p.meeting.start ? (
                        <span className="inline-flex items-center gap-1 text-emerald-800 dark:text-emerald-300">
                          <CalendarCheck aria-hidden="true" className="h-3.5 w-3.5" /> {new Date(p.meeting.start).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
                          <CalendarClock aria-hidden="true" className="h-3.5 w-3.5" /> Asked
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums">
                    {p.inquiries}
                    {p.forms > 0 && <span className="text-muted-foreground"> · {p.forms === 1 ? "1 form" : `${p.forms} forms`}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{relative(p.lastActivity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {more && (
        <button type="button" onClick={() => load(page + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
          Show more
        </button>
      )}

      {open && <PersonPanel leadId={open} getToken={getToken} onClose={() => setOpen(null)} openLead={openLead} />}
    </div>
  );
}

function PersonPanel({ leadId, getToken, onClose, openLead }: { leadId: string; getToken: GetToken; onClose: () => void; openLead: (id: string) => void }) {
  const [p, setP] = useState<Person | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    crm<Person>(getToken, `/people/${leadId}`)
      .then((d) => !cancelled && setP(d))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [getToken, leadId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-100 flex justify-end bg-black/40" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={p?.name ?? "Person"} className="h-full w-full max-w-3xl overflow-y-auto bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">{p?.name || p?.email || "…"}</h2>
            {p && (
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {p.email && (
                  <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                    <Mail aria-hidden="true" className="h-3.5 w-3.5" /> {p.email}
                  </a>
                )}
                {p.phone && <span>{p.phone}</span>}
                <StageBadge stage={p.stage} />
                <span className="text-xs">First seen {new Date(p.firstSeen).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
              </p>
            )}
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
            {error}
          </p>
        )}
        {!p && !error && <div className="mt-6 h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />}

        {p && (
          <div className="mt-5 space-y-6 text-sm">
            {/* Cards from the forms' tagged answers */}
            <div className="grid gap-3 md:grid-cols-3">
              {p.cards.map((c) => (
                <section key={c.card} className="rounded-2xl border border-border bg-card p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{CARD[c.card] ?? c.card}</h3>
                  {c.answers.length === 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">Nothing yet. Tag questions for this card in the form builder.</p>
                  ) : (
                    <dl className="mt-2 space-y-2">
                      {c.answers.map((a, i) => (
                        <div key={i}>
                          <dt className="text-xs text-muted-foreground">{a.question}</dt>
                          <dd className="font-medium">{a.table ? a.table.rows.map((r) => r.filter(Boolean).join(" · ")).join("; ") : a.answer}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </section>
              ))}
            </div>

            {/* Pathways */}
            <section>
              <h3 className="font-semibold">Pathways</h3>
              {p.pathways.length === 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">No guidance forms yet.</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2 font-medium">Form</th>
                        <th className="px-3 py-2 font-medium">Progress</th>
                        <th className="px-3 py-2 font-medium">Result</th>
                        <th className="px-3 py-2 font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.pathways.map((x) => (
                        <tr key={x.formId} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{x.form}</td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <span className="h-1.5 w-24 rounded-full bg-muted" aria-hidden="true">
                                <span className={`block h-full rounded-full ${x.status === "completed" ? "bg-emerald-600" : "bg-amber-500"}`} style={{ width: `${Math.max(4, x.percent)}%` }} />
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs">
                                {x.status === "completed" ? (
                                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
                                ) : x.status === "inProgress" ? (
                                  <Clock aria-hidden="true" className="h-3.5 w-3.5 text-cyan-600" />
                                ) : (
                                  <CircleSlash aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                {x.status === "completed"
                                  ? "Sent"
                                  : x.status === "awaitingConfirmation"
                                    ? "Sent, email not confirmed"
                                    : x.status === "inProgress"
                                      ? "Filling it in"
                                      : x.reached
                                        ? `Stopped at step ${x.reached} of ${x.steps}`
                                        : "Started"}
                              </span>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {x.outcome && <span className="block font-medium">{x.outcome}</span>}
                            {x.match != null && (
                              <span className="text-muted-foreground">
                                {x.match}%{x.matchLabel ? ` · ${x.matchLabel}` : ""}
                              </span>
                            )}
                            {!x.outcome && x.match == null && <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{x.at ? new Date(x.at).toLocaleDateString(undefined, { dateStyle: "medium" }) : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section>
                <h3 className="font-semibold">Inquiries</h3>
                <ul className="mt-2 space-y-1.5">
                  {p.inquiries.map((i) => (
                    <li key={i.leadId}>
                      <button type="button" onClick={() => openLead(i.leadId)} className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/50">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{i.isGuidance ? "Career guidance" : (i.course ?? "A course")}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {i.source ?? "Edulexa"} · {new Date(i.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                          </span>
                        </span>
                        {i.spam ? <span className="text-xs text-muted-foreground">Possible spam</span> : i.incomplete ? <span className="text-xs text-amber-800 dark:text-amber-300">Incomplete</span> : <StageBadge stage={i.stage} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <h3 className="font-semibold">Timeline</h3>
                <ol className="mt-2 space-y-2 border-l border-border pl-4">
                  {p.timeline.map((t, i) => {
                    const Icon = KIND_ICON[t.kind] ?? FileText;
                    return (
                      <li key={i} className="relative">
                        <span className="absolute -left-[1.4rem] top-0.5 grid h-5 w-5 place-items-center rounded-full border border-border bg-background">
                          <Icon aria-hidden="true" className="h-3 w-3 text-muted-foreground" />
                        </span>
                        <p className="text-sm">{t.text}</p>
                        <p className="text-xs text-muted-foreground">{new Date(t.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

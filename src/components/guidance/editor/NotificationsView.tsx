"use client";

/**
 * Notifications: every automatic message the institute's forms sent or will send (emails, SMS, WhatsApp), with what
 * happened to each: scheduled, sent, delivered or read (SMS and WhatsApp), opened (emails, when open tracking is on),
 * skipped (and why), failed (and why), cancelled. Admins send a failed or skipped one again, or cancel one still waiting.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, MessageSquare, RotateCcw, Send, Users, X } from "lucide-react";
import { useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Row {
  id: string;
  leadId: string;
  lead: string | null;
  form: string | null;
  automation: string;
  trigger: string;
  channel: "email" | "team" | "sms" | "whatsapp";
  to: string | null;
  subject: string | null;
  status: string;
  sendAt: string;
  sentAt: string | null;
  attempts: number;
  error: string | null;
  openedAt: string | null;
}
interface Detail extends Row {
  body: string | null;
  providerMessageId: string | null;
  opens: { opens: number; first: string | null; last: string | null } | null;
}

const STATUSES: [string, string][] = [
  ["", "All"],
  ["Scheduled", "Scheduled"],
  ["Sent", "Sent"],
  ["Delivered", "Delivered"],
  ["Read", "Read"],
  ["Skipped", "Skipped"],
  ["Failed", "Failed"],
  ["Cancelled", "Cancelled"],
];
const TONE: Record<string, string> = {
  Scheduled: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  Sending: "bg-sky-500/10 text-sky-800 dark:text-sky-300",
  Sent: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  Delivered: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  Read: "bg-emerald-500/20 text-emerald-900 dark:text-emerald-200",
  Skipped: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
  Failed: "bg-red-500/10 text-red-800 dark:text-red-300",
  Cancelled: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300",
};
const ICON = { email: Mail, team: Users, sms: MessageSquare, whatsapp: Send } as const;
const CHANNEL = { email: "Email", team: "Team email", sms: "SMS", whatsapp: "WhatsApp" } as const;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

export default function NotificationsView({ instituteId, forms, canEdit }: { instituteId?: string; forms: { id: string; name: string }[]; canEdit: boolean }) {
  const { apiFetch, ready } = useLegacyApi();
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [formId, setFormId] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useCallback(
    (p: number) => {
      const q = new URLSearchParams();
      if (instituteId) q.set("instituteId", instituteId);
      if (status) q.set("status", status);
      if (channel) q.set("channel", channel);
      if (formId) q.set("formId", formId);
      q.set("page", String(p));
      return `/api/guidance-forms/notifications?${q}`;
    },
    [instituteId, status, channel, formId],
  );

  const load = useCallback(
    async (p = 1) => {
      const res = await apiFetch(query(p));
      if (!res.ok) return setError("We couldn't load the notifications.");
      const d = await res.json();
      setError(null);
      setRows((x) => (p === 1 ? d.messages : [...(x ?? []), ...d.messages]));
      setCounts(d.counts ?? {});
      setPage(p);
      setMore(d.hasMore);
    },
    [apiFetch, query],
  );
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) loadRef.current(1);
  }, [ready, loadRef, status, channel, formId]);

  const show = async (id: string) => {
    const res = await apiFetch(`/api/guidance-forms/notifications/${id}${instituteId ? `?instituteId=${instituteId}` : ""}`);
    if (res.ok) setOpen(await res.json());
  };
  const act = async (id: string, what: "retry" | "cancel") => {
    const res = await apiFetch(`/api/guidance-forms/notifications/${id}/${what}${instituteId ? `?instituteId=${instituteId}` : ""}`, { method: "POST" });
    const d = await res.json().catch(() => null);
    if (!res.ok) return setError(d?.error ?? "That didn't work. Please try again.");
    setOpen(d);
    load(1);
  };
  const total = Object.values(counts).reduce((n, c) => n + c, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map(([k, label]) => {
          const n = k ? (counts[k] ?? 0) : total;
          return (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${status === k ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}>
              {label} <span className="tabular-nums opacity-75">{n}</span>
            </button>
          );
        })}
        <select aria-label="How it was sent" value={channel} onChange={(e) => setChannel(e.target.value)} className="ml-auto rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
          <option value="">Every channel</option>
          {Object.entries(CHANNEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select aria-label="Form" value={formId} onChange={(e) => setFormId(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs">
          <option value="">Every form</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </p>
      )}

      {!rows ? (
        <div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No messages {status ? "with this status " : ""}yet. Set up automatic messages on a form&apos;s <span className="font-medium">Automatic messages</span> tab.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">To</th>
                <th className="px-3 py-2 font-medium">Message</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const Icon = ICON[r.channel] ?? Mail;
                return (
                  <tr key={r.id} className="cursor-pointer border-t border-border hover:bg-muted/40" onClick={() => show(r.id)}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground">{when(r.sentAt ?? r.sendAt)}</td>
                    <td className="px-3 py-2">
                      <span className="block font-medium">{r.channel === "team" ? "Your team" : (r.lead ?? "—")}</span>
                      {r.channel === "team" && r.lead && <span className="block text-xs text-muted-foreground">about {r.lead}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <button type="button" className="truncate text-left font-medium hover:underline" onClick={(e) => (e.stopPropagation(), show(r.id))}>
                          {r.automation}
                        </button>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{r.form}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[r.status] ?? TONE.Skipped}`}>{r.status}</span>
                      {r.openedAt && <span className="ml-1 text-[11px] text-emerald-700 dark:text-emerald-400">Opened</span>}
                      {(r.status === "Failed" || r.status === "Skipped") && r.error && <span className="mt-0.5 block max-w-64 truncate text-xs text-muted-foreground">{r.error}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {more && (
        <button type="button" onClick={() => load(page + 1)} className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-muted">
          Show more
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label="Message details" onClick={() => setOpen(null)}>
          <div className="h-full w-full max-w-lg overflow-y-auto bg-background p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  {CHANNEL[open.channel]} · {open.form}
                </p>
                <h2 className="text-lg font-semibold">{open.automation}</h2>
              </div>
              <button type="button" aria-label="Close" onClick={() => setOpen(null)} className="rounded-lg p-1.5 hover:bg-muted">
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Status</dt>
              <dd>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[open.status] ?? TONE.Skipped}`}>{open.status}</span>
                {open.error && <span className="mt-1 block text-xs">{open.error}</span>}
              </dd>
              <dt className="text-muted-foreground">Lead</dt>
              <dd>
                <Link href={`/institute/dashboard?lead=${open.leadId}`} className="text-cyan-700 hover:underline dark:text-cyan-400">
                  {open.lead ?? "Open the lead"}
                </Link>
              </dd>
              {open.to && (
                <>
                  <dt className="text-muted-foreground">To</dt>
                  <dd className="break-all">{open.to}</dd>
                </>
              )}
              <dt className="text-muted-foreground">{open.sentAt ? "Sent" : "Due"}</dt>
              <dd>{when(open.sentAt ?? open.sendAt)}</dd>
              <dt className="text-muted-foreground">Attempts</dt>
              <dd>{open.attempts}</dd>
              {open.opens && (
                <>
                  <dt className="text-muted-foreground">Opened</dt>
                  <dd>{open.opens.first ? `${open.opens.opens} time${open.opens.opens === 1 ? "" : "s"}, first ${when(open.opens.first)}` : "Not yet"}</dd>
                </>
              )}
              {open.providerMessageId && (
                <>
                  <dt className="text-muted-foreground">Pulse Relay id</dt>
                  <dd className="break-all font-mono text-xs">{open.providerMessageId}</dd>
                </>
              )}
            </dl>
            {(open.subject || open.body) && (
              <div className="mt-4 rounded-xl border border-border p-3 text-sm">
                {open.subject && <p className="font-semibold">{open.subject}</p>}
                {open.body && <p className="mt-2 whitespace-pre-wrap">{open.body}</p>}
              </div>
            )}
            {!open.body && open.status === "Scheduled" && <p className="mt-4 text-sm text-muted-foreground">The message is filled in when it&apos;s sent, from the form as published then.</p>}
            {canEdit && (
              <div className="mt-4 flex gap-2">
                {["Failed", "Skipped", "Cancelled"].includes(open.status) && (
                  <button type="button" onClick={() => act(open.id, "retry")} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-800">
                    <RotateCcw aria-hidden="true" className="h-4 w-4" /> Send again
                  </button>
                )}
                {open.status === "Scheduled" && (
                  <button type="button" onClick={() => act(open.id, "cancel")} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                    Cancel it
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

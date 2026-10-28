"use client";

/**
 * The events the institute's webhook gets (chosen here), and every delivery: delivered, waiting to be tried again (with
 * why), or failed after the last try; an admin sends one again.
 */

import React, { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useLatestRef } from "@/lib/legacyApi";
import { crm, type GetToken } from "./api";

interface Settings {
  url: string | null;
  events: string[];
  available: { name: string; description: string }[];
}
interface Delivery {
  id: string;
  event: string;
  status: "Pending" | "Delivered" | "Failed";
  attempts: number;
  statusCode: number | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
  payload: unknown;
}

const TONE: Record<string, string> = {
  Delivered: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  Pending: "bg-amber-500/10 text-amber-900 dark:text-amber-300",
  Failed: "bg-red-500/10 text-red-800 dark:text-red-300",
};
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "");

export default function WebhookEvents({ getToken, version }: { getToken: GetToken; version: number }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([
        crm<Settings>(getToken, "/webhook/settings"),
        crm<{ deliveries: Delivery[] }>(getToken, `/webhook/deliveries${status ? `?status=${status}` : ""}`),
      ]);
      setSettings(s);
      setRows(d.deliveries);
    } catch (e) {
      setMsg((e as Error).message);
    }
  }, [getToken, status]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    loadRef.current();
  }, [loadRef, version, status]);

  const toggle = async (name: string) => {
    if (!settings) return;
    const events = settings.events.includes(name) ? settings.events.filter((e) => e !== name) : [...settings.events, name];
    try {
      setSettings(await crm<Settings>(getToken, "/webhook/events", { method: "PUT", body: { events } }));
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  const retry = async (id: string) => {
    try {
      const r = await crm<{ status: string; error: string | null }>(getToken, `/webhook/deliveries/${id}/retry`, { method: "POST" });
      setMsg(r.status === "Delivered" ? "Delivered." : `Not delivered: ${r.error ?? "your system didn't accept it"}. It will be tried again.`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  if (!settings) return null;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border p-3 text-sm">
        <p className="font-medium">Events to send</p>
        <ul className="mt-2 space-y-1.5 text-xs">
          {settings.available.map((e) => (
            <li key={e.name}>
              <label className="flex items-start gap-2">
                <input type="checkbox" className="mt-0.5" checked={settings.events.includes(e.name)} onChange={() => toggle(e.name)} />
                <span>
                  <span className="font-mono">{e.name}</span> <span className="text-muted-foreground">{e.description}</span>
                </span>
              </label>
            </li>
          ))}
          <li className="pl-6 text-muted-foreground">
            Always sent: <span className="font-mono">lead.candidate_opt_in</span> (a candidate agreed to be contacted about a course), <span className="font-mono">lead.withdrawn</span> (they
            withdrew consent: stop contacting them and delete their data) and <span className="font-mono">lead.test</span> (the test button).
          </li>
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">
          Each event is <code>{"{ event, instituteId, at, data }"}</code>. If your system doesn&apos;t answer with a 2xx, it&apos;s tried again after 1, 5, 30, 120 and 720 minutes.
        </p>
      </div>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Deliveries</h3>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-xs">
            <option value="">All</option>
            <option value="Delivered">Delivered</option>
            <option value="Pending">Waiting to be tried again</option>
            <option value="Failed">Failed</option>
          </select>
        </div>
        {msg && (
          <p className="mt-2 rounded-lg bg-muted px-3 py-2 text-xs" role="status">
            {msg}
          </p>
        )}
        {!rows || rows.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{settings.url ? "Nothing sent yet." : "Save your system's address above first."}</p>
        ) : (
          <ul className="mt-2 divide-y divide-border rounded-xl border border-border">
            {rows.map((d) => (
              <li key={d.id} className="px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${TONE[d.status]}`}>{d.status === "Pending" ? "Will retry" : d.status}</span>
                  <button type="button" onClick={() => setOpen(open === d.id ? null : d.id)} className="font-mono hover:underline" aria-expanded={open === d.id}>
                    {d.event}
                  </button>
                  <span className="text-muted-foreground">{when(d.deliveredAt ?? d.createdAt)}</span>
                  {d.statusCode != null && <span className="text-muted-foreground">· answered {d.statusCode}</span>}
                  {d.attempts > 1 && <span className="text-muted-foreground">· {d.attempts} tries</span>}
                  {d.status !== "Delivered" && (
                    <button type="button" onClick={() => retry(d.id)} className="ml-auto inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 hover:bg-muted">
                      <RotateCcw aria-hidden="true" className="h-3 w-3" /> Send again
                    </button>
                  )}
                </div>
                {d.error && d.status !== "Delivered" && (
                  <p className="mt-1 text-muted-foreground">
                    {d.error}
                    {d.nextAttemptAt ? ` Next try ${when(d.nextAttemptAt)}.` : ""}
                  </p>
                )}
                {open === d.id && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-2 text-[11px]">{JSON.stringify(d.payload, null, 2)}</pre>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

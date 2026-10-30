"use client";

/**
 * Platform access (SuperAdmin): recruiter access requests to approve or reject, the recruiters who have access, and the
 * history of platform-level access changes. API: /api/admin/access (backend Services/Identity/StaffAccessService.cs).
 */

import React, { useCallback, useEffect, useState } from "react";
import { Check, History, Trash2, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { useLatestRef } from "@/lib/legacyApi";

type GetToken = () => Promise<string | null>;

type Request = {
  id: string;
  email: string;
  name: string;
  company: string;
  website: string | null;
  jobTitle: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  decidedByName: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
};
type Grant = { id: string; email: string; name: string; role: string; invitedBy: string; activatedAt: string | null };
type AuditRow = { id: string; action: string; targetEmail: string; role: string | null; actorName: string; detail: string | null; createdAt: string };

const ACTION_LABEL: Record<string, string> = {
  recruiter_requested: "Recruiter access requested",
  recruiter_approved: "Recruiter access approved",
  recruiter_rejected: "Recruiter access rejected",
  removed: "Access removed",
};

const secondary = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50";
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

async function api<T>(getToken: GetToken, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await authenticatedFetch(
    `/api/admin/access${path}`,
    { method: init?.method ?? "GET", headers: { "Content-Type": "application/json" }, body: init?.body === undefined ? undefined : JSON.stringify(init.body) },
    getToken
  );
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.");
  return data as T;
}

export default function AccessRequestsAdmin({ getToken }: { getToken: GetToken }) {
  const [status, setStatus] = useState<"pending" | "all">("pending");
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, g] = await Promise.all([
        api<Request[]>(getToken, `/recruiter-requests?status=${status}`),
        api<{ grants: Grant[] }>(getToken, "/grants"),
      ]);
      setRequests(r);
      setGrants(g.grants.filter((x) => x.role === "Recruiter"));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection." : (e as Error).message);
    }
  }, [getToken, status]);

  const loadRef = useLatestRef(load);
  useEffect(() => {
    void loadRef.current();
  }, [loadRef, status]);

  const act = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await action();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy(null);
      return;
    }
    // The change happened: keep saying so even if refreshing the lists fails afterwards
    setMsg({ ok: true, text: done });
    await load();
    if (audit) {
      try {
        setAudit(await api<AuditRow[]>(getToken, "/audit"));
      } catch {
        /* the history refreshes next time it is opened */
      }
    }
    setBusy(null);
  };

  const decide = (r: Request, approve: boolean) =>
    act(
      r.id,
      () => api(getToken, `/recruiter-requests/${r.id}/${approve ? "approve" : "reject"}`, { method: "POST", body: { note: notes[r.id] || null } }),
      approve ? `${r.email} now has recruiter access. They need to sign out and in again.` : `Request from ${r.email} rejected.`
    );

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Recruiter access requests</h2>
          <div className="flex gap-1 rounded-lg border border-border p-0.5 text-sm" role="group" aria-label="Show">
            {(["pending", "all"] as const).map((s) => (
              <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)} className={`rounded-md px-3 py-1 ${status === s ? "bg-muted font-medium" : "text-muted-foreground"}`}>
                {s === "pending" ? "Waiting" : "All"}
              </button>
            ))}
          </div>
        </div>

        {msg && (
          <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
            {msg.text}
          </p>
        )}

        {loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
            {loadError}
            <button type="button" className={secondary} onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : requests === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="rounded-2xl border border-border px-4 py-6 text-center text-sm text-muted-foreground">{status === "pending" ? "No requests waiting." : "No requests yet."}</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => (
              <li key={r.id} className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {r.name || r.email} · {r.company}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.email}
                      {r.jobTitle ? ` · ${r.jobTitle}` : ""} · asked {when(r.createdAt)}
                    </div>
                    {r.website && (
                      <a href={r.website} target="_blank" rel="noopener noreferrer nofollow" className="text-xs text-cyan-700 underline dark:text-cyan-400">
                        {r.website}
                      </a>
                    )}
                  </div>
                  {r.status !== "pending" && (
                    <span className={`rounded-full px-2 py-0.5 text-xs ${r.status === "approved" ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
                      {r.status === "approved" ? "Approved" : "Rejected"}
                      {r.decidedByName ? ` by ${r.decidedByName}` : ""}
                    </span>
                  )}
                </div>
                {r.message && <p className="whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2">{r.message}</p>}
                {r.decisionNote && <p className="text-xs text-muted-foreground">Note: {r.decisionNote}</p>}
                {r.status === "pending" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="min-w-[14rem] flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                      placeholder="Note to the person (optional, sent by e-mail)"
                      aria-label={`Note to ${r.email}`}
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                      maxLength={500}
                    />
                    <button type="button" className={secondary} disabled={busy === r.id} onClick={() => void decide(r, true)}>
                      <Check aria-hidden="true" className="h-4 w-4" />
                      Approve
                    </button>
                    <button type="button" className={secondary} disabled={busy === r.id} onClick={() => void decide(r, false)}>
                      <X aria-hidden="true" className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recruiters with access</h2>
        {grants.length === 0 ? (
          <p className="rounded-2xl border border-border px-4 py-6 text-center text-sm text-muted-foreground">No recruiters approved through Edulexa yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {grants.map((g) => (
              <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{g.name || g.email}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {g.email} · approved by {g.invitedBy}
                    {g.activatedAt ? ` on ${when(g.activatedAt)}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  className={secondary}
                  disabled={busy === g.id}
                  onClick={() => {
                    if (window.confirm(`Remove recruiter access for ${g.email}? They are signed out.`))
                      void act(g.id, () => api(getToken, `/grants/${g.id}`, { method: "DELETE" }), `Recruiter access removed for ${g.email}.`);
                  }}
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <button
          type="button"
          className={secondary}
          aria-expanded={audit !== null}
          onClick={async () => {
            if (audit) return setAudit(null);
            try {
              setAudit(await api<AuditRow[]>(getToken, "/audit"));
            } catch (e) {
              setMsg({ ok: false, text: (e as Error).message });
            }
          }}
        >
          <History aria-hidden="true" className="h-4 w-4" />
          {audit ? "Hide history" : "History of platform access changes"}
        </button>
        {audit && (
          <ol className="divide-y divide-border rounded-2xl border border-border text-sm">
            {audit.length === 0 && <li className="px-4 py-4 text-muted-foreground">No changes yet.</li>}
            {audit.map((a) => (
              <li key={a.id} className="px-4 py-2.5">
                <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>: {a.targetEmail}
                <span className="block text-xs text-muted-foreground">
                  {when(a.createdAt)} · by {a.actorName}
                  {a.detail ? ` · ${a.detail}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

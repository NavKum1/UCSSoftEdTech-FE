"use client";

/**
 * Staff access (institute admins, and SuperAdmin for any institute): invite people to sign in as institute admin,
 * counsellor or faculty, resend or withdraw invitations, remove access, and read the history of changes.
 * API: /api/institute/team (backend Services/Identity/StaffAccessService.cs).
 */

import React, { useCallback, useEffect, useState } from "react";
import { History, Mail, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { useLatestRef } from "@/lib/legacyApi";

type GetToken = () => Promise<string | null>;

export type StaffMember = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: "pending" | "active";
  invitedBy: string;
  createdAt: string;
  lastSentAt: string;
  sendCount: number;
  activatedAt: string | null;
};

type AuditRow = { id: string; action: string; targetEmail: string; role: string | null; actorName: string; detail: string | null; createdAt: string };

export const ROLE_LABEL: Record<string, string> = {
  InstituteAdmin: "Institute admin",
  Counselor: "Counsellor",
  Faculty: "Faculty",
  Recruiter: "Recruiter",
};

const ROLE_HELP: Record<string, string> = {
  InstituteAdmin: "Everything at this institute, including staff access and settings",
  Counselor: "Leads, follow-ups, meetings and guidance results",
  Faculty: "Teaching tools for their own courses and students",
};

const ACTION_LABEL: Record<string, string> = {
  invited: "Invited",
  resent: "Invitation resent",
  joined: "Joined",
  removed: "Access removed",
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";
const primary = "inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50";
const secondary = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50";

async function api<T>(getToken: GetToken, path: string, instituteId?: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await authenticatedFetch(
    `/api/institute/team${path}${instituteId ? `${sep}instituteId=${encodeURIComponent(instituteId)}` : ""}`,
    {
      method: init?.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    },
    getToken
  );
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? (res.status === 403 ? "Only an institute admin can manage staff access." : "Something went wrong. Please try again."));
  return data as T;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

export default function StaffAccess({ getToken, instituteId, compact = false }: { getToken: GetToken; instituteId?: string; compact?: boolean }) {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<string[]>(["InstituteAdmin", "Counselor", "Faculty"]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "", role: compact ? "InstituteAdmin" : "Counselor" });
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  /** True when the list was loaded; on failure the error shows with a Try again button */
  const load = useCallback(async () => {
    try {
      const data = await api<{ enabled: boolean; roles: string[]; members: StaffMember[] }>(getToken, "", instituteId);
      setEnabled(data.enabled);
      setRoles(data.roles);
      setMembers(data.members);
      setLoadError(null);
      setLoaded(true);
      return true;
    } catch (e) {
      setLoadError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection." : (e as Error).message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [getToken, instituteId]);

  const loadRef = useLatestRef(load);
  useEffect(() => {
    void loadRef.current();
  }, [loadRef, instituteId]);

  const run = async <T,>(key: string, action: () => Promise<T>, done: string | ((result: T) => string)) => {
    setBusy(key);
    setMsg(null);
    let result: T;
    try {
      result = await action();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
      setBusy(null);
      return;
    }
    // The change happened: keep saying so even if refreshing the list fails afterwards
    setMsg({ ok: true, text: typeof done === "function" ? done(result) : done });
    await load();
    if (audit) {
      try {
        setAudit(await api<AuditRow[]>(getToken, "/audit", instituteId));
      } catch {
        /* the history refreshes next time it is opened */
      }
    }
    setBusy(null);
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    void run(
      "invite",
      async () => {
        const m = await api<StaffMember>(getToken, "", instituteId, { method: "POST", body: { ...form, email } });
        setForm((f) => ({ ...f, email: "", firstName: "", lastName: "" }));
        return m;
      },
      `Invitation sent to ${email}. If they already have an account, they get access straight away and need to sign in again.`
    );
  };

  const remove = (m: StaffMember) => {
    const what = m.status === "pending" ? `Withdraw the invitation for ${m.email}?` : `Remove ${ROLE_LABEL[m.role] ?? m.role} access for ${m.name || m.email}? They are signed out.`;
    if (!window.confirm(what)) return;
    void run(m.id, () => api(getToken, `/${m.id}`, instituteId, { method: "DELETE" }), m.status === "pending" ? "Invitation withdrawn." : "Access removed.");
  };

  const toggleAudit = async () => {
    if (audit) return setAudit(null);
    try {
      setAudit(await api<AuditRow[]>(getToken, "/audit", instituteId));
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading staff access…</p>;
  const loadAlert = loadError && (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
      {loaded ? `The list couldn't be refreshed: ${loadError}` : loadError}
      <button type="button" className={secondary} onClick={() => void load()}>
        <RefreshCw aria-hidden="true" className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
  if (!loaded) return loadAlert;
  if (!enabled)
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        Staff invitations aren&apos;t set up on this server yet. Ask your platform administrator to connect Edulexa to the sign-in service.
      </p>
    );

  return (
    <div className="space-y-6">
      {!compact && (
        <div>
          <h2 className="text-lg font-semibold">Staff access</h2>
          <p className="text-sm text-muted-foreground">
            Who can sign in for this institute, and as what. New people get an e-mail to set their password; people who already have an account get access at once.
          </p>
        </div>
      )}

      <form onSubmit={invite} className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-label="Invite a staff member">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Work e-mail</span>
            <input type="email" required className={input} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@institute.edu" autoComplete="off" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">First name</span>
            <input className={input} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="off" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Last name</span>
            <input className={input} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="off" />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">Names are needed only for people who don&apos;t have an Edulexa account yet.</p>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Role</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {roles.map((r) => (
              <label key={r} className={`cursor-pointer rounded-lg border px-3 py-2 text-sm ${form.role === r ? "border-cyan-600 bg-cyan-600/5" : "border-border"}`}>
                <input type="radio" name="role" value={r} checked={form.role === r} onChange={() => setForm({ ...form, role: r })} className="sr-only" />
                <span className="block font-medium">{ROLE_LABEL[r] ?? r}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_HELP[r]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className={primary} disabled={busy === "invite" || !form.email.trim()}>
          <UserPlus aria-hidden="true" className="h-4 w-4" />
          {busy === "invite" ? "Sending…" : "Send invitation"}
        </button>
      </form>

      {loadAlert}

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
          {msg.text}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border">
        {members.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No one has been invited through Edulexa yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{m.name || m.email}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {m.email} · {ROLE_LABEL[m.role] ?? m.role}
                  </div>
                </div>
                {m.status === "pending" ? (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-300" title={`Last sent ${when(m.lastSentAt)}`}>
                    Invited, password not set yet
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-800 dark:text-emerald-300">Active</span>
                )}
                <div className="flex gap-1.5">
                  {m.status === "pending" && (
                    <button
                      type="button"
                      className={secondary}
                      disabled={busy === m.id}
                      onClick={() =>
                        void run(
                          m.id,
                          () => api<StaffMember>(getToken, `/${m.id}/resend`, instituteId, { method: "POST" }),
                          (r) => (r.status === "active" ? `${m.email} has already set their password and joined. Nothing was sent.` : `Invitation sent again to ${m.email}.`)
                        )
                      }
                    >
                      <Mail aria-hidden="true" className="h-4 w-4" />
                      Resend
                    </button>
                  )}
                  <button type="button" className={secondary} disabled={busy === m.id} onClick={() => remove(m)} aria-label={m.status === "pending" ? `Withdraw invitation for ${m.email}` : `Remove access for ${m.email}`}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    {m.status === "pending" ? "Withdraw" : "Remove"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={secondary} onClick={() => void load()}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Refresh
        </button>
        <button type="button" className={secondary} onClick={() => void toggleAudit()} aria-expanded={audit !== null}>
          <History aria-hidden="true" className="h-4 w-4" />
          {audit ? "Hide history" : "History of changes"}
        </button>
      </div>

      {audit && (
        <div className="rounded-2xl border border-border">
          {audit.length === 0 ? (
            <p className="px-4 py-4 text-sm text-muted-foreground">No changes yet.</p>
          ) : (
            <ol className="divide-y divide-border text-sm">
              {audit.map((a) => (
                <li key={a.id} className="px-4 py-2.5">
                  <span className="font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                  {": "}
                  {a.targetEmail}
                  {a.role ? ` (${ROLE_LABEL[a.role] ?? a.role})` : ""}
                  <span className="block text-xs text-muted-foreground">
                    {when(a.createdAt)} · by {a.actorName}
                    {a.detail ? ` · ${a.detail}` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {!compact && (
        <p className="text-xs text-muted-foreground">
          People given access before invitations existed, directly in the sign-in service, aren&apos;t listed here. Changes take effect the next time the person signs in.
        </p>
      )}
    </div>
  );
}

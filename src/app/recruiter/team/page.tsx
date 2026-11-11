"use client";

/**
 * Your company's recruiter team (fix plan P2, 5 Nov 2026). Every recruiter of the company sees who is on the team; the people
 * who manage it invite colleagues by e-mail, resend an invitation and remove access. API: /api/recruiter/team.
 */
import React, { useCallback, useEffect, useState } from "react";
import { Mail, RotateCw, Trash2, UserPlus } from "lucide-react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader } from "@/components/career/ui";

interface Member {
  id: string;
  email: string;
  name: string;
  status: "pending" | "active";
  invitedBy: string;
  createdAt: string;
  lastSentAt: string;
  activatedAt: string | null;
  isCompanyAdmin: boolean;
}
interface Company {
  id: string;
  name: string;
  website: string | null;
  isCompanyAdmin: boolean;
}
interface TeamData {
  enabled: boolean;
  company: Company;
  members: Member[];
}

const dateOf = (iso: string) => new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });

export default function RecruiterTeamPage() {
  const en = useEn();
  const { getToken } = useAuth();
  const [data, setData] = useState<TeamData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: "", firstName: "", lastName: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const call = useCallback(
    async <T,>(path: string, init?: { method?: string; body?: unknown }): Promise<T> => {
      const res = await authenticatedFetch(
        `/api/recruiter/team${path}`,
        { method: init?.method ?? "GET", headers: { "Content-Type": "application/json" }, body: init?.body === undefined ? undefined : JSON.stringify(init.body) },
        getToken
      );
      if (res.status === 204) return undefined as T;
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? en("Something went wrong. Please try again."));
      return body as T;
    },
    [getToken, en]
  );

  const load = async () => {
    try {
      setData(await call<TeamData>(""));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof TypeError ? en("We couldn't reach Edulexa. Check your internet connection and try again.") : (e as Error).message);
    }
  };
  const loadRef = useLatestRef(load);
  useEffect(() => {
    void loadRef.current();
  }, [loadRef]);

  // Resolves true when the action succeeded
  const act = async (key: string, action: () => Promise<unknown>, done: string): Promise<boolean> => {
    setBusy(key);
    setMessage(null);
    try {
      await action();
      setMessage({ ok: true, text: done });
      await load();
      return true;
    } catch (e) {
      setMessage({ ok: false, text: e instanceof TypeError ? en("We couldn't reach Edulexa. Check your internet connection and try again.") : (e as Error).message });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    const email = form.email.trim();
    // A failed invitation keeps what was typed, so it can be corrected and sent again
    void act("invite", () => call("", { method: "POST", body: form }), en("Invitation sent to {email}.", { email })).then((ok) => {
      if (ok) setForm({ email: "", firstName: "", lastName: "" });
    });
  };

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader title={en("Team")} />
        <ErrorBanner error={loadError} onRetry={() => void load()} />
      </div>
    );
  }
  if (!data) return <Loading label={en("Loading your team…")} />;

  const manages = data.company.isCompanyAdmin;
  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Team")}
        description={
          manages
            ? en("Recruiters at {company}. Invite colleagues by e-mail; they get the same candidates, reviews and settings.", { company: data.company.name })
            : en("Recruiters at {company}. The people who manage the team can invite or remove colleagues.", { company: data.company.name })
        }
      />

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-sm ${message.ok ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"}`}>
          {message.text}
        </p>
      )}

      {!data.enabled && <ErrorBanner error={en("Invitations aren't set up yet. Ask Edulexa support.")} />}

      {manages && data.enabled && (
        <Card title={en("Invite a colleague")}>
          <form onSubmit={invite} className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1.4fr_auto] sm:items-end">
            <Field label={en("First name")}>{(p) => <input {...p} value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} autoComplete="off" />}</Field>
            <Field label={en("Last name")}>{(p) => <input {...p} value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} autoComplete="off" />}</Field>
            <Field label={en("Work e-mail")}>{(p) => <input {...p} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" />}</Field>
            <Button type="submit" busy={busy === "invite"}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              {en("Send invitation")}
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">{en("New colleagues get an e-mail to set a password. Someone who already has an Edulexa account is added and told by e-mail.")}</p>
        </Card>
      )}

      <Card title={en("{count} recruiters", { count: data.members.length })}>
        {data.members.length === 0 ? (
          <EmptyState title={en("No one on the team yet.")} />
        ) : (
          <ul className="divide-y divide-border">
            {data.members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{m.name || m.email}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email}
                    {m.status === "pending"
                      ? ` · ${en("invited {date}", { date: dateOf(m.lastSentAt) })}`
                      : m.activatedAt
                        ? ` · ${en("joined {date}", { date: dateOf(m.activatedAt) })}`
                        : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {m.isCompanyAdmin && <Badge tone="info">{en("Manages the team")}</Badge>}
                  {m.status === "pending" ? <Badge tone="warn"><Mail aria-hidden="true" className="me-1 h-3 w-3" />{en("Invited")}</Badge> : <Badge tone="good">{en("Joined")}</Badge>}
                  {manages && m.status === "pending" && (
                    <Button variant="secondary" busy={busy === "resend:" + m.id} onClick={() => void act("resend:" + m.id, () => call(`/${m.id}/resend`, { method: "POST" }), en("Invitation sent again to {email}.", { email: m.email }))}>
                      <RotateCw aria-hidden="true" className="h-4 w-4" />
                      {en("Resend")}
                    </Button>
                  )}
                  {/* A manager's access is changed by Edulexa, not from this page (nobody removes their own access) */}
                  {manages && !m.isCompanyAdmin && (
                    <Button
                      variant="ghost"
                      busy={busy === "remove:" + m.id}
                      aria-label={en("Remove {name}", { name: m.name || m.email })}
                      onClick={() => {
                        if (!window.confirm(m.status === "pending" ? en("Withdraw the invitation for {email}?", { email: m.email }) : en("Remove {name} from the team? They are signed out.", { name: m.name || m.email }))) return;
                        void act("remove:" + m.id, () => call(`/${m.id}`, { method: "DELETE" }), en("{email} no longer has access.", { email: m.email }));
                      }}
                    >
                      <Trash2 aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

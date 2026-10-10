"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";

interface TeamMember {
  id: string;
  userId?: string | null;
  email: string;
  name: string;
  title?: string | null;
  role: string;
  status: string;
}

export default function EmployerTeamPage() {
  const api = useApi();
  const { me } = useCareerShell();
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  const team = useLoad(() => (employerId ? api<TeamMember[]>(`/api/career/employer/${employerId}/team`) : Promise.resolve([] as TeamMember[])), [api, employerId]);
  const [form, setForm] = useState({ email: "", name: "", title: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (emp.loading && !emp.data) return <Loading />;
  if (emp.error) return <ErrorBanner error={emp.error} onRetry={emp.reload} />;
  if (!emp.current)
    return (
      <EmptyState title="No company yet">
        <Link href="/employer" className="underline">Set up your company</Link> first.
      </EmptyState>
    );
  const isOwner = emp.current.role === "Owner";

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const invite = (e: React.FormEvent) => {
    e.preventDefault();
    void run("invite", async () => {
      await api(`/api/career/employer/${employerId}/team`, { method: "POST", json: { email: form.email, name: form.name || null, title: form.title || null } });
      setMsg(`${form.email} was invited. They join when they sign in with that email.`);
      setForm({ email: "", name: "", title: "" });
      team.reload();
    });
  };

  const remove = (m: TeamMember) => {
    if (!window.confirm(`Remove ${m.name} from the team?`)) return;
    void run(m.id, async () => {
      await api(`/api/career/employer/${employerId}/team/${m.id}`, { method: "DELETE" });
      setMsg(`${m.name} was removed.`);
      team.reload();
    });
  };

  const pending = (m: TeamMember) => m.status === "Invited" && !m.userId;

  const resend = (m: TeamMember) =>
    run(m.id, async () => {
      const res = await api<{ notified: boolean; message: string }>(`/api/career/employer/${employerId}/team/invites/${m.id}/resend`, { method: "POST" });
      setMsg(res.notified ? `Reminder sent to ${m.email}.` : res.message);
    });

  const revoke = (m: TeamMember) => {
    if (!window.confirm(`Cancel the invitation for ${m.email}?`)) return;
    void run(m.id, async () => {
      await api(`/api/career/employer/${employerId}/team/invites/${m.id}`, { method: "DELETE" });
      setMsg(`The invitation for ${m.email} was cancelled.`);
      team.reload();
    });
  };

  return (
    <div>
      <PageHeader title="Team" description="Colleagues who recruit for your company." actions={<EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} />} />
      <ErrorBanner error={err ?? team.error} />
      <SuccessBanner message={msg} />
      <Card title="Members" className="mb-6">
        {team.loading && !team.data ? (
          <Loading />
        ) : (team.data ?? []).length === 0 ? (
          <EmptyState title="No team members yet" />
        ) : (
          <ul className="divide-y divide-border">
            {team.data!.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{m.name}{m.title && <span className="font-normal text-muted-foreground"> · {m.title}</span>}</p>
                  <p className="text-sm text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={m.role === "Owner" ? "info" : "neutral"}>{m.role}</Badge>
                  <Badge tone={m.status === "Active" ? "good" : "warn"}>{pending(m) ? "Invitation pending" : m.status}</Badge>
                  {isOwner && pending(m) && (
                    <>
                      <Button variant="secondary" onClick={() => resend(m)} busy={busy === m.id} aria-label={`Resend invitation to ${m.email}`}>Resend</Button>
                      <Button variant="ghost" onClick={() => revoke(m)} disabled={busy === m.id} aria-label={`Cancel invitation for ${m.email}`}>Cancel invite</Button>
                    </>
                  )}
                  {isOwner && !pending(m) && m.role !== "Owner" && m.userId !== me?.userId && (
                    <Button variant="ghost" onClick={() => remove(m)} busy={busy === m.id} aria-label={`Remove ${m.name}`}>Remove</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {isOwner ? (
        <Card title="Invite a colleague">
          <form onSubmit={invite} className="grid gap-4 sm:grid-cols-3">
            <Field label="Email">{(p) => <input {...p} type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
            <Field label="Name">{(p) => <input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Job title">{(p) => <input {...p} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
            <div className="sm:col-span-3">
              <Button type="submit" busy={busy === "invite"}>Send invite</Button>
            </div>
          </form>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">Only the account owner can invite or remove colleagues.</p>
      )}
    </div>
  );
}

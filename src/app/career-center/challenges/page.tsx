"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface Row {
  status: string;
  autoApproved: boolean;
  decisionNote?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
  challenge: {
    id: string; title: string; description: string; opensAt: string; closesAt: string; status: string;
    degreeLevels: string[]; majors: string[]; externalJobUrl?: string | null; prizeText?: string | null; maxParticipants?: number | null;
  };
  sprint?: { title: string; requiredLanguage: string; taskType: string } | null;
  employer?: { id: string; name: string; website?: string | null; verificationStatus: string } | null;
  participants: number;
}
interface Stats { joined: number; withdrawn: number; submitted: number; defended: number; consentActive: number; invited: number }

const TONES: Record<string, "neutral" | "good" | "warn" | "bad"> = { Pending: "warn", Approved: "good", Declined: "bad" };

export default function CareerCenterChallengesPage() {
  const api = useApi();
  const [filter, setFilter] = useState("Pending");
  const list = useLoad(() => api<Row[]>(`/api/career/challenges/staff${filter ? `?status=${filter}` : ""}`), [api, filter]);
  const settings = useLoad(() => api<{ autoApproveVerified: boolean }>("/api/career/challenges/staff/settings"), [api]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async (name: string, fn: () => Promise<void>) => {
    setBusy(name);
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

  const decide = (row: Row, status: string) =>
    run(`${status}-${row.challenge.id}`, async () => {
      await api(`/api/career/challenges/staff/${row.challenge.id}/decision`, { method: "POST", json: { status, note: notes[row.challenge.id] || null } });
      setMsg(`"${row.challenge.title}" ${status.toLowerCase()}.`);
      list.reload();
    });

  const loadStats = (row: Row) =>
    run(`stats-${row.challenge.id}`, async () => {
      const s = await api<Stats>(`/api/career/challenges/staff/${row.challenge.id}/stats`);
      setStats((prev) => ({ ...prev, [row.challenge.id]: s }));
    });

  const exportCsv = () =>
    run("csv", async () => {
      const res = await api<Response>("/api/career/challenges/staff/export.csv", { raw: true });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `challenge-participation-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const toggleAuto = (value: boolean) =>
    run("settings", async () => {
      const s = await api<{ autoApproveVerified: boolean }>("/api/career/challenges/staff/settings", { method: "PUT", json: { autoApproveVerified: value } });
      settings.setData(s);
      setMsg(value ? "Challenges from verified employers are now approved automatically." : "Every challenge now needs approval.");
    });

  return (
    <div>
      <PageHeader
        title="Employer challenges"
        description="Approve skills challenges employers publish to your students, and follow participation. Challenges are exercises, not job postings."
        actions={<Button variant="secondary" busy={busy === "csv"} onClick={exportCsv}>Export CSV</Button>}
      />
      <ErrorBanner error={err ?? list.error} />
      <SuccessBanner message={msg} />

      <Card title="Approval setting" className="mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.data?.autoApproveVerified ?? false} disabled={!settings.data || busy === "settings"} onChange={(e) => toggleAuto(e.target.checked)} />
          Approve challenges from verified employers automatically (career admins only)
        </label>
      </Card>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Show">
          {(p) => (
            <select {...p} value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="Pending">Waiting for approval</option>
              <option value="Approved">Approved</option>
              <option value="Declined">Declined</option>
              <option value="">All</option>
            </select>
          )}
        </Field>
      </div>

      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState title="Nothing here" />
      ) : (
        <ul className="space-y-3">
          {list.data.map((row) => {
            const c = row.challenge;
            const s = stats[c.id];
            return (
              <li key={c.id}>
                <Card title={c.title}>
                  <div className="space-y-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={TONES[row.status] ?? "neutral"}>{row.status}{row.autoApproved ? " (automatic)" : ""}</Badge>
                      <span><strong>{row.employer?.name}</strong> ({row.employer?.verificationStatus})</span>
                      <span>· {formatDate(c.opensAt)} – {formatDate(c.closesAt)}</span>
                      <span>· {row.participants} joined</span>
                    </div>
                    {c.description && <p className="whitespace-pre-line">{c.description}</p>}
                    <p className="text-muted-foreground">
                      Assessment: {row.sprint?.title ?? "—"} {row.sprint && `(${row.sprint.requiredLanguage}, ${row.sprint.taskType})`}
                      {" · "}For: {c.degreeLevels.length ? c.degreeLevels.join(", ") : "all levels"}{c.majors.length ? `, ${c.majors.join(", ")}` : ""}
                      {c.maxParticipants ? ` · up to ${c.maxParticipants}` : ""}
                    </p>
                    {c.prizeText && <p>Recognition: {c.prizeText}</p>}
                    {c.externalJobUrl && <p>Job link: <a className="underline" href={c.externalJobUrl} target="_blank" rel="noreferrer">{c.externalJobUrl}</a></p>}
                    {row.decisionNote && <p>Note: {row.decisionNote}</p>}
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[16rem] flex-1">
                        <Field label="Note to the employer (optional)">
                          {(p) => <input {...p} value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })} />}
                        </Field>
                      </div>
                      {row.status !== "Approved" && <Button busy={busy === `Approved-${c.id}`} onClick={() => decide(row, "Approved")}>Approve</Button>}
                      {row.status !== "Declined" && <Button variant="danger" busy={busy === `Declined-${c.id}`} onClick={() => decide(row, "Declined")}>Decline</Button>}
                      <Button variant="secondary" busy={busy === `stats-${c.id}`} onClick={() => loadStats(row)}>Participation</Button>
                    </div>
                    {s && (
                      <dl className="grid grid-cols-3 gap-2 rounded-md bg-muted p-3 sm:grid-cols-6" aria-live="polite">
                        {([["Joined", s.joined], ["Left", s.withdrawn], ["Submitted", s.submitted], ["Defended", s.defended], ["Sharing", s.consentActive], ["Invited to talk", s.invited]] as const).map(([k, v]) => (
                          <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-lg font-semibold">{v}</dd></div>
                        ))}
                      </dl>
                    )}
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

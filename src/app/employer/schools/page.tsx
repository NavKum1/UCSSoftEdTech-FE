"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";
import { RELATIONSHIP_TONES } from "@/components/career/coreLabels";

interface School {
  instituteId: string;
  slug: string;
  displayName: string;
  logoUrl?: string | null;
}

interface Relationship {
  id: string;
  instituteId: string;
  school?: string | null;
  status: string;
  requestNote?: string | null;
  decisionNote?: string | null;
  requestedAt: string;
  decidedAt?: string | null;
}

export default function EmployerSchoolsPage() {
  const api = useApi();
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  const rels = useLoad(() => (employerId ? api<Relationship[]>(`/api/career/employer/${employerId}/schools`) : Promise.resolve([] as Relationship[])), [api, employerId]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<School[] | null>(null);
  const [requesting, setRequesting] = useState<School | null>(null);
  const [note, setNote] = useState("");
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

  const flagged = emp.current.employer.verificationStatus === "Flagged";
  const relFor = (id: string) => rels.data?.find((r) => r.instituteId === id);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("search");
    setErr(null);
    try {
      setResults(await api<School[]>(`/api/career/schools?q=${encodeURIComponent(q.trim())}`));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requesting) return;
    setBusy("request");
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/career/employer/${employerId}/schools`, { method: "POST", json: { instituteId: requesting.instituteId, note: note.trim() || null } });
      setMsg(`Request sent to ${requesting.displayName}. You'll be notified when they decide.`);
      setRequesting(null);
      setNote("");
      rels.reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Schools" description="Ask a school's career center for approval to recruit its students." actions={<EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} />} />
      <ErrorBanner error={err ?? rels.error} />
      <SuccessBanner message={msg} />
      {flagged && <ErrorBanner error="Your company account is under review, so you can't request new schools right now." />}

      <Card title="Find a school" className="mb-6">
        <form role="search" onSubmit={search} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label="School name">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          </div>
          <Button type="submit" variant="secondary" busy={busy === "search"}>Search</Button>
        </form>
        {results && (
          <div className="mt-4" aria-live="polite">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">No schools match.</p>
            ) : (
              <ul className="divide-y divide-border">
                {results.map((s) => {
                  const rel = relFor(s.instituteId);
                  const canRequest = !flagged && (!rel || rel.status === "Declined");
                  return (
                    <li key={s.instituteId} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{s.displayName}</span>
                        <div className="flex items-center gap-2">
                          {rel && <Badge tone={RELATIONSHIP_TONES[rel.status]}>{rel.status}</Badge>}
                          {canRequest && requesting?.instituteId !== s.instituteId && (
                            <Button variant="secondary" onClick={() => setRequesting(s)}>{rel ? "Request again" : "Request access"}</Button>
                          )}
                        </div>
                      </div>
                      {requesting?.instituteId === s.instituteId && (
                        <form onSubmit={sendRequest} className="mt-3 space-y-3 rounded-lg border border-border p-3">
                          <Field label={`Note to ${s.displayName} (optional)`} hint="Who you hire and what roles you recruit for helps the school decide.">
                            {(p) => <textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}
                          </Field>
                          <div className="flex gap-2">
                            <Button type="submit" busy={busy === "request"}>Send request</Button>
                            <Button type="button" variant="secondary" onClick={() => setRequesting(null)}>Cancel</Button>
                          </div>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card title="Your schools">
        {rels.loading && !rels.data ? (
          <Loading />
        ) : (rels.data ?? []).length === 0 ? (
          <EmptyState title="No requests yet">Search for a school above to get started.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Your school relationships</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">School</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Requested</th>
                  <th scope="col" className="py-2 font-medium">School&apos;s note</th>
                </tr>
              </thead>
              <tbody>
                {rels.data!.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pr-3">{r.school ?? "Unknown school"}</td>
                    <td className="py-2 pr-3"><Badge tone={RELATIONSHIP_TONES[r.status]}>{r.status}</Badge></td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatDate(r.requestedAt)}
                      {r.decidedAt && <div className="text-xs text-muted-foreground">Decided {formatDate(r.decidedAt)}</div>}
                    </td>
                    <td className="py-2">{r.decisionNote || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

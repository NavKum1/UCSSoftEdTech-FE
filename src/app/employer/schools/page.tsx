"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";
import { RELATIONSHIP_TONES, useRelationshipLabels } from "@/components/career/coreLabels";

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
  const t = useCareerT("employerSchools");
  const STATUS = useRelationshipLabels();
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
      <EmptyState title={t("noCompanyYet")}>
        {t.rich("setUpYourCompanyFirst", { link: (chunks) => <Link href="/employer" className="underline">{chunks}</Link> })}
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
      setMsg(t("requestSentToDisplayNameYoull", { displayName: requesting.displayName }));
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
      <PageHeader title={t("schools")} description={t("askASchoolsCareerCenter")} actions={<EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} />} />
      <ErrorBanner error={err ?? rels.error} />
      <SuccessBanner message={msg} />
      {flagged && <ErrorBanner error={t("yourCompanyAccountIsUnderReview")} />}

      <Card title={t("findASchool")} className="mb-6">
        <form role="search" onSubmit={search} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field label={t("schoolName")}>{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          </div>
          <Button type="submit" variant="secondary" busy={busy === "search"}>{t("search")}</Button>
        </form>
        {results && (
          <div className="mt-4" aria-live="polite">
            {results.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noSchoolsMatch")}</p>
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
                          {rel && <Badge tone={RELATIONSHIP_TONES[rel.status]}>{STATUS[rel.status] ?? rel.status}</Badge>}
                          {canRequest && requesting?.instituteId !== s.instituteId && (
                            <Button variant="secondary" onClick={() => setRequesting(s)}>{rel ? t("requestAgain") : t("requestAccess")}</Button>
                          )}
                        </div>
                      </div>
                      {requesting?.instituteId === s.instituteId && (
                        <form onSubmit={sendRequest} className="mt-3 space-y-3 rounded-lg border border-border p-3">
                          <Field label={t("noteToDisplayNameOptional", { displayName: s.displayName })} hint={t("whoYouHireAndWhat")}>
                            {(p) => <textarea {...p} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />}
                          </Field>
                          <div className="flex gap-2">
                            <Button type="submit" busy={busy === "request"}>{t("sendRequest")}</Button>
                            <Button type="button" variant="secondary" onClick={() => setRequesting(null)}>{t("cancel")}</Button>
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

      <Card title={t("yourSchools")}>
        {rels.loading && !rels.data ? (
          <Loading />
        ) : (rels.data ?? []).length === 0 ? (
          <EmptyState title={t("noRequestsYet")}>{t("searchForASchoolAbove")}</EmptyState>
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("yourSchoolRelationships")}</caption>
              <thead>
                <tr className="border-b border-border text-start [&_th]:text-start">
                  <th scope="col" className="py-2 pe-3 font-medium">{t("school")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("status")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("requested")}</th>
                  <th scope="col" className="py-2 font-medium">{t("schoolsNote")}</th>
                </tr>
              </thead>
              <tbody>
                {rels.data!.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pe-3">{r.school ?? t("unknownSchool")}</td>
                    <td className="py-2 pe-3"><Badge tone={RELATIONSHIP_TONES[r.status]}>{STATUS[r.status] ?? r.status}</Badge></td>
                    <td className="py-2 pe-3 whitespace-nowrap">
                      {formatDate(r.requestedAt)}
                      {r.decidedAt && <div className="text-xs text-muted-foreground">{t("decidedDecidedAt", { decidedAt: formatDate(r.decidedAt) })}</div>}
                    </td>
                    <td className="py-2">{r.decisionNote || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>
    </div>
  );
}

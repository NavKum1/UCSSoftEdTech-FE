"use client";

/**
 * D3 international office view: F-1 students' self-reported OPT day counts and warnings at this school (career admins and
 * counselors), the DSO contact setting, and links between employer records and sponsorship history.
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, ScrollArea, useCareerT, useCareerLabels, useCareerFormat } from "@/components/career/ui";
import { DsoCard, LevelBadge, NotLegalAdvice, formatDay, type DsoContact, type OptStatus, type OptView, useStateText } from "@/components/career/international/shared";
import { AuthorizationsTable, ChecksList, DeadlinesTable, EmploymentsTable, SpansAndRules, UnemploymentMeter } from "@/components/career/international/OptOverview";
import SponsorLookup, { type SponsorSummary } from "@/components/career/international/SponsorLookup";
import WorkRightsStaff from "@/components/career/international/WorkRightsStaff";

interface StaffRow {
  studentUserId: string;
  name: string;
  email: string;
  studentNumber?: string | null;
  programEndDate?: string | null;
  currentOptType?: string | null;
  eadEnd?: string | null;
  state: OptStatus["state"];
  daysUsed: number;
  limit: number;
  daysRemaining: number;
  level: OptStatus["level"];
  hasStem: boolean;
  employedToday: boolean;
  unreportedChanges: number;
  overdueItems: number;
  nextDue?: { label: string; dueOn: string; status: string } | null;
}

interface StaffList {
  asOf: string;
  total: number;
  atRisk: number;
  items: StaffRow[];
  dso: DsoContact;
  disclaimer: string;
}

interface SettingsResponse {
  dso: DsoContact;
  canEdit: boolean;
  disclaimer: string;
}

interface StudentDetail {
  student: { userId: string; name: string; email: string; studentNumber?: string | null; workAuthorization: string };
  view: OptView;
}

interface EmployerLinkRow {
  employerId: string;
  name: string;
  website?: string | null;
  relationship?: string | null;
  normalizedName: string;
  link: { employerKey: string | null; method: "Auto" | "Staff" | "NoMatch" | null; confirmed: boolean; updatedAt?: string | null };
  sponsor: { employerKey: string; displayName: string; totalCertified: number; latestFiscalYear: number; latestCertified: number } | null;
}

const TYPE_LABEL_KEYS = ["PreCompletion", "PostCompletion", "StemExtension"];
/** type label in the career language (G1) */
function useTypeLabels(): Record<string, string> {
  return useCareerLabels("careerCenterInternational.type", TYPE_LABEL_KEYS);
}

function DsoSettings() {
  const t = useCareerT("careerCenterInternational");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const { data, setData, error, loading } = useLoad(() => api<SettingsResponse>("/api/career/international/settings"), [api, schoolId]);
  const [draft, setDraft] = useState<DsoContact | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (!data) return <ErrorBanner error={error} />;
  const form = draft ?? data.dso;

  if (!data.canEdit) {
    return (
      <>
        <DsoCard dso={data.dso} />
        <p className="mt-3 text-xs text-muted-foreground">{t("aCareerAdminCanChange")}</p>
      </>
    );
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const saved = await api<SettingsResponse>("/api/career/international/settings", {
        method: "PUT",
        json: { dsoName: form.name ?? "", dsoEmail: form.email ?? "", dsoPhone: form.phone ?? "", officeUrl: form.officeUrl ?? "", note: form.note ?? "" },
      });
      setData(saved);
      setDraft(null);
      setMsg(t("dSOContactSavedStudentsSee"));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <Field label={t("dSOName")}>{(p) => <input {...p} value={form.name ?? ""} onChange={(e) => setDraft({ ...form, name: e.target.value })} maxLength={200} />}</Field>
      <Field label={t("dSOEmail")} hint={t("shownToF1Students")}>
        {(p) => <input {...p} type="email" value={form.email ?? ""} onChange={(e) => setDraft({ ...form, email: e.target.value })} maxLength={200} />}
      </Field>
      <Field label={t("phone")}>{(p) => <input {...p} value={form.phone ?? ""} onChange={(e) => setDraft({ ...form, phone: e.target.value })} maxLength={50} />}</Field>
      <Field label={t("internationalOfficeWebsite")}>
        {(p) => <input {...p} type="url" value={form.officeUrl ?? ""} onChange={(e) => setDraft({ ...form, officeUrl: e.target.value })} placeholder={t("https")} />}
      </Field>
      <div className="sm:col-span-2">
        <Field label={t("noteForStudentsOptional")}>
          {(p) => <textarea {...p} rows={2} value={form.note ?? ""} onChange={(e) => setDraft({ ...form, note: e.target.value })} maxLength={1000} />}
        </Field>
      </div>
      <div>
        <Button type="submit" busy={busy}>
          {t("saveContact")}
        </Button>
      </div>
    </form>
  );
}

function StudentDetailPanel({ detail, onClose }: { detail: StudentDetail; onClose: () => void }) {
  const t = useCareerT("careerCenterInternational");
  const v = detail.view;
  return (
    <Card
      title={t("nameOPTRecord", { name: detail.student.name || detail.student.email })}
      className="mt-6"
      actions={
        <Button variant="secondary" onClick={onClose}>
          {t("close")}
        </Button>
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        {detail.student.email}
        {detail.student.studentNumber ? ` · ${detail.student.studentNumber}` : ""}{" "}{t("programEndDateProgramEndDateEntered", { programEndDate: formatDay(v.tracker?.programEndDate) })}
      </p>
      <UnemploymentMeter view={v} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("thingsToCheck")}</h3>
          <ChecksList checks={v.checks} />
        </div>
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("deadlines")}</h3>
          <DeadlinesTable deadlines={v.deadlines} />
        </div>
      </div>
      <h3 className="mb-2 mt-6 text-sm font-semibold">{t("authorizationPeriods")}</h3>
      <AuthorizationsTable items={v.authorizations} />
      <h3 className="mb-2 mt-6 text-sm font-semibold">{t("employment")}</h3>
      <EmploymentsTable items={v.employments} hasStem={v.status.hasStem} />
      <div className="mt-6">
        <SpansAndRules view={v} />
      </div>
    </Card>
  );
}

function OptStudents() {
  const t = useCareerT("careerCenterInternational");
  const STATE_TEXT = useStateText();
  const TYPE_LABEL = useTypeLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const list = useLoad(
    () => api<StaffList>(`/api/career/international/staff/students?filter=${encodeURIComponent(filter)}${query ? `&q=${encodeURIComponent(query)}` : ""}`),
    [api, schoolId, filter, query],
  );
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const open = async (id: string) => {
    setOpening(id);
    setErr(null);
    try {
      setDetail(await api<StudentDetail>(`/api/career/international/staff/students/${id}`));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setOpening(null);
    }
  };

  return (
    <>
      <Card title={t("studentsOnOPT")}>
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <div className="w-48">
            <Field label={t("show")}>
              {(p) => (
                <select {...p} value={filter} onChange={(e) => setFilter(e.target.value)}>
                  <option value="all">{t("allStudentsWithATracker")}</option>
                  <option value="at-risk">{t("withAWarning")}</option>
                  <option value="active">{t("oPTActive")}</option>
                  <option value="unemployed">{t("activeAndNotEmployedToday")}</option>
                </select>
              )}
            </Field>
          </div>
          <div className="min-w-48 flex-1">
            <Field label={t("nameOrEmail")}>{(p) => <input {...p} value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          </div>
          <Button type="submit" variant="secondary">
            {t("search")}
          </Button>
        </form>
        <ErrorBanner error={err ?? list.error} onRetry={list.reload} />
        {list.loading ? (
          <Loading />
        ) : !list.data ? null : list.data.items.length === 0 ? (
          <EmptyState title={t("noStudentsToShow")}>{t("f1StudentsAppearHere")}</EmptyState>
        ) : (
          <div aria-live="polite">
            <p className="mb-2 text-sm text-muted-foreground">
              {t("totalStudentsWithATracker", { total: list.data.total, atRisk: list.data.atRisk, asOf: formatDay(list.data.asOf) })}
            </p>
            <ScrollArea>
              <table className="w-full text-sm">
                <caption className="sr-only">{t("f1StudentsOnOPT")}</caption>
                <thead className="text-start text-xs uppercase text-muted-foreground [&_th]:text-start">
                  <tr>
                    <th scope="col" className="py-2 pe-3">{t("student")}</th>
                    <th scope="col" className="py-2 pe-3">{t("oPT")}</th>
                    <th scope="col" className="py-2 pe-3">{t("unemploymentDays")}</th>
                    <th scope="col" className="py-2 pe-3">{t("employedToday")}</th>
                    <th scope="col" className="py-2 pe-3">{t("reporting")}</th>
                    <th scope="col" className="py-2 pe-3">{t("nextDue")}</th>
                    <th scope="col" className="py-2"><span className="sr-only">{t("actions")}</span></th>
                  </tr>
                </thead>
                <tbody>
                  {list.data.items.map((s) => (
                    <tr key={s.studentUserId} className="border-t border-border align-top">
                      <td className="py-2 pe-3">
                        <span className="font-medium">{s.name || s.email}</span>
                        <span className="block text-xs text-muted-foreground">{s.email}</span>
                      </td>
                      <td className="py-2 pe-3">
                        {s.currentOptType ? TYPE_LABEL[s.currentOptType] ?? s.currentOptType : STATE_TEXT[s.state]}
                        {s.eadEnd && <span className="block text-xs text-muted-foreground">{t("eADEndsEadEnd", { eadEnd: formatDay(s.eadEnd) })}</span>}
                      </td>
                      <td className="py-2 pe-3">
                        {s.state === "PreCompletionOnly" || s.state === "NoAuthorization" ? (
                          "—"
                        ) : (
                          <>
                            <span className="tabular-nums">
                              {s.daysUsed} / {s.limit}
                            </span>{" "}
                            <LevelBadge level={s.level} />
                          </>
                        )}
                      </td>
                      <td className="py-2 pe-3">{s.state === "Active" ? (s.employedToday ? t("yes") : t("no")) : "—"}</td>
                      <td className="py-2 pe-3">
                        {s.overdueItems > 0 ? <Badge tone="bad">{t("overdueItemsOverdue", { overdueItems: s.overdueItems })}</Badge> : s.unreportedChanges > 0 ? <Badge tone="warn">{t("unreportedChangesOpen", { unreportedChanges: s.unreportedChanges })}</Badge> : <Badge tone="good">{t("upToDate")}</Badge>}
                      </td>
                      <td className="py-2 pe-3 text-xs">{s.nextDue ? `${s.nextDue.label} (${formatDay(s.nextDue.dueOn)})` : "—"}</td>
                      <td className="py-2 text-end">
                        <Button variant="secondary" busy={opening === s.studentUserId} onClick={() => open(s.studentUserId)} aria-label={t("viewOPTRecordForName", { name: s.name || s.email })}>
                          {t("view")}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}
      </Card>
      {detail && <StudentDetailPanel detail={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function EmployerLinks() {
  const t = useCareerT("careerCenterInternational");
  const fmt = useCareerFormat();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const { data, setData, error, loading, reload } = useLoad(() => api<{ items: EmployerLinkRow[]; disclaimer: string }>("/api/career/international/staff/employer-links"), [api, schoolId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const [pickQ, setPickQ] = useState("");
  const [matches, setMatches] = useState<SponsorSummary[] | null>(null);

  const act = async (id: string, fn: () => Promise<unknown>, done: string) => {
    setBusy(id);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      const fresh = await api<{ items: EmployerLinkRow[]; disclaimer: string }>("/api/career/international/staff/employer-links");
      setData(fresh);
      setMsg(done);
      setPicking(null);
      setMatches(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const link = (id: string, employerKey: string | null, noMatch = false) =>
    act(id, () => api(`/api/career/international/staff/employer-links/${id}`, { method: "PUT", json: { employerKey, noMatch } }), noMatch ? t("markedAsNoMatch") : t("linkSaved"));

  const findMatches = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      const res = await api<{ items: SponsorSummary[] }>(`/api/career/international/sponsors?q=${encodeURIComponent(pickQ.trim())}&limit=10`);
      setMatches(res.items);
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };

  return (
    <Card title={t("employerSponsorshipLinks")}>
      <p className="mb-3 text-sm text-muted-foreground">
        {t("employersThatWorkWithYour")}
      </p>
      <ErrorBanner error={err ?? error} onRetry={reload} />
      <SuccessBanner message={msg} />
      {loading ? (
        <Loading />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title={t("noEmployersYet")}>{t("employersAppearHereOnceThey")}</EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {data.items.map((row) => (
            <li key={row.employerId} className="py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.sponsor
                      ? t("linkedToDisplayNameTotalCertifiedCertifi", { displayName: row.sponsor.displayName, totalCertified: fmt.number(row.sponsor.totalCertified), latestFiscalYear: row.sponsor.latestFiscalYear })
                      : row.link.method === "NoMatch"
                        ? t("markedAsHavingNoSponsorship")
                        : t("noMatchingSponsorshipRecordFound")}
                  </p>
                  <p className="mt-1">
                    {row.link.method === "Staff" && <Badge tone="good">{t("confirmedByStaff")}</Badge>}
                    {row.link.method === "NoMatch" && <Badge tone="neutral">{t("noMatchStaff")}</Badge>}
                    {row.link.method === "Auto" && <Badge tone="info">{t("matchedByName")}</Badge>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {row.link.method === "Auto" && row.link.employerKey && (
                    <Button variant="secondary" busy={busy === row.employerId} onClick={() => link(row.employerId, row.link.employerKey)}>
                      {t("confirm")}
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    disabled={busy === row.employerId}
                    onClick={() => {
                      setPicking(picking === row.employerId ? null : row.employerId);
                      setPickQ(row.name);
                      setMatches(null);
                    }}
                    aria-expanded={picking === row.employerId}
                  >
                    {t("change")}
                  </Button>
                  {row.link.method !== "NoMatch" && (
                    <Button variant="ghost" disabled={busy === row.employerId} onClick={() => link(row.employerId, null, true)}>
                      {t("noMatch")}
                    </Button>
                  )}
                  {row.link.confirmed && (
                    <Button
                      variant="ghost"
                      disabled={busy === row.employerId}
                      onClick={() => act(row.employerId, () => api(`/api/career/international/staff/employer-links/${row.employerId}`, { method: "DELETE" }), t("backToAutomaticMatching"))}
                    >
                      {t("reset")}
                    </Button>
                  )}
                </div>
              </div>
              {picking === row.employerId && (
                <div className="mt-3 rounded-md border border-border p-3">
                  <form onSubmit={findMatches} className="flex flex-wrap items-end gap-2">
                    <div className="min-w-48 flex-1">
                      <Field label={t("findTheSponsorshipRecordFor", { name: row.name })}>
                        {(p) => <input {...p} value={pickQ} onChange={(e) => setPickQ(e.target.value)} maxLength={100} />}
                      </Field>
                    </div>
                    <Button type="submit" variant="secondary">
                      {t("find")}
                    </Button>
                  </form>
                  {matches && (
                    <ul className="mt-2 space-y-1" aria-live="polite">
                      {matches.length === 0 && <li className="text-sm text-muted-foreground">{t("noRecordsFound")}</li>}
                      {matches.map((m) => (
                        <li key={m.normalizedKey} className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            {m.name} <span className="text-xs text-muted-foreground">{t("totalCertifiedCertified", { totalCertified: fmt.number(m.totalCertified) })}</span>
                          </span>
                          <Button variant="secondary" busy={busy === row.employerId} onClick={() => link(row.employerId, m.normalizedKey)}>
                            {t("link")}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function CareerCenterInternationalPage() {
  const t = useCareerT("careerCenterInternational");
  const { me, schoolId } = useCareerShell();
  const role = me?.memberships.find((m) => m.instituteId === schoolId && ["CareerAdmin", "Counselor", "EmployerRelations"].includes(m.role))?.role
    ?? me?.memberships.find((m) => ["CareerAdmin", "Counselor", "EmployerRelations"].includes(m.role))?.role;
  const officeView = role !== "EmployerRelations";

  return (
    <div>
      <PageHeader
        title={t("internationalStudents")}
        description={t("f1StudentsOPTUnemployment")}
      />
      <NotLegalAdvice>
        {t("theseCountsComeFromWhat")}
      </NotLegalAdvice>
      {officeView ? (
        <>
          <OptStudents />
          <div className="mt-6">
            <WorkRightsStaff />
          </div>
          <Card title={t("internationalOfficeContact")} className="mt-6">
            <DsoSettings />
          </Card>
        </>
      ) : (
        <Card title={t("oPTRecords")}>
          <p className="text-sm text-muted-foreground">{t("studentsOPTRecordsAreVisible")}</p>
        </Card>
      )}
      <div className="mt-6">
        <EmployerLinks />
      </div>
      <div className="mt-6">
        <SponsorLookup />
      </div>
    </div>
  );
}

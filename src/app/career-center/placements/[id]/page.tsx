"use client";

/**
 * One campus drive as the placement office records it (G14a): the company's published criteria, the eligibility list
 * computed from academic records, rounds with per-student results, and offers. Staff only. The company never sees this
 * page, and students don't apply here.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { CareerTranslator } from "@/components/career/i18n/CareerI18nProvider";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, ScrollArea, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import {
  AcademicRecord,
  Drive,
  OFFER_TONE,
  Offer,
  RESULT_TONE,
  StudentRef,
  Vocabulary,
  inrFull,
  label,
  usePlacementModeLabels,
  useDriveStatusLabels,
  useResultLabels,
  useOfferStatusLabels,
  useEligibilityLabels,
} from "@/components/career/placements/shared";
import { useRunner } from "@/components/career/placements/useRunner";

interface DriveDetail {
  drive: Drive;
  rounds: { id: string; sequence: number; name: string; roundDate?: string | null; cleared: number; recorded: number }[];
  participants: { student: StudentRef; programme?: string | null; batch?: number | null; results: ({ roundId: string; result: string; outsideCriteria: boolean } | null)[] }[];
  offers: Offer[];
  vocabulary: Vocabulary;
}

interface EligibilityRow {
  student: StudentRef;
  record?: AcademicRecord | null;
  status: string;
  reasons: string[];
}

interface Eligibility {
  counts: { eligible: number; check: number; notEligible: number };
  eligible: EligibilityRow[];
  check: EligibilityRow[];
  notEligible: EligibilityRow[];
  note: string;
}

interface ResultsImport {
  committed: boolean;
  rows: number;
  rounds: Record<string, number>;
  offers: number;
  offersCreated: number;
  offersUpdated: number;
  matchedRoundColumns: { round: string; column: string }[];
  issueCount: number;
  issues: { line: number; message: string }[];
}

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";

function criteriaSummary(d: Drive, t: CareerTranslator): string[] {
  const out: string[] = [];
  out.push(d.batches.length ? t("criteria.batches", { list: d.batches.join(", ") }) : t("criteria.anyBatch"));
  if (d.degrees.length) out.push(t("criteria.degrees", { list: d.degrees.join(", ") }));
  out.push(d.branches.length ? t("criteria.branches", { list: d.branches.join(", ") }) : t("criteria.anyBranch"));
  if (d.minCgpa != null) out.push(t("criteria.minCgpa", { value: d.minCgpa }));
  if (d.maxActiveBacklogs != null) out.push(t("criteria.maxActiveBacklogs", { value: d.maxActiveBacklogs }));
  if (d.maxTotalBacklogs != null) out.push(t("criteria.maxTotalBacklogs", { value: d.maxTotalBacklogs }));
  if (d.minClass10Percent != null) out.push(t("criteria.minClass10", { value: d.minClass10Percent }));
  if (d.minClass12Percent != null) out.push(t("criteria.minClass12", { value: d.minClass12Percent }));
  if (d.excludePlaced) out.push(t("criteria.excludePlaced"));
  return out;
}

export default function DrivePage() {
  const t = useCareerT("careerCenterPlacementsDetail");
  const ELIGIBILITY_LABELS = useEligibilityLabels();
  const OFFER_STATUS_LABELS = useOfferStatusLabels();
  const RESULT_LABELS = useResultLabels();
  const DRIVE_STATUS_LABELS = useDriveStatusLabels();
  const MODE_LABELS = usePlacementModeLabels();
  const { id } = useParams<{ id: string }>();
  const { schoolId } = useCareerShell();
  const { api, busy, err, msg, setMsg, run, download } = useRunner();
  const detail = useLoad(() => api<DriveDetail>(`/api/career/placement-office/drives/${id}`), [api, schoolId, id]);
  const elig = useLoad(() => api<Eligibility>(`/api/career/placement-office/drives/${id}/eligibility`), [api, schoolId, id]);
  const d = detail.data?.drive;

  const reloadAll = () => {
    detail.reload();
    elig.reload();
  };

  const setStatus = (status: string) =>
    run("status", async () => {
      if (!d) return;
      await api(`/api/career/placement-office/drives/${id}`, { method: "PUT", json: { ...d, status } });
      setMsg(t("driveMarkedValue", { value: label(DRIVE_STATUS_LABELS, status).toLowerCase() }));
      detail.reload();
    });

  // Rounds
  const [roundName, setRoundName] = useState("");
  const [roundDate, setRoundDate] = useState("");
  const addRound = (e: React.FormEvent) => {
    e.preventDefault();
    void run("round", async () => {
      await api(`/api/career/placement-office/drives/${id}/rounds`, { method: "POST", json: { name: roundName, roundDate: roundDate || null } });
      setMsg(t("roundRoundNameAdded", { roundName }));
      setRoundName("");
      setRoundDate("");
      detail.reload();
    });
  };

  // Students shown in the results grid: eligible + check + anyone already recorded
  const gridStudents = useMemo(() => {
    const map = new Map<string, { student: StudentRef; status: string }>();
    for (const r of [...(elig.data?.eligible ?? []), ...(elig.data?.check ?? [])]) map.set(r.student.membershipId, { student: r.student, status: r.status });
    for (const p of detail.data?.participants ?? []) if (!map.has(p.student.membershipId)) map.set(p.student.membershipId, { student: p.student, status: "notEligible" });
    return Array.from(map.values()).sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [elig.data, detail.data]);
  const [extra, setExtra] = useState("");
  const [roundId, setRoundId] = useState("");
  const activeRound = detail.data?.rounds.find((r) => r.id === roundId) ?? detail.data?.rounds[0];
  const [draft, setDraft] = useState<Record<string, string>>({});
  const currentResult = (membershipId: string) => {
    if (!activeRound) return "";
    const key = `${activeRound.id}:${membershipId}`;
    if (key in draft) return draft[key];
    const idx = detail.data?.rounds.findIndex((r) => r.id === activeRound.id) ?? -1;
    const p = detail.data?.participants.find((x) => x.student.membershipId === membershipId);
    return (idx >= 0 && p?.results[idx]?.result) || "";
  };
  const extraStudents = useMemo(() => {
    const shown = new Set(gridStudents.map((g) => g.student.membershipId));
    return (elig.data?.notEligible ?? []).filter((r) => !shown.has(r.student.membershipId));
  }, [gridStudents, elig.data]);
  const [added, setAdded] = useState<{ student: StudentRef; status: string }[]>([]);
  const allGrid = [...gridStudents, ...added.filter((a) => !gridStudents.some((g) => g.student.membershipId === a.student.membershipId))];
  const saveResults = () =>
    run("results", async () => {
      if (!activeRound) throw new Error(t("addARoundFirst"));
      const items = Object.entries(draft)
        .filter(([k, v]) => k.startsWith(activeRound.id + ":") && v)
        .map(([k, v]) => ({ membershipId: k.split(":")[1], result: v }));
      if (items.length === 0) throw new Error(t("chooseAResultForAt"));
      const r = await api<{ written: number; outsideCriteria: number }>(`/api/career/placement-office/drives/${id}/rounds/${activeRound.id}/results`, { method: "PUT", json: items });
      setMsg(t("writtenResultSSavedFor", { written: r.written, name: activeRound.name, value: r.outsideCriteria ? t("outsideCriteriaStudentSAreOutside", { outsideCriteria: r.outsideCriteria }) : "" }));
      setDraft({});
      detail.reload();
    });

  // Offers
  const roles = d?.roles ?? [];
  const [offer, setOffer] = useState({ membershipId: "", roleTitle: "", ctcText: "", joiningDate: "", status: "Offered" });
  const addOffer = (e: React.FormEvent) => {
    e.preventDefault();
    void run("offer", async () => {
      if (!offer.membershipId) throw new Error(t("chooseTheStudent"));
      await api("/api/career/placement-office/offers", {
        method: "POST",
        json: { driveId: id, membershipId: offer.membershipId, roleTitle: offer.roleTitle || null, ctcText: offer.ctcText || null, joiningDate: offer.joiningDate || null, status: offer.status },
      });
      setMsg(t("offerRecorded"));
      setOffer({ membershipId: "", roleTitle: "", ctcText: "", joiningDate: "", status: "Offered" });
      reloadAll();
    });
  };
  const setOfferStatus = (o: Offer, status: string) =>
    run(o.id, async () => {
      await api(`/api/career/placement-office/offers/${o.id}`, { method: "PUT", json: { status } });
      setMsg(t("offerStatusSavedStatus", { status: label(OFFER_STATUS_LABELS, status) }));
      detail.reload();
    });

  // Import results
  const [file, setFile] = useState<File | null>(null);
  const [imp, setImp] = useState<ResultsImport | null>(null);
  const importResults = (commit: boolean) =>
    run(commit ? "commit" : "dry", async () => {
      if (!file) throw new Error(t("chooseACSVOrExcel"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("commit", String(commit));
      const r = await api<ResultsImport>(`/api/career/placement-office/drives/${id}/import`, { method: "POST", body: fd });
      setImp(r);
      if (commit) {
        setMsg(t("importedValueResultSOffersCreated", { value: Object.values(r.rounds).reduce((a, b) => a + b, 0), offersCreated: r.offersCreated, offersUpdated: r.offersUpdated }));
        reloadAll();
      }
    });

  if (detail.loading && !detail.data) return <Loading />;
  if (!d) return <ErrorBanner error={detail.error ?? t("driveNotFound")} onRetry={detail.reload} />;

  const eligTable = (rows: EligibilityRow[], caption: string) => (
    <ScrollArea>
      <table className="w-full text-sm">
        <caption className="mb-2 text-start font-semibold">{caption}</caption>
        <thead>
          <tr className="border-b border-border [&_th]:text-start">
            <th scope="col" className={th}>{t("student")}</th>
            <th scope="col" className={th}>{t("programmeAndBatch")}</th>
            <th scope="col" className={th}>{t("cGPA")}</th>
            <th scope="col" className={th}>{t("reasons")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-2 text-muted-foreground">{t("none")}</td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.student.membershipId} className="border-b border-border last:border-0">
                <th scope="row" className={`${td} text-start font-normal`}>
                  {r.student.name}
                  <div className="text-xs text-muted-foreground">{r.record?.rollNumber ?? r.student.email}</div>
                </th>
                <td className={td}>{r.record ? `${r.record.programme}, ${r.record.batch}` : "—"}</td>
                <td className={td}>{r.record?.cgpa ?? "—"}</td>
                <td className={td}>{r.reasons.join("; ") || "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </ScrollArea>
  );

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/career-center/placements" className="underline">
          {t("placementOffice")}
        </Link>
      </p>
      <PageHeader
        title={t("companyNameDrive", { companyName: d.companyName })}
        description={t("driveDateModeValueRecordedBy", { driveDate: formatDate(d.driveDate), mode: label(MODE_LABELS, d.mode), value: d.location ? ` · ${d.location}` : "" })}
        actions={
          <Field label={t("driveStatus")}>
            {(p) => (
              <select {...p} value={d.status} disabled={busy === "status"} onChange={(e) => void setStatus(e.target.value)}>
                {Object.keys(DRIVE_STATUS_LABELS).map((s) => <option key={s} value={s}>{label(DRIVE_STATUS_LABELS, s)}</option>)}
              </select>
            )}
          </Field>
        }
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <div className="space-y-6">
        <Card title={t("rolesAndPublishedCriteria")}>
          <ul className="mb-3 list-disc space-y-1 ps-5 text-sm">
            {roles.length === 0 ? <li>{t("noRolesRecorded")}</li> : roles.map((r) => <li key={r.title}>{r.title}{r.ctcAnnual ? t("ctcAnnualPerYear", { ctcAnnual: inrFull(r.ctcAnnual) }) : ""}{r.stipendMonthly ? t("stipendStipendMonthlyAMonth", { stipendMonthly: inrFull(r.stipendMonthly) }) : ""}</li>)}
          </ul>
          <ul className="list-disc space-y-1 ps-5 text-sm">
            {criteriaSummary(d, t).map((c) => <li key={c}>{c}</li>)}
          </ul>
          {d.criteriaNotes && <p className="mt-2 text-sm text-muted-foreground">{d.criteriaNotes}</p>}
          {d.companyContact && <p className="mt-2 text-sm">{t("companyContactCompanyContact", { companyContact: d.companyContact })}</p>}
        </Card>

        <Card
          title={t("eligibilityList")}
          actions={
            <Button variant="secondary" busy={busy === "csv"} onClick={() => void download(`/api/career/placement-office/drives/${id}/eligibility.csv`, "csv", "eligibility.csv")}>
              {t("downloadCSV")}
            </Button>
          }
        >
          {elig.loading && !elig.data ? (
            <Loading />
          ) : elig.error ? (
            <ErrorBanner error={elig.error} onRetry={elig.reload} />
          ) : (
            elig.data && (
              <div className="space-y-4">
                <p className="text-sm" role="status">
                  {ELIGIBILITY_LABELS.eligible}: {elig.data.counts.eligible} · {ELIGIBILITY_LABELS.check}: {elig.data.counts.check} · {ELIGIBILITY_LABELS.notEligible}: {elig.data.counts.notEligible}
                </p>
                <p className="text-xs text-muted-foreground">{elig.data.note}</p>
                {eligTable(elig.data.eligible, t("eligible"))}
                {eligTable(elig.data.check, t("checkDataMissing"))}
                <details>
                  <summary className="cursor-pointer text-sm font-medium">{t("notEligibleNotEligible", { notEligible: elig.data.counts.notEligible })}</summary>
                  <div className="mt-2">{eligTable(elig.data.notEligible, t("notEligible"))}</div>
                </details>
              </div>
            )
          )}
        </Card>

        <Card title={t("roundsAndResults")}>
          {(detail.data?.rounds.length ?? 0) === 0 ? (
            <EmptyState title={t("noRoundsYet")}>{t("addTheRoundsTheCompany")}</EmptyState>
          ) : (
            <div className="space-y-4">
              <ul className="flex flex-wrap gap-2 text-sm">
                {detail.data!.rounds.map((r) => (
                  <li key={r.id} className="rounded-md border border-border px-2 py-1">
                    {r.sequence}. {r.name} {r.roundDate ? `(${formatDate(r.roundDate)})` : ""}{t("clearedClearedOfRecordedRecorded", { cleared: r.cleared, recorded: r.recorded })}
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <Field label={t("recordResultsFor")}>
                  {(p) => (
                    <select {...p} value={activeRound?.id ?? ""} onChange={(e) => setRoundId(e.target.value)}>
                      {detail.data!.rounds.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  )}
                </Field>
                {extraStudents.length > 0 && (
                  <Field label={t("addAStudentOutsideThe")}>
                    {(p) => (
                      <select
                        {...p}
                        value={extra}
                        onChange={(e) => {
                          const row = extraStudents.find((x) => x.student.membershipId === e.target.value);
                          if (row) setAdded((a) => [...a, { student: row.student, status: row.status }]);
                          setExtra("");
                        }}
                      >
                        <option value="">{t("choose")}</option>
                        {extraStudents.map((x) => <option key={x.student.membershipId} value={x.student.membershipId}>{x.student.name}</option>)}
                      </select>
                    )}
                  </Field>
                )}
              </div>
              {allGrid.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noEligibleStudentsYet")}</p>
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t("resultsForName", { name: activeRound?.name })}</caption>
                    <thead>
                      <tr className="border-b border-border [&_th]:text-start">
                        <th scope="col" className={th}>{t("student")}</th>
                        <th scope="col" className={th}>{t("eligibility")}</th>
                        <th scope="col" className={th}>{t("resultInName", { name: activeRound?.name })}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allGrid.map(({ student, status }) => {
                        const value = currentResult(student.membershipId);
                        return (
                          <tr key={student.membershipId} className="border-b border-border last:border-0">
                            <th scope="row" className={`${td} text-start font-normal`}>{student.name}</th>
                            <td className={td}>
                              <Badge tone={status === "eligible" ? "good" : status === "check" ? "warn" : "neutral"}>{label(ELIGIBILITY_LABELS, status)}</Badge>
                            </td>
                            <td className={td}>
                              <label className="sr-only" htmlFor={`res-${student.membershipId}`}>{t("resultForName", { name: student.name })}</label>
                              <select
                                id={`res-${student.membershipId}`}
                                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                                value={value}
                                onChange={(e) => setDraft((x) => ({ ...x, [`${activeRound!.id}:${student.membershipId}`]: e.target.value }))}
                              >
                                <option value="">{t("notRecorded")}</option>
                                {Object.keys(RESULT_LABELS).map((k) => <option key={k} value={k}>{label(RESULT_LABELS, k)}</option>)}
                              </select>
                              {value && !(`${activeRound!.id}:${student.membershipId}` in draft) && (
                                <span className="ms-2"><Badge tone={RESULT_TONE[value] ?? "neutral"}>{t("saved")}</Badge></span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
              <Button busy={busy === "results"} onClick={() => void saveResults()}>{t("saveResults")}</Button>
            </div>
          )}
          <form onSubmit={addRound} className="mt-6 flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <Field label={t("newRound")}>{(p) => <input {...p} required maxLength={120} value={roundName} onChange={(e) => setRoundName(e.target.value)} />}</Field>
            <Field label={t("dateOptional")}>{(p) => <input {...p} type="date" value={roundDate} onChange={(e) => setRoundDate(e.target.value)} />}</Field>
            <Button type="submit" variant="secondary" busy={busy === "round"}>{t("addRound")}</Button>
          </form>
        </Card>

        <Card title={t("offersFromThisDrive")}>
          {(detail.data?.offers.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noOffersRecordedYet")}</p>
          ) : (
            <ScrollArea>
              <table className="w-full text-sm">
                <caption className="sr-only">{t("offersFromThisDrive")}</caption>
                <thead>
                  <tr className="border-b border-border [&_th]:text-start">
                    <th scope="col" className={th}>{t("student")}</th>
                    <th scope="col" className={th}>{t("role")}</th>
                    <th scope="col" className={th}>{t("package")}</th>
                    <th scope="col" className={th}>{t("joining")}</th>
                    <th scope="col" className={th}>{t("status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data!.offers.map((o) => (
                    <tr key={o.id} className="border-b border-border last:border-0">
                      <th scope="row" className={`${td} text-start font-normal`}>{o.student?.name ?? "—"}</th>
                      <td className={td}>{o.roleTitle}</td>
                      <td className={td}>{inrFull(o.ctcAnnual)}</td>
                      <td className={td}>{formatDate(o.joiningDate)}</td>
                      <td className={td}>
                        <label className="sr-only" htmlFor={`ost-${o.id}`}>{t("statusOfNameSOffer", { name: o.student?.name })}</label>
                        <select id={`ost-${o.id}`} className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={o.status} disabled={busy === o.id} onChange={(e) => void setOfferStatus(o, e.target.value)}>
                          {Object.keys(OFFER_STATUS_LABELS).map((s) => <option key={s} value={s}>{label(OFFER_STATUS_LABELS, s)}</option>)}
                        </select>
                        <span className="ms-2"><Badge tone={OFFER_TONE[o.status] ?? "neutral"}>{o.placementId ? t("inOutcomes") : o.outcomePending ? t("waitingForSignIn") : label(OFFER_STATUS_LABELS, o.status)}</Badge></span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
          <form onSubmit={addOffer} className="mt-6 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("student")}>
              {(p) => (
                <select {...p} required value={offer.membershipId} onChange={(e) => setOffer({ ...offer, membershipId: e.target.value })}>
                  <option value="">{t("choose")}</option>
                  {allGrid.map(({ student }) => <option key={student.membershipId} value={student.membershipId}>{student.name}</option>)}
                </select>
              )}
            </Field>
            <Field label={t("role")}>
              {(p) =>
                roles.length > 0 ? (
                  <select {...p} value={offer.roleTitle} onChange={(e) => setOffer({ ...offer, roleTitle: e.target.value })}>
                    {roles.length > 1 && <option value="">{t("choose")}</option>}
                    {roles.map((r) => <option key={r.title} value={r.title}>{r.title}</option>)}
                  </select>
                ) : (
                  <input {...p} required maxLength={200} value={offer.roleTitle} onChange={(e) => setOffer({ ...offer, roleTitle: e.target.value })} />
                )
              }
            </Field>
            <Field label={t("packageCTCPerYear")} hint={t("leaveBlankToUseThe")}>
              {(p) => <input {...p} value={offer.ctcText} onChange={(e) => setOffer({ ...offer, ctcText: e.target.value })} />}
            </Field>
            <Field label={t("joiningDate")}>{(p) => <input {...p} type="date" value={offer.joiningDate} onChange={(e) => setOffer({ ...offer, joiningDate: e.target.value })} />}</Field>
            <Field label={t("status")}>
              {(p) => (
                <select {...p} value={offer.status} onChange={(e) => setOffer({ ...offer, status: e.target.value })}>
                  {Object.keys(OFFER_STATUS_LABELS).map((s) => <option key={s} value={s}>{label(OFFER_STATUS_LABELS, s)}</option>)}
                </select>
              )}
            </Field>
            <div className="flex items-end">
              <Button type="submit" busy={busy === "offer"}>{t("recordOffer")}</Button>
            </div>
          </form>
        </Card>

        <Card title={t("importResultsAndOffers")}>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("uploadTheDrivesResultSheet")}
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t("file")}>{(p) => <input {...p} type="file" accept=".csv,.xlsx,.txt,.tsv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setImp(null); }} />}</Field>
            <Button variant="secondary" busy={busy === "dry"} onClick={() => void importResults(false)}>{t("checkFile")}</Button>
            <Button busy={busy === "commit"} disabled={!imp || imp.committed} onClick={() => void importResults(true)}>{t("import")}</Button>
          </div>
          {imp && (
            <div role="status" className="mt-3 text-sm">
              <p>
                {imp.committed ? t("imported") : t("checked")}{" "}{t("rowsRowsValueOffersOffer", { rows: imp.rows, value: Object.entries(imp.rounds).map(([k, v]) => t("roundResults", { count: v, round: k })).join(", ") || t("noRoundResults"), offers: imp.offers, issueCount: imp.issueCount })}
              </p>
              {imp.issues.length > 0 && (
                <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
                  {imp.issues.slice(0, 20).map((i) => <li key={`${i.line}-${i.message}`}>{t("lineLineMessage", { line: i.line, message: i.message })}</li>)}
                </ul>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

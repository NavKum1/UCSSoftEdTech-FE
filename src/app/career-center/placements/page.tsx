"use client";

/**
 * G14a placement office (India campus edition): the school's own records of campus drives, offers and packages,
 * students' academic data for eligibility lists, higher studies / exams / ventures, and intake figures for reports.
 * No employer posting, no student applications and no job board: drives are records the placement office keeps.
 */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, ScrollArea, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import {
  AcademicRecord,
  OFFER_TONE,
  Offer,
  StudentRef,
  Vocabulary,
  inrFull,
  inrShort,
  label,
  numOrNull,
  splitList,
  usePlacementModeLabels,
  useDriveStatusLabels,
  useOfferStatusLabels,
  useProgressionKindLabels,
  useProgressionLevelLabels,
  useExamLabels,
} from "@/components/career/placements/shared";
import { useRunner } from "@/components/career/placements/useRunner";

interface Overview {
  drives: {
    id: string;
    companyName: string;
    driveDate?: string | null;
    mode: string;
    status: string;
    roles: { title: string; ctcAnnual?: number | null }[];
    batches: number[];
    rounds: number;
    offers: number;
    accepted: number;
  }[];
  totals: { drives: number; academicRecords: number; offers: number; studentsWithAcceptedOffer: number; highestCtc?: number | null };
  batches: number[];
  degrees: string[];
  branches: string[];
  vocabulary: Vocabulary;
  boundary: string;
}

interface RecordList {
  items: { student: StudentRef; record: AcademicRecord }[];
  studentsWithoutRecord: StudentRef[];
}

interface Progression {
  id: string;
  student?: StudentRef | null;
  kind: string;
  year: number;
  institutionJoined?: string | null;
  programmeAdmitted?: string | null;
  progressionLevel?: string | null;
  exam?: string | null;
  examOther?: string | null;
  registrationNumber?: string | null;
  qualified: boolean;
  ventureName?: string | null;
  outcomePending?: boolean;
}

interface Intake {
  id: string;
  degree: string;
  branch: string;
  level: string;
  durationYears: number;
  admissionYear: number;
  sanctionedIntake?: number | null;
  admittedFirstYear?: number | null;
  lateralEntry?: number | null;
}

interface ImportResult {
  committed: boolean;
  rows: number;
  ready: number;
  created: number;
  updated: number;
  issueCount: number;
  issues: { line: number; message: string }[];
}

type Tab = "drives" | "offers" | "records" | "progression" | "intake";
// Labels: messages careerCenterPlacements.tab.<key>
const TABS: Tab[] = ["drives", "offers", "records", "progression", "intake"];

const emptyDrive = {
  companyName: "",
  companyContact: "",
  driveDate: "",
  mode: "OnCampus",
  status: "Planned",
  roleTitle: "",
  roleType: "FullTime",
  roleCtc: "",
  batches: "",
  degrees: "",
  branches: "",
  minCgpa: "",
  maxActiveBacklogs: "",
  maxTotalBacklogs: "",
  minClass10Percent: "",
  minClass12Percent: "",
  criteriaNotes: "",
  excludePlaced: false,
};

const emptyOffer = { membershipId: "", companyName: "", roleTitle: "", employmentType: "FullTime", ctcText: "", offerDate: "", joiningDate: "", status: "Offered" };
const emptyProgression = { membershipId: "", kind: "HigherStudies", year: String(new Date().getFullYear()), institutionJoined: "", programmeAdmitted: "", progressionLevel: "UGtoPG", exam: "GATE", examOther: "", registrationNumber: "", qualified: true, ventureName: "" };
const emptyIntake = { degree: "", branch: "", level: "UG", durationYears: "4", admissionYear: "", sanctionedIntake: "", admittedFirstYear: "", lateralEntry: "" };

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";

export default function PlacementOfficePage() {
  const tr = useCareerT("careerCenterPlacements");
  const EXAM_LABELS = useExamLabels();
  const PROGRESSION_LEVEL_LABELS = useProgressionLevelLabels();
  const KIND_LABELS = useProgressionKindLabels();
  const OFFER_STATUS_LABELS = useOfferStatusLabels();
  const DRIVE_STATUS_LABELS = useDriveStatusLabels();
  const MODE_LABELS = usePlacementModeLabels();
  const { schoolId } = useCareerShell();
  const { api, busy, err, msg, setMsg, run } = useRunner();
  const [tab, setTab] = useState<Tab>("drives");

  const overview = useLoad(() => api<Overview>("/api/career/placement-office"), [api, schoolId]);
  const vocab = overview.data?.vocabulary;
  const records = useLoad(() => (tab !== "drives" ? api<RecordList>("/api/career/placement-office/academic-records") : Promise.resolve(null)), [api, schoolId, tab]);
  const studentOptions = useMemo(() => {
    const list: StudentRef[] = [...(records.data?.items.map((i) => i.student) ?? []), ...(records.data?.studentsWithoutRecord ?? [])];
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [records.data]);

  // Drives
  const [drive, setDrive] = useState(emptyDrive);
  const createDrive = (e: React.FormEvent) => {
    e.preventDefault();
    void run("drive", async () => {
      const batches = splitList(drive.batches).map(Number).filter((n) => Number.isInteger(n));
      await api("/api/career/placement-office/drives", {
        method: "POST",
        json: {
          companyName: drive.companyName,
          companyContact: drive.companyContact || null,
          driveDate: drive.driveDate || null,
          mode: drive.mode,
          status: drive.status,
          roles: drive.roleTitle ? [{ title: drive.roleTitle, employmentType: drive.roleType, ctcAnnual: numOrNull(drive.roleCtc) }] : [],
          batches,
          degrees: splitList(drive.degrees),
          branches: splitList(drive.branches),
          minCgpa: numOrNull(drive.minCgpa),
          maxActiveBacklogs: numOrNull(drive.maxActiveBacklogs),
          maxTotalBacklogs: numOrNull(drive.maxTotalBacklogs),
          minClass10Percent: numOrNull(drive.minClass10Percent),
          minClass12Percent: numOrNull(drive.minClass12Percent),
          criteriaNotes: drive.criteriaNotes || null,
          excludePlaced: drive.excludePlaced,
        },
      });
      setMsg(tr("driveForCompanyNameRecordedOpen", { companyName: drive.companyName }));
      setDrive(emptyDrive);
      overview.reload();
    });
  };

  // Offers
  const [offerStatus, setOfferStatus] = useState("");
  const offers = useLoad(
    () => (tab === "offers" ? api<{ items: Offer[] }>(`/api/career/placement-office/offers?status=${offerStatus}`) : Promise.resolve(null)),
    [api, schoolId, tab, offerStatus],
  );
  const [offer, setOffer] = useState(emptyOffer);
  const addOffer = (e: React.FormEvent) => {
    e.preventDefault();
    void run("offer", async () => {
      if (!offer.membershipId) throw new Error(tr("chooseTheStudent"));
      await api("/api/career/placement-office/offers", {
        method: "POST",
        json: { ...offer, ctcText: offer.ctcText || null, offerDate: offer.offerDate || null, joiningDate: offer.joiningDate || null },
      });
      setMsg(tr("offerRecorded"));
      setOffer(emptyOffer);
      offers.reload();
      overview.reload();
    });
  };
  const setStatus = (o: Offer, status: string) =>
    run(o.id, async () => {
      await api(`/api/career/placement-office/offers/${o.id}`, { method: "PUT", json: { status } });
      setMsg(tr("nameSOfferFromCompanyName", { name: o.student?.name ?? tr("theStudent"), companyName: o.companyName, value: label(OFFER_STATUS_LABELS, status).toLowerCase() }));
      offers.reload();
      overview.reload();
    });

  // Academic records import
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importRecords = (commit: boolean) =>
    run(commit ? "commit" : "dry", async () => {
      if (!file) throw new Error(tr("chooseACSVOrExcel"));
      const fd = new FormData();
      fd.append("file", file);
      fd.append("commit", String(commit));
      const r = await api<ImportResult>("/api/career/placement-office/academic-records/import", { method: "POST", body: fd });
      setImportResult(r);
      if (commit) {
        setMsg(tr("createdRecordsAddedAndUpdated", { created: r.created, updated: r.updated }));
        records.reload();
        overview.reload();
      }
    });

  // Progression
  const [prog, setProg] = useState(emptyProgression);
  const [progKind, setProgKind] = useState("");
  const progression = useLoad(
    () => (tab === "progression" ? api<{ items: Progression[] }>(`/api/career/placement-office/progression?kind=${progKind}`) : Promise.resolve(null)),
    [api, schoolId, tab, progKind],
  );
  const addProgression = (e: React.FormEvent) => {
    e.preventDefault();
    void run("prog", async () => {
      if (!prog.membershipId) throw new Error(tr("chooseTheStudent"));
      await api("/api/career/placement-office/progression", { method: "POST", json: { ...prog, year: Number(prog.year) } });
      setMsg(tr("kindRecorded", { kind: label(KIND_LABELS, prog.kind) }));
      setProg({ ...emptyProgression, kind: prog.kind });
      progression.reload();
    });
  };
  const removeProgression = (p: Progression) => {
    if (!window.confirm(tr("deleteThisValueRecordFor", { value: label(KIND_LABELS, p.kind).toLowerCase(), name: p.student?.name ?? tr("thisStudent") }))) return;
    void run(p.id, async () => {
      await api(`/api/career/placement-office/progression/${p.id}`, { method: "DELETE" });
      setMsg(tr("recordDeleted"));
      progression.reload();
    });
  };

  // Intake
  const intakes = useLoad(() => (tab === "intake" ? api<Intake[]>("/api/career/placement-office/intakes") : Promise.resolve(null)), [api, schoolId, tab]);
  const [intake, setIntake] = useState(emptyIntake);
  const saveIntake = (e: React.FormEvent) => {
    e.preventDefault();
    void run("intake", async () => {
      await api("/api/career/placement-office/intakes", {
        method: "PUT",
        json: {
          degree: intake.degree,
          branch: intake.branch,
          level: intake.level,
          durationYears: numOrNull(intake.durationYears),
          admissionYear: numOrNull(intake.admissionYear) ?? 0,
          sanctionedIntake: numOrNull(intake.sanctionedIntake),
          admittedFirstYear: numOrNull(intake.admittedFirstYear),
          lateralEntry: numOrNull(intake.lateralEntry),
        },
      });
      setMsg(tr("intakeFiguresSaved"));
      setIntake(emptyIntake);
      intakes.reload();
    });
  };

  const studentSelect = (value: string, onChange: (v: string) => void) => (
    <Field label={tr("student")}>
      {(p) => (
        <select {...p} required value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{tr("choose")}</option>
          {studentOptions.map((s) => (
            <option key={s.membershipId} value={s.membershipId}>
              {s.name} ({s.email})
            </option>
          ))}
        </select>
      )}
    </Field>
  );

  const t = overview.data?.totals;

  return (
    <div>
      <PageHeader
        title={tr("placementOffice")}
        description={tr("yourRecordsOfCampusDrives")}
        actions={
          <Link href="/career-center/reports/india" className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
            {tr("nIRFNAACAndNBAReports")}
          </Link>
        }
      />
      {overview.loading && !overview.data ? <Loading /> : <ErrorBanner error={overview.error} onRetry={overview.reload} />}
      {t && (
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            [tr("statDrives"), String(t.drives)],
            [tr("statAcademicRecords"), String(t.academicRecords)],
            [tr("statOffers"), String(t.offers)],
            [tr("statStudentsWithAcceptedOffer"), String(t.studentsWithAcceptedOffer)],
            [tr("statHighestAcceptedPackage"), inrShort(t.highestCtc)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border bg-card p-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="mt-1 text-lg font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div role="tablist" aria-label={tr("placementOffice")} className="mb-4 flex flex-wrap gap-1 border-b border-border">
        {TABS.map((key) => [key, tr(`tab.${key}`)] as const).map(([key, text]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls="placements-panel"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? "font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            style={tab === key ? { borderColor: "var(--brand, #4f46e5)" } : undefined}
          >
            {text}
          </button>
        ))}
      </div>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <div id="placements-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-6">
        {tab === "drives" && (
          <>
            <Card title={tr("drives")}>
              {!overview.data ? null : overview.data.drives.length === 0 ? (
                <EmptyState title={tr("noDrivesRecordedYet")}>{tr("recordADriveBelowWith")}</EmptyState>
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{tr("campusDrives")}</caption>
                    <thead>
                      <tr className="border-b border-border [&_th]:text-start">
                        <th scope="col" className={th}>{tr("company")}</th>
                        <th scope="col" className={th}>{tr("date")}</th>
                        <th scope="col" className={th}>{tr("status")}</th>
                        <th scope="col" className={th}>{tr("rolesAndPackages")}</th>
                        <th scope="col" className={th}>{tr("batches")}</th>
                        <th scope="col" className={th}>{tr("rounds")}</th>
                        <th scope="col" className={th}>{tr("offersAccepted")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overview.data.drives.map((d) => (
                        <tr key={d.id} className="border-b border-border last:border-0">
                          <th scope="row" className={`${td} text-start font-normal`}>
                            <Link href={`/career-center/placements/${d.id}`} className="font-medium underline">
                              {d.companyName}
                            </Link>
                            <div className="text-xs text-muted-foreground">{label(MODE_LABELS, d.mode)}</div>
                          </th>
                          <td className={td}>{formatDate(d.driveDate)}</td>
                          <td className={td}>
                            <Badge tone={d.status === "Completed" ? "good" : d.status === "Cancelled" ? "bad" : "info"}>{label(DRIVE_STATUS_LABELS, d.status)}</Badge>
                          </td>
                          <td className={td}>{d.roles.length === 0 ? "—" : d.roles.map((r) => `${r.title}${r.ctcAnnual ? ` · ${inrShort(r.ctcAnnual)}` : ""}`).join("; ")}</td>
                          <td className={td}>{d.batches.join(", ") || tr("any")}</td>
                          <td className={td}>{d.rounds}</td>
                          <td className={td}>
                            {d.offers} ({d.accepted})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </Card>
            <Card title={tr("recordADrive")}>
              <form onSubmit={createDrive} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={tr("company")}>{(p) => <input {...p} required maxLength={200} value={drive.companyName} onChange={(e) => setDrive({ ...drive, companyName: e.target.value })} />}</Field>
                  <Field label={tr("companyContactOptional")} hint={tr("nameEmailOrPhoneOf")}>
                    {(p) => <input {...p} maxLength={300} value={drive.companyContact} onChange={(e) => setDrive({ ...drive, companyContact: e.target.value })} />}
                  </Field>
                  <Field label={tr("driveDate")}>{(p) => <input {...p} type="date" value={drive.driveDate} onChange={(e) => setDrive({ ...drive, driveDate: e.target.value })} />}</Field>
                  <Field label={tr("mode")}>
                    {(p) => (
                      <select {...p} value={drive.mode} onChange={(e) => setDrive({ ...drive, mode: e.target.value })}>
                        {(vocab?.modes ?? Object.keys(MODE_LABELS)).map((m) => <option key={m} value={m}>{label(MODE_LABELS, m)}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label={tr("status")}>
                    {(p) => (
                      <select {...p} value={drive.status} onChange={(e) => setDrive({ ...drive, status: e.target.value })}>
                        {(vocab?.driveStatuses ?? Object.keys(DRIVE_STATUS_LABELS)).map((m) => <option key={m} value={m}>{label(DRIVE_STATUS_LABELS, m)}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label={tr("roleOfferedOptional")}>{(p) => <input {...p} maxLength={200} value={drive.roleTitle} onChange={(e) => setDrive({ ...drive, roleTitle: e.target.value })} />}</Field>
                  <Field label={tr("roleType")}>
                    {(p) => (
                      <select {...p} value={drive.roleType} onChange={(e) => setDrive({ ...drive, roleType: e.target.value })}>
                        {(vocab?.employmentTypes ?? ["FullTime", "Internship"]).map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    )}
                  </Field>
                  <Field label={tr("packageCTCRupeesPerYear")} hint={drive.roleCtc && numOrNull(drive.roleCtc) ? inrFull(numOrNull(drive.roleCtc)) : tr("forExample1200000For12")}>
                    {(p) => <input {...p} inputMode="numeric" value={drive.roleCtc} onChange={(e) => setDrive({ ...drive, roleCtc: e.target.value })} />}
                  </Field>
                </div>
                <fieldset className="rounded-lg border border-border p-4">
                  <legend className="px-1 text-sm font-semibold">{tr("eligibilityCriteriaAsTheCompany")}</legend>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label={tr("batchesGraduatingYears")} hint={tr("commaSeparatedEG2025")}>{(p) => <input {...p} value={drive.batches} onChange={(e) => setDrive({ ...drive, batches: e.target.value })} />}</Field>
                    <Field label={tr("degrees")} hint={tr("commaSeparatedOnRecordDegrees", { degrees: overview.data?.degrees.join(", ") || tr("noneYet") })}>{(p) => <input {...p} value={drive.degrees} onChange={(e) => setDrive({ ...drive, degrees: e.target.value })} />}</Field>
                    <Field label={tr("branches")} hint={tr("commaSeparatedBlankMeansAny")}>{(p) => <textarea {...p} rows={2} value={drive.branches} onChange={(e) => setDrive({ ...drive, branches: e.target.value })} />}</Field>
                    <Field label={tr("minimumCGPAOutOf10")}>{(p) => <input {...p} inputMode="decimal" value={drive.minCgpa} onChange={(e) => setDrive({ ...drive, minCgpa: e.target.value })} />}</Field>
                    <Field label={tr("mostActiveBacklogsAllowed")}>{(p) => <input {...p} inputMode="numeric" value={drive.maxActiveBacklogs} onChange={(e) => setDrive({ ...drive, maxActiveBacklogs: e.target.value })} />}</Field>
                    <Field label={tr("mostBacklogsEverAllowed")}>{(p) => <input {...p} inputMode="numeric" value={drive.maxTotalBacklogs} onChange={(e) => setDrive({ ...drive, maxTotalBacklogs: e.target.value })} />}</Field>
                    <Field label={tr("minimumClass10")}>{(p) => <input {...p} inputMode="decimal" value={drive.minClass10Percent} onChange={(e) => setDrive({ ...drive, minClass10Percent: e.target.value })} />}</Field>
                    <Field label={tr("minimumClass12Diploma")}>{(p) => <input {...p} inputMode="decimal" value={drive.minClass12Percent} onChange={(e) => setDrive({ ...drive, minClass12Percent: e.target.value })} />}</Field>
                    <Field label={tr("otherPublishedConditionsNotes")}>{(p) => <textarea {...p} rows={2} maxLength={2000} value={drive.criteriaNotes} onChange={(e) => setDrive({ ...drive, criteriaNotes: e.target.value })} />}</Field>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={drive.excludePlaced} onChange={(e) => setDrive({ ...drive, excludePlaced: e.target.checked })} />
                    {tr("schoolPolicyLeaveOutStudents")}
                  </label>
                </fieldset>
                <Button type="submit" busy={busy === "drive"}>{tr("recordDrive")}</Button>
              </form>
            </Card>
          </>
        )}

        {tab === "offers" && (
          <>
            <Card
              title={tr("offers")}
              actions={
                <Field label={tr("status")}>
                  {(p) => (
                    <select {...p} value={offerStatus} onChange={(e) => setOfferStatus(e.target.value)}>
                      <option value="">{tr("all")}</option>
                      {Object.keys(OFFER_STATUS_LABELS).map((s) => <option key={s} value={s}>{label(OFFER_STATUS_LABELS, s)}</option>)}
                    </select>
                  )}
                </Field>
              }
            >
              {offers.loading && !offers.data ? (
                <Loading />
              ) : (offers.data?.items.length ?? 0) === 0 ? (
                <EmptyState title={tr("noOffersRecorded")}>{tr("offersFromDrivesAreAdded")}</EmptyState>
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{tr("offers")}</caption>
                    <thead>
                      <tr className="border-b border-border [&_th]:text-start">
                        <th scope="col" className={th}>{tr("student")}</th>
                        <th scope="col" className={th}>{tr("companyAndRole")}</th>
                        <th scope="col" className={th}>{tr("package")}</th>
                        <th scope="col" className={th}>{tr("offerJoining")}</th>
                        <th scope="col" className={th}>{tr("status")}</th>
                        <th scope="col" className={th}>{tr("outcomeRecord")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {offers.data!.items.map((o) => (
                        <tr key={o.id} className="border-b border-border last:border-0">
                          <th scope="row" className={`${td} text-start font-normal`}>
                            {o.student?.name ?? "—"}
                            <div className="text-xs text-muted-foreground">{o.student?.email}</div>
                          </th>
                          <td className={td}>
                            {o.companyName}
                            <div className="text-xs text-muted-foreground">{o.roleTitle}{o.driveId ? "" : tr("offCampus")}</div>
                          </td>
                          <td className={td}>{inrFull(o.ctcAnnual)}</td>
                          <td className={td}>
                            {formatDate(o.offerDate)} / {formatDate(o.joiningDate)}
                          </td>
                          <td className={td}>
                            <label className="sr-only" htmlFor={`st-${o.id}`}>{tr("statusOfNameSOffer", { name: o.student?.name, companyName: o.companyName })}</label>
                            <select id={`st-${o.id}`} className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={o.status} disabled={busy === o.id} onChange={(e) => void setStatus(o, e.target.value)}>
                              {Object.keys(OFFER_STATUS_LABELS).map((s) => <option key={s} value={s}>{label(OFFER_STATUS_LABELS, s)}</option>)}
                            </select>
                          </td>
                          <td className={td}>
                            {o.placementId ? <Badge tone="good">{tr("recorded")}</Badge> : o.outcomePending ? <Badge tone="warn">{tr("afterTheStudentSignsIn")}</Badge> : <Badge tone={OFFER_TONE[o.status] ?? "neutral"}>{tr("none")}</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
              <p className="mt-3 text-xs text-muted-foreground">{tr("acceptedOffersBecomePlacementRecords")}</p>
            </Card>
            <Card title={tr("recordAnOffCampusOffer")}>
              <form onSubmit={addOffer} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {studentSelect(offer.membershipId, (v) => setOffer({ ...offer, membershipId: v }))}
                <Field label={tr("company")}>{(p) => <input {...p} required maxLength={200} value={offer.companyName} onChange={(e) => setOffer({ ...offer, companyName: e.target.value })} />}</Field>
                <Field label={tr("role")}>{(p) => <input {...p} required maxLength={200} value={offer.roleTitle} onChange={(e) => setOffer({ ...offer, roleTitle: e.target.value })} />}</Field>
                <Field label={tr("type")}>
                  {(p) => (
                    <select {...p} value={offer.employmentType} onChange={(e) => setOffer({ ...offer, employmentType: e.target.value })}>
                      {(vocab?.employmentTypes ?? ["FullTime"]).map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={tr("packageCTCPerYear")} hint={tr("rupeesOrForExample12")}>{(p) => <input {...p} value={offer.ctcText} onChange={(e) => setOffer({ ...offer, ctcText: e.target.value })} />}</Field>
                <Field label={tr("status")}>
                  {(p) => (
                    <select {...p} value={offer.status} onChange={(e) => setOffer({ ...offer, status: e.target.value })}>
                      {Object.keys(OFFER_STATUS_LABELS).map((s) => <option key={s} value={s}>{label(OFFER_STATUS_LABELS, s)}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={tr("offerDate")}>{(p) => <input {...p} type="date" value={offer.offerDate} onChange={(e) => setOffer({ ...offer, offerDate: e.target.value })} />}</Field>
                <Field label={tr("joiningDate")}>{(p) => <input {...p} type="date" value={offer.joiningDate} onChange={(e) => setOffer({ ...offer, joiningDate: e.target.value })} />}</Field>
                <div className="flex items-end">
                  <Button type="submit" busy={busy === "offer"}>{tr("recordOffer")}</Button>
                </div>
              </form>
            </Card>
          </>
        )}

        {tab === "records" && (
          <>
            <Card title={tr("importAcademicRecords")}>
              <p className="mb-3 text-sm text-muted-foreground">
                {tr("uploadTheExamCellsExport")}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <Field label={tr("file")}>{(p) => <input {...p} type="file" accept=".csv,.xlsx,.txt,.tsv" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setImportResult(null); }} />}</Field>
                <Button variant="secondary" busy={busy === "dry"} onClick={() => void importRecords(false)}>{tr("checkFile")}</Button>
                <Button busy={busy === "commit"} disabled={!importResult || importResult.committed || importResult.ready === 0} onClick={() => void importRecords(true)}>
                  {tr("import")}{" "}{importResult && !importResult.committed ? importResult.ready : ""}{" "}{tr("records")}
                </Button>
              </div>
              {importResult && (
                <div role="status" className="mt-3 text-sm">
                  <p>
                    {importResult.committed ? tr("imported") : tr("checked")}{tr("rowsRowsReadyReadyIssueCount", { rows: importResult.rows, ready: importResult.ready, issueCount: importResult.issueCount })}
                  </p>
                  {importResult.issues.length > 0 && (
                    <ul className="mt-2 list-disc space-y-1 ps-5 text-muted-foreground">
                      {importResult.issues.slice(0, 20).map((i) => <li key={`${i.line}-${i.message}`}>{tr("lineLineMessage", { line: i.line, message: i.message })}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </Card>
            <Card title={tr("academicRecords")}>
              {records.loading && !records.data ? (
                <Loading />
              ) : (records.data?.items.length ?? 0) === 0 ? (
                <EmptyState title={tr("noAcademicRecordsYet")}>{tr("importThemAboveEligibilityLists")}</EmptyState>
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{tr("academicRecords")}</caption>
                    <thead>
                      <tr className="border-b border-border [&_th]:text-start">
                        <th scope="col" className={th}>{tr("student")}</th>
                        <th scope="col" className={th}>{tr("programme")}</th>
                        <th scope="col" className={th}>{tr("batch")}</th>
                        <th scope="col" className={th}>{tr("cGPA")}</th>
                        <th scope="col" className={th}>{tr("backlogsActiveEver")}</th>
                        <th scope="col" className={th}>{tr("n10th12thDiploma")}</th>
                        <th scope="col" className={th}>{tr("notes")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.data!.items.map(({ student, record }) => (
                        <tr key={record.id} className="border-b border-border last:border-0">
                          <th scope="row" className={`${td} text-start font-normal`}>
                            {student.name}
                            <div className="text-xs text-muted-foreground">{record.rollNumber ?? student.email}</div>
                          </th>
                          <td className={td}>{record.programme}</td>
                          <td className={td}>{record.batch}</td>
                          <td className={td}>{record.cgpa ?? "—"}</td>
                          <td className={td}>
                            {record.activeBacklogs ?? "—"} / {record.totalBacklogs ?? "—"}
                          </td>
                          <td className={td}>
                            {record.class10Percent ?? "—"} / {record.class12Percent ?? "—"} / {record.diplomaPercent ?? "—"}
                          </td>
                          <td className={td}>
                            {[record.lateralEntry ? tr("lateralEntry") : null, record.optedOut ? tr("optedOut") : null, record.graduatedOnTime === false ? tr("notGraduatedOnTime") : null].filter(Boolean).join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
              {(records.data?.studentsWithoutRecord.length ?? 0) > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">{tr("countCurrentStudentSHave", { count: records.data!.studentsWithoutRecord.length })}</p>
              )}
            </Card>
          </>
        )}

        {tab === "progression" && (
          <>
            <Card
              title={tr("higherStudiesQualifyingExamsAnd")}
              actions={
                <Field label={tr("show")}>
                  {(p) => (
                    <select {...p} value={progKind} onChange={(e) => setProgKind(e.target.value)}>
                      <option value="">{tr("all")}</option>
                      {Object.keys(KIND_LABELS).map((k) => <option key={k} value={k}>{label(KIND_LABELS, k)}</option>)}
                    </select>
                  )}
                </Field>
              }
            >
              {progression.loading && !progression.data ? (
                <Loading />
              ) : (progression.data?.items.length ?? 0) === 0 ? (
                <EmptyState title={tr("nothingRecordedYet")} />
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{tr("progressionRecords")}</caption>
                    <thead>
                      <tr className="border-b border-border [&_th]:text-start">
                        <th scope="col" className={th}>{tr("student")}</th>
                        <th scope="col" className={th}>{tr("kind")}</th>
                        <th scope="col" className={th}>{tr("year")}</th>
                        <th scope="col" className={th}>{tr("details")}</th>
                        <th scope="col" className={th}><span className="sr-only">{tr("actions")}</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {progression.data!.items.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <th scope="row" className={`${td} text-start font-normal`}>{p.student?.name ?? "—"}</th>
                          <td className={td}>{label(KIND_LABELS, p.kind)}</td>
                          <td className={td}>{p.year}</td>
                          <td className={td}>
                            {p.kind === "HigherStudies" && `${p.programmeAdmitted}, ${p.institutionJoined} (${label(PROGRESSION_LEVEL_LABELS, p.progressionLevel)})`}
                            {p.kind === "QualifyingExam" && `${p.exam === "Other" ? p.examOther : label(EXAM_LABELS, p.exam)} ·${p.qualified ? tr("qualified") : tr("appeared")}${p.registrationNumber ? ` · ${p.registrationNumber}` : ""}`}
                            {p.kind === "Entrepreneurship" && p.ventureName}
                          </td>
                          <td className={td}>
                            <Button variant="ghost" busy={busy === p.id} onClick={() => removeProgression(p)} aria-label={tr("deleteKindRecordForName", { kind: label(KIND_LABELS, p.kind), name: p.student?.name ?? tr("student2") })}>
                              {tr("delete")}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </Card>
            <Card title={tr("addARecord")}>
              <form onSubmit={addProgression} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {studentSelect(prog.membershipId, (v) => setProg({ ...prog, membershipId: v }))}
                <Field label={tr("kind")}>
                  {(p) => (
                    <select {...p} value={prog.kind} onChange={(e) => setProg({ ...prog, kind: e.target.value })}>
                      {Object.keys(KIND_LABELS).map((k) => <option key={k} value={k}>{label(KIND_LABELS, k)}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={tr("year")} hint={tr("graduatingYearForHigherStudies")}>
                  {(p) => <input {...p} required inputMode="numeric" value={prog.year} onChange={(e) => setProg({ ...prog, year: e.target.value })} />}
                </Field>
                {prog.kind === "HigherStudies" && (
                  <>
                    <Field label={tr("institutionJoined")}>{(p) => <input {...p} required maxLength={200} value={prog.institutionJoined} onChange={(e) => setProg({ ...prog, institutionJoined: e.target.value })} />}</Field>
                    <Field label={tr("programmeAdmittedTo")}>{(p) => <input {...p} required maxLength={200} value={prog.programmeAdmitted} onChange={(e) => setProg({ ...prog, programmeAdmitted: e.target.value })} />}</Field>
                    <Field label={tr("progression")}>
                      {(p) => (
                        <select {...p} value={prog.progressionLevel} onChange={(e) => setProg({ ...prog, progressionLevel: e.target.value })}>
                          {Object.keys(PROGRESSION_LEVEL_LABELS).map((k) => <option key={k} value={k}>{label(PROGRESSION_LEVEL_LABELS, k)}</option>)}
                        </select>
                      )}
                    </Field>
                  </>
                )}
                {prog.kind === "QualifyingExam" && (
                  <>
                    <Field label={tr("examination")}>
                      {(p) => (
                        <select {...p} value={prog.exam} onChange={(e) => setProg({ ...prog, exam: e.target.value })}>
                          {(vocab?.exams ?? ["GATE"]).map((k) => <option key={k} value={k}>{EXAM_LABELS[k] ?? k}</option>)}
                        </select>
                      )}
                    </Field>
                    {prog.exam === "Other" && <Field label={tr("nameOfTheExamination")}>{(p) => <input {...p} required maxLength={120} value={prog.examOther} onChange={(e) => setProg({ ...prog, examOther: e.target.value })} />}</Field>}
                    <Field label={tr("registrationRollNumber")}>{(p) => <input {...p} maxLength={64} value={prog.registrationNumber} onChange={(e) => setProg({ ...prog, registrationNumber: e.target.value })} />}</Field>
                    <label className="flex items-center gap-2 self-end text-sm">
                      <input type="checkbox" checked={prog.qualified} onChange={(e) => setProg({ ...prog, qualified: e.target.checked })} />
                      {tr("qualifiedUntickIfTheStudent")}
                    </label>
                  </>
                )}
                {prog.kind === "Entrepreneurship" && (
                  <Field label={tr("ventureName")}>{(p) => <input {...p} required maxLength={200} value={prog.ventureName} onChange={(e) => setProg({ ...prog, ventureName: e.target.value })} />}</Field>
                )}
                <div className="flex items-end">
                  <Button type="submit" busy={busy === "prog"}>{tr("addRecord")}</Button>
                </div>
              </form>
            </Card>
          </>
        )}

        {tab === "intake" && (
          <>
            <Card title={tr("intakeFigures")}>
              <p className="mb-3 text-sm text-muted-foreground">
                {tr("sanctionedIntakeAndAdmissionsPer")}
              </p>
              {intakes.loading && !intakes.data ? (
                <Loading />
              ) : (intakes.data?.length ?? 0) === 0 ? (
                <EmptyState title={tr("noIntakeFiguresYet")} />
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{tr("intakeFigures")}</caption>
                    <thead>
                      <tr className="border-b border-border [&_th]:text-start">
                        <th scope="col" className={th}>{tr("programme")}</th>
                        <th scope="col" className={th}>{tr("admissionYear")}</th>
                        <th scope="col" className={th}>{tr("sanctionedIntake")}</th>
                        <th scope="col" className={th}>{tr("admittedFirstYear")}</th>
                        <th scope="col" className={th}>{tr("lateralEntry")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intakes.data!.map((i) => (
                        <tr key={i.id} className="border-b border-border last:border-0">
                          <th scope="row" className={`${td} text-start font-normal`}>
                            {i.degree} {i.branch} <span className="text-xs text-muted-foreground">{tr("levelDurationYearsYears", { level: i.level, durationYears: i.durationYears })}</span>
                          </th>
                          <td className={td}>{i.admissionYear}</td>
                          <td className={td}>{i.sanctionedIntake ?? "—"}</td>
                          <td className={td}>{i.admittedFirstYear ?? tr("fromRecords")}</td>
                          <td className={td}>{i.lateralEntry ?? tr("fromRecords")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </Card>
            <Card title={tr("saveIntakeFigures")}>
              <form onSubmit={saveIntake} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={tr("degree")}>{(p) => <input {...p} required maxLength={80} value={intake.degree} onChange={(e) => setIntake({ ...intake, degree: e.target.value })} />}</Field>
                <Field label={tr("branch")}>{(p) => <input {...p} maxLength={120} value={intake.branch} onChange={(e) => setIntake({ ...intake, branch: e.target.value })} />}</Field>
                <Field label={tr("level")}>
                  {(p) => (
                    <select {...p} value={intake.level} onChange={(e) => setIntake({ ...intake, level: e.target.value })}>
                      {(vocab?.levels ?? ["UG", "PG"]).map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  )}
                </Field>
                <Field label={tr("durationYears")}>{(p) => <input {...p} inputMode="numeric" value={intake.durationYears} onChange={(e) => setIntake({ ...intake, durationYears: e.target.value })} />}</Field>
                <Field label={tr("admissionYear")}>{(p) => <input {...p} required inputMode="numeric" value={intake.admissionYear} onChange={(e) => setIntake({ ...intake, admissionYear: e.target.value })} />}</Field>
                <Field label={tr("sanctionedIntake")}>{(p) => <input {...p} inputMode="numeric" value={intake.sanctionedIntake} onChange={(e) => setIntake({ ...intake, sanctionedIntake: e.target.value })} />}</Field>
                <Field label={tr("admittedInFirstYearOptional")}>{(p) => <input {...p} inputMode="numeric" value={intake.admittedFirstYear} onChange={(e) => setIntake({ ...intake, admittedFirstYear: e.target.value })} />}</Field>
                <Field label={tr("lateralEntryInclLeftoverSeats")}>{(p) => <input {...p} inputMode="numeric" value={intake.lateralEntry} onChange={(e) => setIntake({ ...intake, lateralEntry: e.target.value })} />}</Field>
                <div className="flex items-end">
                  <Button type="submit" busy={busy === "intake"}>{tr("save")}</Button>
                </div>
              </form>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

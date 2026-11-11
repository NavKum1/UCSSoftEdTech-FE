"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { CheckCircle2, Plus, ShieldCheck, X, XCircle } from "lucide-react";
import { Badge, Button, EmptyState, Loading, Modal, PageHeader, StatTile, buttonClass } from "@/components/career/ui";

interface Campus {
  id: string;
  parentInstituteId: string;
  campusCode: string;
  campusName: string;
  deanEmail: string;
  region: string;
  timezone: string;
  studentCount: number;
  facultyCount: number;
  accreditationTier: string;
  complianceScore: number;
  isActive: boolean;
  createdAt: string;
}

interface AuditBlock {
  id: string;
  campusId: string;
  blockIndex: number;
  actorEmail: string;
  actorRole: string;
  eventType: string;
  eventPayload_JSON: string;
  payloadHash: string;
  previousBlockHash: string;
  blockHash: string;
  notes: string;
  createdAt: string;
}

interface SystemRollup {
  parentInstituteId: string;
  totalCampuses: number;
  totalStudentsEnrolled: number;
  totalFacultyMembers: number;
  averageSystemComplianceScore: number | null;
  totalAuditLedgerBlocks: number;
  totalGradeCertifications: number;
  totalProctoringOverrides: number;
  totalAccreditationClearances: number;
  accreditationReadinessStatus: string;
  campuses: Campus[];
  generatedAt: string;
}

interface VerificationResult {
  isTamperFree: boolean;
  totalBlocksVerified: number;
  status: string;
  latestBlockHash: string;
  verifiedAt: string;
}

export default function MultiCampusGovernancePage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [rollup, setRollup] = useState<SystemRollup | null>(null);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [ledgerBlocks, setLedgerBlocks] = useState<AuditBlock[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isAppending, setIsAppending] = useState<boolean>(false);

  // New Block Form State
  const [showAppendModal, setShowAppendModal] = useState<boolean>(false);
  const [newActorEmail, setNewActorEmail] = useState<string>("");
  const [newActorRole, setNewActorRole] = useState<string>("AcademicDean");
  const [newEventType, setNewEventType] = useState<string>("GradeCertification");
  const [newNotes, setNewNotes] = useState<string>("");

  // Fetch System Roll-up
  const fetchSystemRollup = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/governance/system-rollup`);
      const data = await res.json();
      if (data.success && data.report) {
        setRollup(data.report);
        if (data.report.campuses && data.report.campuses.length > 0 && !selectedCampus) {
          selectCampus(data.report.campuses[0]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch system roll-up:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Select Campus & Fetch its Ledger
  const selectCampus = async (campus: Campus) => {
    setSelectedCampus(campus);
    setVerification(null);
    try {
      const res = await apiFetch(`/api/governance/ledger/${campus.id}`);
      const data = await res.json();
      if (data.success) {
        setLedgerBlocks(data.blocks || []);
      }
    } catch (err) {
      console.error("Failed to fetch campus ledger:", err);
    }
  };

  // Cryptographically Verify Ledger Integrity
  const handleVerifyLedger = async () => {
    if (!selectedCampus) return;
    try {
      setIsVerifying(true);
      const res = await apiFetch(`/api/governance/ledger/${selectedCampus.id}/verify`);
      const data = await res.json();
      if (data.success && data.verification) {
        setVerification(data.verification);
      }
    } catch (err) {
      console.error("Failed to verify ledger:", err);
    } finally {
      setIsVerifying(false);
    }
  };

  // Append new audit block
  const handleAppendBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampus) return;
    try {
      setIsAppending(true);
      const payload = {
        action: newEventType,
        authorizedBy: newActorEmail,
        timestampUtc: new Date().toISOString(),
        auditDetails: newNotes,
      };

      const res = await apiFetch(`/api/governance/ledger/append`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campusId: selectedCampus.id,
          actorEmail: newActorEmail,
          actorRole: newActorRole,
          eventType: newEventType,
          eventPayload: payload,
          notes: newNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAppendModal(false);
        // Refresh campus ledger & system rollup
        await selectCampus(selectedCampus);
        await fetchSystemRollup();
      }
    } catch (err) {
      console.error("Failed to append audit block:", err);
    } finally {
      setIsAppending(false);
    }
  };

  const fetchSystemRollupRef = useLatestRef(fetchSystemRollup);
  useEffect(() => {
    if (!ready) return;
    fetchSystemRollupRef.current();
  }, [ready, fetchSystemRollupRef]);

  if (access) return <AccessNotice problem={access} feature="Multi-campus governance" />;

  const notAssessed = !rollup?.accreditationReadinessStatus || rollup.accreditationReadinessStatus === "NotAssessed";
  const dash = isLoading ? "…" : "—";
  const fieldClass = "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1";

  return (
    <div className="space-y-6 text-foreground">
      <PageHeader
        title={en("Campus governance")}
        description={en("Compliance records for each campus, with a tamper-evident history you can verify.")}
        actions={
          <>
            <Badge tone={rollup?.accreditationReadinessStatus === "AuditReady" ? "good" : notAssessed ? "neutral" : "warn"}>
              {notAssessed ? en("Not assessed") : rollup!.accreditationReadinessStatus === "AuditReady" ? en("Audit ready") : rollup!.accreditationReadinessStatus}
            </Badge>
            <Link href="/partner/dashboard" className={buttonClass("secondary")}>
              {en("Partner portal")}
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={en("Campuses")}
          value={rollup ? rollup.totalCampuses : dash}
          hint={
            rollup?.averageSystemComplianceScore != null
              ? en("{value}% average compliance", { value: rollup.averageSystemComplianceScore })
              : en("Compliance not assessed yet")
          }
        />
        <StatTile
          label={en("Students")}
          value={rollup ? rollup.totalStudentsEnrolled.toLocaleString() : dash}
          hint={rollup ? en("{number} faculty members", { number: rollup.totalFacultyMembers.toLocaleString() }) : undefined}
        />
        <StatTile label={en("Audit records")} value={rollup ? rollup.totalAuditLedgerBlocks : dash} hint={en("Linked by tamper-evident fingerprints")} />
        <StatTile
          label={en("Certifications")}
          value={rollup ? rollup.totalGradeCertifications + rollup.totalAccreditationClearances : dash}
          hint={rollup ? en("{value} proctoring overrides", { value: rollup.totalProctoringOverrides }) : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-3 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{en("Campuses")}</h2>
            {rollup && <Badge>{en("{value} registered", { value: rollup.campuses?.length || 0 })}</Badge>}
          </div>

          {isLoading && !rollup ? (
            <Loading />
          ) : !rollup?.campuses?.length ? (
            <EmptyState title={en("No campuses yet")}>{en("Campuses appear here once they are registered for this institution.")}</EmptyState>
          ) : (
            <div className="space-y-3">
              {rollup.campuses.map((c) => {
                const isSelected = selectedCampus?.id === c.id;
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => selectCampus(c)}
                    aria-pressed={isSelected}
                    className={`block w-full rounded-xl border bg-card p-4 text-start shadow-sm transition-colors ${
                      isSelected ? "border-[var(--brand,#0e7490)] ring-1 ring-[var(--brand,#0e7490)]" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{c.campusName}</span>
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">{c.campusCode}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{en("Dean: {deanEmail}", { deanEmail: c.deanEmail })}</span>
                      <span className="font-medium tabular-nums text-foreground">{c.complianceScore}%</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{en("Students: {number}", { number: c.studentCount.toLocaleString() })}</span>
                      <span>{en("Tier: {accreditationTier}", { accreditationTier: c.accreditationTier })}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="space-y-4 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {selectedCampus ? en("{campus} compliance records", { campus: selectedCampus.campusName }) : en("Campus compliance records")}
              </h2>
              <p className="text-sm text-muted-foreground">{en("Records certified by academic leadership")}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" onClick={handleVerifyLedger} busy={isVerifying} disabled={!selectedCampus}>
                {!isVerifying && <ShieldCheck className="h-4 w-4" aria-hidden />}
                {isVerifying ? en("Verifying...") : en("Verify records")}
              </Button>
              <Button onClick={() => setShowAppendModal(true)} disabled={!selectedCampus}>
                <Plus className="h-4 w-4" aria-hidden />
                {en("Certify new event")}
              </Button>
            </div>
          </div>

          {verification && (
            <div
              role="status"
              className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm ${
                verification.isTamperFree
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              }`}
            >
              <div className="flex items-center gap-2">
                {verification.isTamperFree ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : <XCircle className="h-4 w-4 shrink-0" aria-hidden />}
                <span>
                  <span className="font-medium">{en("Status: {status}", { status: verification.status })}</span>
                  <span className="ms-2 opacity-80">
                    {en("({totalBlocksVerified} records verified)", { totalBlocksVerified: verification.totalBlocksVerified })}
                  </span>
                </span>
              </div>
              <span className="text-xs opacity-80">{en("Verified: {date}", { date: new Date(verification.verifiedAt).toLocaleTimeString() })}</span>
            </div>
          )}

          <div className="max-h-[600px] space-y-3 overflow-y-auto pe-1">
            {ledgerBlocks.length === 0 ? (
              <EmptyState title={en("No records yet")}>{en("No audit records have been certified for this campus.")}</EmptyState>
            ) : (
              ledgerBlocks.map((b) => (
                <div key={b.id} className="space-y-2.5 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-muted px-2 py-0.5 font-mono font-medium text-foreground">#{b.blockIndex}</span>
                      <Badge>{b.eventType}</Badge>
                      <span className="text-muted-foreground">{en("by {actor}", { actor: b.actorEmail })}</span>
                    </div>
                    <span className="text-muted-foreground">{new Date(b.createdAt).toLocaleString()}</span>
                  </div>

                  <p className="text-sm text-muted-foreground">{b.notes}</p>

                  <div className="grid grid-cols-1 gap-2 border-t border-border pt-2 text-xs text-muted-foreground md:grid-cols-2">
                    <div className="truncate">
                      <span>{en("Record fingerprint: ")}</span>
                      <span className="font-mono text-foreground">{b.blockHash}</span>
                    </div>
                    <div className="truncate">
                      <span>{en("Previous fingerprint: ")}</span>
                      <span className="font-mono">{b.previousBlockHash}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {showAppendModal && (
        <Modal labelledBy="certify-event-title" onClose={() => setShowAppendModal(false)}>
          <div className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
              <h3 id="certify-event-title" className="text-base font-semibold text-foreground">
                {en("Certify an event for {campus}", { campus: selectedCampus?.campusName ?? "" })}
              </h3>
              <Button variant="ghost" onClick={() => setShowAppendModal(false)} aria-label={en("Close")} className="px-2">
                <X className="h-4 w-4" aria-hidden />
              </Button>
            </div>

            <form onSubmit={handleAppendBlock} className="space-y-3">
              <div>
                <label htmlFor="gov-actor-email" className="mb-1 block text-sm font-medium">{en("Actor email")}</label>
                <input
                  id="gov-actor-email"
                  type="email"
                  value={newActorEmail}
                  onChange={(e) => setNewActorEmail(e.target.value)}
                  required
                  placeholder={en("e.g. dean@yourschool.edu")}
                  className={fieldClass}
                />
              </div>

              <div>
                <label htmlFor="gov-actor-role" className="mb-1 block text-sm font-medium">{en("Actor role")}</label>
                <select id="gov-actor-role" value={newActorRole} onChange={(e) => setNewActorRole(e.target.value)} className={fieldClass}>
                  <option value="AcademicDean">{en("Academic Dean")}</option>
                  <option value="CampusProvost">{en("Campus Provost")}</option>
                  <option value="ChiefComplianceOfficer">{en("Chief Compliance Officer")}</option>
                  <option value="ExternalAuditor">{en("External Auditor")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="gov-event-type" className="mb-1 block text-sm font-medium">{en("Event type")}</label>
                <select id="gov-event-type" value={newEventType} onChange={(e) => setNewEventType(e.target.value)} className={fieldClass}>
                  <option value="GradeCertification">{en("Grade certification")}</option>
                  <option value="ProctoringAnomalyOverride">{en("Proctoring anomaly override")}</option>
                  <option value="AccreditationClearance">{en("Accreditation clearance")}</option>
                  <option value="FERPA_AuditExport">{en("FERPA audit export")}</option>
                  <option value="CurriculumReviewApproved">{en("Curriculum review approved")}</option>
                </select>
              </div>

              <div>
                <label htmlFor="gov-notes" className="mb-1 block text-sm font-medium">{en("Notes and rationale")}</label>
                <textarea id="gov-notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} required rows={3} className={`${fieldClass} resize-none`} />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowAppendModal(false)}>
                  {en("Cancel")}
                </Button>
                <Button type="submit" busy={isAppending}>
                  {isAppending ? en("Signing record...") : en("Sign and add record")}
                </Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

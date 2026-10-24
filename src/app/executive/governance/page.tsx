"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";

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
  averageSystemComplianceScore: number;
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
  const { apiFetch, ready, access } = useLegacyApi();
  const [parentInstituteId] = useState<string>("8c353f80-0a21-41fb-8b43-2287413d98bf");
  const [rollup, setRollup] = useState<SystemRollup | null>(null);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const [ledgerBlocks, setLedgerBlocks] = useState<AuditBlock[]>([]);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [isAppending, setIsAppending] = useState<boolean>(false);

  // New Block Form State
  const [showAppendModal, setShowAppendModal] = useState<boolean>(false);
  const [newActorEmail, setNewActorEmail] = useState<string>("dean.provost@university.edu");
  const [newActorRole, setNewActorRole] = useState<string>("AcademicDean");
  const [newEventType, setNewEventType] = useState<string>("GradeCertification");
  const [newNotes, setNewNotes] = useState<string>("Fall Term algorithmic engineering grading audit finalized.");

  // Fetch System Roll-up
  const fetchSystemRollup = async () => {
    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/governance/system-rollup/${parentInstituteId}`);
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
  }, [parentInstituteId, ready, fetchSystemRollupRef]);

  if (access) return <AccessNotice problem={access} feature="Multi-campus governance" />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-16 z-20">
        <div className="flex items-center space-x-4">
          <Link
            href="/partner/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-slate-700 text-muted-foreground border border-border transition"
          >
            ← Partner Portal
          </Link>
          <div className="h-4 w-px bg-muted" />
          <div className="flex items-center space-x-2">
            <span className="text-xl">🏛️</span>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                Executive Multi-Campus Governance &amp; Compliance Records
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Institutional Consortium • Verified Compliance Record
              </p>
            </div>
          </div>
        </div>

        {/* Global Accreditation Status Badge */}
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-muted-foreground">System Accreditation Health</div>
            <div className="text-sm font-mono font-bold text-foreground">
              {rollup?.averageSystemComplianceScore != null ? `${rollup.averageSystemComplianceScore}% compliance` : "Not assessed yet"}
            </div>
          </div>
          <span
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-wider ${
              rollup?.accreditationReadinessStatus === "AuditReady"
                ? "bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-500/50"
                : "bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-500/50"
            }`}
          >
            ● {rollup?.accreditationReadinessStatus || "Not assessed"}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-card/60 border border-border/80 shadow-sm">
            <div className="text-muted-foreground text-xs font-medium">Chartered Campuses</div>
            <div className="text-2xl font-black text-foreground mt-1">
              {rollup?.totalCampuses || 0}
            </div>
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1 font-mono">100% Fully Isolated</div>
          </div>

          <div className="p-4 rounded-2xl bg-card/60 border border-border/80 shadow-sm">
            <div className="text-muted-foreground text-xs font-medium">Total Student Body</div>
            <div className="text-2xl font-black text-cyan-700 dark:text-cyan-400 mt-1 font-mono">
              {(rollup?.totalStudentsEnrolled || 0).toLocaleString()}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {(rollup?.totalFacultyMembers || 0).toLocaleString()} Faculty Members
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card/60 border border-border/80 shadow-sm">
            <div className="text-muted-foreground text-xs font-medium">Immutable Audit Blocks</div>
            <div className="text-2xl font-black text-purple-700 dark:text-purple-400 mt-1 font-mono">
              {rollup?.totalAuditLedgerBlocks || 0}
            </div>
            <div className="text-[11px] text-purple-600 dark:text-purple-300 mt-1 font-mono">SHA-256 Hash Chain</div>
          </div>

          <div className="p-4 rounded-2xl bg-card/60 border border-border/80 shadow-sm">
            <div className="text-muted-foreground text-xs font-medium">Compliance Certifications</div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
              {(rollup?.totalGradeCertifications || 0) + (rollup?.totalAccreditationClearances || 0)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {rollup?.totalProctoringOverrides || 0} Proctoring Overrides
            </div>
          </div>
        </div>

        {/* Two-Column Section: Campus Selector & Ledger View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Campus Hierarchy (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Institutional Campuses
              </h2>
              <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                {rollup?.campuses?.length || 0} Registered
              </span>
            </div>

            <div className="space-y-3">
              {rollup?.campuses?.map((c) => {
                const isSelected = selectedCampus?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => selectCampus(c)}
                    className={`p-4 rounded-xl border cursor-pointer transition relative ${
                      isSelected
                        ? "bg-card border-emerald-500 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-500/50"
                        : "bg-card/40 border-border/80 hover:bg-card/70 hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{c.campusName}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted text-emerald-700 dark:text-emerald-400 font-semibold border border-border">
                        {c.campusCode}
                      </span>
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
                      <span>Dean: {c.deanEmail}</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{c.complianceScore}%</span>
                    </div>

                    <div className="mt-2 text-[11px] text-muted-foreground flex items-center justify-between font-mono">
                      <span>Students: {c.studentCount.toLocaleString()}</span>
                      <span>Tier: {c.accreditationTier}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Cryptographic Audit Ledger (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">
                  {selectedCampus ? `${selectedCampus.campusName} Compliance Records` : "Campus Compliance Records"}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Verified compliance records certified by Academic Leadership
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleVerifyLedger}
                  disabled={isVerifying || !selectedCampus}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition flex items-center space-x-1.5"
                >
                  <span>{isVerifying ? "⏳" : "🛡️"}</span>
                  <span>{isVerifying ? "Verifying..." : "Verify Records Integrity"}</span>
                </button>

                <button
                  onClick={() => setShowAppendModal(true)}
                  disabled={!selectedCampus}
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition shadow-md shadow-cyan-600/20 flex items-center space-x-1"
                >
                  <span>+</span>
                  <span>Certify New Event</span>
                </button>
              </div>
            </div>

            {/* Tamper Verification Banner */}
            {verification && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between ${
                  verification.isTamperFree
                    ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-600 dark:text-emerald-300"
                    : "bg-rose-950/40 border-rose-500/50 text-rose-300"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-base">{verification.isTamperFree ? "✅" : "❌"}</span>
                  <div>
                    <span className="font-bold">STATUS: {verification.status}</span>
                    <span className="ml-2 text-muted-foreground">
                      ({verification.totalBlocksVerified} blocks verified across chain)
                    </span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Verified: {new Date(verification.verifiedAt).toLocaleTimeString()}
                </div>
              </div>
            )}

            {/* Block Chain Timeline */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {ledgerBlocks.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-2xl bg-card/30 text-muted-foreground text-xs">
                  No audit blocks recorded for this campus.
                </div>
              ) : (
                ledgerBlocks.map((b) => (
                  <div
                    key={b.id}
                    className="p-4 rounded-xl border border-border bg-card/60 space-y-2.5 relative"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-muted text-cyan-600 dark:text-cyan-300 border border-border">
                          #{b.blockIndex}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-950 text-indigo-600 dark:text-indigo-300 border border-indigo-700/50">
                          {b.eventType}
                        </span>
                        <span className="text-muted-foreground text-xs">by {b.actorEmail}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(b.createdAt).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground">{b.notes}</p>

                    {/* Cryptographic Hashes Bar */}
                    <div className="pt-2 border-t border-border/80 grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-muted-foreground">
                      <div className="truncate">
                        <span className="text-muted-foreground">Block Hash: </span>
                        <span className="text-emerald-700 dark:text-emerald-400">{b.blockHash}</span>
                      </div>
                      <div className="truncate">
                        <span className="text-muted-foreground">Prev Hash: </span>
                        <span className="text-muted-foreground">{b.previousBlockHash}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Append Block Modal */}
      {showAppendModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground">
                Certify Audit Block: {selectedCampus?.campusName}
              </h3>
              <button
                onClick={() => setShowAppendModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAppendBlock} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground mb-1">Actor Email</label>
                <input
                  type="email"
                  value={newActorEmail}
                  onChange={(e) => setNewActorEmail(e.target.value)}
                  required
                  className="w-full bg-background text-foreground p-2.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Actor Role</label>
                <select
                  value={newActorRole}
                  onChange={(e) => setNewActorRole(e.target.value)}
                  className="w-full bg-background text-foreground p-2.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="AcademicDean">Academic Dean</option>
                  <option value="CampusProvost">Campus Provost</option>
                  <option value="ChiefComplianceOfficer">Chief Compliance Officer</option>
                  <option value="ExternalAuditor">External Auditor</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Event Type</label>
                <select
                  value={newEventType}
                  onChange={(e) => setNewEventType(e.target.value)}
                  className="w-full bg-background text-foreground p-2.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="GradeCertification">Grade Certification</option>
                  <option value="ProctoringAnomalyOverride">Proctoring Anomaly Override</option>
                  <option value="AccreditationClearance">Accreditation Clearance</option>
                  <option value="FERPA_AuditExport">FERPA Audit Export</option>
                  <option value="CurriculumReviewApproved">Curriculum Review Approved</option>
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Compliance Notes & Rationale</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  required
                  rows={3}
                  className="w-full bg-background text-foreground p-2.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAppendModal(false)}
                  className="px-4 py-2 rounded-lg bg-muted hover:bg-slate-700 text-muted-foreground font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAppending}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-md shadow-cyan-600/20 disabled:opacity-50"
                >
                  {isAppending ? "Signing Block..." : "Sign & Append Block"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

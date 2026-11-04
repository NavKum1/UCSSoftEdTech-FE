"use client";

/**
 * Session integrity review (phase C, 24 Oct 2026): proctored sessions with the browser and environment events that were
 * logged (tab switches, focus loss, pastes, device changes), their integrity score and the full event log, for a person to
 * review. No one is disqualified automatically; a reviewer records their decision with a note. No gaze or face detection
 * is performed. (This page used to list three invented candidates.)
 */

import React, { useCallback, useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, PageHeader, ScrollArea, Tabs } from "@/components/career/ui";

interface SessionRow {
  sessionId: string;
  userId: string;
  candidateName: string | null;
  totalViolations: number;
  integrityScore: number;
  riskLevel: string;
  isOverriddenByAdmin: boolean;
  needsReview: boolean;
  createdAt: string;
  lastUpdatedAt: string;
}
interface Report {
  sessionId: string;
  totalViolations: number;
  integrityScore: number;
  riskLevel: string;
  auditSummary: string;
  isOverriddenByAdmin: boolean;
  adminOverrideNotes: string | null;
  overriddenByAdminEmail: string | null;
  incidentBreakdown: Record<string, number>;
  chronologicalLedger: { id: string; eventType: string; severity: string; metadata_JSON: string; timestamp: string }[];
}

const card = "rounded-xl border border-border bg-card shadow-sm";
const EVENT_LABEL: Record<string, string> = {
  TabSwitch: "Switched tab",
  WindowBlur: "Left the window",
  FullScreenExit: "Left full screen",
  ClipboardPaste: "Pasted text",
  KeystrokeCadence: "Unusual typing rhythm",
  AudioDisturbance: "Background audio",
  DeviceChange: "Camera or microphone changed",
  Other: "Other event",
};

export default function SessionIntegrityPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [rows, setRows] = useState<SessionRow[] | null>(null);
  type Filter = "all" | "review" | "Flagged" | "Suspicious" | "Clean";
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Report | null>(null);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/proctoring/sessions");
      if (!res.ok) return setFailed(true);
      setRows((await res.json()) as SessionRow[]);
    } catch {
      setFailed(true);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const openReport = async (id: string) => {
    setMessage(null);
    setNotes("");
    const res = await apiFetch(`/api/proctoring/report/${id}`);
    if (res.ok) setOpen((await res.json()) as Report);
  };

  const recordDecision = async () => {
    if (!open || !notes.trim()) return;
    const res = await apiFetch(`/api/proctoring/session/${open.sessionId}/override`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ waiveDisqualification: true, notes: notes.trim() }),
    });
    if (res.ok) {
      setMessage(en("Your review was recorded."));
      await openReport(open.sessionId);
      await load();
    } else setMessage(en("That didn't save. Please try again."));
  };

  if (access) return <AccessNotice problem={access} feature="Session integrity review" />;

  const shown = (rows ?? []).filter((r) => (filter === "all" ? true : filter === "review" ? r.needsReview : r.riskLevel === filter));

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Session integrity review")}
        description={en("Events logged during proctored sessions, for a person to review. Event severity is set by the kind of event, not by the candidate's browser. No one is disqualified automatically, and no gaze or face detection is performed.")}
      />

      <Tabs<Filter>
        label={en("Filter sessions")}
        value={filter}
        onChange={setFilter}
        items={[
          { id: "all", label: en("All") },
          { id: "review", label: en("Needs review") },
          { id: "Flagged", label: en("Flagged") },
          { id: "Suspicious", label: en("Suspicious") },
          { id: "Clean", label: en("Clean") },
        ]}
      />

      {failed ? (
        <p className={`${card} p-6 text-sm text-muted-foreground`}>{en("The sessions couldn't be loaded. Please refresh the page.")}</p>
      ) : !rows ? (
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} aria-busy="true" />
      ) : shown.length === 0 ? (
        <p className={`${card} p-6 text-sm text-muted-foreground`}>{rows.length === 0 ? en("No proctored sessions yet.") : en("No sessions match this filter.")}</p>
      ) : (
        <div className={card}>
          <ScrollArea>
          <table className="w-full text-sm">
            <thead className="border-b border-border text-start text-xs text-muted-foreground">
              <tr>
                <th className="p-3 text-start font-medium">{en("Candidate")}</th>
                <th className="p-3 text-start font-medium">{en("Last activity")}</th>
                <th className="p-3 text-end font-medium">{en("Events")}</th>
                <th className="p-3 text-end font-medium">{en("Integrity score")}</th>
                <th className="p-3 text-start font-medium">{en("Status")}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((r) => (
                <tr key={r.sessionId}>
                  <td className="p-3">{r.candidateName ?? <span className="font-mono text-xs text-muted-foreground">{r.userId.slice(0, 8)}</span>}</td>
                  <td className="p-3 text-muted-foreground">{new Date(r.lastUpdatedAt).toLocaleString()}</td>
                  <td className="p-3 text-end tabular-nums">{r.totalViolations}</td>
                  <td className="p-3 text-end tabular-nums">{r.integrityScore}</td>
                  <td className="p-3">
                    {r.isOverriddenByAdmin ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                        <ShieldCheck aria-hidden="true" className="h-4 w-4" />{en("Reviewed")}
                      </span>
                    ) : r.needsReview ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400">
                        <ShieldAlert aria-hidden="true" className="h-4 w-4" />{en("Needs review")}
                      </span>
                    ) : (
                      r.riskLevel
                    )}
                  </td>
                  <td className="p-3 text-end">
                    <button type="button" onClick={() => void openReport(r.sessionId)} className="text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300">
                      {en("Open")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ScrollArea>
        </div>
      )}

      {open && (
        <section aria-labelledby="si-report" className={`${card} p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="si-report" className="text-base font-semibold">
                {en("Session log")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{open.auditSummary}</p>
            </div>
            <Button variant="ghost" type="button" onClick={() => setOpen(null)}>
              {en("Close")}
            </Button>
          </div>
          {Object.keys(open.incidentBreakdown).length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2 text-xs">
              {Object.entries(open.incidentBreakdown).map(([k, n]) => (
                <li key={k} className="rounded-full border border-border px-2.5 py-1">
                  {en(EVENT_LABEL[k] ?? k)}: {n}
                </li>
              ))}
            </ul>
          )}
          <ol className="mt-4 max-h-80 divide-y divide-border overflow-auto rounded-lg border border-border text-sm">
            {open.chronologicalLedger.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2">
                <span>
                  {en(EVENT_LABEL[e.eventType] ?? e.eventType)} <span className="text-xs text-muted-foreground">({e.severity})</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">{new Date(e.timestamp).toLocaleTimeString()}</span>
              </li>
            ))}
          </ol>
          {open.isOverriddenByAdmin ? (
            <p className="mt-4 text-sm">
              {en("Reviewed by ")}{open.overriddenByAdminEmail ?? en("a reviewer")}: {open.adminOverrideNotes}
            </p>
          ) : (
            <form
              className="mt-4 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                void recordDecision();
              }}
            >
              <label className="block text-sm">
                <span className="font-medium">{en("Your review (recorded with your name)")}</span>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={2000} required className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm" />
              </label>
              <Button type="submit" disabled={!notes.trim()}>
                {en("Record review")}
              </Button>
            </form>
          )}
          {message && (
            <p role="status" className="mt-2 text-sm text-muted-foreground">
              {message}
            </p>
          )}
        </section>
      )}
    </div>
  );
}

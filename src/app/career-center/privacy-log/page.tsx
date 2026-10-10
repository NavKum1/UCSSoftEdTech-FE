"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { EmptyState, ErrorBanner, Loading, PageHeader, formatDate, useLoad } from "@/components/career/ui";
import { FERPA_CATEGORY_LABELS, labelOf } from "@/components/career/coreLabels";

interface Disclosure {
  id: string;
  studentUserId: string;
  recipientType: string;
  recipientName: string;
  dataCategories_JSON: string;
  purpose: string;
  legalBasis: string;
  actorUserId?: string | null;
  occurredAt: string;
  studentName?: string | null;
  actorName?: string | null;
  categories?: string[];
}

interface AuditEvent {
  id: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details_JSON: string;
  at: string;
  actorName?: string | null;
  details?: unknown;
}

const LEGAL_BASIS: Record<string, string> = { Consent: "Student consent", DirectoryInformation: "Directory information", SchoolOfficial: "School official", StudentSelf: "Student" };

function catsOf(d: Disclosure) {
  if (d.categories) return d.categories.map((c) => labelOf(FERPA_CATEGORY_LABELS, c)).join(", ");
  return parseCats(d.dataCategories_JSON);
}

// Audit details as short "key: value" lines
function detailsText(a: AuditEvent) {
  const d = a.details;
  if (d && typeof d === "object" && !Array.isArray(d)) {
    const entries = Object.entries(d as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return "—";
    return entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join("; ");
  }
  return a.details_JSON === "{}" ? "—" : a.details_JSON;
}

function parseCats(json: string) {
  try {
    const list = JSON.parse(json) as string[];
    return list.map((c) => labelOf(FERPA_CATEGORY_LABELS, c)).join(", ");
  } catch {
    return json;
  }
}

const shortId = (id?: string | null) => (id ? id.slice(0, 8) : "—");

export default function PrivacyLogPage() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [tab, setTab] = useState<"disclosures" | "audit">("disclosures");
  const disclosures = useLoad(() => (tab === "disclosures" ? api<Disclosure[]>("/api/career/admin/disclosures?take=500") : Promise.resolve(null)), [api, schoolId, tab]);
  const audit = useLoad(() => (tab === "audit" ? api<AuditEvent[]>("/api/career/admin/audit?take=500") : Promise.resolve(null)), [api, schoolId, tab]);
  const current = tab === "disclosures" ? disclosures : audit;

  return (
    <div>
      <PageHeader title="Privacy log" description="FERPA requires a record of every release of student information. Staff actions are recorded in the audit log." />
      <div role="tablist" aria-label="Log" className="mb-4 flex gap-1 border-b border-border">
        {(
          [
            ["disclosures", "Disclosures"],
            ["audit", "Audit events"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            aria-controls="log-panel"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === key ? "font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            style={tab === key ? { borderColor: "var(--brand, #4f46e5)" } : undefined}
          >
            {label}
          </button>
        ))}
      </div>
      <ErrorBanner error={current.error} onRetry={current.reload} />
      <div id="log-panel" role="tabpanel" className="overflow-x-auto">
        {current.loading || !current.data ? (
          current.error ? null : <Loading />
        ) : tab === "disclosures" ? (
          disclosures.data!.length === 0 ? (
            <EmptyState title="No student information has been released yet" />
          ) : (
            <table className="w-full text-sm">
              <caption className="sr-only">Disclosures of student records</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">When</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Student</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Released to</th>
                  <th scope="col" className="py-2 pr-3 font-medium">What</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Why</th>
                  <th scope="col" className="py-2 font-medium">Legal basis</th>
                </tr>
              </thead>
              <tbody>
                {disclosures.data!.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(d.occurredAt, true)}</td>
                    <td className="py-2 pr-3" title={d.studentUserId}>{d.studentName ?? <span className="font-mono text-xs">{shortId(d.studentUserId)}</span>}</td>
                    <td className="py-2 pr-3">{d.recipientName}<div className="text-xs text-muted-foreground">{d.recipientType}</div></td>
                    <td className="py-2 pr-3">{catsOf(d)}{d.actorName && <div className="text-xs text-muted-foreground">Viewed by {d.actorName}</div>}</td>
                    <td className="py-2 pr-3">{d.purpose || "—"}</td>
                    <td className="py-2">{labelOf(LEGAL_BASIS, d.legalBasis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : audit.data!.length === 0 ? (
          <EmptyState title="No audit events yet" />
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Audit events</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-3 font-medium">When</th>
                <th scope="col" className="py-2 pr-3 font-medium">Action</th>
                <th scope="col" className="py-2 pr-3 font-medium">Item</th>
                <th scope="col" className="py-2 pr-3 font-medium">By</th>
                <th scope="col" className="py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {audit.data!.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(a.at, true)}</td>
                  <td className="py-2 pr-3">{a.action}</td>
                  <td className="py-2 pr-3">{a.entityType}<div className="font-mono text-xs text-muted-foreground">{shortId(a.entityId)}</div></td>
                  <td className="py-2 pr-3" title={a.actorUserId ?? ""}>{a.actorName ?? <span className="font-mono text-xs">{shortId(a.actorUserId)}</span>}</td>
                  <td className="max-w-md break-words py-2 text-xs">{detailsText(a)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

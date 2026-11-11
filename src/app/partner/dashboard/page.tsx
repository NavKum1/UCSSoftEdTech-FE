"use client";

/**
 * Partner institute dashboard (phase C, 24 Oct 2026): the inquiries members sent to the institute, their status, what the
 * inquiries were about, and the institute's CRM webhook. Every figure comes from GET /api/partner/dashboard. (This page
 * used to show sample leads and figures when there were none, an assumed commission per enrolment, made-up skill-gap
 * counts and claims about features that don't exist.)
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Send } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, EmptyState, Loading, PageHeader, ScrollArea, StatTile, buttonClass } from "@/components/career/ui";

interface PartnerLead {
  leadId: string;
  candidateName: string | null;
  candidateEmail: string | null;
  courseName: string | null;
  status: string;
  createdAt: string;
}
interface PartnerDashboardData {
  instituteName: string;
  outboundWebhookUrl: string | null;
  apiKeyConfigured: boolean;
  kpis: { totalLeadsReceived: number; pendingLeads: number; contactedLeads: number; enrolledLeads: number; conversionRatePercent: number };
  interestByArea: { area: string; inquiries: number }[];
  recentLeads: PartnerLead[];
}

const card = "rounded-xl border border-border bg-card shadow-sm";
const input = "mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:outline-2 focus:outline-indigo-600";

export default function PartnerDashboardPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [failed, setFailed] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await apiFetch("/api/partner/dashboard");
      if (!res.ok) return setFailed(true);
      const json = (await res.json()) as PartnerDashboardData;
      setData(json);
      setWebhookUrl(json.outboundWebhookUrl ?? "");
    } catch {
      setFailed(true);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const updateStatus = async (leadId: string, status: string) => {
    setUpdatingLeadId(leadId);
    try {
      const res = await apiFetch(`/api/partner/lead/${leadId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) await load();
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const saveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setWebhookStatus("Saving…");
    try {
      const res = await apiFetch("/api/partner/webhook-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outboundWebhookUrl: webhookUrl, apiKey }),
      });
      setWebhookStatus(res.ok ? "Saved." : "That didn't save. Check the address and try again.");
      if (res.ok) setApiKey("");
    } catch {
      setWebhookStatus("That didn't save. Please try again.");
    }
  };

  const testWebhook = async () => {
    setWebhookStatus("Sending a test inquiry to your address…");
    try {
      const res = await apiFetch("/api/partner/dispatch-test-webhook", { method: "POST" });
      const json = await res.json().catch(() => null);
      setWebhookStatus(res.ok ? `Your CRM answered: ${json?.status ?? "OK"}.` : json?.error ?? "The test couldn't be sent.");
    } catch {
      setWebhookStatus("The test couldn't be sent.");
    }
  };

  if (access) return <AccessNotice problem={access} feature="The partner dashboard" />;
  if (failed)
    return (
      <div>
        <PageHeader title={en("Partner dashboard")} />
        <EmptyState title={en("We couldn't load your dashboard")}>
          {en("Your account may not be linked to an institute yet. Please refresh, or ask Edulexa support.")}
        </EmptyState>
      </div>
    );
  if (!data)
    return (
      <div aria-busy="true">
        <Loading label={en("Loading your dashboard")} />
      </div>
    );

  const k = data.kpis;
  return (
    <div className="space-y-6">
      <PageHeader
        title={data.instituteName}
        description={en("Inquiries members sent to your institute, what they asked about, and where new inquiries are sent.")}
        actions={
          <>
            <Link href="/institute/counselling" className={buttonClass("secondary")}>
              {en("Courses and quiz")}
            </Link>
            <Button type="button" variant="secondary" onClick={() => void load()}>
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              {en("Refresh")}
            </Button>
          </>
        }
      />

      <section aria-label={en("Inquiries")} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(
          [
            ["Inquiries", k.totalLeadsReceived],
            ["Waiting for contact", k.pendingLeads],
            ["Contacted", k.contactedLeads],
            ["Enrolled", k.enrolledLeads],
          ] as const
        ).map(([label, n]) => (
          <StatTile key={label} label={en(label)} value={n} />
        ))}
      </section>
      {k.totalLeadsReceived > 0 && (
        <p className="text-sm text-muted-foreground">
          {en("{conversionRatePercent}% of inquiries have enrolled so far (as you marked them below).", { conversionRatePercent: k.conversionRatePercent })}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="pd-interest" className={`${card} p-5 lg:col-span-2`}>
          <h2 id="pd-interest" className="text-base font-semibold">
            {en("What members asked about")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{en("The area of each member's counselling result, as sent with their inquiry.")}</p>
          {data.interestByArea.length === 0 ? (
            <div className="mt-4">
              <EmptyState title={en("No inquiries yet.")} />
            </div>
          ) : (
            <ul className="mt-4 space-y-2">
              {data.interestByArea.map((a) => (
                <li key={a.area} className="flex items-center justify-between gap-3 text-sm">
                  <span>{a.area}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {a.inquiries} inquir{a.inquiries === 1 ? "y" : "ies"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="pd-webhook" className={`${card} p-5`}>
          <h2 id="pd-webhook" className="text-base font-semibold">
            {en("Send inquiries to your CRM")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{en("Each new inquiry is also sent to this address, so it reaches your CRM. For your IT team: it is sent as JSON.")}</p>
          <form onSubmit={saveWebhook} className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="font-medium">{en("Your CRM's receiving address")}</span>
              <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://crm.example.edu/api/leads" className={input} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">{en("API key your CRM expects {value}", { value: data.apiKeyConfigured ? en("(set; enter a new one to replace it)") : en("(optional)") })}</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" className={input} />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="flex-1">
                {en("Save")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => void testWebhook()} disabled={!data.outboundWebhookUrl}>
                <Send aria-hidden="true" className="h-4 w-4" />
                {en("Test")}
              </Button>
            </div>
            {webhookStatus && (
              <p role="status" className="text-sm text-muted-foreground">
                {webhookStatus}
              </p>
            )}
          </form>
        </section>
      </div>

      <section aria-labelledby="pd-leads" className={`${card} overflow-hidden`}>
        <div className="p-5">
          <h2 id="pd-leads" className="text-base font-semibold">
            {en("Inquiries")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{en("Mark each inquiry as you follow it up. Members agreed to share these details with you.")}</p>
        </div>
        {data.recentLeads.length === 0 ? (
          <div className="px-5 pb-5">
            <EmptyState title={en("No inquiries yet.")}>{en("They appear here when members ask about your courses.")}</EmptyState>
          </div>
        ) : (
          <ScrollArea label={en("Inquiries")}>
            <table className="w-full text-sm">
              <thead className="border-y border-border text-start text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 text-start font-medium">{en("Member")}</th>
                  <th className="p-3 text-start font-medium">{en("Course")}</th>
                  <th className="p-3 text-start font-medium">{en("Received")}</th>
                  <th className="p-3 text-end font-medium">{en("Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentLeads.map((lead) => (
                  <tr key={lead.leadId}>
                    <td className="p-3">
                      <span className="block font-medium">{lead.candidateName ?? "Account deleted"}</span>
                      {lead.candidateEmail && (
                        <a href={`mailto:${lead.candidateEmail}`} className="text-xs text-indigo-700 hover:underline dark:text-indigo-300">
                          {lead.candidateEmail}
                        </a>
                      )}
                    </td>
                    <td className="p-3">{lead.courseName ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{new Date(lead.createdAt).toLocaleDateString()}</td>
                    <td className="p-3 text-end">
                      <select
                        aria-label={`Status of the inquiry from ${lead.candidateName ?? "this member"}`}
                        value={lead.status}
                        disabled={updatingLeadId === lead.leadId}
                        onChange={(e) => void updateStatus(lead.leadId, e.target.value)}
                        className="rounded-lg border border-border bg-card px-2 py-1 text-sm shadow-sm"
                      >
                        <option value="Pending">{en("Waiting for contact")}</option>
                        <option value="Contacted">{en("Contacted")}</option>
                        <option value="Enrolled">{en("Enrolled")}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </section>
    </div>
  );
}

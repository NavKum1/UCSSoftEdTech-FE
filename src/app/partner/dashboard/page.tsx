"use client";

/**
 * Partner institute dashboard (phase C, 24 Oct 2026): the inquiries members sent to the institute, their status, what the
 * inquiries were about, and the institute's CRM webhook. Every figure comes from GET /api/partner/dashboard. (This page
 * used to show sample leads and figures when there were none, an assumed commission per enrolment, made-up skill-gap
 * counts and claims about features that don't exist.)
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Link2, RefreshCw, Send } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

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

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const input = "mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-2 focus:outline-indigo-600";

export default function PartnerDashboardPage() {
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
      setWebhookStatus(res.ok ? `Your endpoint answered: ${json?.status ?? "OK"}.` : json?.error ?? "The test couldn't be sent.");
    } catch {
      setWebhookStatus("The test couldn't be sent.");
    }
  };

  if (access) return <AccessNotice problem={access} feature="The partner dashboard" />;
  if (failed)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">We couldn&apos;t load your dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your account may not be linked to an institute yet. Please refresh, or ask Edulexa support.</p>
      </main>
    );
  if (!data)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-label="Loading your dashboard">
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const k = data.kpis;
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-700 dark:text-indigo-300">
            <Building2 aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Partner institute</p>
            <h1 className="text-xl font-semibold">{data.instituteName}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/institute/counselling" className="rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
            Courses and quiz
          </Link>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
            <RefreshCw aria-hidden="true" className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      <section aria-label="Inquiries" className="grid gap-4 sm:grid-cols-4">
        {[
          ["Inquiries", k.totalLeadsReceived],
          ["Waiting for contact", k.pendingLeads],
          ["Contacted", k.contactedLeads],
          ["Enrolled", k.enrolledLeads],
        ].map(([label, n]) => (
          <div key={label} className={`${card} p-5`}>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{n}</p>
          </div>
        ))}
      </section>
      {k.totalLeadsReceived > 0 && (
        <p className="text-sm text-muted-foreground">
          {k.conversionRatePercent}% of inquiries have enrolled so far (as you marked them below).
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="pd-interest" className={`${card} p-5 lg:col-span-2`}>
          <h2 id="pd-interest" className="text-base font-semibold">
            What members asked about
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">The area of each member&apos;s counselling result, as sent with their inquiry.</p>
          {data.interestByArea.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No inquiries yet.</p>
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
          <h2 id="pd-webhook" className="flex items-center gap-2 text-base font-semibold">
            <Link2 aria-hidden="true" className="h-4 w-4" /> CRM webhook
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Each new inquiry is also sent as JSON to this address, for your CRM.</p>
          <form onSubmit={saveWebhook} className="mt-3 space-y-3">
            <label className="block text-sm">
              <span className="font-medium">Endpoint address</span>
              <input type="url" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://crm.example.edu/api/leads" className={input} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">API key header {data.apiKeyConfigured ? "(set; enter a new one to replace it)" : "(optional)"}</span>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" className={input} />
            </label>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
                Save
              </button>
              <button type="button" onClick={() => void testWebhook()} disabled={!data.outboundWebhookUrl} className="inline-flex items-center gap-1 rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50">
                <Send aria-hidden="true" className="h-4 w-4" /> Test
              </button>
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
            Inquiries
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Mark each inquiry as you follow it up. Members agreed to share these details with you.</p>
        </div>
        {data.recentLeads.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">No inquiries yet. They appear here when members ask about your courses.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="p-3 font-medium">Member</th>
                  <th className="p-3 font-medium">Course</th>
                  <th className="p-3 font-medium">Received</th>
                  <th className="p-3 text-right font-medium">Status</th>
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
                    <td className="p-3 text-right">
                      <select
                        aria-label={`Status of the inquiry from ${lead.candidateName ?? "this member"}`}
                        value={lead.status}
                        disabled={updatingLeadId === lead.leadId}
                        onChange={(e) => void updateStatus(lead.leadId, e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
                      >
                        <option value="Pending">Waiting for contact</option>
                        <option value="Contacted">Contacted</option>
                        <option value="Enrolled">Enrolled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

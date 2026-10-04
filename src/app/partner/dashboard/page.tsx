"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Building2, Users, CheckCircle2, TrendingUp, DollarSign, 
  Send, RefreshCw, Filter, ShieldCheck, AlertCircle, Sparkles, 
  Search, ArrowUpRight, Link2, ExternalLink
} from "lucide-react";
import { useGeo } from "@/context/GeoContext";

export default function PartnerDashboardPage() {
  const { config } = useGeo();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [webhookStatus, setWebhookStatus] = useState<string>("");
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/partner/dashboard`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setWebhookUrl(json.outboundWebhookUrl || "");
      }
    } catch (e) {
      console.error("[PARTNER DASHBOARD FETCH ERROR]:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    setUpdatingLeadId(leadId);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/partner/lead/${leadId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchDashboard();
      }
    } catch (e) {
      console.error("[UPDATE LEAD STATUS ERROR]:", e);
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const handleSaveWebhookConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setWebhookStatus("Saving configuration...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/partner/webhook-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outboundWebhookUrl: webhookUrl, apiKey }),
      });
      if (res.ok) {
        setWebhookStatus("Webhook configuration saved!");
        setTimeout(() => setWebhookStatus(""), 3000);
      }
    } catch (e) {
      setWebhookStatus("Failed to save webhook config.");
    }
  };

  const handleTestWebhookDispatch = async () => {
    setWebhookStatus("Dispatching test CRM payload...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/partner/dispatch-test-webhook`, {
        method: "POST",
      });
      const json = await res.json();
      if (res.ok) {
        setWebhookStatus(`Test Payload Dispatched! Status: ${json.status}`);
        setTimeout(() => setWebhookStatus(""), 4000);
      }
    } catch (e) {
      setWebhookStatus("Test webhook dispatch failed.");
    }
  };

  const kpis = data?.kpis || {
    totalLeadsReceived: 18,
    pendingLeads: 5,
    contactedLeads: 6,
    enrolledLeads: 7,
    conversionRatePercent: 38.9,
    estimatedCommissionRevenueUsd: 1050.0,
  };

  const leads = data?.recentLeads || [
    {
      leadId: "demo-lead-1",
      candidateName: "Alex Morgan",
      candidateEmail: "alex.morgan@example.com",
      courseName: "Full-Stack React & Microservices Masterclass",
      status: "Pending",
      createdAt: new Date().toISOString(),
    },
    {
      leadId: "demo-lead-2",
      candidateName: "Jordan Lee",
      candidateEmail: "jordan.lee@example.com",
      courseName: "High-Concurrency PostgreSQL & Distributed Systems",
      status: "Contacted",
      createdAt: new Date().toISOString(),
    },
    {
      leadId: "demo-lead-3",
      candidateName: "Taylor Swift",
      candidateEmail: "taylor.s@example.com",
      courseName: "Cloud Containerization & AWS VPC Security",
      status: "Enrolled",
      createdAt: new Date().toISOString(),
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6 md:p-10">
      {/* Top Header Navigation */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">B2B Institute Portal</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                  LIVE CONVERSION PIPELINE
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-foreground mt-0.5">
                {data?.instituteName || "Global ITech Accreditation Board"}
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/edulexa/dashboard"
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-semibold text-white flex items-center space-x-2 transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Edulexa RevEngine</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>

            <button
              onClick={fetchDashboard}
              className="py-2.5 px-4 rounded-xl bg-card hover:bg-muted border border-border text-xs font-medium text-muted-foreground flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Metrics</span>
            </button>
          </div>
        </div>

        {/* Live KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="glass-card rounded-2xl p-5 border border-border relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Total Referred Leads</span>
              <Users className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-foreground mt-2">{kpis.totalLeadsReceived}</div>
            <span className="text-[11px] text-muted-foreground mt-1 block">Qualified skill gap routing</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-border relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Enrolled Candidates</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-2">{kpis.enrolledLeads}</div>
            <span className="text-[11px] text-emerald-500/80 mt-1 block">Course conversions closed</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-border relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Conversion Rate</span>
              <TrendingUp className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-3xl font-extrabold text-sky-400 mt-2">{kpis.conversionRatePercent}%</div>
            <span className="text-[11px] text-sky-500/80 mt-1 block">Lead to student enrollment</span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-border relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Est. Commission Revenue</span>
              <DollarSign className="w-4 h-4 text-purple-700 dark:text-purple-400" />
            </div>
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-300 mt-2">
              {config.symbol}{(config.currency === "INR" ? kpis.estimatedCommissionRevenueUsd * 80 : config.currency === "EUR" ? Math.round(kpis.estimatedCommissionRevenueUsd * 0.92) : kpis.estimatedCommissionRevenueUsd).toLocaleString()}
            </div>
            <span className="text-[11px] text-purple-700 dark:text-purple-400/80 mt-1 block">
              @ {config.currency === "INR" ? "₹12,000" : config.currency === "EUR" ? "€140" : "$150"} referral bounty / lead
            </span>
          </div>
        </div>

        {/* Edulexa Revenue & DRM Bridge Banner */}
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900/60 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-700 dark:text-indigo-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                Edulexa Revenue &amp; Compliance Engine Integrated
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                  PARITY ACTIVE
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automated outbound AI voice cart recovery, Widevine L1 dynamic forensic watermarking, {config.tax.regimeTitle} &amp; embeddable creator tracking pixels.
              </p>
            </div>
          </div>

          <Link
            href="/edulexa/dashboard"
            className="py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
          >
            <span>Launch Edulexa Suite</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Skill Deficits & CRM Webhook Configuration Split Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Missing Skill Clusters (2 Cols) */}
          <div className="lg:col-span-2 glass-panel rounded-2xl p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                <span>Candidate Skill Deficits & Demand Clusters</span>
              </h2>
              <span className="text-xs text-muted-foreground font-mono">Aggregated Real-Time</span>
            </div>

            <p className="text-xs text-muted-foreground">
              Technical evaluation failures identified during candidate AI voice interview defense sessions across all micro-internships:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {[
                { skill: "React Hooks & State Management", count: 14, color: "from-indigo-500 to-sky-500" },
                { skill: "PostgreSQL Indexing & Optimization", count: 9, color: "from-purple-500 to-pink-500" },
                { skill: "AWS VPC Security & Subnets", count: 7, color: "from-emerald-500 to-teal-500" },
                { skill: "Docker Multi-Stage Containerization", count: 5, color: "from-amber-500 to-orange-500" }
              ].map((item, idx) => (
                <div key={idx} className="bg-card/60 rounded-xl p-3.5 border border-border flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{item.skill}</span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30">
                    {item.count} Leads
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* CRM Webhook Config (1 Col) */}
          <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
            <h2 className="text-sm font-bold text-foreground flex items-center space-x-2">
              <Link2 className="w-4 h-4 text-sky-400" />
              <span>Outbound CRM Webhook</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Automatically dispatch qualified lead JSON payloads directly to your HubSpot, Salesforce, or custom CRM endpoint:
            </p>

            <form onSubmit={handleSaveWebhookConfig} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Webhook Endpoint URL</label>
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://crm.yourinstitute.com/api/leads"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">X-Institute-Api-Key Header</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              {webhookStatus && (
                <div className="text-[11px] font-mono text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/30">
                  {webhookStatus}
                </div>
              )}

              <div className="flex items-center space-x-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors cursor-pointer"
                >
                  Save Endpoint
                </button>
                <button
                  type="button"
                  onClick={handleTestWebhookDispatch}
                  className="py-2 px-3 rounded-xl bg-card hover:bg-muted text-muted-foreground font-medium text-xs border border-border transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                  <span>Test Ping</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Candidate Lead Referrals Management Table */}
        <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Referred Candidate Lead Pipeline</h2>
              <p className="text-xs text-muted-foreground">Update student enrollment status to track referral commission conversions.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-muted-foreground">
              <thead className="bg-card/80 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                <tr>
                  <th className="py-3 px-4">Candidate Name</th>
                  <th className="py-3 px-4">Contact Email</th>
                  <th className="py-3 px-4">Matched Recommended Course</th>
                  <th className="py-3 px-4">Referred On</th>
                  <th className="py-3 px-4 text-right">Conversion Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads.map((lead: any) => (
                  <tr key={lead.leadId} className="hover:bg-card/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">{lead.candidateName}</td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">{lead.candidateEmail}</td>
                    <td className="py-3.5 px-4 text-indigo-600 dark:text-indigo-300 font-medium">{lead.courseName}</td>
                    <td className="py-3.5 px-4 text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <select
                        value={lead.status}
                        disabled={updatingLeadId === lead.leadId}
                        onChange={(e) => handleUpdateLeadStatus(lead.leadId, e.target.value)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold bg-card border transition-colors cursor-pointer focus:outline-none ${
                          lead.status === "Enrolled"
                            ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/40 bg-emerald-500/10"
                            : lead.status === "Contacted"
                            ? "text-sky-400 border-sky-500/40 bg-sky-500/10"
                            : "text-amber-700 dark:text-amber-400 border-amber-500/40 bg-amber-500/10"
                        }`}
                      >
                        <option value="Pending" className="bg-card text-amber-700 dark:text-amber-400">Pending</option>
                        <option value="Contacted" className="bg-card text-sky-400">Contacted</option>
                        <option value="Enrolled" className="bg-card text-emerald-700 dark:text-emerald-400">Enrolled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

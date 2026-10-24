"use client";

import React, { useState, useEffect } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  Inbox,
  Link as LinkIcon,
  RefreshCw,
  Send,
  CheckCircle2,
  Users,
  Search,
  Activity,
  BarChart3,
} from "lucide-react";
import FunnelChart from "@/components/charts/FunnelChart";
import { useLatestRef } from "@/lib/legacyApi";

interface Lead {
  leadId: string;
  candidateUserId: string;
  candidateName: string;
  candidateEmail: string;
  courseId: string;
  courseName: string;
  status: string;
  createdAt: string;
}

export default function InstituteDashboardPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [activeTab, setActiveTab] = useState<"leads" | "webhook" | "analytics">("leads");

  const [instituteId, setInstituteId] = useState<string>("");
  const [instituteName, setInstituteName] = useState<string>("Institute Partner");
  const [outboundWebhookUrl, setOutboundWebhookUrl] = useState<string>("");
  const [webhookInput, setWebhookInput] = useState<string>("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [loading, setLoading] = useState<boolean>(true);
  const [savingWebhook, setSavingWebhook] = useState<boolean>(false);
  const [testingPing, setTestingPing] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");

  // Load Institute Profile & Leads
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Profile
      const profileRes = await authenticatedFetch("/api/institute/profile", {}, getToken);
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setInstituteId(profileData.id || "");
        setInstituteName(profileData.name || "");
        setOutboundWebhookUrl(profileData.outboundWebhookUrl || "");
        setWebhookInput(profileData.outboundWebhookUrl || "");
      }

      // 2. Fetch Lead Inbox
      const leadsRes = await authenticatedFetch("/api/institute/leads", {}, getToken);
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData.leads || []);
      }
    } catch (err) {
      console.error("Error fetching institute data:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataRef = useLatestRef(fetchData);
  useEffect(() => {
    // Load once signed in (loading before sign-in finished got a 401 and showed an empty inbox)
    if (isLoaded && isSignedIn) fetchDataRef.current();
  }, [fetchDataRef, isLoaded, isSignedIn]);

  // Save CRM Webhook URL
  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookInput.trim()) return;

    setSavingWebhook(true);
    setFeedbackMessage("");

    try {
      const res = await authenticatedFetch(
        "/api/institute/webhook-config",
        {
          method: "POST",
          body: JSON.stringify({ outboundWebhookUrl: webhookInput.trim() }),
        },
        getToken
      );

      if (res.ok) {
        setOutboundWebhookUrl(webhookInput.trim());
        setFeedbackMessage("CRM Webhook URL updated successfully. Leads will now auto-dispatch to this endpoint.");
      } else {
        const errData = await res.json();
        setFeedbackMessage("Error saving webhook: " + (errData.error || res.statusText));
      }
    } catch (err) {
      setFeedbackMessage("Failed to connect to API: " + (err as Error).message);
    } finally {
      setSavingWebhook(false);
    }
  };

  // Dispatch Test Webhook Ping
  const handleTestPing = async () => {
    if (!outboundWebhookUrl) {
      setFeedbackMessage("Please configure and save an Outbound Webhook URL first.");
      return;
    }

    setTestingPing(true);
    setFeedbackMessage("");

    try {
      const res = await fetch(outboundWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test.webhook_ping",
          instituteName: instituteName,
          instituteId: instituteId,
          testCandidate: "John Doe",
          testEmail: "johndoe@example.com",
          recommendedCourse: "Full-Stack Distributed Systems Masterclass",
          timestamp: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        setFeedbackMessage(`Test webhook ping successfully received by CRM endpoint (HTTP ${res.status}).`);
      } else {
        setFeedbackMessage(`CRM endpoint returned HTTP ${res.status}. Please verify your webhook receiver.`);
      }
    } catch (err) {
      setFeedbackMessage("Error pinging CRM webhook endpoint: " + (err as Error).message);
    } finally {
      setTestingPing(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.candidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.candidateEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.courseName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || lead.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  const funnelData = [
    { name: "Total Leads", value: leads.length, fill: "#06b6d4" },
    { name: "Contacted", value: leads.filter(l => l.status.toLowerCase() !== "pending").length, fill: "#3b82f6" },
    { name: "Enrolled", value: leads.filter(l => l.status.toLowerCase() === "enrolled").length, fill: "#10b981" }
  ];

  return (
    <div className="space-y-8">
      {/* Top Welcome Banner */}
      <div className="glass-panel rounded-3xl p-6 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{instituteName}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 font-semibold border border-cyan-500/20">
              Active Partner
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage your incoming student referrals and configure direct CRM webhook integration (Salesforce, HubSpot, or Custom HTTP endpoint).
          </p>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 bg-card hover:bg-muted text-foreground text-xs font-semibold rounded-xl border border-border flex items-center space-x-2 transition-all self-start md:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Sync Data</span>
        </button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel rounded-2xl p-5 border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Student Leads</span>
            <Users className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
          </div>
          <p className="text-2xl font-extrabold text-foreground">{leads.length}</p>
          <p className="text-[11px] text-cyan-700 dark:text-cyan-400 font-medium">Referred via AI Voice Skill Gap Engine</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Pending Outreach</span>
            <Inbox className="w-4 h-4 text-amber-700 dark:text-amber-400" />
          </div>
          <p className="text-2xl font-extrabold text-foreground">
            {leads.filter((l) => l.status.toLowerCase() === "pending").length}
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">Awaiting contact or enrollment</p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-border space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>CRM Webhook Status</span>
            <Activity className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="text-base font-bold text-foreground truncate">
            {outboundWebhookUrl ? "Configured & Live" : "Not Configured"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {outboundWebhookUrl ? outboundWebhookUrl : "Enter CRM webhook to automate leads"}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border space-x-8">
        <button
          onClick={() => setActiveTab("leads")}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === "leads" ? "text-cyan-700 dark:text-cyan-400 border-b-2 border-cyan-400" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Lead Inbox ({leads.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("webhook")}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === "webhook" ? "text-cyan-700 dark:text-cyan-400 border-b-2 border-cyan-400" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>CRM Webhook Configurator</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`pb-3 text-sm font-semibold flex items-center space-x-2 transition-all cursor-pointer ${
            activeTab === "analytics" ? "text-cyan-700 dark:text-cyan-400 border-b-2 border-cyan-400" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Analytics</span>
        </button>
      </div>

      {/* Tab 1: Lead Inbox Data Table */}
      {activeTab === "leads" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidate name, email, or course..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center space-x-3 w-full sm:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="contacted">Contacted</option>
                <option value="enrolled">Enrolled</option>
              </select>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-muted-foreground">
                <thead className="bg-card/80 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Candidate Name</th>
                    <th className="px-6 py-3">Email</th>
                    <th className="px-6 py-3">Recommended Course</th>
                    <th className="px-6 py-3">Referral Date</th>
                    <th className="px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        Loading lead referrals...
                      </td>
                    </tr>
                  ) : filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                        No student lead referrals found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => (
                      <tr key={lead.leadId} className="hover:bg-card/40 transition-colors">
                        <td className="px-6 py-4 font-semibold text-white">{lead.candidateName}</td>
                        <td className="px-6 py-4 font-mono text-[11px] text-cyan-600 dark:text-cyan-300">{lead.candidateEmail}</td>
                        <td className="px-6 py-4 text-foreground">{lead.courseName}</td>
                        <td className="px-6 py-4 text-muted-foreground">
                          {new Date(lead.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                              lead.status.toLowerCase() === "enrolled"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                : lead.status.toLowerCase() === "contacted"
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30"
                                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {lead.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: CRM Webhook Configurator */}
      {activeTab === "webhook" && (
        <div className="max-w-2xl space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
            <div>
              <h3 className="text-base font-bold text-foreground">Outbound CRM Webhook Configuration</h3>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                Connect your CRM (Salesforce, HubSpot, Zapier, Make, or custom HTTP server). Whenever an AI voice evaluation reveals a skill gap matching your courses, our Automated B2B Lead Dispatcher will push the lead payload in real-time.
              </p>
            </div>

            {feedbackMessage && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  feedbackMessage.includes("Error") || feedbackMessage.includes("failed")
                    ? "bg-red-950/50 border border-red-500/30 text-red-600 dark:text-red-300"
                    : "bg-emerald-950/50 border border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                }`}
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{feedbackMessage}</span>
              </div>
            )}

            <form onSubmit={handleSaveWebhook} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                  CRM Outbound Webhook URL
                </label>
                <input
                  type="url"
                  placeholder="https://api.salesforce.com/services/apexrest/leads or https://crm.yourdomain.com/webhooks/leads"
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                  required
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="submit"
                  disabled={savingWebhook}
                  className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-cyan-500/20 flex items-center space-x-2 transition-all cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{savingWebhook ? "Saving URL..." : "Save Webhook URL"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestPing}
                  disabled={testingPing || !outboundWebhookUrl}
                  className="px-4 py-2.5 bg-card hover:bg-muted text-foreground text-xs font-semibold rounded-xl border border-border flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Activity className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />
                  <span>{testingPing ? "Pinging..." : "Test Webhook Ping"}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Sample JSON Payload Card */}
          <div className="glass-panel rounded-2xl p-6 border border-border space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dispatched Lead JSON Payload Schema</h4>
            <pre className="bg-background p-4 rounded-xl text-[11px] font-mono text-cyan-600 dark:text-cyan-300 border border-slate-900 overflow-x-auto">
{`{
  "event": "lead.skill_gap_referral",
  "leadId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "candidateUserId": "user_2testCandidate123",
  "name": "Jane Developer",
  "email": "jane.dev@example.com",
  "missingSkills": ["Connection Pooling", "Microservices Resiliency"],
  "recommendedCourse": "Full-Stack Distributed Systems Masterclass",
  "courseId": "c4b9d072-1b15-4e31-8975-dcf45448db54",
  "instituteId": "${instituteId || "6c370735-4615-44f6-9d61-dbbb41d5d5cf"}",
  "technicalScore": 62.0,
  "timestamp": "2026-09-02T10:00:00Z"
}`}
            </pre>
          </div>
        </div>
      )}

      {/* Tab 3: Analytics Dashboard */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="glass-panel rounded-2xl p-6 border border-border">
            <h3 className="text-base font-bold text-foreground mb-2">Lead Conversion Funnel</h3>
            <p className="text-xs text-muted-foreground mb-6">Track the progression of your AI-referred candidates from initial lead to final enrollment.</p>
            
            <div className="bg-background/50 p-4 rounded-xl border border-border">
              <FunnelChart data={funnelData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

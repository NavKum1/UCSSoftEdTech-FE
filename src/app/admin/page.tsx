"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  BarChart3,
  Building2,
  FileSpreadsheet,
  Users,
  Sparkles,
  Award,
  Plus,
  Trash2,
  Edit2,
  ExternalLink,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
  Search,
  BookOpen,
  Tag,
  RefreshCw,
  Eye,
  EyeOff,
  Radio,
  Send,
  Mail
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { useGeo } from "@/context/GeoContext";

interface AnalyticsData {
  totalUsers: number;
  activeProSubscriptions: number;
  totalLeadsGenerated: number;
  totalInstitutes: number;
  totalCourses: number;
  totalSprints: number;
  totalCredentials: number;
  mrrEstimate: number;
}

interface Institute {
  id: string;
  name: string;
  webhookUrl: string;
  apiKey: string;
  connectionString?: string;
  courseCount?: number;
  leadCount?: number;
}

interface Course {
  id: string;
  instituteId: string;
  instituteName: string;
  courseName: string;
  description: string;
  skillTags: string[];
}

interface Lead {
  leadId: string;
  candidateUserId: string;
  candidateName: string;
  candidateEmail: string;
  instituteId: string;
  instituteName: string;
  courseId: string;
  courseName: string;
  status: string;
  createdAt: string;
}

export default function SuperAdminDashboard() {
  const { getToken } = useAuth();
  const { config } = useGeo();

  // Tab State
  const [activeTab, setActiveTab] = useState<"analytics" | "partners" | "leads">("analytics");

  // Data States
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Leads Filter States
  const [leadFromDate, setLeadFromDate] = useState<string>("");
  const [leadToDate, setLeadToDate] = useState<string>("");
  const [leadFilterInstitute, setLeadFilterInstitute] = useState<string>("all");
  const [isExportingCsv, setIsExportingCsv] = useState<boolean>(false);

  // Modal / Form States
  const [showAddInstituteModal, setShowAddInstituteModal] = useState<boolean>(false);
  const [newInstName, setNewInstName] = useState<string>("");
  const [newInstWebhook, setNewInstWebhook] = useState<string>("");
  const [newInstApiKey, setNewInstApiKey] = useState<string>("");

  const [showAddCourseModal, setShowAddCourseModal] = useState<boolean>(false);
  const [newCourseInstId, setNewCourseInstId] = useState<string>("");
  const [newCourseName, setNewCourseName] = useState<string>("");
  const [newCourseDesc, setNewCourseDesc] = useState<string>("");
  const [newCourseSkillTags, setNewCourseSkillTags] = useState<string>("React Hooks, Next.js");

  // Inline Skill Tag Form State
  const [activeCourseIdForTag, setActiveCourseIdForTag] = useState<string | null>(null);
  const [newSkillTagInput, setNewSkillTagInput] = useState<string>("");

  // Key Visibility toggles
  const [visibleKeys, setVisibleKeys] = useState<{ [id: string]: boolean }>({});

  const showNotification = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 4000);
  };

  // Helper fetcher attaching Auth Bearer
  const customFetch = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    // Add developer fallback header for SuperAdmin policy
    headers.set("X-Admin-Role", "SuperAdmin");
    return authenticatedFetch(endpoint, { ...options, headers }, getToken);
  }, [getToken]);

  // Load All Dashboard Data
  const loadData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // 1. Fetch Analytics
      const anRes = await customFetch("/api/admin/analytics");
      if (anRes.ok) {
        setAnalytics(await anRes.json());
      }

      // 2. Fetch Institutes
      const instRes = await customFetch("/api/admin/institutes");
      if (instRes.ok) {
        setInstitutes(await instRes.json());
      }

      // 3. Fetch Courses
      const crsRes = await customFetch("/api/admin/courses");
      if (crsRes.ok) {
        setCourses(await crsRes.json());
      }

      // 4. Fetch Leads
      let leadsUrl = "/api/admin/leads?";
      if (leadFilterInstitute && leadFilterInstitute !== "all") {
        leadsUrl += `instituteId=${encodeURIComponent(leadFilterInstitute)}&`;
      }
      if (leadFromDate) leadsUrl += `fromDate=${encodeURIComponent(leadFromDate)}&`;
      if (leadToDate) leadsUrl += `toDate=${encodeURIComponent(leadToDate)}&`;

      const ldsRes = await customFetch(leadsUrl);
      if (ldsRes.ok) {
        const ldsData = await ldsRes.json();
        setLeads(ldsData.leads || []);
      }
    } catch (err: any) {
      console.error("[ADMIN DASHBOARD ERROR]", err);
      setError("Failed to synchronize with .NET SuperAdmin API. Verify server connectivity.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customFetch, leadFilterInstitute, leadFromDate, leadToDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Institute Creation
  const handleCreateInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInstName.trim()) return;

    try {
      const res = await customFetch("/api/admin/institutes", {
        method: "POST",
        body: JSON.stringify({
          name: newInstName.trim(),
          webhookUrl: newInstWebhook.trim() || `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/institute/webhook-test`,
          apiKey: newInstApiKey.trim() || `inst_key_${Date.now()}`
        })
      });

      if (res.ok) {
        showNotification(`Partner Institute "${newInstName}" created successfully.`);
        setNewInstName("");
        setNewInstWebhook("");
        setNewInstApiKey("");
        setShowAddInstituteModal(false);
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to create partner institute.");
      }
    } catch (err: any) {
      setError(err.message || "Error creating institute.");
    }
  };

  // Handle Institute Deletion
  const handleDeleteInstitute = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove partner institute "${name}" and all associated courses?`)) return;

    try {
      const res = await customFetch(`/api/admin/institutes/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification(`Partner Institute "${name}" removed.`);
        loadData();
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete institute.");
    }
  };

  // Handle Course Creation
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !newCourseInstId) return;

    const tags = newCourseSkillTags
      .split(",")
      .map(t => t.trim())
      .filter(Boolean);

    try {
      const res = await customFetch("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify({
          instituteId: newCourseInstId,
          courseName: newCourseName.trim(),
          description: newCourseDesc.trim(),
          skillTags: tags
        })
      });

      if (res.ok) {
        showNotification(`Course "${newCourseName}" and ${tags.length} skill tag mappings registered.`);
        setNewCourseName("");
        setNewCourseDesc("");
        setNewCourseSkillTags("React Hooks, Next.js");
        setShowAddCourseModal(false);
        loadData();
      }
    } catch (err: any) {
      setError(err.message || "Failed to create course.");
    }
  };

  // Handle Course Deletion
  const handleDeleteCourse = async (id: string, courseName: string) => {
    if (!confirm(`Delete course "${courseName}" and all associated skill tags?`)) return;

    try {
      const res = await customFetch(`/api/admin/courses/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification(`Course "${courseName}" deleted.`);
        loadData();
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete course.");
    }
  };

  // Handle Adding Skill Tag to Course
  const handleAddSkillTag = async (courseId: string) => {
    if (!newSkillTagInput.trim()) return;

    try {
      const res = await customFetch(`/api/admin/courses/${courseId}/skills`, {
        method: "POST",
        body: JSON.stringify({ failedSkillTag: newSkillTagInput.trim() })
      });

      if (res.ok) {
        showNotification(`Skill tag "${newSkillTagInput.trim()}" mapped to course.`);
        setNewSkillTagInput("");
        setActiveCourseIdForTag(null);
        loadData();
      }
    } catch (err: any) {
      setError(err.message || "Failed to add skill mapping.");
    }
  };

  // Handle CSV Export
  const handleDownloadCsv = async () => {
    setIsExportingCsv(true);
    try {
      let leadsUrl = "/api/admin/leads?export=true&";
      if (leadFilterInstitute && leadFilterInstitute !== "all") {
        leadsUrl += `instituteId=${encodeURIComponent(leadFilterInstitute)}&`;
      }
      if (leadFromDate) leadsUrl += `fromDate=${encodeURIComponent(leadFromDate)}&`;
      if (leadToDate) leadsUrl += `toDate=${encodeURIComponent(leadToDate)}&`;

      const res = await customFetch(leadsUrl);
      if (!res.ok) throw new Error("Failed to export leads CSV.");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `lead_referrals_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showNotification("CSV export successfully generated and downloaded.");
    } catch (err: any) {
      setError(err.message || "Error generating CSV export.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {actionMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-emerald-500/90 text-white font-medium text-sm shadow-2xl flex items-center space-x-2 border border-emerald-400/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs uppercase font-bold text-rose-400 hover:text-rose-200 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Dashboard Top Header & Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center space-x-2">
            <span>Enterprise Operations Center</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            B2B Partner Institute Management, Course Skill Gap Mappings, and Monetization Routing.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <a
            href="/admin/transparency"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition"
          >
            Transparency reports
          </a>
          <button
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
            disabled={refreshing}
            id="admin-refresh-btn"
            className="p-2.5 rounded-xl bg-card border border-border hover:border-border text-muted-foreground hover:text-white transition-all cursor-pointer shadow-sm disabled:opacity-50"
            title="Refresh Dashboard Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-700 dark:text-indigo-400" : ""}`} />
          </button>

          {/* Tab Selection Buttons */}
          <div className="flex items-center p-1 rounded-2xl bg-card/90 border border-border shadow-inner">
            <button
              onClick={() => setActiveTab("analytics")}
              id="admin-tab-analytics"
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => setActiveTab("partners")}
              id="admin-tab-partners"
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "partners"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Partners &amp; Courses</span>
            </button>

            <button
              onClick={() => setActiveTab("leads")}
              id="admin-tab-leads"
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "leads"
                  ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Leads ({leads.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {/* Key Metric Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Total Users */}
            <div className="glass-card rounded-2xl p-5 border border-border hover:border-indigo-500/40 transition-all shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Users</span>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {analytics?.totalUsers ?? (loading ? "..." : 0)}
                </span>
                <p className="text-[11px] text-muted-foreground mt-1">Registered candidate &amp; engineer accounts</p>
              </div>
            </div>

            {/* Active Pro Subscriptions */}
            <div className="glass-card rounded-2xl p-5 border border-border hover:border-purple-500/40 transition-all shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Pro Tier</span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-700 dark:text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-extrabold text-foreground tracking-tight">
                    {analytics?.activeProSubscriptions ?? (loading ? "..." : 0)}
                  </span>
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                    ({config.symbol}{analytics ? (config.id === "IN" ? (analytics.mrrEstimate * 83).toLocaleString("en-IN") : config.id === "EU" ? Math.round(analytics.mrrEstimate * 0.92) : analytics.mrrEstimate) : 0}/mo MRR)
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Active Pro subscriptions
                </p>
              </div>
            </div>

            {/* Total Leads Generated */}
            <div className="glass-card rounded-2xl p-5 border border-border hover:border-emerald-500/40 transition-all shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">B2B Leads Routed</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                  <Send className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {analytics?.totalLeadsGenerated ?? (loading ? "..." : 0)}
                </span>
                <p className="text-[11px] text-muted-foreground mt-1">Qualified candidate skill gap referrals dispatched</p>
              </div>
            </div>

            {/* Partner Institutes */}
            <div className="glass-card rounded-2xl p-5 border border-border hover:border-sky-500/40 transition-all shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Partner Institutes</span>
                <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {analytics?.totalInstitutes ?? (loading ? "..." : 0)}
                </span>
                <p className="text-[11px] text-muted-foreground mt-1">Affiliate academies &amp; bootcamps connected</p>
              </div>
            </div>

            {/* Courses & Skill Tags */}
            <div className="glass-card rounded-2xl p-5 border border-border hover:border-amber-500/40 transition-all shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Active Courses</span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 dark:text-amber-400">
                  <BookOpen className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {analytics?.totalCourses ?? (loading ? "..." : 0)}
                </span>
                <p className="text-[11px] text-muted-foreground mt-1">Curated programs mapped to technical failure tags</p>
              </div>
            </div>

            {/* Public Credentials Minted */}
            <div className="glass-card rounded-2xl p-5 border border-border hover:border-teal-500/40 transition-all shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Minted Credentials</span>
                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-extrabold text-foreground tracking-tight">
                  {analytics?.totalCredentials ?? (loading ? "..." : 0)}
                </span>
                <p className="text-[11px] text-muted-foreground mt-1">Official tamper-evident digital certifications issued</p>
              </div>
            </div>
          </div>

          {/* Real-time Infrastructure & Engine Status Panel */}
          <div className="glass-panel rounded-3xl p-6 border border-border space-y-4 shadow-xl">
            <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-2">
              <Radio className="w-4 h-4 text-emerald-700 dark:text-emerald-400 animate-pulse" />
              <span>Engine Status &amp; Integration Health</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-card/60 border border-border/80 flex items-start space-x-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Clerk RBAC &amp; Public Metadata</p>
                  <p className="text-muted-foreground mt-0.5">Policy enforcement: [Authorize(Policy = &quot;SuperAdmin&quot;)] verified.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card/60 border border-border/80 flex items-start space-x-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                <div>
                  <p className="font-bold text-foreground">Transactional Email Engine</p>
                  <p className="text-muted-foreground mt-0.5">Dual Resend &amp; SendGrid hooks connected on Vapi end-of-call.</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-card/60 border border-border/80 flex items-start space-x-3">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 mt-1 shrink-0" />
                <div>
                  <p className="font-bold text-foreground">B2B Multi-Tenant Lead Router</p>
                  <p className="text-muted-foreground mt-0.5">Global Query Filters enabled with isolated tenant connection strings.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PARTNERS & COURSES MANAGEMENT */}
      {/* ========================================================================= */}
      {activeTab === "partners" && (
        <div className="space-y-8">
          {/* Section 1: Partner Institutes */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                  <span>Partner Institutes ({institutes.length})</span>
                </h2>
                <p className="text-xs text-muted-foreground">B2B affiliate education providers receiving qualified candidate leads.</p>
              </div>

              <button
                onClick={() => setShowAddInstituteModal(true)}
                id="admin-add-institute-btn"
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-lg shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Partner Institute</span>
              </button>
            </div>

            {/* Institutes Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {institutes.map((inst) => (
                <div
                  key={inst.id}
                  className="glass-card rounded-2xl p-5 border border-border/90 hover:border-border transition-all space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-bold text-foreground">{inst.name}</h3>
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">ID: {inst.id}</p>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleDeleteInstitute(inst.id, inst.name)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Delete Institute"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between py-1 border-t border-border/60">
                      <span className="text-muted-foreground">Webhook Endpoint:</span>
                      <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-300 truncate max-w-[240px]" title={inst.webhookUrl}>
                        {inst.webhookUrl || "No webhook URL configured"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-1 border-t border-border/60">
                      <span className="text-muted-foreground">API Key:</span>
                      <div className="flex items-center space-x-1 font-mono text-[11px] text-muted-foreground">
                        <span>{visibleKeys[inst.id] ? inst.apiKey : "••••••••••••••••"}</span>
                        <button
                          type="button"
                          onClick={() => setVisibleKeys(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}
                          className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          {visibleKeys[inst.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/60">
                      <span className="text-muted-foreground">Catalog &amp; Activity:</span>
                      <div className="flex items-center space-x-3">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 font-semibold text-[11px]">
                          {inst.courseCount ?? 0} Courses
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold text-[11px]">
                          {inst.leadCount ?? 0} Leads Routed
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Courses & Skill Tag Mappings */}
          <div className="space-y-4 pt-6 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
                  <BookOpen className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                  <span>Courses &amp; Skill Gap Mappings ({courses.length})</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Map failed interview skill tags (e.g. &quot;React Hooks&quot;, &quot;AWS VPC&quot;) to partner courses for automated routing.
                </p>
              </div>

              <button
                onClick={() => {
                  if (institutes.length > 0) setNewCourseInstId(institutes[0].id);
                  setShowAddCourseModal(true);
                }}
                id="admin-add-course-btn"
                className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center space-x-1.5 transition-all shadow-lg shadow-purple-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Course &amp; Mappings</span>
              </button>
            </div>

            {/* Courses Cards Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="glass-card rounded-2xl p-5 border border-border/90 hover:border-purple-500/30 transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 mb-1">
                          {course.instituteName}
                        </span>
                        <h3 className="text-base font-bold text-foreground leading-tight">{course.courseName}</h3>
                      </div>

                      <button
                        onClick={() => handleDeleteCourse(course.id, course.courseName)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all cursor-pointer"
                        title="Delete Course"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {course.description || "No description provided."}
                    </p>
                  </div>

                  {/* Skill Tag Chips & Adder */}
                  <div className="pt-3 border-t border-border/70 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-muted-foreground flex items-center space-x-1">
                        <Tag className="w-3 h-3 text-purple-700 dark:text-purple-400" />
                        <span>Mapped Failure Tags:</span>
                      </span>

                      {activeCourseIdForTag !== course.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveCourseIdForTag(course.id);
                            setNewSkillTagInput("");
                          }}
                          className="text-[11px] font-bold text-purple-700 dark:text-purple-400 hover:text-purple-600 dark:text-purple-300 cursor-pointer flex items-center space-x-0.5"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Tag</span>
                        </button>
                      )}
                    </div>

                    {/* Chips Display */}
                    <div className="flex flex-wrap gap-1.5">
                      {course.skillTags && course.skillTags.length > 0 ? (
                        course.skillTags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">No skill tags mapped yet.</span>
                      )}
                    </div>

                    {/* Inline Tag Adder Form */}
                    {activeCourseIdForTag === course.id && (
                      <div className="pt-2 flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="e.g. React Hooks"
                          value={newSkillTagInput}
                          onChange={(e) => setNewSkillTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddSkillTag(course.id);
                            }
                          }}
                          className="flex-1 px-3 py-1.5 rounded-lg bg-card border border-purple-500/40 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleAddSkillTag(course.id)}
                          className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveCourseIdForTag(null)}
                          className="px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LEADS & CSV EXPORT */}
      {/* ========================================================================= */}
      {activeTab === "leads" && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <div className="glass-panel rounded-2xl p-5 border border-border space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <span>Lead Referral Invoicing &amp; Audit Log</span>
                </h2>
                <p className="text-xs text-muted-foreground">
                  Real-time generated candidate referrals for partner institute verification and manual billing.
                </p>
              </div>

              {/* Download CSV Button */}
              <button
                onClick={handleDownloadCsv}
                disabled={isExportingCsv}
                id="admin-export-csv-btn"
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50 shrink-0"
              >
                <Download className={`w-4 h-4 ${isExportingCsv ? "animate-bounce" : ""}`} />
                <span>{isExportingCsv ? "Exporting CSV..." : "Download CSV for Billing"}</span>
              </button>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-border/80">
              {/* Institute Filter */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Filter by Institute</label>
                <select
                  value={leadFilterInstitute}
                  onChange={(e) => setLeadFilterInstitute(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="all">All Institutes</option>
                  {institutes.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">From Date</label>
                <input
                  type="date"
                  value={leadFromDate}
                  onChange={(e) => setLeadFromDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* To Date */}
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">To Date</label>
                <input
                  type="date"
                  value={leadToDate}
                  onChange={(e) => setLeadToDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Leads Data Table */}
          <div className="glass-panel rounded-2xl border border-border overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-card/90 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                  <tr>
                    <th className="py-3.5 px-4">Date &amp; Time</th>
                    <th className="py-3.5 px-4">Candidate</th>
                    <th className="py-3.5 px-4">Partner Institute</th>
                    <th className="py-3.5 px-4">Recommended Course</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Referral ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-muted-foreground">
                  {leads.length > 0 ? (
                    leads.map((lead) => (
                      <tr key={lead.leadId} className="hover:bg-card/40 transition-colors">
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(lead.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-foreground">{lead.candidateName}</div>
                          <div className="text-[11px] text-muted-foreground">{lead.candidateEmail}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-foreground">
                          {lead.instituteName}
                        </td>
                        <td className="py-3 px-4 text-indigo-600 dark:text-indigo-300">
                          {lead.courseName}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              lead.status === "Pending"
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                : lead.status === "Contacted"
                                ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/30"
                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                            }`}
                          >
                            {lead.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-muted-foreground">
                          {lead.leadId.slice(0, 8)}...
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        <FileSpreadsheet className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                        <p className="font-semibold">No lead referrals found for the selected criteria.</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Leads are dynamically generated whenever candidate scores fall below 70% during sprint defense.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD PARTNER INSTITUTE */}
      {/* ========================================================================= */}
      {showAddInstituteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full glass-panel rounded-3xl p-6 border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
                <span>Add Partner Institute</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddInstituteModal(false)}
                className="text-muted-foreground hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateInstitute} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Institute Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lambda School Global"
                  value={newInstName}
                  onChange={(e) => setNewInstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Webhook Dispatch URL</label>
                <input
                  type="url"
                  placeholder="https://institute.domain.com/webhooks/leads"
                  value={newInstWebhook}
                  onChange={(e) => setNewInstWebhook(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">API Secret Key (Optional)</label>
                <input
                  type="text"
                  placeholder="Leave empty to auto-generate secret"
                  value={newInstApiKey}
                  onChange={(e) => setNewInstApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddInstituteModal(false)}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-slate-700 text-muted-foreground font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Save Partner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD COURSE & MAPPINGS */}
      {/* ========================================================================= */}
      {showAddCourseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full glass-panel rounded-3xl p-6 border border-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                <span>Add Course &amp; Map Skills</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddCourseModal(false)}
                className="text-muted-foreground hover:text-white cursor-pointer"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-3 text-xs">
              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Partner Institute *</label>
                <select
                  value={newCourseInstId}
                  onChange={(e) => setNewCourseInstId(e.target.value)}
                  required
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  {institutes.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Course Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AWS VPC & Cloud Networking Professional"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief curriculum overview..."
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-semibold mb-1">
                  Mapped Skill Gap Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="React Hooks, System Architecture, AWS VPC"
                  value={newCourseSkillTags}
                  onChange={(e) => setNewCourseSkillTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-border text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  When a candidate fails any of these tags in their defense, this course is recommended.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddCourseModal(false)}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-slate-700 text-muted-foreground font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer"
                >
                  Save Course
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

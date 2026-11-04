"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import {
  BarChart3,
  Building2,
  FileSpreadsheet,
  Users,
  Sparkles,
  Award,
  Plus,
  Trash2,
  Download,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Tag,
  RefreshCw,
  Eye,
  EyeOff,
  Send,
} from "lucide-react";
import { UserCog, ShieldCheck, X as CloseIcon, Pencil } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { Badge, Button, Card, EmptyState, Modal, PageHeader, ScrollArea, StatTile, Tabs } from "@/components/career/ui";
import StaffAccess from "@/components/institute/StaffAccess";
import AccessRequestsAdmin from "@/components/admin/AccessRequestsAdmin";
import PlatformSetupBanner from "@/components/admin/PlatformSetupBanner";
import { useGeo } from "@/context/GeoContext";
import { useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";

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
  const en = useEn();
  const { getToken } = useAuth();
  const { config } = useGeo();

  // Tab State
  const [activeTab, setActiveTab] = useState<"analytics" | "partners" | "leads" | "access">("analytics");
  // Staff access for one institute (its first admin, and everyone else), in a dialog
  const [staffFor, setStaffFor] = useState<Institute | null>(null);
  // Renaming an institute (or changing where its leads are sent), in a dialog; after saving, where the old name is still written
  const [editFor, setEditFor] = useState<Institute | null>(null);
  const [editName, setEditName] = useState("");
  const [editWebhook, setEditWebhook] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editResult, setEditResult] = useState<{ from: string; to: string; stillMentioned: string[] } | null>(null);

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
  const [newCourseSkillTags, setNewCourseSkillTags] = useState<string>("");

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
    } catch (err) {
      console.error("[ADMIN DASHBOARD ERROR]", err);
      setError("We couldn't load the overview. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customFetch, leadFilterInstitute, leadFromDate, leadToDate]);

  const loadDataRef = useLatestRef(loadData);
  useEffect(() => {
    loadDataRef.current();
  }, [loadData, loadDataRef]);

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
        showNotification(`Added partner institute "${newInstName}".`);
        setNewInstName("");
        setNewInstWebhook("");
        setNewInstApiKey("");
        setShowAddInstituteModal(false);
        loadData();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to create partner institute.");
      }
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (err as Error).message || "We couldn't create the institute. Please try again.");
    }
  };

  const openEdit = (inst: Institute) => {
    setEditFor(inst);
    setEditName(inst.name);
    setEditWebhook(inst.webhookUrl ?? "");
    setEditError(null);
    setEditResult(null);
  };

  const handleSaveInstitute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFor) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await customFetch(`/api/admin/institutes/${editFor.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: editName.trim(), webhookUrl: editWebhook.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setEditError(body?.error ?? "The institute couldn't be saved.");
        return;
      }
      loadData();
      if (body?.renamedFrom && body.stillMentioned?.length) {
        setEditResult({ from: body.renamedFrom, to: body.name, stillMentioned: body.stillMentioned });
      } else {
        setEditFor(null);
        showNotification(body?.renamedFrom ? `Renamed "${body.renamedFrom}" to "${body.name}".` : "Saved.");
      }
    } catch (err) {
      setEditError(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : "The institute couldn't be saved.");
    } finally {
      setEditBusy(false);
    }
  };

  // Handle Institute Deletion
  const handleDeleteInstitute = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove partner institute "${name}" and all its courses?`)) return;

    try {
      const res = await customFetch(`/api/admin/institutes/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification(`Removed partner institute "${name}".`);
        loadData();
      }
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (err as Error).message || "We couldn't delete the institute. Please try again.");
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
        showNotification(`Course "${newCourseName}" and ${tags.length} skills linked.`);
        setNewCourseName("");
        setNewCourseDesc("");
        setNewCourseSkillTags("");
        setShowAddCourseModal(false);
        loadData();
      }
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (err as Error).message || "We couldn't create the course. Please try again.");
    }
  };

  // Handle Course Deletion
  const handleDeleteCourse = async (id: string, courseName: string) => {
    if (!confirm(`Delete course "${courseName}" and its linked skills?`)) return;

    try {
      const res = await customFetch(`/api/admin/courses/${id}`, { method: "DELETE" });
      if (res.ok) {
        showNotification(`Course "${courseName}" deleted.`);
        loadData();
      }
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (err as Error).message || "We couldn't delete the course. Please try again.");
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
        showNotification(`Added skill "${newSkillTagInput.trim()}" to the course.`);
        setNewSkillTagInput("");
        setActiveCourseIdForTag(null);
        loadData();
      }
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (err as Error).message || "We couldn't add the skill. Please try again.");
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

      showNotification("CSV downloaded.");
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (err as Error).message || "We couldn't create the export. Please try again.");
    } finally {
      setIsExportingCsv(false);
    }
  };

  const inputCls =
    "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none";
  const labelCls = "mb-1 block text-sm font-medium text-foreground";
  const iconBtnCls =
    "inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {actionMessage && (
        <div role="status" className="fixed bottom-6 end-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 shadow-lg dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          <span>{actionMessage}</span>
        </div>
      )}

      <PlatformSetupBanner />

      {/* Global Error Banner */}
      {error && (
        <div role="alert" className="flex items-start justify-between gap-3 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-sm font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <PageHeader
        title="Overview"
        description="People, schools and courses across Edulexa, and the requests waiting for you."
        actions={
          <Button
            variant="secondary"
            id="admin-refresh-btn"
            busy={refreshing}
            onClick={() => {
              setRefreshing(true);
              loadData();
            }}
          >
            {!refreshing && <RefreshCw aria-hidden="true" className="h-4 w-4" />}
            Refresh
          </Button>
        }
      />
      <Tabs
        label="Overview sections"
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { id: "analytics", label: "Analytics", icon: <BarChart3 /> },
          { id: "partners", label: "Partners and courses", icon: <Building2 /> },
          { id: "leads", label: "Leads", count: leads.length, icon: <FileSpreadsheet /> },
          { id: "access", label: "Access requests", icon: <ShieldCheck /> },
        ]}
      />
      {/* ========================================================================= */}
      {/* TAB 1: ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile icon={<Users />} label="People" value={analytics?.totalUsers ?? (loading ? "…" : 0)} hint="Candidate and engineer accounts" />
            <StatTile icon={<Sparkles />} label="Pro subscriptions" value={analytics?.activeProSubscriptions ?? (loading ? "…" : 0)} hint="Active paid plans" />
            <StatTile icon={<Send />} label="Course referrals" value={analytics?.totalLeadsGenerated ?? (loading ? "…" : 0)} hint="Candidates referred to a course for a skill gap" />
            <StatTile icon={<Building2 />} label="Partner schools" value={analytics?.totalInstitutes ?? (loading ? "…" : 0)} hint="Schools and bootcamps connected" />
            <StatTile icon={<BookOpen />} label="Courses" value={analytics?.totalCourses ?? (loading ? "…" : 0)} hint="Matched to the skills people miss" />
            <StatTile icon={<Award />} label="Credentials issued" value={analytics?.totalCredentials ?? (loading ? "…" : 0)} hint="Each one can be verified online" />
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
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Partner institutes ({institutes.length})</h2>
                <p className="text-sm text-muted-foreground">Education providers who receive interested learners as leads.</p>
              </div>

              <Button onClick={() => setShowAddInstituteModal(true)} id="admin-add-institute-btn">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add partner institute
              </Button>
            </div>

            {/* Institutes Grid */}
            {institutes.length === 0 && !loading ? (
              <EmptyState title="No partner institutes yet">Add a partner institute to start sending it leads.</EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {institutes.map((inst) => (
                  <div key={inst.id} className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-foreground">{inst.name}</h3>
                        <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">ID: {inst.id}</p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => openEdit(inst)} className={iconBtnCls} title="Rename this institute or change where its leads are sent">
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          <span>Edit</span>
                        </button>
                        <button type="button" onClick={() => setStaffFor(inst)} className={iconBtnCls} title="Invite this institute's admin and staff">
                          <UserCog className="h-4 w-4" aria-hidden="true" />
                          <span>Staff access</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteInstitute(inst.id, inst.name)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="Delete institute"
                          aria-label={`Delete institute ${inst.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <dl className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-3 border-t border-border py-1.5">
                        <dt className="shrink-0 text-muted-foreground">Lead delivery address</dt>
                        <dd className="min-w-0 truncate font-mono text-xs text-foreground" title={inst.webhookUrl}>
                          {inst.webhookUrl || "Not set up"}
                        </dd>
                      </div>

                      <div className="flex items-center justify-between gap-3 border-t border-border py-1.5">
                        <dt className="shrink-0 text-muted-foreground">Access key</dt>
                        <dd className="flex min-w-0 items-center gap-1 font-mono text-xs text-foreground">
                          <span className="truncate">{visibleKeys[inst.id] ? inst.apiKey : "••••••••••••••••"}</span>
                          <button
                            type="button"
                            onClick={() => setVisibleKeys(prev => ({ ...prev, [inst.id]: !prev[inst.id] }))}
                            className="rounded p-1 text-muted-foreground hover:text-foreground"
                            aria-label={visibleKeys[inst.id] ? "Hide access key" : "Show access key"}
                          >
                            {visibleKeys[inst.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        </dd>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-1.5">
                        <dt className="text-muted-foreground">Catalog and activity</dt>
                        <dd className="flex items-center gap-2">
                          <Badge>{inst.courseCount ?? 0} courses</Badge>
                          <Badge>{inst.leadCount ?? 0} leads sent</Badge>
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Courses & Skill Tag Mappings */}
          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Courses and skill gaps ({courses.length})</h2>
                <p className="text-sm text-muted-foreground">
                  Link the skills candidates miss in interviews (e.g. &quot;React Hooks&quot;, &quot;AWS VPC&quot;) to partner courses, so the right course is recommended.
                </p>
              </div>

              <Button
                variant="secondary"
                onClick={() => {
                  if (institutes.length > 0) setNewCourseInstId(institutes[0].id);
                  setShowAddCourseModal(true);
                }}
                id="admin-add-course-btn"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add course
              </Button>
            </div>

            {/* Courses Cards Grid */}
            {courses.length === 0 && !loading ? (
              <EmptyState title="No courses yet">Add a course and the skills it teaches.</EmptyState>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {courses.map((course) => (
                  <div key={course.id} className="flex flex-col justify-between space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <Badge>{course.instituteName}</Badge>
                          <h3 className="text-base font-semibold leading-tight text-foreground">{course.courseName}</h3>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteCourse(course.id, course.courseName)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="Delete course"
                          aria-label={`Delete course ${course.courseName}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>

                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {course.description || "No description provided."}
                      </p>
                    </div>

                    {/* Skill Tag Chips & Adder */}
                    <div className="space-y-2 border-t border-border pt-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 font-medium text-muted-foreground">
                          <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                          Skill gaps this course covers
                        </span>

                        {activeCourseIdForTag !== course.id && (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCourseIdForTag(course.id);
                              setNewSkillTagInput("");
                            }}
                            className="flex items-center gap-0.5 text-xs font-medium text-indigo-700 hover:underline dark:text-indigo-400"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                            Add skill
                          </button>
                        )}
                      </div>

                      {/* Chips Display */}
                      <div className="flex flex-wrap gap-1.5">
                        {course.skillTags && course.skillTags.length > 0 ? (
                          course.skillTags.map((tag, idx) => <Badge key={idx}>{tag}</Badge>)
                        ) : (
                          <span className="text-xs text-muted-foreground">No skills linked yet.</span>
                        )}
                      </div>

                      {/* Inline Tag Adder Form */}
                      {activeCourseIdForTag === course.id && (
                        <div className="flex flex-wrap items-center gap-2 pt-2">
                          <input
                            type="text"
                            placeholder="e.g. React Hooks"
                            aria-label="Skill"
                            value={newSkillTagInput}
                            onChange={(e) => setNewSkillTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAddSkillTag(course.id);
                              }
                            }}
                            className={`${inputCls} min-w-0 flex-1`}
                            autoFocus
                          />
                          <Button type="button" onClick={() => handleAddSkillTag(course.id)}>
                            Save
                          </Button>
                          <Button type="button" variant="ghost" onClick={() => setActiveCourseIdForTag(null)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: ACCESS REQUESTS (recruiters) */}
      {/* ========================================================================= */}
      {activeTab === "access" && <AccessRequestsAdmin getToken={getToken} />}

      {editFor && (
        <Modal labelledBy="edit-dialog-title" onClose={() => setEditFor(null)}>
          <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="edit-dialog-title" className="text-lg font-semibold">
                {editResult ? "Renamed" : `Edit ${editFor.name}`}
              </h2>
              <button type="button" onClick={() => setEditFor(null)} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Close">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            {editResult ? (
              <div className="space-y-3 text-sm">
                <p>
                  {en("\"{from}\" is now \"{to}\" everywhere Edulexa shows the institute's name: the CRM, forms, reports, e-mails and the career centre.", { from: editResult.from, to: editResult.to })}
                </p>
                <p>The old name is still written in text the institute wrote itself. Change it there:</p>
                <ul className="list-disc space-y-1 ps-5">
                  {editResult.stillMentioned.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
                <div className="flex justify-end">
                  <Button type="button" onClick={() => setEditFor(null)}>
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveInstitute} className="space-y-4 text-sm">
                <div>
                  <label htmlFor="edit-inst-name" className={labelCls}>
                    Name
                  </label>
                  <input
                    id="edit-inst-name"
                    required
                    maxLength={200}
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">Shown to students, families and staff wherever the institute appears.</p>
                </div>
                <div>
                  <label htmlFor="edit-inst-webhook" className={labelCls}>
                    Lead delivery address
                  </label>
                  <input
                    id="edit-inst-webhook"
                    value={editWebhook}
                    onChange={(e) => setEditWebhook(e.target.value)}
                    className={`${inputCls} font-mono`}
                  />
                </div>
                {editError && (
                  <p role="alert" className="text-red-700 dark:text-red-400">
                    {editError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditFor(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" busy={editBusy} disabled={!editName.trim()}>
                    {editBusy ? "Saving…" : "Save"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {staffFor && (
        <Modal labelledBy="staff-dialog-title" onClose={() => setStaffFor(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="staff-dialog-title" className="text-lg font-semibold">Staff access: {staffFor.name}</h2>
                <p className="text-sm text-muted-foreground">Start with the institute admin; they can invite everyone else themselves.</p>
              </div>
              <button type="button" onClick={() => setStaffFor(null)} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Close">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <StaffAccess getToken={getToken} instituteId={staffFor.id} compact />
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LEADS & CSV EXPORT */}
      {/* ========================================================================= */}
      {activeTab === "leads" && (
        <div className="space-y-6">
          {/* Header & Filter Controls */}
          <Card
            title="Course referrals"
            actions={
              <Button variant="secondary" onClick={handleDownloadCsv} busy={isExportingCsv} id="admin-export-csv-btn">
                {!isExportingCsv && <Download className="h-4 w-4" aria-hidden="true" />}
                {isExportingCsv ? "Exporting…" : "Download CSV"}
              </Button>
            }
          >
            <p className="-mt-2 mb-4 text-sm text-muted-foreground">
              Candidates referred to partner courses, for partner checks and billing.
            </p>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-3">
              {/* Institute Filter */}
              <div>
                <label htmlFor="lead-filter-institute" className={labelCls}>Institute</label>
                <select
                  id="lead-filter-institute"
                  value={leadFilterInstitute}
                  onChange={(e) => setLeadFilterInstitute(e.target.value)}
                  className={inputCls}
                >
                  <option value="all">All institutes</option>
                  {institutes.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* From Date */}
              <div>
                <label htmlFor="lead-filter-from" className={labelCls}>From</label>
                <input
                  id="lead-filter-from"
                  type="date"
                  value={leadFromDate}
                  onChange={(e) => setLeadFromDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              {/* To Date */}
              <div>
                <label htmlFor="lead-filter-to" className={labelCls}>To</label>
                <input
                  id="lead-filter-to"
                  type="date"
                  value={leadToDate}
                  onChange={(e) => setLeadToDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </Card>

          {/* Leads Data Table */}
          {leads.length === 0 ? (
            <EmptyState title="No referrals match these filters">
              A referral is made when a candidate scores below 70% on a skill in a sprint review.
            </EmptyState>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <ScrollArea>
                <table className="w-full text-start text-sm">
                  <caption className="sr-only">Course referrals</caption>
                  <thead className="border-b border-border bg-muted/50 text-xs font-medium text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 text-start font-medium">Date and time</th>
                      <th className="px-4 py-3 text-start font-medium">Candidate</th>
                      <th className="px-4 py-3 text-start font-medium">Partner institute</th>
                      <th className="px-4 py-3 text-start font-medium">Recommended course</th>
                      <th className="px-4 py-3 text-start font-medium">Status</th>
                      <th className="px-4 py-3 text-start font-medium">Referral ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leads.map((lead) => (
                      <tr key={lead.leadId} className="transition-colors hover:bg-muted/40">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {new Date(lead.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{lead.candidateName}</div>
                          <div className="text-xs text-muted-foreground">{lead.candidateEmail}</div>
                        </td>
                        <td className="px-4 py-3 text-foreground">{lead.instituteName}</td>
                        <td className="px-4 py-3 text-foreground">{lead.courseName}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <Badge tone={lead.status === "Pending" ? "warn" : lead.status === "Contacted" ? "info" : "good"}>{lead.status}</Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground" title={lead.leadId}>
                          {lead.leadId.slice(0, 8)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD PARTNER INSTITUTE */}
      {/* ========================================================================= */}
      {showAddInstituteModal && (
        <Modal labelledBy="add-institute-title" onClose={() => setShowAddInstituteModal(false)}>
          <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="add-institute-title" className="text-lg font-semibold text-foreground">Add partner institute</h2>
              <button type="button" onClick={() => setShowAddInstituteModal(false)} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Close">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateInstitute} className="space-y-4 text-sm">
              <div>
                <label htmlFor="new-inst-name" className={labelCls}>Institute name</label>
                <input
                  id="new-inst-name"
                  type="text"
                  required
                  placeholder="e.g. Lambda School Global"
                  value={newInstName}
                  onChange={(e) => setNewInstName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="new-inst-webhook" className={labelCls}>Lead delivery address</label>
                <input
                  id="new-inst-webhook"
                  type="url"
                  placeholder="https://institute.example.com/webhooks/leads"
                  value={newInstWebhook}
                  onChange={(e) => setNewInstWebhook(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
                <p className="mt-1 text-xs text-muted-foreground">The web address where we send new leads.</p>
              </div>

              <div>
                <label htmlFor="new-inst-key" className={labelCls}>Access key (optional)</label>
                <input
                  id="new-inst-key"
                  type="text"
                  placeholder="Leave empty to generate one"
                  value={newInstApiKey}
                  onChange={(e) => setNewInstApiKey(e.target.value)}
                  className={`${inputCls} font-mono`}
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowAddInstituteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save partner</Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD COURSE & MAPPINGS */}
      {/* ========================================================================= */}
      {showAddCourseModal && (
        <Modal labelledBy="add-course-title" onClose={() => setShowAddCourseModal(false)}>
          <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <h2 id="add-course-title" className="text-lg font-semibold text-foreground">Add course</h2>
              <button type="button" onClick={() => setShowAddCourseModal(false)} className="rounded-lg p-1.5 hover:bg-muted" aria-label="Close">
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4 text-sm">
              <div>
                <label htmlFor="new-course-inst" className={labelCls}>Partner institute</label>
                <select
                  id="new-course-inst"
                  value={newCourseInstId}
                  onChange={(e) => setNewCourseInstId(e.target.value)}
                  required
                  className={inputCls}
                >
                  {institutes.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="new-course-name" className={labelCls}>Course title</label>
                <input
                  id="new-course-name"
                  type="text"
                  required
                  placeholder="e.g. AWS VPC and cloud networking"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="new-course-desc" className={labelCls}>Description</label>
                <textarea
                  id="new-course-desc"
                  rows={3}
                  placeholder="A short overview of what the course covers"
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label htmlFor="new-course-tags" className={labelCls}>Skill gaps (comma-separated)</label>
                <input
                  id="new-course-tags"
                  type="text"
                  placeholder="e.g. React Hooks, System Architecture, AWS VPC"
                  value={newCourseSkillTags}
                  onChange={(e) => setNewCourseSkillTags(e.target.value)}
                  className={inputCls}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  When a candidate misses one of these skills in a sprint review, this course is recommended.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="secondary" onClick={() => setShowAddCourseModal(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save course</Button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

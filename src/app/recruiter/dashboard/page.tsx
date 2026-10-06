"use client";

import React, { useState, useEffect } from "react";
import { 
  Briefcase, Users, ShieldAlert, ShieldCheck, Plus, 
  ExternalLink, Search, RefreshCw, KeyRound, Copy, Check,
  AlertTriangle, Sparkles, Filter, Code2, Award, Mic,
  FileText, CheckCircle2, Clock, Send, Layers, ArrowRight,
  Brain, ThumbsUp, ThumbsDown, CheckCheck, XCircle, X,
  MessageSquare, AlertCircle, HelpCircle, FileSearch, Target, Flame
} from "lucide-react";

interface TranscriptEntry {
  role: string;
  text: string;
  timestamp: string;
}

interface AiHiringVerdict {
  decision: string;
  recommendationTier: string;
  confidenceScore: number;
  hiringBarThreshold: number;
  executiveSummary: string;
  keyStrengths: string[];
  fatalDeficiencies: string[];
  antiCheatVerdict: string;
  corporateActionStatus: string;
  recruiterNotes?: string | null;
  decisionTimestamp: string;
  evaluatedByAiModel: string;
  transcriptLog: TranscriptEntry[];
}

interface ScrutinyFlaggedClaim {
  claim: string;
  severity: "HIGH" | "MEDIUM" | string;
  critique: string;
  interrogationQuestion: string;
}

interface ScrutinyResultData {
  candidateName: string;
  targetRole: string;
  summary: string;
  credibilityScore: number;
  flaggedClaims: ScrutinyFlaggedClaim[];
  buzzwordInflation: string[];
  technicalDeficiencies: string[];
  generatedAssessmentToken: string;
  tailoredWrittenFocus: string;
  tailoredCodingPrompt: string;
  tailoredVoiceDefenseQuestions: string[];
  [key: string]: any;
}

interface AssessmentBundle {
  token: string;
  candidateName: string;
  candidateEmail: string;
  targetRole: string;
  companyName: string;
  currentStage: number;
  overallStatus: string;
  corporateDecisionStatus?: string;
  examId: string;
  examTitle: string;
  examDurationMinutes: number;
  stage1Score?: number | null;
  sprintTitle: string;
  requiredLanguage: string;
  problemStatement: string;
  starterCode: string;
  stage2Score?: number | null;
  defenseTopic: string;
  defenseVoice: string;
  stage3Score?: number | null;
  compositeScore?: number | null;
  certificateNumber?: string | null;
  verificationSignatureSha256?: string | null;
  aiVerdict?: AiHiringVerdict | null;
  createdAt: string;
  completedAt?: string | null;
}

export default function RecruiterDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [bundles, setBundles] = useState<AssessmentBundle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingBundles, setLoadingBundles] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"bundles" | "challenges">("bundles");

  // Challenge Modal State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Challenge Form State
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newLanguage, setNewLanguage] = useState("python");
  const [newCompany, setNewCompany] = useState("Uber");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  // Bundle Modal & Form State
  const [showBundleModal, setShowBundleModal] = useState<boolean>(false);
  const [bundleCandidateName, setBundleCandidateName] = useState("");
  const [bundleCandidateEmail, setBundleCandidateEmail] = useState("");
  const [bundleTargetRole, setBundleTargetRole] = useState("Senior Distributed Systems Engineer");
  const [bundleCompany, setBundleCompany] = useState("Uber");
  const [bundleExamId, setBundleExamId] = useState("swe-core-systems");
  const [bundleLanguage, setBundleLanguage] = useState("typescript");
  const [bundleDefenseTopic, setBundleDefenseTopic] = useState("Architectural pushback: Defend your partition rebalancing latency vs consistency model.");
  const [bundleStatus, setBundleStatus] = useState<string | null>(null);
  const [bundleCreatedData, setBundleCreatedData] = useState<any>(null);

  // AI Deep Resume Scrutiny State
  const [showScrutinyModal, setShowScrutinyModal] = useState<boolean>(false);
  const [scrutinyResumeText, setScrutinyResumeText] = useState<string>("");
  const [scrutinyCandidateName, setScrutinyCandidateName] = useState<string>("");
  const [scrutinyTargetRole, setScrutinyTargetRole] = useState<string>("Staff Distributed Systems Engineer");
  const [scrutinyTargetCompany, setScrutinyTargetCompany] = useState<string>("Uber");
  const [scrutinyYearsExp, setScrutinyYearsExp] = useState<number>(6);
  const [scrutinyResult, setScrutinyResult] = useState<ScrutinyResultData | null>(null);
  const [scrutinyLoading, setScrutinyLoading] = useState<boolean>(false);

  // AI Decision Filters & Audit Modal State
  const [decisionFilter, setDecisionFilter] = useState<"ALL" | "SELECTED" | "DESELECTED" | "OFFER_EXTENDED" | "IN_PROGRESS">("ALL");
  const [selectedBundleForAudit, setSelectedBundleForAudit] = useState<AssessmentBundle | null>(null);
  const [recruiterActionNotes, setRecruiterActionNotes] = useState<string>("");
  const [recruiterActionSubmitting, setRecruiterActionSubmitting] = useState<boolean>(false);
  const [recruiterActionToast, setRecruiterActionToast] = useState<string | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/recruiter/candidates?companyId=Uber`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("[RECRUITER DASHBOARD ERROR]:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchBundles = async () => {
    setLoadingBundles(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/recruiter/assessments/bundles`);
      if (res.ok) {
        const json = await res.json();
        setBundles(json);
      }
    } catch (e) {
      console.error("[RECRUITER BUNDLES ERROR]:", e);
    } finally {
      setLoadingBundles(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    fetchBundles();
  }, []);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStatus("Creating private challenge...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/recruiter/sprint/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDescription,
          requiredLanguage: newLanguage,
          companyId: newCompany,
          inviteCode: newInviteCode || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setCreateStatus(`Created! Invite Code: ${created.inviteCode}`);
        setTimeout(() => {
          setShowCreateModal(false);
          setCreateStatus(null);
          setNewTitle("");
          setNewDescription("");
          setNewInviteCode("");
          fetchCandidates();
        }, 2000);
      } else {
        setCreateStatus("Failed to create challenge.");
      }
    } catch (e) {
      setCreateStatus("Network error occurred.");
    }
  };

  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBundleStatus("Generating 3-Stage Assessment Bundle...");
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/recruiter/assessments/bundle/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: bundleCandidateName,
          candidateEmail: bundleCandidateEmail,
          targetRole: bundleTargetRole,
          companyName: bundleCompany,
          examId: bundleExamId,
          requiredLanguage: bundleLanguage,
          defenseTopic: bundleDefenseTopic
        }),
      });

      if (res.ok) {
        const result = await res.json();
        setBundleCreatedData(result);
        setBundleStatus(null);
        fetchBundles();
      } else {
        setBundleStatus("Failed to generate assessment bundle.");
      }
    } catch (e) {
      setBundleStatus("Network error occurred.");
    }
  };

  const handleRunDeepScrutiny = async (e: React.FormEvent) => {
    e.preventDefault();
    setScrutinyLoading(true);
    setScrutinyResult(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/resume/deep-scrutiny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: scrutinyResumeText,
          candidateName: scrutinyCandidateName || undefined,
          targetRole: scrutinyTargetRole || undefined,
          targetCompany: scrutinyTargetCompany || undefined,
          yearsOfExperience: Number(scrutinyYearsExp) || 5,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setScrutinyResult(json);
        fetchBundles();
      }
    } catch (err) {
      console.error("[DEEP SCRUTINY ERROR]:", err);
    } finally {
      setScrutinyLoading(false);
    }
  };

  const handleCopyInvite = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyBundleUrl = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    const fullUrl = `${origin}/assessment/${token}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleRecruiterAction = async (action: string) => {
    if (!selectedBundleForAudit) return;
    setRecruiterActionSubmitting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/recruiter/assessments/bundle/${selectedBundleForAudit.token}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: recruiterActionNotes || undefined,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setRecruiterActionToast(`Action Applied: ${action.replace("_", " ")}`);
        if (json.bundle) {
          setSelectedBundleForAudit(json.bundle);
        }
        setRecruiterActionNotes("");
        fetchBundles();
        setTimeout(() => setRecruiterActionToast(null), 3000);
      }
    } catch (e) {
      console.error("Failed to execute recruiter action:", e);
    } finally {
      setRecruiterActionSubmitting(false);
    }
  };

  const candidates = data?.candidates || [
    {
      submissionId: "sub-demo-1",
      candidateName: "Sarah Chen",
      candidateEmail: "sarah.chen@example.com",
      sprintTitle: "Uber Rideshare Geohash Routing Engine Challenge",
      status: "Completed",
      antiCheat: {
        verificationFlagged: false,
        suspectedAi: false,
        suspectedPasting: false,
        flagReason: null,
      },
      evaluation: {
        finalScore: 92.0,
        publicUrlSlug: "cred-sarah-chen-9921",
      },
    },
    {
      submissionId: "sub-demo-2",
      candidateName: "Devon Miller",
      candidateEmail: "devon.m@example.com",
      sprintTitle: "Uber Rideshare Geohash Routing Engine Challenge",
      status: "Completed",
      antiCheat: {
        verificationFlagged: true,
        suspectedAi: true,
        suspectedPasting: true,
        flagReason: "Generative AI conversational watermark and rapid paste velocity detected.",
      },
      evaluation: {
        finalScore: 84.5,
        publicUrlSlug: "cred-devon-miller-4412",
      },
    },
  ];

  const totalApplicants = data?.totalApplicants ?? candidates.length;
  const flaggedCount = data?.flaggedCount ?? candidates.filter((c: any) => c.antiCheat.verificationFlagged).length;
  const cleanCount = totalApplicants - flaggedCount;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Navigation */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Corporate Recruiter Portal</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
                  UBER HIRING PIPELINE
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-foreground mt-0.5">
                Technical Hiring Command &amp; Assessment Suites
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                setScrutinyResult(null);
                setScrutinyResumeText("Alex Rivera, Senior Distributed Systems Engineer\n- Architected Kafka event streaming microservices handling 150k msg/sec at Uber Freight.\n- Optimized PostgreSQL query execution and connection pooling, reducing P99 latency by 45%.\n- Designed Redis cache-aside tier with cluster replication for high-throughput dispatch engine.\n- Deployed containerized microservices with Kubernetes, Docker, and Terraform on AWS.");
                setScrutinyCandidateName("Alex Rivera");
                setScrutinyTargetRole("Staff Distributed Systems Engineer");
                setScrutinyTargetCompany("Uber");
                setScrutinyYearsExp(7);
                setShowScrutinyModal(true);
              }}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-xs font-bold text-white flex items-center space-x-2 transition-all shadow-lg shadow-rose-600/25 cursor-pointer"
            >
              <FileSearch className="w-4 h-4 text-amber-200" />
              <span>AI Resume Scrutiny &amp; Auto-Tailor</span>
            </button>

            <button
              onClick={() => {
                setBundleCreatedData(null);
                setBundleCandidateName("");
                setBundleCandidateEmail("");
                setShowBundleModal(true);
              }}
              className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-xs font-bold text-white flex items-center space-x-2 transition-all shadow-lg shadow-indigo-600/25 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Generate 3-Stage Assessment</span>
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="py-2.5 px-4 rounded-xl bg-card hover:bg-muted border border-border text-xs font-bold text-foreground flex items-center space-x-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>New Challenge</span>
            </button>

            <button
              onClick={() => {
                fetchCandidates();
                fetchBundles();
              }}
              className="py-2.5 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-medium text-muted-foreground flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingBundles ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">AI Selected (Recommend Hire)</span>
              <ThumbsUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
              {bundles.filter(b => b.corporateDecisionStatus === "AI_SELECTED" || b.aiVerdict?.decision === "SELECTED" || b.corporateDecisionStatus === "OFFER_EXTENDED").length}
            </div>
            <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">
              Met or exceeded corporate hiring bar
            </span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-rose-500/20 bg-rose-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">AI Deselected (Failed Bar)</span>
              <ThumbsDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-3xl font-extrabold text-rose-600 dark:text-rose-400 mt-2">
              {bundles.filter(b => b.corporateDecisionStatus === "AI_DESELECTED" || b.aiVerdict?.decision === "DESELECTED" || b.corporateDecisionStatus === "REJECTION_ISSUED").length}
            </div>
            <span className="text-[11px] text-rose-600/80 dark:text-rose-400/80 mt-1 block">
              Below competency threshold / red flags
            </span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-indigo-500/20 bg-indigo-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Offers Extended</span>
              <Award className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
              {bundles.filter(b => b.corporateDecisionStatus === "OFFER_EXTENDED" || b.aiVerdict?.corporateActionStatus === "OFFER_EXTENDED").length}
            </div>
            <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-1 block">
              Recruiter accepted AI recommendation
            </span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">In-Flight AI Interviews</span>
              <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-2">
              {bundles.filter(b => b.overallStatus !== "Completed").length}
            </div>
            <span className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1 block">
              Candidate currently in assessment pipeline
            </span>
          </div>
        </div>

        {/* Toast Notification */}
        {recruiterActionToast && (
          <div className="fixed top-20 right-6 z-50 bg-card border border-indigo-500/50 text-foreground px-4 py-3 rounded-2xl shadow-xl flex items-center space-x-2 animate-in slide-in-from-top-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-bold">{recruiterActionToast}</span>
          </div>
        )}

        {/* Tab Navigation Switcher */}
        <div className="flex items-center space-x-2 border-b border-border pb-3">
          <button
            onClick={() => setActiveTab("bundles")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "bundles"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-card text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Autonomous AI Assessment Pipeline ({bundles.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("challenges")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 cursor-pointer ${
              activeTab === "challenges"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-card text-muted-foreground hover:text-foreground border border-border"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Sprint Coding Submissions &amp; Anti-Cheat ({candidates.length})</span>
          </button>
        </div>

        {/* Tab 1: 3-Stage Assessment Bundles */}
        {activeTab === "bundles" && (
          <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                  <span>Autonomous AI Corporate Interview Pipeline</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                    AI Autonomous Hiring Bar &amp; Selection Engine
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  AI autonomously interviews candidates via voice defense and selects or deselects based on verified technical competence.
                </p>
              </div>

              <button
                onClick={() => {
                  setBundleCreatedData(null);
                  setShowBundleModal(true);
                }}
                className="py-2 px-3 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 text-xs font-bold flex items-center space-x-1.5 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Invite New Candidate</span>
              </button>
            </div>

            {/* Filter Pills Bar */}
            <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
              <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center space-x-1">
                <Filter className="w-3 h-3" />
                <span>Filter By AI Verdict:</span>
              </span>
              {[
                { id: "ALL", label: `All Candidates (${bundles.length})` },
                { id: "SELECTED", label: `✅ AI Selected (${bundles.filter(b => b.corporateDecisionStatus === "AI_SELECTED" || b.aiVerdict?.decision === "SELECTED" || b.corporateDecisionStatus === "OFFER_EXTENDED").length})` },
                { id: "DESELECTED", label: `❌ AI Deselected (${bundles.filter(b => b.corporateDecisionStatus === "AI_DESELECTED" || b.aiVerdict?.decision === "DESELECTED" || b.corporateDecisionStatus === "REJECTION_ISSUED").length})` },
                { id: "OFFER_EXTENDED", label: `🎉 Offer Extended (${bundles.filter(b => b.corporateDecisionStatus === "OFFER_EXTENDED").length})` },
                { id: "IN_PROGRESS", label: `⏳ In-Flight (${bundles.filter(b => b.overallStatus !== "Completed").length})` },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setDecisionFilter(pill.id as any)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    decisionFilter === pill.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-card text-muted-foreground hover:text-foreground border border-border"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-muted-foreground">
                <thead className="bg-card/80 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Candidate &amp; Role</th>
                    <th className="py-3 px-4">Diagnostics (1 / 2 / 3)</th>
                    <th className="py-3 px-4">Autonomous AI Hiring Verdict</th>
                    <th className="py-3 px-4">Corporate Status</th>
                    <th className="py-3 px-4">Composite</th>
                    <th className="py-3 px-4 text-right">Actions &amp; AI Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {bundles.filter(bundle => {
                    if (decisionFilter === "ALL") return true;
                    if (decisionFilter === "SELECTED") return bundle.corporateDecisionStatus === "AI_SELECTED" || bundle.aiVerdict?.decision === "SELECTED" || bundle.corporateDecisionStatus === "OFFER_EXTENDED";
                    if (decisionFilter === "DESELECTED") return bundle.corporateDecisionStatus === "AI_DESELECTED" || bundle.aiVerdict?.decision === "DESELECTED" || bundle.corporateDecisionStatus === "REJECTION_ISSUED";
                    if (decisionFilter === "OFFER_EXTENDED") return bundle.corporateDecisionStatus === "OFFER_EXTENDED";
                    if (decisionFilter === "IN_PROGRESS") return bundle.overallStatus !== "Completed";
                    return true;
                  }).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No candidates match the selected AI verdict filter.
                      </td>
                    </tr>
                  ) : (
                    bundles
                      .filter(bundle => {
                        if (decisionFilter === "ALL") return true;
                        if (decisionFilter === "SELECTED") return bundle.corporateDecisionStatus === "AI_SELECTED" || bundle.aiVerdict?.decision === "SELECTED" || bundle.corporateDecisionStatus === "OFFER_EXTENDED";
                        if (decisionFilter === "DESELECTED") return bundle.corporateDecisionStatus === "AI_DESELECTED" || bundle.aiVerdict?.decision === "DESELECTED" || bundle.corporateDecisionStatus === "REJECTION_ISSUED";
                        if (decisionFilter === "OFFER_EXTENDED") return bundle.corporateDecisionStatus === "OFFER_EXTENDED";
                        if (decisionFilter === "IN_PROGRESS") return bundle.overallStatus !== "Completed";
                        return true;
                      })
                      .map((bundle) => {
                        const isCompleted = bundle.overallStatus === "Completed";
                        const isSelected = bundle.corporateDecisionStatus === "AI_SELECTED" || bundle.aiVerdict?.decision === "SELECTED" || bundle.corporateDecisionStatus === "OFFER_EXTENDED";
                        const isDeselected = bundle.corporateDecisionStatus === "AI_DESELECTED" || bundle.aiVerdict?.decision === "DESELECTED" || bundle.corporateDecisionStatus === "REJECTION_ISSUED";
                        const isOfferExtended = bundle.corporateDecisionStatus === "OFFER_EXTENDED";
                        const isRejectionIssued = bundle.corporateDecisionStatus === "REJECTION_ISSUED";

                        return (
                          <tr key={bundle.token} className="hover:bg-card/40 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-foreground">{bundle.candidateName}</div>
                              <div className="font-mono text-[11px] text-muted-foreground">{bundle.candidateEmail}</div>
                              <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium">
                                {bundle.targetRole} • {bundle.companyName}
                              </div>
                            </td>

                            {/* Stage Diagnostics */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center space-x-2 text-[11px] font-mono">
                                <span title="Written Exam" className={bundle.stage1Score ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground"}>
                                  W: {bundle.stage1Score ?? "--"}%
                                </span>
                                <span className="text-border">|</span>
                                <span title="Coding Sprint" className={bundle.stage2Score ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-muted-foreground"}>
                                  C: {bundle.stage2Score ?? "--"}%
                                </span>
                                <span className="text-border">|</span>
                                <span title="AI Voice Defense" className={bundle.stage3Score ? "text-purple-600 dark:text-purple-400 font-bold" : "text-muted-foreground"}>
                                  V: {bundle.stage3Score ?? "--"}%
                                </span>
                              </div>
                              <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[140px]" title={bundle.examTitle}>
                                {bundle.examTitle}
                              </div>
                            </td>

                            {/* Autonomous AI Hiring Verdict */}
                            <td className="py-3.5 px-4">
                              {bundle.aiVerdict ? (
                                bundle.aiVerdict.decision === "SELECTED" ? (
                                  <div className="space-y-1">
                                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1.5 w-fit">
                                      <ThumbsUp className="w-3 h-3 text-emerald-500" />
                                      <span>SELECTED • {bundle.aiVerdict.recommendationTier.replace("_", " ")}</span>
                                    </span>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      {bundle.aiVerdict.confidenceScore}% AI Confidence • Threshold {bundle.aiVerdict.hiringBarThreshold}%
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <span className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold flex items-center space-x-1.5 w-fit ${
                                      bundle.aiVerdict.recommendationTier === "DISQUALIFIED"
                                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                    }`}>
                                      <ThumbsDown className="w-3 h-3" />
                                      <span>{bundle.aiVerdict.recommendationTier === "DISQUALIFIED" ? "DISQUALIFIED • SUSPECTED FRAUD" : `DESELECTED • ${bundle.aiVerdict.recommendationTier.replace("_", " ")}`}</span>
                                    </span>
                                    <div className="text-[10px] text-muted-foreground font-mono">
                                      {bundle.aiVerdict.confidenceScore}% AI Confidence • Threshold {bundle.aiVerdict.hiringBarThreshold}%
                                    </div>
                                  </div>
                                )
                              ) : (
                                <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center space-x-1.5 w-fit">
                                  <Clock className="w-3 h-3" />
                                  <span>Interview In-Flight (Stage {bundle.currentStage}/3)</span>
                                </span>
                              )}
                            </td>

                            {/* Corporate Status */}
                            <td className="py-3.5 px-4">
                              {isOfferExtended ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 w-fit">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Offer Extended</span>
                                </span>
                              ) : isRejectionIssued ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground border border-border flex items-center space-x-1 w-fit">
                                  <XCircle className="w-3 h-3" />
                                  <span>Rejection Sent</span>
                                </span>
                              ) : bundle.aiVerdict ? (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center space-x-1 w-fit">
                                  <AlertCircle className="w-3 h-3" />
                                  <span>Review AI Verdict</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground font-mono">In Progress</span>
                              )}
                            </td>

                            {/* Composite */}
                            <td className="py-3.5 px-4">
                              {isCompleted ? (
                                <div>
                                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold border ${
                                    isSelected
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                                  }`}>
                                    {bundle.compositeScore}%
                                  </span>
                                  {bundle.certificateNumber && (
                                    <div className="font-mono text-[9px] text-muted-foreground mt-1 truncate max-w-[95px]" title={bundle.certificateNumber}>
                                      {bundle.certificateNumber}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">--</span>
                              )}
                            </td>

                            {/* Actions & AI Audit */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {bundle.aiVerdict && (
                                  <button
                                    onClick={() => setSelectedBundleForAudit(bundle)}
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-xs"
                                    title="Open Deep AI Hiring Audit & Feedback"
                                  >
                                    <Brain className="w-3.5 h-3.5" />
                                    <span>Audit AI Verdict</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleCopyBundleUrl(bundle.token)}
                                  title="Copy Candidate Invite URL"
                                  className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-medium text-foreground flex items-center space-x-1 cursor-pointer transition-colors"
                                >
                                  {copiedToken === bundle.token ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-500">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3 text-muted-foreground" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>

                                <a
                                  href={`/assessment/${bundle.token}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border text-[11px] font-medium flex items-center space-x-1 cursor-pointer transition-colors"
                                  title="Open Candidate Assessment Sandbox"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Existing Sprint Submissions & Anti-Cheat Review */}
        {activeTab === "challenges" && (
          <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Corporate Applicant Pipeline</h2>
                <p className="text-xs text-muted-foreground">Review candidate sprint scores, project work, and anti-cheat integrity flags.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-muted-foreground">
                <thead className="bg-card/80 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Corporate Challenge</th>
                    <th className="py-3 px-4">Defense Score</th>
                    <th className="py-3 px-4">Anti-Cheat Audit</th>
                    <th className="py-3 px-4 text-right">Verifiable Badge</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {candidates.map((cand: any, idx: number) => (
                    <tr key={idx} className="hover:bg-card/40 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">{cand.candidateName}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">{cand.candidateEmail}</div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground max-w-xs truncate">
                        {cand.sprintTitle}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-indigo-700 dark:text-indigo-400">
                        {cand.evaluation?.finalScore ? `${cand.evaluation.finalScore}%` : "Pending"}
                      </td>
                      <td className="py-3.5 px-4">
                        {cand.antiCheat?.verificationFlagged ? (
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Flagged (AI / Bulk Paste)</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verified Clean</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {cand.evaluation?.publicUrlSlug ? (
                          <a
                            href={`/credential/${cand.evaluation.publicUrlSlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 text-indigo-700 dark:text-indigo-400 hover:text-indigo-600 dark:text-indigo-300 font-medium"
                          >
                            <span>View Seal</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">No Credential</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal 1: Generate 3-Stage Assessment Bundle */}
      {showBundleModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl p-6 max-w-lg w-full border border-indigo-500/30 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Generate 3-Stage Assessment Bundle</span>
              </h3>
              <button
                onClick={() => setShowBundleModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            {bundleCreatedData ? (
              <div className="space-y-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                  <h4 className="font-extrabold text-foreground text-sm">3-Stage Assessment Bundle Created!</h4>
                  <p className="text-xs text-muted-foreground">
                    Candidate <strong className="text-foreground">{bundleCreatedData.candidateName}</strong> is ready to be invited.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-card border border-border space-y-2">
                  <div className="text-[11px] font-semibold text-muted-foreground">Direct Candidate Invite Link:</div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={typeof window !== "undefined" ? `${window.location.origin}/assessment/${bundleCreatedData.token}` : `/assessment/${bundleCreatedData.token}`}
                      className="w-full bg-muted/60 border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopyBundleUrl(bundleCreatedData.token)}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer shrink-0"
                    >
                      {copiedToken === bundleCreatedData.token ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken === bundleCreatedData.token ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-3 pt-2">
                  <a
                    href={`/assessment/${bundleCreatedData.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs text-center flex items-center justify-center space-x-1.5 cursor-pointer shadow-lg shadow-indigo-600/25"
                  >
                    <span>Test Candidate Flow</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => {
                      setShowBundleModal(false);
                      setBundleCreatedData(null);
                    }}
                    className="py-2.5 px-4 rounded-xl bg-card hover:bg-muted text-muted-foreground font-medium text-xs border border-border cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateBundle} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Candidate Full Name</label>
                    <input
                      type="text"
                      value={bundleCandidateName}
                      onChange={(e) => setBundleCandidateName(e.target.value)}
                      placeholder="e.g. Jordan Lee"
                      required
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Candidate Email</label>
                    <input
                      type="email"
                      value={bundleCandidateEmail}
                      onChange={(e) => setBundleCandidateEmail(e.target.value)}
                      placeholder="e.g. jordan@example.com"
                      required
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Target Role Title</label>
                    <input
                      type="text"
                      value={bundleTargetRole}
                      onChange={(e) => setBundleTargetRole(e.target.value)}
                      placeholder="e.g. Senior Distributed Systems Engineer"
                      required
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Company / Team</label>
                    <input
                      type="text"
                      value={bundleCompany}
                      onChange={(e) => setBundleCompany(e.target.value)}
                      placeholder="e.g. Uber"
                      required
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Stage 1: Diagnostic Written Exam</label>
                  <select
                    value={bundleExamId}
                    onChange={(e) => setBundleExamId(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                  >
                    <option value="swe-core-systems">Software Engineering &amp; Distributed Systems Diagnostic (20 min)</option>
                    <option value="algorithms-dsa">Algorithmic Problem Solving &amp; Data Structures (20 min)</option>
                    <option value="fullstack-arch">Full Stack Web Architecture &amp; React/Node.js Diagnostic (20 min)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Stage 2: Code Sprint Language</label>
                  <select
                    value={bundleLanguage}
                    onChange={(e) => setBundleLanguage(e.target.value)}
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                  >
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="csharp">C# (.NET)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Stage 3: AI Voice Defense Topic</label>
                  <textarea
                    value={bundleDefenseTopic}
                    onChange={(e) => setBundleDefenseTopic(e.target.value)}
                    rows={2}
                    required
                    className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {bundleStatus && (
                  <div className="text-[11px] font-mono text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/30">
                    {bundleStatus}
                  </div>
                )}

                <div className="flex items-center space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBundleModal(false)}
                    className="flex-1 py-2 px-3 rounded-xl bg-card hover:bg-muted text-muted-foreground font-medium text-xs border border-border cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-indigo-600/25"
                  >
                    Generate &amp; Get Link
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Modal 2: Create Corporate Challenge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl p-6 max-w-md w-full border border-indigo-500/30 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                <Code2 className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
                <span>Create Corporate Challenge</span>
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChallenge} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Company / Team Name</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Uber"
                  required
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Challenge Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Real-Time Geospatial Driver Dispatcher"
                  required
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Language</label>
                <select
                  value={newLanguage}
                  onChange={(e) => setNewLanguage(e.target.value)}
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                >
                  <option value="python">Python</option>
                  <option value="csharp">C# (.NET)</option>
                  <option value="typescript">TypeScript</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Technical Problem Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe technical constraints, architecture expectations, and defense criteria..."
                  rows={3}
                  required
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Custom Invite Code (Optional)</label>
                <input
                  type="text"
                  value={newInviteCode}
                  onChange={(e) => setNewInviteCode(e.target.value)}
                  placeholder="e.g. UBER-GEO-2026 (Auto-generated if blank)"
                  className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {createStatus && (
                <div className="text-[11px] font-mono text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/30">
                  {createStatus}
                </div>
              )}

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 px-3 rounded-xl bg-card hover:bg-muted text-muted-foreground font-medium text-xs border border-border cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-indigo-600/25"
                >
                  Create &amp; Launch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: AI Resume Scrutiny & Auto-Tailor */}
      {showScrutinyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-card/90 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-foreground">AI Resume Scrutiny &amp; Precision Tailor</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      GPT-4o Deep Claim Verification
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Exposes inflated claims, detects buzzword fluff, and auto-generates custom 3-stage assessments
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScrutinyModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold cursor-pointer p-1.5 rounded-xl hover:bg-muted"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-6 space-y-6 flex-1">
              {/* Input Form */}
              <form onSubmit={handleRunDeepScrutiny} className="p-5 rounded-2xl bg-muted/30 border border-border space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Candidate Name</label>
                    <input
                      type="text"
                      value={scrutinyCandidateName}
                      onChange={(e) => setScrutinyCandidateName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Target Role</label>
                    <input
                      type="text"
                      value={scrutinyTargetRole}
                      onChange={(e) => setScrutinyTargetRole(e.target.value)}
                      placeholder="e.g. Staff Distributed Systems Engineer"
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Target Company</label>
                    <input
                      type="text"
                      value={scrutinyTargetCompany}
                      onChange={(e) => setScrutinyTargetCompany(e.target.value)}
                      placeholder="e.g. Uber"
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground block mb-1">Years of Exp</label>
                    <input
                      type="number"
                      value={scrutinyYearsExp}
                      onChange={(e) => setScrutinyYearsExp(Number(e.target.value))}
                      className="w-full bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-muted-foreground">Raw Resume Text or Bullet Points</label>
                    <span className="text-[10px] text-muted-foreground font-mono">{scrutinyResumeText.length} chars</span>
                  </div>
                  <textarea
                    rows={4}
                    value={scrutinyResumeText}
                    onChange={(e) => setScrutinyResumeText(e.target.value)}
                    placeholder="Paste candidate resume, experience highlights, or CV bullets..."
                    className="w-full bg-card border border-border rounded-xl p-3 text-xs text-foreground font-mono leading-relaxed focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-muted-foreground italic">
                    AI will cross-examine metric feasibility against industry baselines.
                  </span>
                  <button
                    type="submit"
                    disabled={scrutinyLoading}
                    className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-amber-600 via-rose-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/25 flex items-center space-x-2 disabled:opacity-50"
                  >
                    {scrutinyLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Auditing Claims &amp; Synthesizing Assessment...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                        <span>Execute Deep Scrutiny &amp; Auto-Tailor</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Scrutiny Results Display */}
              {scrutinyResult && (
                <div className="space-y-6 animate-in fade-in">
                  {/* Top Score Banner */}
                  <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    scrutinyResult.credibilityScore >= 75
                      ? "bg-emerald-500/10 border-emerald-500/30"
                      : scrutinyResult.credibilityScore >= 55
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-rose-500/10 border-rose-500/30"
                  }`}>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider ${
                          scrutinyResult.credibilityScore >= 75
                            ? "bg-emerald-500 text-black"
                            : scrutinyResult.credibilityScore >= 55
                            ? "bg-amber-500 text-black"
                            : "bg-rose-500 text-white"
                        }`}>
                          CLAIM CREDIBILITY: {scrutinyResult.credibilityScore}%
                        </span>
                        <span className="text-xs font-bold text-foreground font-mono">
                          {scrutinyResult.candidateName} • {scrutinyResult.targetRole}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {scrutinyResult.summary}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground">Scrutiny Verdict</div>
                      <div className={`text-2xl font-black font-mono ${
                        scrutinyResult.credibilityScore >= 75 ? "text-emerald-500" : scrutinyResult.credibilityScore >= 55 ? "text-amber-500" : "text-rose-500"
                      }`}>
                        {scrutinyResult.credibilityScore >= 75 ? "AUTHENTIC" : scrutinyResult.credibilityScore >= 55 ? "QUESTIONABLE" : "HIGH DEFICIT"}
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">Bayesian Benchmark</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column: Flagged Claims & Deficiencies */}
                    <div className="space-y-4">
                      {/* Flagged Claims */}
                      <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center space-x-2">
                            <ShieldAlert className="w-4 h-4 text-rose-500" />
                            <span>Flagged Claims &amp; Metric Scrutiny</span>
                          </h4>
                          <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-bold">
                            {scrutinyResult.flaggedClaims?.length ?? 0} Suspect Points
                          </span>
                        </div>

                        <div className="space-y-3">
                          {scrutinyResult.flaggedClaims?.map((item: ScrutinyFlaggedClaim, idx: number) => (
                            <div key={idx} className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-foreground">"{item.claim}"</span>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                  item.severity === "HIGH" ? "bg-rose-500 text-white" : "bg-amber-500 text-black"
                                }`}>
                                  {item.severity} SEVERITY
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-relaxed">
                                <strong className="text-foreground">Critique:</strong> {item.critique}
                              </p>
                              <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-700 dark:text-indigo-300">
                                <strong className="block text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400">Interrogation Probe:</strong>
                                "{item.interrogationQuestion}"
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Buzzwords & Deficiencies */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Inflated Buzzwords
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {scrutinyResult.buzzwordInflation?.map((bw: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                {bw}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                            Identified Gaps
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {scrutinyResult.technicalDeficiencies?.map((def: string, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                {def}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Tailored Assessment Suite & Live Link */}
                    <div className="space-y-4">
                      <div className="p-5 rounded-2xl bg-card border border-indigo-500/30 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                              Auto-Tailored 3-Stage Assessment Blueprint
                            </h4>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 font-bold">
                            {scrutinyResult.generatedAssessmentToken}
                          </span>
                        </div>

                        {/* Stage 1 Focus */}
                        <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                          <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 block font-mono">
                            Stage 1: Written Diagnostic Focus
                          </span>
                          <p className="text-xs text-foreground leading-relaxed">
                            {scrutinyResult.tailoredWrittenFocus}
                          </p>
                        </div>

                        {/* Stage 2 Focus */}
                        <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-1">
                          <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block font-mono">
                            Stage 2: Tailored Coding Sprint Challenge
                          </span>
                          <p className="text-xs text-foreground leading-relaxed font-mono">
                            {scrutinyResult.tailoredCodingPrompt}
                          </p>
                        </div>

                        {/* Stage 3 Voice Defense Questions */}
                        <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-2">
                          <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 block font-mono">
                            Stage 3: AI Voice Defense Targeted Questions
                          </span>
                          <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
                            {scrutinyResult.tailoredVoiceDefenseQuestions?.map((q: string, i: number) => (
                              <li key={i} className="text-foreground">
                                <span className="text-purple-600 dark:text-purple-400 font-bold">Q{i + 1}:</span> "{q}"
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Direct Candidate Link Box */}
                        <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 space-y-2">
                          <span className="text-[11px] font-bold text-foreground block">
                            Direct Candidate Invite URL (Instant Live Token):
                          </span>
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              readOnly
                              value={typeof window !== "undefined" ? `${window.location.origin}/assessment/${scrutinyResult.generatedAssessmentToken}` : `/assessment/${scrutinyResult.generatedAssessmentToken}`}
                              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none"
                            />
                            <button
                              onClick={() => handleCopyBundleUrl(scrutinyResult.generatedAssessmentToken)}
                              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer shrink-0"
                            >
                              {copiedToken === scrutinyResult.generatedAssessmentToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedToken === scrutinyResult.generatedAssessmentToken ? "Copied" : "Copy Link"}</span>
                            </button>
                          </div>

                          <div className="flex items-center space-x-2 pt-2">
                            <a
                              href={`/assessment/${scrutinyResult.generatedAssessmentToken}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs text-center flex items-center justify-center space-x-1.5 cursor-pointer shadow-lg shadow-indigo-600/25"
                            >
                              <span>Open Candidate Assessment Portal</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Deep AI Autonomous Interview & Hiring Audit Modal */}
      {selectedBundleForAudit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="bg-card border border-border rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border p-5 bg-card/90 backdrop-blur-sm sticky top-0 z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-foreground">
                      {selectedBundleForAudit.candidateName} — Autonomous AI Hiring Audit
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      {selectedBundleForAudit.token}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedBundleForAudit.targetRole} • {selectedBundleForAudit.companyName} • Evaluated by Edulexa AI Engine v2.4
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedBundleForAudit(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl hover:bg-muted cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Content */}
            <div className="overflow-y-auto p-6 space-y-6">
              {/* 1. Hero AI Verdict Card */}
              {selectedBundleForAudit.aiVerdict ? (
                <div className={`rounded-2xl p-6 border relative overflow-hidden ${
                  selectedBundleForAudit.aiVerdict.decision === "SELECTED"
                    ? "bg-gradient-to-r from-emerald-950/40 via-emerald-900/10 to-card border-emerald-500/40"
                    : "bg-gradient-to-r from-rose-950/40 via-rose-900/10 to-card border-rose-500/40"
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2">
                        {selectedBundleForAudit.aiVerdict.decision === "SELECTED" ? (
                          <span className="px-3 py-1 rounded-xl text-xs font-black bg-emerald-500 text-black uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-emerald-500/20">
                            <ThumbsUp className="w-3.5 h-3.5 fill-black" />
                            <span>AI HIRING VERDICT: SELECTED</span>
                          </span>
                        ) : (
                          <span className="px-3 py-1 rounded-xl text-xs font-black bg-rose-500 text-white uppercase tracking-wider flex items-center space-x-1.5 shadow-md shadow-rose-500/20">
                            <ThumbsDown className="w-3.5 h-3.5 fill-white" />
                            <span>AI HIRING VERDICT: DESELECTED</span>
                          </span>
                        )}
                        <span className="text-xs font-bold font-mono text-muted-foreground">
                          TIER: {selectedBundleForAudit.aiVerdict.recommendationTier.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Hiring Bar Threshold: <span className="font-mono font-bold text-foreground">{selectedBundleForAudit.aiVerdict.hiringBarThreshold}%</span> • Candidate Composite: <span className="font-mono font-bold text-foreground">{selectedBundleForAudit.compositeScore}%</span>
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-semibold text-muted-foreground">Autonomous AI Confidence</div>
                      <div className={`text-3xl font-black font-mono ${
                        selectedBundleForAudit.aiVerdict.decision === "SELECTED" ? "text-emerald-500" : "text-rose-500"
                      }`}>
                        {selectedBundleForAudit.aiVerdict.confidenceScore}%
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">Calibrated via Bayesian Scrutiny</span>
                    </div>
                  </div>

                  {/* Anti Cheat Badge */}
                  <div className="mt-4 pt-4 border-t border-border/50 flex flex-wrap items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span className="text-muted-foreground">Telemetry Integrity:</span>
                      {selectedBundleForAudit.aiVerdict.antiCheatVerdict === "VERIFIED_CLEAN" ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3" />
                          <span>VERIFIED CLEAN (No External AI Watermark)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center space-x-1">
                          <ShieldAlert className="w-3 h-3" />
                          <span>FLAGGED SUSPICIOUS (Mass Paste / Dishonesty Detected)</span>
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-muted-foreground">
                      Decision Timestamp: {new Date(selectedBundleForAudit.aiVerdict.decisionTimestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-muted/40 border border-border text-center space-y-1">
                  <Clock className="w-6 h-6 text-indigo-500 mx-auto" />
                  <h4 className="text-sm font-bold text-foreground">Candidate Still in Pipeline</h4>
                  <p className="text-xs text-muted-foreground">The AI Interview panel will synthesize final hiring verdict upon Stage 3 completion.</p>
                </div>
              )}

              {/* 2. 4-Stage Diagnostics KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-card border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Stage 1: Written</span>
                  <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                    {selectedBundleForAudit.stage1Score ?? "--"}%
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate block mt-0.5">Theory &amp; Architecture</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-card border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Stage 2: Code Sprint</span>
                  <div className="text-xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                    {selectedBundleForAudit.stage2Score ?? "--"}%
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate block mt-0.5">{selectedBundleForAudit.requiredLanguage.toUpperCase()} Sandbox</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-card border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Stage 3: Voice Defense</span>
                  <div className="text-xl font-black font-mono text-purple-600 dark:text-purple-400 mt-1">
                    {selectedBundleForAudit.stage3Score ?? "--"}%
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate block mt-0.5">Live Scrutiny HUD</span>
                </div>

                <div className="p-3.5 rounded-2xl bg-card border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">Composite Score</span>
                  <div className="text-xl font-black font-mono text-foreground mt-1">
                    {selectedBundleForAudit.compositeScore ?? "--"}%
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate block mt-0.5">Sealed &amp; Cryptographic</span>
                </div>
              </div>

              {/* 3. AI Executive Summary */}
              {selectedBundleForAudit.aiVerdict && (
                <div className="p-5 rounded-2xl bg-card border border-border space-y-2">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      AI Executive Hiring Evaluation Rationale
                    </h4>
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {selectedBundleForAudit.aiVerdict.executiveSummary}
                  </p>
                </div>
              )}

              {/* 4. Strengths & Deficiencies Columns */}
              {selectedBundleForAudit.aiVerdict && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Strengths */}
                  <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-2.5">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCheck className="w-4 h-4" />
                      <span>Demonstrated Technical Strengths</span>
                    </div>
                    {selectedBundleForAudit.aiVerdict.keyStrengths.length > 0 ? (
                      <ul className="space-y-1.5">
                        {selectedBundleForAudit.aiVerdict.keyStrengths.map((str, idx) => (
                          <li key={idx} className="text-xs text-foreground flex items-start space-x-2">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{str}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No distinctive strengths recorded.</p>
                    )}
                  </div>

                  {/* Deficiencies */}
                  <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-2.5">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Fatal Deficiencies &amp; Corporate Red Flags</span>
                    </div>
                    {selectedBundleForAudit.aiVerdict.fatalDeficiencies.length > 0 ? (
                      <ul className="space-y-1.5">
                        {selectedBundleForAudit.aiVerdict.fatalDeficiencies.map((def, idx) => (
                          <li key={idx} className="text-xs text-foreground flex items-start space-x-2">
                            <span className="text-rose-500 font-bold">•</span>
                            <span>{def}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No fatal deficiencies identified.</p>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Autonomous AI Audio Dialogue & Transcript Log */}
              {selectedBundleForAudit.aiVerdict?.transcriptLog && selectedBundleForAudit.aiVerdict.transcriptLog.length > 0 && (
                <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-purple-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Autonomous AI Interviewer &amp; Candidate Spoken Dialogue
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {selectedBundleForAudit.aiVerdict.transcriptLog.length} Spoken Turns Recorded
                    </span>
                  </div>

                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {selectedBundleForAudit.aiVerdict.transcriptLog.map((entry, idx) => {
                      const isInterviewer = entry.role === "interviewer";
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-2xl text-xs space-y-1 border ${
                            isInterviewer
                              ? "bg-muted/40 border-border text-foreground mr-6"
                              : "bg-indigo-600/10 border-indigo-500/30 text-foreground ml-6"
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                            <span className="font-bold uppercase flex items-center space-x-1">
                              {isInterviewer ? (
                                <>
                                  <Brain className="w-3 h-3 text-purple-400" />
                                  <span>AI INTERVIEWER</span>
                                </>
                              ) : (
                                <>
                                  <Mic className="w-3 h-3 text-indigo-400" />
                                  <span>CANDIDATE ({selectedBundleForAudit.candidateName})</span>
                                </>
                              )}
                            </span>
                            <span>{entry.timestamp}</span>
                          </div>
                          <p className="leading-relaxed">{entry.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 6. Corporate Recruiter Action Center */}
              <div className="p-5 rounded-2xl bg-card border border-indigo-500/30 space-y-3">
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Corporate Hiring Panel Decision &amp; Action
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current Corporate Status:{" "}
                  <span className="font-bold text-foreground">
                    {selectedBundleForAudit.corporateDecisionStatus?.replace("_", " ") ?? "PENDING REVIEW"}
                  </span>
                </p>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Recruiter Panel Review Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={recruiterActionNotes}
                    onChange={(e) => setRecruiterActionNotes(e.target.value)}
                    placeholder="e.g. Compensation package aligned with Director approval..."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {selectedBundleForAudit.aiVerdict?.decision === "SELECTED" ? (
                    <>
                      <button
                        onClick={() => handleRecruiterAction("EXTEND_OFFER")}
                        disabled={recruiterActionSubmitting}
                        className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-emerald-600/20 flex items-center space-x-2 disabled:opacity-50"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span>Accept AI Verdict: Issue Formal Offer</span>
                      </button>

                      <button
                        onClick={() => handleRecruiterAction("OVERRIDE_DESELECT")}
                        disabled={recruiterActionSubmitting}
                        className="py-2.5 px-3 rounded-xl bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs border border-border cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-500" />
                        <span>Manual Override: Reject Anyway</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleRecruiterAction("ISSUE_REJECTION")}
                        disabled={recruiterActionSubmitting}
                        className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-lg shadow-rose-600/20 flex items-center space-x-2 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Accept AI Verdict: Send Rejection Notice</span>
                      </button>

                      <button
                        onClick={() => handleRecruiterAction("OVERRIDE_SELECT")}
                        disabled={recruiterActionSubmitting}
                        className="py-2.5 px-3 rounded-xl bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs border border-border cursor-pointer flex items-center space-x-1.5 disabled:opacity-50"
                      >
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Manual Override: Advance Candidate</span>
                      </button>
                    </>
                  )}

                  <a
                    href={`/assessment/${selectedBundleForAudit.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-card hover:bg-muted text-muted-foreground hover:text-foreground font-semibold text-xs border border-border cursor-pointer flex items-center space-x-1.5 ml-auto"
                  >
                    <span>View Candidate Portal</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

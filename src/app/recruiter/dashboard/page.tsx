"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import { 
  Briefcase, Users, ShieldAlert, ShieldCheck, Plus, 
  ExternalLink, Search, RefreshCw, KeyRound, Copy, Check,
  AlertTriangle, Sparkles, Filter, Code2, Award, Mic,
  FileText, CheckCircle2, Clock, Send, Layers, ArrowRight,
  Brain, CheckCheck, X,
  MessageSquare, HelpCircle, FileSearch, Target, Flame
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

type ReviewStatus = "AWAITING" | "ADVANCED" | "HOLD" | "DECLINED" | "IN_PROGRESS";

// Only a recruiter's action changes a candidate's status; AI scores never do.
function reviewStatus(bundle: AssessmentBundle): ReviewStatus {
  const s = bundle.corporateDecisionStatus;
  if (s === "OFFER_EXTENDED") return "ADVANCED";
  if (s === "REJECTION_ISSUED") return "DECLINED";
  if (s === "ON_HOLD" || s === "HOLD") return "HOLD";
  return bundle.overallStatus === "Completed" ? "AWAITING" : "IN_PROGRESS";
}

const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  AWAITING: "Awaiting review",
  ADVANCED: "Advanced",
  HOLD: "On hold",
  DECLINED: "Declined",
  IN_PROGRESS: "In progress",
};

const REVIEW_STATUS_STYLES: Record<ReviewStatus, string> = {
  AWAITING: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
  ADVANCED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  HOLD: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  DECLINED: "bg-muted text-muted-foreground border-border",
  IN_PROGRESS: "bg-muted text-muted-foreground border-border",
};

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function evidenceHref(submissionId?: string | null) {
  return submissionId && GUID_PATTERN.test(submissionId) ? `/recruiter/evidence/${submissionId}` : "/recruiter/evidence";
}

export default function RecruiterDashboardPage() {
  const { apiFetch, ready, access } = useLegacyApi();
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
  const [decisionFilter, setDecisionFilter] = useState<"ALL" | ReviewStatus>("ALL");
  const [selectedBundleForAudit, setSelectedBundleForAudit] = useState<AssessmentBundle | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/recruiter/candidates?companyId=Uber`);
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
      const res = await apiFetch(`/api/recruiter/assessments/bundles`);
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
    if (!ready) return;
    fetchCandidates();
    fetchBundles();
  }, [ready]);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStatus("Creating private challenge...");
    try {
      const res = await apiFetch(`/api/recruiter/sprint/create`, {
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
      const res = await apiFetch(`/api/recruiter/assessments/bundle/create`, {
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
      const res = await apiFetch(`/api/resume/deep-scrutiny`, {
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

  if (access) return <AccessNotice problem={access} feature="The recruiter dashboard" />;

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

        {/* Human review, integrations and validity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { href: "/recruiter/evidence", title: "Evidence review queue", text: "Review evidence packs and record Advance / Hold / Decline decisions.", Icon: FileSearch },
            { href: "/recruiter/integrations", title: "ATS integrations", text: "Connect Greenhouse, Lever, Workday, SeekJobs or a signed webhook.", Icon: Layers },
            { href: "/recruiter/validity", title: "Validity & bias audit", text: "Score-to-performance correlations and four-fifths impact ratios.", Icon: Target },
          ].map(({ href, title, text, Icon }) => (
            <Link
              key={href}
              href={href}
              className="glass-panel rounded-2xl p-4 border border-border hover:border-indigo-500/40 transition-colors flex items-start gap-3"
            >
              <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="text-sm font-bold text-foreground flex items-center gap-1">
                  {title}
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Live KPI Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="glass-card rounded-2xl p-5 border border-indigo-500/20 bg-indigo-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Awaiting review</span>
              <FileSearch className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-3xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-2">
              {bundles.filter(b => reviewStatus(b) === "AWAITING").length}
            </div>
            <span className="text-[11px] text-indigo-600/80 dark:text-indigo-400/80 mt-1 block">
              All stages complete; a recruiter decides on the evidence
            </span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Advanced</span>
              <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-2">
              {bundles.filter(b => reviewStatus(b) === "ADVANCED").length}
            </div>
            <span className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 block">
              Advanced by a recruiter
            </span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-border bg-muted/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">On hold / declined</span>
              <Clock className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-3xl font-extrabold text-foreground mt-2">
              {bundles.filter(b => reviewStatus(b) === "HOLD").length} / {bundles.filter(b => reviewStatus(b) === "DECLINED").length}
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Decided by a recruiter
            </span>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-purple-500/20 bg-purple-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">In progress</span>
              <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 mt-2">
              {bundles.filter(b => reviewStatus(b) === "IN_PROGRESS").length}
            </div>
            <span className="text-[11px] text-purple-600/80 dark:text-purple-400/80 mt-1 block">
              Candidate still completing the assessment stages
            </span>
          </div>
        </div>

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
            <span>3-Stage Assessment Pipeline ({bundles.length})</span>
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
            <span>Sprint Submissions &amp; Integrity Signals ({candidates.length})</span>
          </button>
        </div>

        {/* Tab 1: 3-Stage Assessment Bundles */}
        {activeTab === "bundles" && (
          <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center space-x-2">
                  <span>Assessment Pipeline</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                    Human decision required
                  </span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Candidates complete a written exam, a coding sprint and a voice defense. Scores are evidence for a recruiter; nobody is advanced or declined automatically.
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
                <span>Filter By Review Status:</span>
              </span>
              {([
                { id: "ALL", label: `All Candidates (${bundles.length})` },
                ...(["AWAITING", "ADVANCED", "HOLD", "DECLINED", "IN_PROGRESS"] as const).map((s) => ({
                  id: s,
                  label: `${REVIEW_STATUS_LABELS[s]} (${bundles.filter(b => reviewStatus(b) === s).length})`,
                })),
              ] as { id: "ALL" | ReviewStatus; label: string }[]).map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setDecisionFilter(pill.id)}
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
                    <th className="py-3 px-4">Stage Progress</th>
                    <th className="py-3 px-4">Review Status</th>
                    <th className="py-3 px-4">Composite</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {bundles.filter(bundle => decisionFilter === "ALL" || reviewStatus(bundle) === decisionFilter).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No candidates match the selected review status.
                      </td>
                    </tr>
                  ) : (
                    bundles
                      .filter(bundle => decisionFilter === "ALL" || reviewStatus(bundle) === decisionFilter)
                      .map((bundle) => {
                        const isCompleted = bundle.overallStatus === "Completed";
                        const status = reviewStatus(bundle);

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

                            {/* Stage Progress */}
                            <td className="py-3.5 px-4">
                              <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-muted text-muted-foreground border border-border flex items-center space-x-1.5 w-fit">
                                {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                <span>{isCompleted ? "All stages complete" : `Stage ${bundle.currentStage}/3`}</span>
                              </span>
                            </td>

                            {/* Review Status */}
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex items-center space-x-1 w-fit ${REVIEW_STATUS_STYLES[status]}`}>
                                <span>{REVIEW_STATUS_LABELS[status]}</span>
                              </span>
                            </td>

                            {/* Composite */}
                            <td className="py-3.5 px-4">
                              {isCompleted ? (
                                <div>
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold border bg-muted/40 text-foreground border-border">
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

                            {/* Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-2">
                                {isCompleted && (
                                  <Link
                                    href="/recruiter/evidence"
                                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-xs"
                                    title="Review this candidate's evidence and record a decision"
                                  >
                                    <FileSearch className="w-3.5 h-3.5" />
                                    <span>Review</span>
                                  </Link>
                                )}
                                {bundle.aiVerdict && (
                                  <button
                                    onClick={() => setSelectedBundleForAudit(bundle)}
                                    className="px-2.5 py-1.5 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-medium text-foreground flex items-center space-x-1 cursor-pointer transition-colors"
                                    title="Stage scores and interview transcript"
                                  >
                                    <span>Details</span>
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

        {/* Tab 2: Sprint submissions and integrity signals */}
        {activeTab === "challenges" && (
          <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-foreground">Corporate Applicant Pipeline</h2>
                <p className="text-xs text-muted-foreground">Sprint scores, project work and integrity signals. Signals are prompts for a conversation, not proof; open the evidence pack to review and decide.</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-muted-foreground">
                <thead className="bg-card/80 text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Candidate</th>
                    <th className="py-3 px-4">Corporate Challenge</th>
                    <th className="py-3 px-4">Defense Score</th>
                    <th className="py-3 px-4">Integrity Signals</th>
                    <th className="py-3 px-4">Evidence</th>
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
                            <span>Signals to review</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>No signals raised</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <Link
                          href={evidenceHref(cand.submissionId)}
                          className="inline-flex items-center space-x-1 text-indigo-700 dark:text-indigo-400 hover:underline font-medium"
                        >
                          <FileSearch className="w-3 h-3" />
                          <span>{evidenceHref(cand.submissionId) === "/recruiter/evidence" ? "Review" : "Evidence pack"}</span>
                        </Link>
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
                    <option value="quantitative-aptitude-logic">Quantitative Aptitude &amp; Logical Reasoning</option>
                    <option value="product-management-foundations">Product Management Foundations</option>
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
                    <option value="javascript">JavaScript</option>
                    <option value="python">Python</option>
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

      {/* Assessment details modal (reference only; decisions are made on the evidence pack) */}
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
                      {selectedBundleForAudit.candidateName} — Assessment Details
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border">
                      {selectedBundleForAudit.token}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {selectedBundleForAudit.targetRole} • {selectedBundleForAudit.companyName}
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
              {/* 1. Status and reminder that a human decides */}
              <div className="rounded-2xl p-5 border border-indigo-500/30 bg-indigo-500/5 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${REVIEW_STATUS_STYLES[reviewStatus(selectedBundleForAudit)]}`}>
                    {REVIEW_STATUS_LABELS[reviewStatus(selectedBundleForAudit)]}
                  </span>
                  {selectedBundleForAudit.aiVerdict && (
                    <span className="text-xs text-muted-foreground">
                      Integrity signals: {selectedBundleForAudit.aiVerdict.antiCheatVerdict === "VERIFIED_CLEAN" ? "none raised" : "some raised; discuss with the candidate"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Scores and the AI-generated summary below are reference material. The platform does not advance or decline
                  candidates; a recruiter records every decision, with a rationale, on the evidence pack.
                </p>
              </div>

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
                      AI-Generated Interview Summary (Reference Only)
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
                      <span>Gaps Noted in the Interview</span>
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
                      <p className="text-xs text-muted-foreground italic">No gaps noted.</p>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Voice defense transcript */}
              {selectedBundleForAudit.aiVerdict?.transcriptLog && selectedBundleForAudit.aiVerdict.transcriptLog.length > 0 && (
                <div className="p-5 rounded-2xl bg-card border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-purple-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Voice Defense Transcript
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

              {/* 6. Next step: human review on the evidence pack */}
              <div className="p-5 rounded-2xl bg-card border border-indigo-500/30 space-y-3">
                <div className="flex items-center space-x-2">
                  <Briefcase className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Review &amp; Decision
                  </h4>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current status:{" "}
                  <span className="font-bold text-foreground">{REVIEW_STATUS_LABELS[reviewStatus(selectedBundleForAudit)]}</span>.
                  Record Advance, Hold or Decline with a rationale from the evidence review queue.
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Link
                    href="/recruiter/evidence"
                    className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer flex items-center space-x-2"
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    <span>Review</span>
                  </Link>

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

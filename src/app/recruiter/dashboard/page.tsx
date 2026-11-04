"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, Modal, PageHeader, ScrollArea, StatTile, Tabs, brandFill, buttonClass } from "@/components/career/ui";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import {
  ShieldAlert, ShieldCheck, Plus, ExternalLink, RefreshCw, Copy, Check,
  AlertTriangle, Sparkles, Code2, Mic, CheckCircle2, Clock,
  Layers, Brain, CheckCheck, X, MessageSquare, FileSearch, ChevronDown,
} from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";

interface TranscriptEntry {
  role: string;
  text: string;
  timestamp: string;
}

interface AiHiringVerdict {
  decision: string;
  recommendationTier: string;
  confidenceScore: number | null;
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
  [key: string]: unknown;
}

// PL1/PL2: the list carries the bundle id and a link hint; the link itself is shown once (at create or "New link")
interface AssessmentBundle {
  id: string;
  linkHint: string;
  linkStatus: "active" | "expired" | "revoked" | "completed" | string;
  expiresAt?: string | null;
  revokedAt?: string | null;
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

interface CorporateCandidate {
  submissionId: string;
  candidateName: string;
  candidateEmail: string;
  sprintTitle: string;
  status: string;
  antiCheat: { verificationFlagged: boolean; suspectedAi: boolean; suspectedPasting: boolean; flagReason: string | null };
  evaluation: { finalScore: number; publicUrlSlug: string | null };
}

interface CorporateCandidatesResponse {
  companyId?: string;
  totalApplicants?: number;
  flaggedCount?: number;
  candidates?: CorporateCandidate[];
}

// POST /api/recruiter/assessments/bundle/create: the only response that carries the link token
interface CreatedBundle {
  id: string;
  token: string;
  inviteUrl: string;
  linkHint: string;
  candidateName: string;
  candidateEmail: string;
  companyName: string;
  targetRole: string;
  expiresAt?: string | null;
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

const REVIEW_STATUS_TONES: Record<ReviewStatus, "neutral" | "good" | "warn" | "bad" | "info"> = {
  AWAITING: "info",
  ADVANCED: "good",
  HOLD: "warn",
  DECLINED: "neutral",
  IN_PROGRESS: "neutral",
};

const inputCls =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-1";

function modalPanel(width: string) {
  return `max-h-[90vh] w-full ${width} space-y-4 overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-xl`;
}

function CloseButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      <X aria-hidden="true" className="h-4 w-4" />
    </button>
  );
}

function sentenceCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : value;
}

function linkStatusClass(bundle: AssessmentBundle) {
  return bundle.linkStatus === "revoked" || bundle.linkStatus === "expired" ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground";
}

/** Written / coding / voice scores, e.g. "W 80% · C --% · V 72%" */
function stageScores(bundle: AssessmentBundle) {
  return `W ${bundle.stage1Score ?? "--"}% · C ${bundle.stage2Score ?? "--"}% · V ${bundle.stage3Score ?? "--"}%`;
}

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatLinkDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function linkStatusText(bundle: AssessmentBundle) {
  switch (bundle.linkStatus) {
    case "revoked": return `Link revoked ${formatLinkDate(bundle.revokedAt)}`.trim();
    case "expired": return bundle.expiresAt ? `Link expired ${formatLinkDate(bundle.expiresAt)}` : "Old link without expiry (not usable)";
    case "completed": return "Assessment finished";
    default: return bundle.expiresAt ? `Link expires ${formatLinkDate(bundle.expiresAt)}` : "Link active";
  }
}

function evidenceHref(submissionId?: string | null) {
  return submissionId && GUID_PATTERN.test(submissionId) ? `/recruiter/evidence/${submissionId}` : "/recruiter/evidence";
}

export default function RecruiterDashboardPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [data, setData] = useState<CorporateCandidatesResponse | null>(null);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
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
  const [newCompany, setNewCompany] = useState("");
  const [newInviteCode, setNewInviteCode] = useState("");
  const [createStatus, setCreateStatus] = useState<string | null>(null);

  // Bundle Modal & Form State
  const [showBundleModal, setShowBundleModal] = useState<boolean>(false);
  const [bundleCandidateName, setBundleCandidateName] = useState("");
  const [bundleCandidateEmail, setBundleCandidateEmail] = useState("");
  const [bundleTargetRole, setBundleTargetRole] = useState("");
  const [bundleCompany, setBundleCompany] = useState("");
  const [bundleExamId, setBundleExamId] = useState("swe-core-systems");
  const [bundleLanguage, setBundleLanguage] = useState("typescript");
  const [bundleDefenseTopic, setBundleDefenseTopic] = useState("");
  const [bundleStatus, setBundleStatus] = useState<string | null>(null);
  const [bundleCreatedData, setBundleCreatedData] = useState<CreatedBundle | null>(null);

  // AI Deep Resume Scrutiny State
  const [showScrutinyModal, setShowScrutinyModal] = useState<boolean>(false);
  const [scrutinyResumeText, setScrutinyResumeText] = useState<string>("");
  const [scrutinyCandidateName, setScrutinyCandidateName] = useState<string>("");
  const [scrutinyTargetRole, setScrutinyTargetRole] = useState<string>("");
  const [scrutinyTargetCompany, setScrutinyTargetCompany] = useState<string>("");
  const [scrutinyYearsExp, setScrutinyYearsExp] = useState<number>(0);
  const [scrutinyResult, setScrutinyResult] = useState<ScrutinyResultData | null>(null);
  const [scrutinyLoading, setScrutinyLoading] = useState<boolean>(false);

  // AI Decision Filters & Audit Modal State
  const [decisionFilter, setDecisionFilter] = useState<"ALL" | ReviewStatus>("ALL");
  const [selectedBundleForAudit, setSelectedBundleForAudit] = useState<AssessmentBundle | null>(null);

  // Link management (revoke, new link)
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);
  const [reissued, setReissued] = useState<{ id: string; token: string; expiresAt?: string | null } | null>(null);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      // The server lists the signed-in recruiter's own company; it never trusts a company named by the page
      const res = await apiFetch(`/api/recruiter/candidates`);
      if (res.ok) {
        setData(await res.json());
        setCandidatesError(null);
      } else {
        const body = await res.json().catch(() => null);
        setCandidatesError(body?.error || en("We couldn't load your candidates. Please try again."));
      }
    } catch (e) {
      console.error("[RECRUITER DASHBOARD ERROR]:", e);
      setCandidatesError(en("We couldn't load your candidates. Please try again."));
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

  // The loaders start with setLoading(true): call them through a ref, not from the effect body
  const loadRef = useLatestRef(() => {
    fetchCandidates();
    fetchBundles();
  });
  useEffect(() => {
    if (!ready) return;
    loadRef.current();
  }, [ready, loadRef]);

  const handleCreateChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateStatus(en("Creating the challenge…"));
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
        setCreateStatus(en("Created. Invite code: {code}", { code: created.inviteCode }));
        setTimeout(() => {
          setShowCreateModal(false);
          setCreateStatus(null);
          setNewTitle("");
          setNewDescription("");
          setNewInviteCode("");
          fetchCandidates();
        }, 2000);
      } else {
        setCreateStatus("We couldn't create the challenge. Please try again.");
      }
    } catch (e) {
      setCreateStatus("We couldn't reach the server. Please check your connection and try again.");
    }
  };

  const handleCreateBundle = async (e: React.FormEvent) => {
    e.preventDefault();
    setBundleStatus(en("Creating the assessment…"));
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
        setBundleStatus("We couldn't create the assessment bundle. Please try again.");
      }
    } catch (e) {
      setBundleStatus("We couldn't reach the server. Please check your connection and try again.");
    }
  };

  const handleRevokeLink = async (bundle: AssessmentBundle) => {
    if (typeof window !== "undefined" && !window.confirm(`Withdraw the assessment link for ${bundle.candidateName}? The candidate will no longer be able to open it.`)) return;
    setLinkBusyId(bundle.id);
    setLinkMessage(null);
    try {
      const res = await apiFetch(`/api/recruiter/assessments/bundle/${encodeURIComponent(bundle.id)}/revoke`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      setLinkMessage(res.ok ? `Link for ${bundle.candidateName} revoked.` : body.error || "Could not revoke the link.");
      if (res.ok) {
        if (reissued?.id === bundle.id) setReissued(null);
        fetchBundles();
      }
    } catch {
      setLinkMessage("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setLinkBusyId(null);
    }
  };

  const handleReissueLink = async (bundle: AssessmentBundle) => {
    setLinkBusyId(bundle.id);
    setLinkMessage(null);
    try {
      const res = await apiFetch(`/api/recruiter/assessments/bundle/${encodeURIComponent(bundle.id)}/reissue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.token) {
        setReissued({ id: bundle.id, token: body.token, expiresAt: body.expiresAt });
        setLinkMessage(`New link for ${bundle.candidateName}. The previous link no longer works. Copy it now: it is shown only once.`);
        fetchBundles();
      } else {
        setLinkMessage(body.error || "Could not create a new link.");
      }
    } catch {
      setLinkMessage("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setLinkBusyId(null);
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

  const candidates: CorporateCandidate[] = data?.candidates ?? [];

  const totalApplicants = data?.totalApplicants ?? candidates.length;
  const flaggedCount = data?.flaggedCount ?? candidates.filter((c) => c.antiCheat.verificationFlagged).length;
  const cleanCount = totalApplicants - flaggedCount;

  const visibleBundles = bundles.filter((bundle) => decisionFilter === "ALL" || reviewStatus(bundle) === decisionFilter);

  const bundleActions = (bundle: AssessmentBundle, isCompleted: boolean, align: "justify-start" | "justify-end") => (
    <div className={`flex flex-wrap items-center gap-2 ${align}`}>
      {isCompleted && (
        <Link href="/recruiter/evidence" className={buttonClass("secondary")} title={en("Review this candidate's evidence and record a decision")}>
          <FileSearch aria-hidden="true" className="h-4 w-4" />
          {en("Review")}
        </Link>
      )}
      {bundle.aiVerdict && (
        <Button variant="ghost" onClick={() => setSelectedBundleForAudit(bundle)} title={en("Stage scores and interview transcript")}>
          {en("Details")}
        </Button>
      )}
      {(bundle.linkStatus === "active" || bundle.linkStatus === "expired") && (
        <Button
          variant="ghost"
          onClick={() => handleReissueLink(bundle)}
          disabled={linkBusyId === bundle.id}
          title={en("Send a new link (the previous one stops working)")}
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
          {en("New link")}
        </Button>
      )}
      {bundle.linkStatus === "active" && (
        <Button
          variant="ghost"
          onClick={() => handleRevokeLink(bundle)}
          disabled={linkBusyId === bundle.id}
          title={en("Withdraw this candidate's link")}
          className="text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          <X aria-hidden="true" className="h-4 w-4" />
          {en("Revoke")}
        </Button>
      )}
    </div>
  );

  const integrityBadge = (cand: CorporateCandidate) =>
    cand.antiCheat?.verificationFlagged ? (
      <Badge tone="warn">
        <AlertTriangle aria-hidden="true" className="me-1 h-3.5 w-3.5" />
        {en("Signals to review")}
      </Badge>
    ) : (
      <Badge tone="good">
        <ShieldCheck aria-hidden="true" className="me-1 h-3.5 w-3.5" />
        {en("No signals raised")}
      </Badge>
    );

  const candidateLinks = (cand: CorporateCandidate, only?: "evidence" | "credential") => (
    <>
      {only !== "credential" && (
        <Link href={evidenceHref(cand.submissionId)} className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline dark:text-indigo-400">
          <FileSearch aria-hidden="true" className="h-3.5 w-3.5" />
          {evidenceHref(cand.submissionId) === "/recruiter/evidence" ? en("Review") : en("Evidence pack")}
        </Link>
      )}
      {only !== "evidence" &&
        (cand.evaluation?.publicUrlSlug ? (
          <a
            href={`/credential/${cand.evaluation.publicUrlSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-indigo-700 hover:underline dark:text-indigo-400"
          >
            {en("View credential")}
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="text-muted-foreground">{en("No credential")}</span>
        ))}
    </>
  );

  if (access) return <AccessNotice problem={access} feature="The recruiter dashboard" />;

  return (
    <div className="text-foreground font-sans">
      <div className="space-y-8">
        <PageHeader
          title={en("Candidates")}
          description={en("Assessments you've sent, the evidence they produced, and the decisions waiting for you. Nobody is advanced or declined automatically.")}
          actions={
            <>
              <Button
                variant="ghost"
                aria-label={en("Refresh")}
                title={en("Refresh")}
                onClick={() => {
                  fetchCandidates();
                  fetchBundles();
                }}
                busy={loading || loadingBundles}
              >
                {!(loading || loadingBundles) && <RefreshCw aria-hidden="true" className="h-4 w-4" />}
              </Button>
              <MoreActions
                label={en("More actions")}
                items={[
                  {
                    label: en("Review a résumé"),
                    icon: <FileSearch aria-hidden="true" className="h-4 w-4" />,
                    onSelect: () => {
                      setScrutinyResult(null);
                      setScrutinyResumeText("");
                      setScrutinyCandidateName("");
                      setScrutinyTargetRole("");
                      setScrutinyTargetCompany("");
                      setScrutinyYearsExp(0);
                      setShowScrutinyModal(true);
                    },
                  },
                  { label: en("New coding challenge"), icon: <Plus aria-hidden="true" className="h-4 w-4" />, onSelect: () => setShowCreateModal(true) },
                ]}
              />
              <Button
                onClick={() => {
                  setBundleCreatedData(null);
                  setBundleCandidateName("");
                  setBundleCandidateEmail("");
                  setShowBundleModal(true);
                }}
              >
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                {en("Send an assessment")}
              </Button>
            </>
          }
        />

        {/* Where each assessment stands; choosing one shows those candidates (choose it again for everyone) */}
        <div role="group" aria-label={en("Filter by review status")} className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {(["AWAITING", "IN_PROGRESS", "ADVANCED", "HOLD", "DECLINED"] as const).map((s) => {
            const on = decisionFilter === s;
            const count = bundles.filter((b) => reviewStatus(b) === s).length;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setDecisionFilter(on ? "ALL" : s);
                  setActiveTab("bundles");
                }}
                className={`rounded-xl border bg-card p-4 text-start shadow-sm transition-colors ${
                  on ? "border-[var(--brand)] ring-1 ring-[var(--brand)]" : "border-border hover:border-foreground/30"
                }`}
              >
                <span className="block text-sm text-muted-foreground">{en(REVIEW_STATUS_LABELS[s])}</span>
                <span className="mt-1 block text-2xl font-semibold tabular-nums tracking-tight text-foreground">{count}</span>
              </button>
            );
          })}
        </div>

        <Tabs
          label={en("Candidate lists")}
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { id: "bundles", label: en("Assessments"), count: bundles.length, icon: <Layers /> },
            { id: "challenges", label: en("Coding challenge submissions"), count: candidates.length, icon: <Code2 /> },
          ]}
        />

        {/* Tab 1: assessments (written exam, coding sprint, voice defense) */}
        {activeTab === "bundles" && (
          <Card className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {en("Candidates complete a written exam, a coding sprint and a voice defense. Scores are evidence for a recruiter; nobody is advanced or declined automatically.")}
              </p>
              {decisionFilter !== "ALL" && (
                <p className="flex items-center gap-2 text-sm">
                  <span className="text-foreground">{en("Showing: {status}", { status: en(REVIEW_STATUS_LABELS[decisionFilter]) })}</span>
                  <button type="button" onClick={() => setDecisionFilter("ALL")} className="font-medium text-[var(--brand)] underline-offset-2 hover:underline">
                    {en("Show all")}
                  </button>
                </p>
              )}
            </div>

            {linkMessage && (
              <div role="status" aria-live="polite" className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
                {linkMessage}
              </div>
            )}
            {reissued && (
              <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                <label htmlFor="reissued-link" className="block text-sm font-medium text-foreground">
                  {en("New candidate link{value}:", { value: reissued.expiresAt ? ` (expires ${formatLinkDate(reissued.expiresAt)})` : "" })}</label>
                <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                  <input
                    id="reissued-link"
                    type="text"
                    readOnly
                    value={typeof window !== "undefined" ? `${window.location.origin}/assessment/${reissued.token}` : `/assessment/${reissued.token}`}
                    className={`${inputCls} min-w-0 font-mono`}
                  />
                  <Button onClick={() => handleCopyBundleUrl(reissued.token)}>
                    {copiedToken === reissued.token ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                    {copiedToken === reissued.token ? en("Copied") : en("Copy")}
                  </Button>
                  <Button variant="secondary" onClick={() => setReissued(null)}>
                    {en("Done")}
                  </Button>
                </div>
              </div>
            )}

            {loadingBundles && bundles.length === 0 ? (
              <Loading />
            ) : bundles.length === 0 ? (
              <EmptyState title={en("No assessments yet")}>
                {en("Send an assessment to a candidate and their progress shows up here.")}
              </EmptyState>
            ) : visibleBundles.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{en("No candidates match the selected review status.")}</p>
            ) : (
              <>
                {/* Phones: one card per candidate */}
                <ul className="space-y-3 md:hidden">
                  {visibleBundles.map((bundle) => {
                    const isCompleted = bundle.overallStatus === "Completed";
                    const status = reviewStatus(bundle);
                    return (
                      <li key={bundle.id} className="space-y-3 rounded-lg border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{bundle.candidateName}</p>
                            <p className="truncate text-xs text-muted-foreground">{bundle.candidateEmail}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {bundle.targetRole} • {bundle.companyName}
                            </p>
                          </div>
                          <Badge tone={REVIEW_STATUS_TONES[status]}>{en(REVIEW_STATUS_LABELS[status])}</Badge>
                        </div>
                        <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                          <div>
                            <dt className="text-muted-foreground">{en("Stage scores")}</dt>
                            <dd className="mt-0.5 tabular-nums text-foreground">{stageScores(bundle)}</dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">{en("Composite")}</dt>
                            <dd className="mt-0.5 tabular-nums text-foreground">
                              {isCompleted ? (bundle.compositeScore == null ? en("Needs scoring") : `${bundle.compositeScore}%`) : "--"}
                            </dd>
                          </div>
                          <div className="col-span-2">
                            <dt className="text-muted-foreground">{en("Progress")}</dt>
                            <dd className="mt-0.5 text-foreground">
                              {isCompleted ? en("All stages complete") : en("Stage {stage} of 3", { stage: bundle.currentStage })}
                              <span className={`block ${linkStatusClass(bundle)}`}>{linkStatusText(bundle)}</span>
                            </dd>
                          </div>
                        </dl>
                        {bundleActions(bundle, isCompleted, "justify-start")}
                      </li>
                    );
                  })}
                </ul>

                {/* Wider screens: table */}
                <ScrollArea className="hidden overflow-x-auto md:block">
                  <table className="w-full text-start text-sm">
                    <caption className="sr-only">{en("Assessment pipeline")}</caption>
                    <thead className="border-b border-border text-xs font-medium text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Candidate and role")}</th>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Stage scores")}</th>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Progress")}</th>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Review status")}</th>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Composite")}</th>
                        <th scope="col" className="px-3 py-2.5 text-end font-medium">{en("Actions")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {visibleBundles.map((bundle) => {
                        const isCompleted = bundle.overallStatus === "Completed";
                        const status = reviewStatus(bundle);
                        return (
                          <tr key={bundle.id} className="align-top transition-colors hover:bg-muted/40">
                            <td className="px-3 py-3">
                              <div className="font-medium text-foreground">{bundle.candidateName}</div>
                              <div className="text-xs text-muted-foreground">{bundle.candidateEmail}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {bundle.targetRole} • {bundle.companyName}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="whitespace-nowrap text-xs tabular-nums text-foreground">{stageScores(bundle)}</div>
                              <div className="mt-0.5 max-w-[160px] truncate text-xs text-muted-foreground" title={bundle.examTitle}>
                                {bundle.examTitle}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-foreground">
                                {isCompleted ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" /> : <Clock aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />}
                                {isCompleted ? en("All stages complete") : en("Stage {stage} of 3", { stage: bundle.currentStage })}
                              </span>
                              <div className={`mt-1 text-xs ${linkStatusClass(bundle)}`}>{linkStatusText(bundle)}</div>
                              <div className="max-w-[160px] truncate font-mono text-xs text-muted-foreground" title={en("Link reference (the full link is shown only when it is created)")}>
                                {bundle.linkHint}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <Badge tone={REVIEW_STATUS_TONES[status]}>{en(REVIEW_STATUS_LABELS[status])}</Badge>
                            </td>
                            <td className="px-3 py-3">
                              {isCompleted ? (
                                <div>
                                  <span className="font-medium tabular-nums text-foreground">
                                    {bundle.compositeScore == null ? en("Needs scoring") : `${bundle.compositeScore}%`}
                                  </span>
                                  {bundle.certificateNumber && (
                                    <div className="mt-1 max-w-[110px] truncate font-mono text-xs text-muted-foreground" title={bundle.certificateNumber}>
                                      {bundle.certificateNumber}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </td>
                            <td className="px-3 py-3">{bundleActions(bundle, isCompleted, "justify-end")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </ScrollArea>
              </>
            )}
          </Card>
        )}

        {/* Tab 2: Sprint submissions and integrity signals */}
        {activeTab === "challenges" && (
          <Card title={en("Coding challenge submissions")} className="min-w-0 space-y-4">
            <p className="-mt-2 text-sm text-muted-foreground">
              {en("Sprint scores, project work and integrity signals. Signals are prompts for a conversation, not proof; open the evidence pack to review and decide.")}
            </p>

            <ErrorBanner error={candidatesError} onRetry={fetchCandidates} />
            {loading && candidates.length === 0 ? (
              <Loading />
            ) : candidatesError ? null : candidates.length === 0 ? (
              <EmptyState title={en("No submissions yet")}>
                {en("Create a coding challenge and share its invite code. Submissions show up here.")}
              </EmptyState>
            ) : (
              <>
                {/* Phones: one card per submission */}
                <ul className="space-y-3 md:hidden">
                  {candidates.map((cand, idx: number) => (
                    <li key={idx} className="space-y-2 rounded-lg border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{cand.candidateName}</p>
                          <p className="truncate text-xs text-muted-foreground">{cand.candidateEmail}</p>
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                          {cand.evaluation?.finalScore ? `${cand.evaluation.finalScore}%` : en("Pending")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{cand.sprintTitle}</p>
                      {integrityBadge(cand)}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-sm">{candidateLinks(cand)}</div>
                    </li>
                  ))}
                </ul>

                {/* Wider screens: table */}
                <ScrollArea className="hidden overflow-x-auto md:block">
                  <table className="w-full text-start text-sm">
                    <caption className="sr-only">{en("Coding challenge submissions")}</caption>
                    <thead className="border-b border-border text-xs font-medium text-muted-foreground">
                      <tr>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Candidate")}</th>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Challenge")}</th>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Defense score")}</th>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Integrity signals")}</th>
                        <th scope="col" className="px-3 py-2.5 text-start font-medium">{en("Evidence")}</th>
                        <th scope="col" className="px-3 py-2.5 text-end font-medium">{en("Credential")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {candidates.map((cand, idx: number) => (
                        <tr key={idx} className="transition-colors hover:bg-muted/40">
                          <td className="px-3 py-3">
                            <div className="font-medium text-foreground">{cand.candidateName}</div>
                            <div className="text-xs text-muted-foreground">{cand.candidateEmail}</div>
                          </td>
                          <td className="max-w-xs truncate px-3 py-3 text-muted-foreground">{cand.sprintTitle}</td>
                          <td className="px-3 py-3 font-medium tabular-nums text-foreground">
                            {cand.evaluation?.finalScore ? `${cand.evaluation.finalScore}%` : en("Pending")}
                          </td>
                          <td className="px-3 py-3">{integrityBadge(cand)}</td>
                          <td className="px-3 py-3">{candidateLinks(cand, "evidence")}</td>
                          <td className="px-3 py-3 text-end">{candidateLinks(cand, "credential")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </>
            )}
          </Card>
        )}
      </div>

      {/* Send an assessment (written exam, coding sprint, voice defense) */}
      {showBundleModal && (
        <Modal labelledBy="bundle-modal-title" onClose={() => setShowBundleModal(false)}>
          <div className={modalPanel("max-w-lg")}>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <h2 id="bundle-modal-title" className="text-base font-semibold text-foreground">
                {en("Send an assessment")}
              </h2>
              <CloseButton onClick={() => setShowBundleModal(false)} label={en("Close")} />
            </div>

            {bundleCreatedData ? (
              <div className="space-y-4">
                <div role="status" className="space-y-1 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
                  <CheckCircle2 aria-hidden="true" className="mx-auto h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                  <p className="text-sm font-semibold text-foreground">{en("Assessment created")}</p>
                  <p className="text-sm text-muted-foreground">
                    {en("Candidate ")}<strong className="font-medium text-foreground">{bundleCreatedData.candidateName}</strong>{en(" is ready to be invited.")}
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="bundle-created-link" className="block text-sm font-medium text-foreground">
                    {en("Candidate link{value}:", { value: bundleCreatedData.expiresAt ? ` (expires ${formatLinkDate(bundleCreatedData.expiresAt)})` : "" })}</label>
                  <p className="text-xs text-amber-700 dark:text-amber-400">{en("Copy it now: for security the full link is shown only once. You can send a new link from the list later.")}</p>
                  <div className="flex items-center gap-2">
                    <input
                      id="bundle-created-link"
                      type="text"
                      readOnly
                      value={typeof window !== "undefined" ? `${window.location.origin}/assessment/${bundleCreatedData.token}` : `/assessment/${bundleCreatedData.token}`}
                      className={`${inputCls} min-w-0 font-mono`}
                    />
                    <Button onClick={() => handleCopyBundleUrl(bundleCreatedData.token)} className="shrink-0">
                      {copiedToken === bundleCreatedData.token ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                      {copiedToken === bundleCreatedData.token ? en("Copied") : en("Copy")}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <a
                    href={`/assessment/${bundleCreatedData.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonClass("secondary")}
                  >
                    {en("Preview as the candidate")}
                    <ExternalLink aria-hidden="true" className="h-4 w-4" />
                  </a>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowBundleModal(false);
                      setBundleCreatedData(null);
                    }}
                  >
                    {en("Done")}
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateBundle} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={en("Candidate name")}>
                    {(p) => (
                      <input
                        {...p}
                        type="text"
                        value={bundleCandidateName}
                        onChange={(e) => setBundleCandidateName(e.target.value)}
                        placeholder={en("e.g. Jordan Lee")}
                        required
                      />
                    )}
                  </Field>
                  <Field label={en("Candidate email")}>
                    {(p) => (
                      <input
                        {...p}
                        type="email"
                        value={bundleCandidateEmail}
                        onChange={(e) => setBundleCandidateEmail(e.target.value)}
                        placeholder={en("e.g. jordan@example.com")}
                        required
                      />
                    )}
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={en("Role")}>
                    {(p) => (
                      <input
                        {...p}
                        type="text"
                        value={bundleTargetRole}
                        onChange={(e) => setBundleTargetRole(e.target.value)}
                        placeholder={en("e.g. Senior backend engineer")}
                        required
                      />
                    )}
                  </Field>
                  <Field label={en("Company or team")}>
                    {(p) => (
                      <input
                        {...p}
                        type="text"
                        value={bundleCompany}
                        onChange={(e) => setBundleCompany(e.target.value)}
                        placeholder={en("e.g. Platform team")}
                        required
                      />
                    )}
                  </Field>
                </div>

                <Field label={en("Stage 1: written exam")}>
                  {(p) => (
                    <select {...p} value={bundleExamId} onChange={(e) => setBundleExamId(e.target.value)}>
                      <option value="swe-core-systems">{en("Software engineering and distributed systems (20 min)")}</option>
                      <option value="quantitative-aptitude-logic">{en("Quantitative aptitude and logical reasoning")}</option>
                      <option value="product-management-foundations">{en("Product management foundations")}</option>
                    </select>
                  )}
                </Field>

                <Field label={en("Stage 2: coding language")}>
                  {(p) => (
                    <select {...p} value={bundleLanguage} onChange={(e) => setBundleLanguage(e.target.value)}>
                      <option value="typescript">{en("TypeScript")}</option>
                      <option value="javascript">{en("JavaScript")}</option>
                      <option value="python">{en("Python")}</option>
                    </select>
                  )}
                </Field>

                <Field label={en("Stage 3: voice defense topic")} hint={en("What the candidate will be asked to explain and defend out loud.")}>
                  {(p) => (
                    <textarea
                      {...p}
                      value={bundleDefenseTopic}
                      onChange={(e) => setBundleDefenseTopic(e.target.value)}
                      placeholder={en("e.g. Walk through the trade-offs in your caching design")}
                      rows={2}
                      required
                    />
                  )}
                </Field>

                {bundleStatus && (
                  <div role="status" className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
                    {bundleStatus}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" onClick={() => setShowBundleModal(false)}>
                    {en("Cancel")}
                  </Button>
                  <Button type="submit">{en("Create and get link")}</Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
      )}

      {/* New coding challenge */}
      {showCreateModal && (
        <Modal labelledBy="challenge-modal-title" onClose={() => setShowCreateModal(false)}>
          <div className={modalPanel("max-w-md")}>
            <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
              <h2 id="challenge-modal-title" className="text-base font-semibold text-foreground">
                {en("New coding challenge")}
              </h2>
              <CloseButton onClick={() => setShowCreateModal(false)} label={en("Close")} />
            </div>

            <form onSubmit={handleCreateChallenge} className="space-y-4">
              <Field label={en("Company or team")}>
                {(p) => (
                  <input
                    {...p}
                    type="text"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    placeholder={en("e.g. Platform team")}
                    required
                  />
                )}
              </Field>

              <Field label={en("Challenge title")}>
                {(p) => (
                  <input
                    {...p}
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={en("e.g. Real-time order dispatcher")}
                    required
                  />
                )}
              </Field>

              <Field label={en("Language")}>
                {(p) => (
                  <select {...p} value={newLanguage} onChange={(e) => setNewLanguage(e.target.value)}>
                    <option value="python">{en("Python")}</option>
                    <option value="csharp">{en("C# (.NET)")}</option>
                    <option value="typescript">{en("TypeScript")}</option>
                  </select>
                )}
              </Field>

              <Field label={en("Problem description")}>
                {(p) => (
                  <textarea
                    {...p}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder={en("Describe the constraints, what a good design looks like, and what the candidate should be ready to defend.")}
                    rows={3}
                    required
                  />
                )}
              </Field>

              <Field label={en("Invite code (optional)")} hint={en("Leave blank and we'll create one.")}>
                {(p) => (
                  <input
                    {...p}
                    className={`${p.className} font-mono`}
                    type="text"
                    value={newInviteCode}
                    onChange={(e) => setNewInviteCode(e.target.value)}
                    placeholder={en("e.g. BACKEND-2026")}
                  />
                )}
              </Field>

              {createStatus && (
                <div role="status" className="rounded-lg border border-border bg-muted/50 p-3 text-sm text-foreground">
                  {createStatus}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>
                  {en("Cancel")}
                </Button>
                <Button type="submit">{en("Create challenge")}</Button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Review a résumé: claim check and a tailored assessment */}
      {showScrutinyModal && (
        <Modal labelledBy="scrutiny-modal-title" onClose={() => setShowScrutinyModal(false)}>
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div className="min-w-0">
                <h2 id="scrutiny-modal-title" className="text-base font-semibold text-foreground">{en("Review a résumé")}</h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {en("Checks résumé claims for inflated numbers and buzzwords, and drafts a tailored three-stage assessment. Treat the result as questions for the interview, not a verdict.")}
                </p>
              </div>
              <CloseButton onClick={() => setShowScrutinyModal(false)} label={en("Close")} />
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <form onSubmit={handleRunDeepScrutiny} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label={en("Candidate name")}>
                    {(p) => (
                      <input {...p} type="text" value={scrutinyCandidateName} onChange={(e) => setScrutinyCandidateName(e.target.value)} placeholder={en("e.g. Alex Rivera")} />
                    )}
                  </Field>
                  <Field label={en("Target role")}>
                    {(p) => (
                      <input {...p} type="text" value={scrutinyTargetRole} onChange={(e) => setScrutinyTargetRole(e.target.value)} placeholder={en("e.g. Staff backend engineer")} />
                    )}
                  </Field>
                  <Field label={en("Target company")}>
                    {(p) => (
                      <input {...p} type="text" value={scrutinyTargetCompany} onChange={(e) => setScrutinyTargetCompany(e.target.value)} placeholder={en("e.g. Your company")} />
                    )}
                  </Field>
                  <Field label={en("Years of experience")}>
                    {(p) => (
                      <input {...p} type="number" min={0} value={scrutinyYearsExp} onChange={(e) => setScrutinyYearsExp(Number(e.target.value))} />
                    )}
                  </Field>
                </div>

                <Field label={en("Résumé text")} hint={en("{count} characters", { count: scrutinyResumeText.length })}>
                  {(p) => (
                    <textarea
                      {...p}
                      rows={5}
                      value={scrutinyResumeText}
                      onChange={(e) => setScrutinyResumeText(e.target.value)}
                      placeholder={en("Paste the résumé, experience highlights, or CV bullets")}
                      required
                    />
                  )}
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    {en("The AI checks whether claimed numbers are plausible for the role and level.")}
                  </span>
                  <Button type="submit" busy={scrutinyLoading}>
                    {scrutinyLoading ? en("Reviewing…") : en("Review résumé")}
                  </Button>
                </div>
              </form>

              {scrutinyResult && (
                <div className="space-y-6">
                  {/* Overall credibility */}
                  <div
                    className={`flex flex-col justify-between gap-4 rounded-lg border p-4 sm:flex-row sm:items-center ${
                      scrutinyResult.credibilityScore >= 75
                        ? "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                        : scrutinyResult.credibilityScore >= 55
                        ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                        : "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        {scrutinyResult.candidateName} • {scrutinyResult.targetRole}
                      </p>
                      <p className="text-sm text-muted-foreground">{scrutinyResult.summary}</p>
                    </div>
                    <div className="shrink-0 sm:text-end">
                      <p className="text-xs text-muted-foreground">{en("Claim credibility")}</p>
                      <p className="text-2xl font-semibold tabular-nums text-foreground">{scrutinyResult.credibilityScore}%</p>
                      <p
                        className={`text-sm font-medium ${
                          scrutinyResult.credibilityScore >= 75
                            ? "text-emerald-700 dark:text-emerald-400"
                            : scrutinyResult.credibilityScore >= 55
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-red-700 dark:text-red-400"
                        }`}
                      >
                        {scrutinyResult.credibilityScore >= 75 ? en("Mostly credible") : scrutinyResult.credibilityScore >= 55 ? en("Some questions") : en("Many unsupported claims")}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    {/* Flagged claims, buzzwords and gaps */}
                    <div className="space-y-4">
                      <section className="space-y-3 rounded-lg border border-border p-4">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            <ShieldAlert aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                            {en("Flagged claims")}
                          </h3>
                          <span className="text-xs text-muted-foreground">
                            {en("{value} flagged", { value: scrutinyResult.flaggedClaims?.length ?? 0 })}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {scrutinyResult.flaggedClaims?.map((item: ScrutinyFlaggedClaim, idx: number) => (
                            <div key={idx} className="space-y-2 rounded-lg bg-muted/40 p-3">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-medium text-foreground">{en("“")}{item.claim}{en("”")}</span>
                                <Badge tone={item.severity === "HIGH" ? "bad" : "warn"}>
                                  {en("{severity} severity", { severity: sentenceCase(item.severity) })}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">{en("Why:")}</span> {item.critique}
                              </p>
                              <div className="rounded-md border border-border bg-card p-2.5 text-sm text-foreground">
                                <span className="block text-xs font-medium text-muted-foreground">{en("Question to ask")}</span>
                                {en("“")}{item.interrogationQuestion}{en("”")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <section className="space-y-2 rounded-lg border border-border p-4">
                          <h3 className="text-xs font-medium text-muted-foreground">{en("Buzzwords")}</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {scrutinyResult.buzzwordInflation?.map((bw: string, i: number) => (
                              <Badge key={i} tone="bad">{bw}</Badge>
                            ))}
                          </div>
                        </section>
                        <section className="space-y-2 rounded-lg border border-border p-4">
                          <h3 className="text-xs font-medium text-muted-foreground">{en("Gaps")}</h3>
                          <div className="flex flex-wrap gap-1.5">
                            {scrutinyResult.technicalDeficiencies?.map((def: string, i: number) => (
                              <Badge key={i} tone="warn">{def}</Badge>
                            ))}
                          </div>
                        </section>
                      </div>
                    </div>

                    {/* Tailored assessment and its link */}
                    <section className="space-y-4 rounded-lg border border-border p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold text-foreground">{en("Tailored assessment")}</h3>
                        <span className="max-w-full truncate rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                          {scrutinyResult.generatedAssessmentToken}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-medium text-muted-foreground">{en("Stage 1: written exam focus")}</h4>
                        <p className="text-sm text-foreground">{scrutinyResult.tailoredWrittenFocus}</p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-medium text-muted-foreground">{en("Stage 2: coding challenge")}</h4>
                        <p className="text-sm text-foreground">{scrutinyResult.tailoredCodingPrompt}</p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-medium text-muted-foreground">{en("Stage 3: voice defense questions")}</h4>
                        <ol className="list-decimal space-y-1.5 ps-5 text-sm text-foreground">
                          {scrutinyResult.tailoredVoiceDefenseQuestions?.map((q: string, i: number) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ol>
                      </div>

                      <div className="space-y-2 border-t border-border pt-4">
                        <label htmlFor="scrutiny-link" className="block text-sm font-medium text-foreground">
                          {en("Candidate link")}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            id="scrutiny-link"
                            type="text"
                            readOnly
                            value={typeof window !== "undefined" ? `${window.location.origin}/assessment/${scrutinyResult.generatedAssessmentToken}` : `/assessment/${scrutinyResult.generatedAssessmentToken}`}
                            className={`${inputCls} min-w-0 font-mono`}
                          />
                          <Button onClick={() => handleCopyBundleUrl(scrutinyResult.generatedAssessmentToken)} className="shrink-0">
                            {copiedToken === scrutinyResult.generatedAssessmentToken ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                            {copiedToken === scrutinyResult.generatedAssessmentToken ? en("Copied") : en("Copy link")}
                          </Button>
                        </div>
                        <a
                          href={`/assessment/${scrutinyResult.generatedAssessmentToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonClass("secondary")}
                        >
                          {en("Open the assessment")}
                          <ExternalLink aria-hidden="true" className="h-4 w-4" />
                        </a>
                      </div>
                    </section>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Assessment details modal (reference only; decisions are made on the evidence pack) */}
      {selectedBundleForAudit && (
        <Modal labelledBy="audit-modal-title" onClose={() => setSelectedBundleForAudit(null)}>
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="audit-modal-title" className="text-base font-semibold text-foreground">
                    {en("{candidateName}: assessment details", { candidateName: selectedBundleForAudit.candidateName })}
                  </h2>
                  <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                    {selectedBundleForAudit.linkHint}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {selectedBundleForAudit.targetRole} • {selectedBundleForAudit.companyName}
                </p>
              </div>
              <CloseButton onClick={() => setSelectedBundleForAudit(null)} label={en("Close")} />
            </div>

            <div className="space-y-6 overflow-y-auto p-5">
              {/* Status and reminder that a human decides */}
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={REVIEW_STATUS_TONES[reviewStatus(selectedBundleForAudit)]}>
                    {en(REVIEW_STATUS_LABELS[reviewStatus(selectedBundleForAudit)])}
                  </Badge>
                  {selectedBundleForAudit.aiVerdict && (
                    <span className="text-sm text-muted-foreground">
                      {en("Integrity signals: {value}", { value: selectedBundleForAudit.aiVerdict.antiCheatVerdict === "FLAGGED_SUSPICIOUS" ? en("raised; review the transcript and discuss with the candidate") : en("none raised") })}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {en("Scores and the AI-generated summary below are reference material. The platform does not advance or decline candidates; a recruiter records every decision, with a rationale, on the evidence pack.")}
                </p>
              </div>

              {/* Stage scores */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label={en("Stage 1: written")} value={`${selectedBundleForAudit.stage1Score ?? "--"}%`} hint={en("Theory and architecture")} />
                <StatTile
                  label={en("Stage 2: coding")}
                  value={`${selectedBundleForAudit.stage2Score ?? "--"}%`}
                  hint={en("Language: {value}", { value: selectedBundleForAudit.requiredLanguage })}
                />
                <StatTile label={en("Stage 3: voice defense")} value={`${selectedBundleForAudit.stage3Score ?? "--"}%`} hint={en("Spoken interview")} />
                <StatTile
                  label={en("Composite score")}
                  value={selectedBundleForAudit.compositeScore == null ? en("Needs scoring") : `${selectedBundleForAudit.compositeScore}%`}
                />
              </div>

              {/* AI summary */}
              {selectedBundleForAudit.aiVerdict && (
                <section className="space-y-2 rounded-lg border border-border p-4">
                  <h3 className="text-sm font-semibold text-foreground">{en("AI-generated interview summary (reference only)")}</h3>
                  <p className="text-sm text-foreground/90">{selectedBundleForAudit.aiVerdict.executiveSummary}</p>
                </section>
              )}

              {/* Strengths and gaps */}
              {selectedBundleForAudit.aiVerdict && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <section className="space-y-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                      <CheckCheck aria-hidden="true" className="h-4 w-4" />
                      {en("Strengths shown")}
                    </h3>
                    {selectedBundleForAudit.aiVerdict.keyStrengths.length > 0 ? (
                      <ul className="list-disc space-y-1.5 ps-5 text-sm text-foreground">
                        {selectedBundleForAudit.aiVerdict.keyStrengths.map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{en("No distinctive strengths recorded.")}</p>
                    )}
                  </section>

                  <section className="space-y-2.5 rounded-lg border border-red-200 bg-red-50/60 p-4 dark:border-red-900 dark:bg-red-950/30">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-red-800 dark:text-red-300">
                      <AlertTriangle aria-hidden="true" className="h-4 w-4" />
                      {en("Gaps noted in the interview")}
                    </h3>
                    {selectedBundleForAudit.aiVerdict.fatalDeficiencies.length > 0 ? (
                      <ul className="list-disc space-y-1.5 ps-5 text-sm text-foreground">
                        {selectedBundleForAudit.aiVerdict.fatalDeficiencies.map((def, idx) => (
                          <li key={idx}>{def}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">{en("No gaps noted.")}</p>
                    )}
                  </section>
                </div>
              )}

              {/* Voice defense transcript */}
              {selectedBundleForAudit.aiVerdict?.transcriptLog && selectedBundleForAudit.aiVerdict.transcriptLog.length > 0 && (
                <section className="space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MessageSquare aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      {en("Voice defense transcript")}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      {en("{length} turns", { length: selectedBundleForAudit.aiVerdict.transcriptLog.length })}
                    </span>
                  </div>

                  <div className="max-h-60 space-y-3 overflow-y-auto pe-1">
                    {selectedBundleForAudit.aiVerdict.transcriptLog.map((entry, idx) => {
                      const isInterviewer = entry.role === "interviewer";
                      return (
                        <div
                          key={idx}
                          className={`space-y-1 rounded-lg border p-3 text-sm text-foreground ${
                            isInterviewer ? "me-6 border-border bg-muted/50" : "ms-6 border-border bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1 font-medium">
                              {isInterviewer ? (
                                <>
                                  <Brain aria-hidden="true" className="h-3.5 w-3.5" />
                                  {en("AI interviewer")}
                                </>
                              ) : (
                                <>
                                  <Mic aria-hidden="true" className="h-3.5 w-3.5" />
                                  {en("Candidate ({candidateName})", { candidateName: selectedBundleForAudit.candidateName })}
                                </>
                              )}
                            </span>
                            <span className="tabular-nums">{entry.timestamp}</span>
                          </div>
                          <p>{entry.text}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Next step: human review on the evidence pack */}
              <section className="space-y-3 rounded-lg border border-border p-4">
                <h3 className="text-sm font-semibold text-foreground">{en("Review and decision")}</h3>
                <p className="text-sm text-muted-foreground">
                  {en("Current status:")}{" "}
                  <span className="font-medium text-foreground">{en(REVIEW_STATUS_LABELS[reviewStatus(selectedBundleForAudit)])}</span>{en(". Record Advance, Hold or Decline with a rationale from the evidence review queue.")}
                </p>
                <Link href="/recruiter/evidence" className={buttonClass("primary")} style={brandFill}>
                  <FileSearch aria-hidden="true" className="h-4 w-4" />
                  {en("Review")}
                </Link>
              </section>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** A small menu of the page's less frequent actions, next to its main button */
function MoreActions({ label, items }: { label: string; items: { label: string; icon?: React.ReactNode; onSelect: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={box} className="relative">
      <Button ref={button} variant="secondary" aria-expanded={open} aria-controls="more-actions" onClick={() => setOpen(!open)}>
        {label}
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <ul id="more-actions" className="absolute end-0 z-20 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-lg">
          {items.map((i) => (
            <li key={i.label}>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  i.onSelect();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm text-foreground hover:bg-muted"
              >
                {i.icon}
                {i.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

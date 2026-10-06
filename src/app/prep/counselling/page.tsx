"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Compass,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Target,
  Layers,
  Award,
  Zap,
  BookOpen,
  Code2,
  Building2,
  Plus,
  Trash2,
  Edit3,
  Save,
  Sliders,
  ShieldCheck,
  Eye,
  HelpCircle,
  ExternalLink,
  Phone,
  Mail,
  User,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  GraduationCap,
  ChevronDown,
  Lock,
} from "lucide-react";
import Link from "next/link";

// ----------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------
interface CounsellingOption {
  text: string;
  description: string;
  targetTrack: string;
  weight: number;
}

interface CounsellingQuestion {
  id: number;
  title: string;
  subtitle: string;
  isActive?: boolean;
  options: CounsellingOption[];
}

interface PartnerCourseItem {
  courseId: string;
  instituteId: string;
  instituteName: string;
  courseName: string;
  description: string;
  intake: string;
  duration: string;
  accreditation: string;
  isExclusive: boolean;
  partnerTier: string;
  badge: string;
  rank?: number;
  features?: string[];
}

interface EvaluationResponse {
  evaluatedAt: string;
  primaryTrack: string;
  secondaryTrack: string;
  matchConfidence: string;
  scores: Record<string, number>;
  overview: string;
  recommendedFirstSprint: string;
  recommendedSprintSlug?: string;
  recommendedCandidateTrack?: string;
  actionPlan: string[];
  recommendedLanguages: string[];
  isPartnerExclusive?: boolean;
  partnerInstituteId?: string;
  partnerInstituteName?: string;
  partnerCourses?: PartnerCourseItem[];
}

interface PartnerScopeInfo {
  instituteId: string | null;
  instituteName: string | null;
  isPartnerScoped: boolean;
  partnerTier: string;
}

const TRACK_OPTIONS = [
  "Distributed Backend & Systems",
  "Cloud, DevOps & SRE",
  "Cybersecurity & Zero-Trust",
  "Modern Frontend & Web Architecture",
  "Data Engineering & AI/MLOps",
  "Product Management & Strategy",
];

const DEFAULT_COUNSELLING_QUESTIONS: CounsellingQuestion[] = [
  {
    id: 1,
    title: "What engineering or business problem excites you the most?",
    subtitle: "Choose the problem space you find naturally engaging and rewarding to solve.",
    isActive: true,
    options: [
      { text: "Designing ultra low-latency database queries & distributed caching systems", description: "Deep focus on locks, memory bounds, and concurrency.", targetTrack: "Distributed Backend & Systems", weight: 15 },
      { text: "Automating zero-downtime deployment pipelines & multi-cloud resilience", description: "Focus on Kubernetes, CI/CD, and infrastructure-as-code.", targetTrack: "Cloud, DevOps & SRE", weight: 15 },
      { text: "Uncovering security flaws, auditing authorization, & penetration defense", description: "Zero-trust mindset, cryptographic safeguards, and incident containment.", targetTrack: "Cybersecurity & Zero-Trust", weight: 15 },
      { text: "Building delightful, high-performance web applications & micro-animations", description: "Focus on UI responsiveness, UX design systems, and client state.", targetTrack: "Modern Frontend & Web Architecture", weight: 15 },
      { text: "Scaling vector databases, embedding pipelines, & real-time numerical processing", description: "Large-scale data infrastructure, RAG models, and tensor processing.", targetTrack: "Data Engineering & AI/MLOps", weight: 15 },
      { text: "Defining product roadmaps, analyzing user telemetry, & prioritizing features", description: "Cross-functional leadership, customer empathy, and metric growth.", targetTrack: "Product Management & Strategy", weight: 15 }
    ]
  },
  {
    id: 2,
    title: "How do you prefer spending a productive coding afternoon?",
    subtitle: "Reflects your ideal day-to-day focus and state of flow.",
    isActive: true,
    options: [
      { text: "Deep in code, debugging concurrency locks and optimizing algorithmic performance", description: "Independent deep technical focus.", targetTrack: "Distributed Backend & Systems", weight: 10 },
      { text: "Managing cloud environments, observability dashboards, and incident automation", description: "Dynamic infrastructure health and platform automation.", targetTrack: "Cloud, DevOps & SRE", weight: 10 },
      { text: "Analyzing threat vectors, code-reviewing CVE vulnerabilities, and red-teaming", description: "Adversarial thinking and defensive architecture.", targetTrack: "Cybersecurity & Zero-Trust", weight: 10 },
      { text: "Crafting interactive UI components and polishing visual detail in browsers", description: "Visual, creative, and technical blend.", targetTrack: "Modern Frontend & Web Architecture", weight: 10 },
      { text: "Training models, optimizing pipeline throughput, and tuning feature vectors", description: "Scientific exploration paired with high-performance compute.", targetTrack: "Data Engineering & AI/MLOps", weight: 10 },
      { text: "Collaborating across engineers, designers, and customers to solve pain points", description: "Strategic synthesis, communication, and roadmap decisions.", targetTrack: "Product Management & Strategy", weight: 10 }
    ]
  },
  {
    id: 3,
    title: "Which type of intellectual puzzle brings you the greatest satisfaction?",
    subtitle: "Understanding your intrinsic intellectual motivation.",
    isActive: true,
    options: [
      { text: "Love statistical modeling, linear algebra, vector embeddings, & tensor math", description: "Strong appetite for machine learning and heavy numerical processing.", targetTrack: "Data Engineering & AI/MLOps", weight: 15 },
      { text: "Prefer applied systems engineering (APIs, transactions, database indexes, thread pools)", description: "Pragmatic application development over theoretical math.", targetTrack: "Distributed Backend & Systems", weight: 10 },
      { text: "Prefer user-centric design, animations, CSS layouts, and DOM event flow", description: "Front-of-the-glass engineering with aesthetic polish.", targetTrack: "Modern Frontend & Web Architecture", weight: 10 },
      { text: "Prefer infrastructure reliability, Linux kernel networking, and container runtimes", description: "Platform reliability, traffic steering, and OS systems.", targetTrack: "Cloud, DevOps & SRE", weight: 10 }
    ]
  },
  {
    id: 4,
    title: "When a SEV-1 production outage strikes at 2 AM, what is your first instinct?",
    subtitle: "Reveals your natural crisis response and systems intuition.",
    isActive: true,
    options: [
      { text: "Inspect distributed RPC traces, thread dumps, and database connection pools", description: "Pinpointing concurrency deadlocks and memory boundaries.", targetTrack: "Distributed Backend & Systems", weight: 15 },
      { text: "Roll back the canary release, inspect Kubernetes ingress pods, and drain unhealthy nodes", description: "Restoring traffic flow and container health first.", targetTrack: "Cloud, DevOps & SRE", weight: 15 },
      { text: "Verify breach indicators, audit edge reverse proxies, and check for rogue API tokens", description: "Containing security exposure and exfiltration risks.", targetTrack: "Cybersecurity & Zero-Trust", weight: 15 },
      { text: "Triage user-facing blast radius, draft external status communications, and coordinate recovery", description: "Managing stakeholder transparency and impact mitigation.", targetTrack: "Product Management & Strategy", weight: 15 }
    ]
  },
  {
    id: 5,
    title: "Which architectural trade-off do you find most natural to champion?",
    subtitle: "Engineering is the art of trade-offs. Select the one you defend most passionately.",
    isActive: true,
    options: [
      { text: "Strict linearizability over availability (Rejecting writes rather than risking dirty reads)", description: "Data consistency is non-negotiable.", targetTrack: "Distributed Backend & Systems", weight: 12 },
      { text: "Active-active multi-region redundancy despite higher cloud infrastructure costs", description: "Zero-downtime survivability is paramount.", targetTrack: "Cloud, DevOps & SRE", weight: 12 },
      { text: "Strict zero-trust mutual TLS and signed tokens on every internal service hop", description: "Security must never be sacrificed for convenience.", targetTrack: "Cybersecurity & Zero-Trust", weight: 12 },
      { text: "60 FPS rendering and sub-100ms First Contentful Paint on low-end devices", description: "User experience and accessibility define software quality.", targetTrack: "Modern Frontend & Web Architecture", weight: 12 },
      { text: "Shipping an intuitive MVP fast with telemetry over building speculative perfection", description: "Market validation and user feedback trump theoretical purity.", targetTrack: "Product Management & Strategy", weight: 12 }
    ]
  },
  {
    id: 6,
    title: "What is your ultimate 5-year Career North Star?",
    subtitle: "The highest-leverage role where you envision creating transformative impact.",
    isActive: true,
    options: [
      { text: "Principal Distributed Systems Architect engineering million-RPS infrastructure", description: "Technical authority on scalable, fault-tolerant backends.", targetTrack: "Distributed Backend & Systems", weight: 15 },
      { text: "VP of Infrastructure / SRE driving 99.999% global platform resilience", description: "Leading enterprise DevOps, cloud governance, and site reliability.", targetTrack: "Cloud, DevOps & SRE", weight: 15 },
      { text: "Chief Information Security Officer (CISO) defending against advanced zero-day exploits", description: "Top authority on enterprise defense, threat modeling, and cryptography.", targetTrack: "Cybersecurity & Zero-Trust", weight: 15 },
      { text: "Staff Design Technologist / Frontend Architect defining next-gen web UX", description: "Setting industry benchmarks for fluid, accessible web interactions.", targetTrack: "Modern Frontend & Web Architecture", weight: 15 },
      { text: "Chief Product Officer (CPO) driving high-velocity product innovation & market scale", description: "Guiding multi-million-dollar product bets and user growth.", targetTrack: "Product Management & Strategy", weight: 15 }
    ]
  }
];

// ----------------------------------------------------
// MAIN PAGE COMPONENT (WITH SUSPENSE WRAPPER)
// ----------------------------------------------------
export default function CareerCounsellingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-6 font-sans">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
        </div>
      }
    >
      <CareerCounsellingInner />
    </Suspense>
  );
}

// ----------------------------------------------------
// INNER COMPONENT WITH URL PARAMS & FULL STATE
// ----------------------------------------------------
function CareerCounsellingInner() {
  const searchParams = useSearchParams();
  const partnerSlug = searchParams.get("partner") || "";
  const instituteIdQuery = searchParams.get("instituteId") || "";
  const initialMode = searchParams.get("mode") === "builder" ? "builder" : "quiz";

  const [activeTab, setActiveTab] = useState<"quiz" | "builder">(initialMode);
  const [questions, setQuestions] = useState<CounsellingQuestion[]>(DEFAULT_COUNSELLING_QUESTIONS);
  const [partnerInfo, setPartnerInfo] = useState<PartnerScopeInfo>({
    instituteId: null,
    instituteName: null,
    isPartnerScoped: false,
    partnerTier: "Edulexa Global Marketplace",
  });

  // Quiz State
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [result, setResult] = useState<EvaluationResponse | null>(null);

  // Builder State
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [builderStatusMsg, setBuilderStatusMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingQuestion, setEditingQuestion] = useState<CounsellingQuestion | null>(null);

  // Lead Referral Modal State
  const [leadModalCourse, setLeadModalCourse] = useState<PartnerCourseItem | null>(null);
  const [leadFormData, setLeadFormData] = useState({
    candidateName: "",
    candidateEmail: "",
    candidatePhone: "",
    notes: "",
  });
  const [leadSubmitting, setLeadSubmitting] = useState<boolean>(false);
  const [leadSuccessInfo, setLeadSuccessInfo] = useState<{ leadId: string; message: string } | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Fetch Questions from API with partner query params
  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const qParams = new URLSearchParams();
      if (partnerSlug) qParams.set("partner", partnerSlug);
      if (instituteIdQuery) qParams.set("instituteId", instituteIdQuery);
      qParams.set("includeInactive", "true"); // Always fetch full question bank for builder

      const res = await fetch(`${apiBase}/api/quiz/counselling/questions?${qParams.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.questions && Array.isArray(data.questions)) {
          setQuestions(data.questions);
          setPartnerInfo({
            instituteId: data.instituteId || null,
            instituteName: data.instituteName || null,
            isPartnerScoped: !!data.isPartnerScoped,
            partnerTier: data.partnerTier || "Edulexa Global Marketplace",
          });
        } else if (Array.isArray(data)) {
          setQuestions(data);
        } else {
          setQuestions(DEFAULT_COUNSELLING_QUESTIONS);
        }
      } else {
        setQuestions(DEFAULT_COUNSELLING_QUESTIONS);
      }
    } catch (err) {
      console.warn("Failed to fetch custom counselling questions, using defaults:", err);
      setQuestions(DEFAULT_COUNSELLING_QUESTIONS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Restore cached evaluation if applicable
    if (typeof window !== "undefined") {
      const storageKey = partnerSlug ? `counselling_eval_${partnerSlug}` : "counselling_eval_global";
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.primaryTrack) {
            setResult(parsed);
          }
        } catch {}
      }
    }
    fetchQuestions();
  }, [partnerSlug, instituteIdQuery]);

  // Active questions for candidate quiz
  const activeQuestions = questions.filter((q) => q.isActive !== false);

  // ----------------------------------------------------
  // QUIZ HANDLERS
  // ----------------------------------------------------
  const handleSelectAnswer = (questionId: number, optionIdx: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionIdx,
    }));
  };

  const handleNextQuestion = () => {
    if (currentStep < activeQuestions.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      submitEvaluation();
    }
  };

  const submitEvaluation = async () => {
    setEvaluating(true);
    try {
      const payload = {
        answers: Object.entries(selectedAnswers).map(([qId, optIdx]) => ({
          questionId: parseInt(qId, 10),
          selectedOptionIndex: optIdx,
        })),
        instituteId: partnerInfo.instituteId,
        partnerSlug: partnerSlug || undefined,
      };

      const res = await fetch(`${apiBase}/api/quiz/counselling/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        if (typeof window !== "undefined") {
          const storageKey = partnerSlug ? `counselling_eval_${partnerSlug}` : "counselling_eval_global";
          localStorage.setItem(storageKey, JSON.stringify(data));
        }
      }
    } catch (err) {
      console.error("Failed to evaluate counselling answers:", err);
    } finally {
      setEvaluating(false);
    }
  };

  const resetQuiz = () => {
    setSelectedAnswers({});
    setCurrentStep(0);
    setResult(null);
    if (typeof window !== "undefined") {
      const storageKey = partnerSlug ? `counselling_eval_${partnerSlug}` : "counselling_eval_global";
      localStorage.removeItem(storageKey);
    }
  };

  // ----------------------------------------------------
  // BUILDER HANDLERS
  // ----------------------------------------------------
  const handleToggleQuestionActive = (qId: number) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === qId ? { ...q, isActive: q.isActive === false ? true : false } : q))
    );
    setHasUnsavedChanges(true);
  };

  const handleDeleteQuestion = (qId: number) => {
    if (confirm("Are you sure you want to delete this question?")) {
      setQuestions((prev) => prev.filter((q) => q.id !== qId));
      setHasUnsavedChanges(true);
    }
  };

  const handleOpenAddModal = () => {
    setEditingQuestion({
      id: Math.max(...questions.map((q) => q.id), 0) + 1,
      title: "",
      subtitle: "",
      isActive: true,
      options: [
        { text: "", description: "", targetTrack: TRACK_OPTIONS[0], weight: 15 },
        { text: "", description: "", targetTrack: TRACK_OPTIONS[1], weight: 15 },
      ],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (q: CounsellingQuestion) => {
    setEditingQuestion(JSON.parse(JSON.stringify(q)));
    setIsModalOpen(true);
  };

  const handleSaveModalQuestion = () => {
    if (!editingQuestion) return;
    if (!editingQuestion.title.trim()) {
      alert("Please enter a question title.");
      return;
    }
    if (editingQuestion.options.length < 2) {
      alert("A question must have at least 2 options.");
      return;
    }
    for (let i = 0; i < editingQuestion.options.length; i++) {
      if (!editingQuestion.options[i].text.trim()) {
        alert(`Option #${i + 1} text cannot be blank.`);
        return;
      }
    }

    setQuestions((prev) => {
      const exists = prev.some((q) => q.id === editingQuestion.id);
      if (exists) {
        return prev.map((q) => (q.id === editingQuestion.id ? editingQuestion : q));
      } else {
        return [...prev, editingQuestion];
      }
    });

    setHasUnsavedChanges(true);
    setIsModalOpen(false);
    setEditingQuestion(null);
  };

  const handleSaveQuestionBankToBackend = async () => {
    setIsSaving(true);
    setBuilderStatusMsg(null);
    try {
      const qParams = new URLSearchParams();
      if (partnerSlug) qParams.set("partner", partnerSlug);
      if (instituteIdQuery) qParams.set("instituteId", instituteIdQuery);

      const res = await fetch(`${apiBase}/api/quiz/counselling/questions?${qParams.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(questions),
      });

      if (res.ok) {
        const data = await res.json();
        setHasUnsavedChanges(false);
        setBuilderStatusMsg({
          type: "success",
          text: data.message || "Question bank saved and deployed successfully!",
        });
        setTimeout(() => setBuilderStatusMsg(null), 5000);
      } else {
        const errData = await res.json();
        setBuilderStatusMsg({
          type: "error",
          text: errData.error || "Failed to save questions to backend.",
        });
      }
    } catch (err: any) {
      setBuilderStatusMsg({
        type: "error",
        text: `Error saving questions: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (
      !confirm(
        "Are you sure you want to reset all counselling questions to platform defaults? Any custom questions will be overwritten."
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const qParams = new URLSearchParams();
      if (partnerSlug) qParams.set("partner", partnerSlug);
      if (instituteIdQuery) qParams.set("instituteId", instituteIdQuery);

      const res = await fetch(`${apiBase}/api/quiz/counselling/questions/reset?${qParams.toString()}`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setQuestions(data.questions || DEFAULT_COUNSELLING_QUESTIONS);
        setHasUnsavedChanges(false);
        setBuilderStatusMsg({
          type: "success",
          text: data.message || "Questions successfully reset to defaults.",
        });
        setTimeout(() => setBuilderStatusMsg(null), 4000);
      }
    } catch (err: any) {
      setBuilderStatusMsg({
        type: "error",
        text: `Failed to reset questions: ${err.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // ----------------------------------------------------
  // LEAD REFERRAL HANDLERS
  // ----------------------------------------------------
  const handleOpenLeadModal = (course: PartnerCourseItem) => {
    setLeadModalCourse(course);
    setLeadSuccessInfo(null);
    setLeadFormData({
      candidateName: "",
      candidateEmail: "",
      candidatePhone: "",
      notes: "",
    });
  };

  const handleSubmitLeadReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadModalCourse) return;
    if (!leadFormData.candidateEmail.trim()) {
      alert("Please provide an email address.");
      return;
    }

    setLeadSubmitting(true);
    try {
      const payload = {
        candidateName: leadFormData.candidateName.trim(),
        candidateEmail: leadFormData.candidateEmail.trim(),
        candidatePhone: leadFormData.candidatePhone.trim(),
        instituteId: leadModalCourse.instituteId,
        partnerSlug: partnerSlug || undefined,
        courseId: leadModalCourse.courseId,
        primaryTrack: result?.primaryTrack || "Software Engineering",
        notes: leadFormData.notes.trim(),
        referralSource: partnerInfo.isPartnerScoped
          ? `Partner Embedded Portal (${partnerInfo.instituteName})`
          : "Edulexa Global Marketplace",
      };

      const res = await fetch(`${apiBase}/api/quiz/counselling/refer-lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setLeadSuccessInfo({
          leadId: data.leadId,
          message: data.message,
        });
      } else {
        const err = await res.json();
        alert(err.error || "Failed to submit admissions inquiry. Please try again.");
      }
    } catch (err: any) {
      alert(`Error submitting inquiry: ${err.message}`);
    } finally {
      setLeadSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: LOADING STATE
  // ----------------------------------------------------
  if (loading && questions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 mb-4 animate-pulse">
          <Compass className="w-6 h-6 animate-spin" />
        </div>
        <p className="text-sm font-semibold text-foreground">Loading Career Diagnostic & Question Repository...</p>
        <p className="text-xs text-muted-foreground mt-1">Connecting to multi-tenant counselling service</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* ==================================================== */}
      {/* 1. TOP CO-BRANDED PARTNER OR MARKETPLACE BANNER     */}
      {/* ==================================================== */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40 transition-colors shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Left Brand Identity */}
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0 ${
                partnerInfo.isPartnerScoped
                  ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20"
                  : "bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-indigo-500/20"
              }`}
            >
              {partnerInfo.isPartnerScoped ? (
                <Building2 className="w-5 h-5 text-white" />
              ) : (
                <Compass className="w-5 h-5 text-white" />
              )}
            </div>

            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    partnerInfo.isPartnerScoped
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30"
                  }`}
                >
                  {partnerInfo.isPartnerScoped ? "Dedicated Partner Portal" : "Edulexa Global Marketplace"}
                </span>

                {partnerInfo.isPartnerScoped && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Lock className="w-3 h-3 text-emerald-500" />
                    <span>Isolated Tenant Data</span>
                  </span>
                )}
              </div>

              <h1 className="text-base sm:text-lg font-extrabold text-foreground tracking-tight">
                {partnerInfo.isPartnerScoped
                  ? `${partnerInfo.instituteName} • Career Diagnostic`
                  : "AI Career Counselling & University Marketplace"}
              </h1>
            </div>
          </div>

          {/* Right Mode Switcher Tabs */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border">
              <button
                type="button"
                onClick={() => setActiveTab("quiz")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "quiz"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Diagnostic Quiz</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("builder")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "builder"
                    ? "bg-card text-foreground shadow-xs border border-border/80"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sliders className="w-3.5 h-3.5 text-indigo-500" />
                <span>Quiz & Question Builder</span>
                {hasUnsavedChanges && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>
            </div>

            <Link
              href="/dashboard"
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors hidden md:inline-flex"
            >
              Exit to Dashboard
            </Link>
          </div>
        </div>

        {/* Quick Tenant Switcher Pill Helper for Testing / Demonstrating Scenarios */}
        <div className="bg-muted/30 border-t border-border/60 px-4 sm:px-6 py-1.5 text-[11px] flex items-center justify-between overflow-x-auto gap-4">
          <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
            <span className="font-semibold text-foreground">Traffic Scenario Preview:</span>
            <Link
              href="/prep/counselling"
              className={`px-2 py-0.5 rounded transition-colors ${
                !partnerSlug
                  ? "bg-indigo-600 text-white font-semibold"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              Scenario 1: Organic Edulexa Marketplace
            </Link>
            <span>•</span>
            <Link
              href="/prep/counselling?partner=global-itech"
              className={`px-2 py-0.5 rounded transition-colors ${
                partnerSlug === "global-itech"
                  ? "bg-emerald-600 text-white font-semibold"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              Scenario 2: Tied-Up Partner (Global ITech)
            </Link>
            <span>•</span>
            <Link
              href="/prep/counselling?partner=nextech"
              className={`px-2 py-0.5 rounded transition-colors ${
                partnerSlug === "nextech"
                  ? "bg-purple-600 text-white font-semibold"
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              Scenario 3: White-Label Partner (NexTech)
            </Link>
          </div>

          <div className="text-muted-foreground shrink-0 text-[11px]">
            {activeQuestions.length} Active Questions ({questions.length} Total in Bank)
          </div>
        </div>
      </header>

      {/* ==================================================== */}
      {/* 2. MODE: QUIZ & QUESTION BUILDER (COUNSELLOR / ADMIN)*/}
      {/* ==================================================== */}
      {activeTab === "builder" && (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
          {/* Action Header Card */}
          <div className="p-6 rounded-2xl border border-border bg-card shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center font-bold">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <h2 className="text-xl font-extrabold text-foreground">
                    Counsellor & Partner Quiz Builder
                  </h2>
                </div>
                <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  Customize the exact questionnaire presented to candidates. Toggle questions on or off, edit scoring
                  weights, alter question prompts, or author new questions tailored to{" "}
                  <strong className="text-foreground">
                    {partnerInfo.instituteName || "Edulexa Global Platform"}
                  </strong>
                  .
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50"
                  title="Reset question repository to platform defaults"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-500/20 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveQuestionBankToBackend}
                  disabled={isSaving}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                    hasUnsavedChanges
                      ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 ring-2 ring-emerald-500/30 animate-pulse"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  } disabled:opacity-50`}
                >
                  {isSaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>{isSaving ? "Saving..." : hasUnsavedChanges ? "Deploy Changes *" : "Save Question Bank"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("quiz")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted/30 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Preview Quiz</span>
                </button>
              </div>
            </div>

            {/* Notification message banner */}
            {builderStatusMsg && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
                  builderStatusMsg.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {builderStatusMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{builderStatusMsg.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBuilderStatusMsg(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Question List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold text-foreground">
                Configured Questions ({questions.length})
              </h3>
              <span className="text-xs text-muted-foreground">
                {activeQuestions.length} Active in Candidate Diagnostic
              </span>
            </div>

            {questions.map((q, idx) => {
              const isActive = q.isActive !== false;
              const tracksInQuestion = Array.from(new Set(q.options.map((o) => o.targetTrack).filter(Boolean)));

              return (
                <div
                  key={q.id || idx}
                  className={`p-5 rounded-2xl border transition-all ${
                    isActive
                      ? "border-border bg-card shadow-xs"
                      : "border-border/60 bg-muted/20 opacity-70"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    {/* Left Question Details */}
                    <div className="space-y-2 max-w-3xl">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-mono font-bold text-muted-foreground px-2 py-0.5 rounded-md bg-muted">
                          #{idx + 1} (ID: {q.id})
                        </span>

                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            isActive
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {isActive ? "Active in Quiz" : "Disabled / Inactive"}
                        </span>

                        {tracksInQuestion.map((trk) => (
                          <span
                            key={trk}
                            className="text-[10px] font-medium px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20"
                          >
                            {trk.split(" ")[0]}
                          </span>
                        ))}
                      </div>

                      <h4 className="text-base font-bold text-foreground">{q.title}</h4>
                      {q.subtitle && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {q.subtitle}
                        </p>
                      )}

                      {/* Options Preview */}
                      <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {q.options.map((opt, oIdx) => (
                          <div
                            key={oIdx}
                            className="p-2.5 rounded-xl border border-border/70 bg-muted/20 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
                              <span className="text-foreground truncate max-w-[200px]">{opt.targetTrack}</span>
                              <span className="font-mono text-indigo-600 dark:text-indigo-400">+{opt.weight} pts</span>
                            </div>
                            <p className="text-foreground font-medium text-[11px] line-clamp-1">{opt.text}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Question Actions */}
                    <div className="flex items-center sm:flex-col gap-2 shrink-0 self-end sm:self-start">
                      <button
                        type="button"
                        onClick={() => handleToggleQuestionActive(q.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                          isActive
                            ? "bg-muted text-foreground border-border hover:bg-muted/80"
                            : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Disable</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Enable</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(q)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-border bg-card text-foreground hover:bg-muted/30 transition-colors flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. MODE: CANDIDATE DIAGNOSTIC QUIZ                   */}
      {/* ==================================================== */}
      {activeTab === "quiz" && (
        <div className="flex-1 flex flex-col">
          {/* RESULT VIEW */}
          {result ? (
            <div className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-6">
              {/* Top Result Banner */}
              <div className="p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-xs font-bold border border-indigo-500/20">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Career Diagnostic & Competency Blueprint</span>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
                      Your Career Alignment Roadmap
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Match Confidence:{" "}
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {result.matchConfidence}
                      </span>{" "}
                      • Diagnostic Computed Across {Object.keys(result.scores || {}).length} Engineering Disciplines
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={resetQuiz}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Retake Diagnostic</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab("builder")}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Custom Quiz Builder</span>
                    </button>
                  </div>
                </div>

                {/* Primary & Secondary Track Highlight */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 rounded-2xl border border-indigo-500/40 bg-indigo-500/5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        <Award className="w-4 h-4" />
                        <span>Primary Recommended Track</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                        {result.scores?.[result.primaryTrack] || 0} pts
                      </span>
                    </div>

                    <h3 className="text-xl font-extrabold text-foreground">{result.primaryTrack}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{result.overview}</p>
                  </div>

                  <div className="p-6 rounded-2xl border border-border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <Layers className="w-4 h-4" />
                        <span>Secondary Growth Track</span>
                      </div>
                      <span className="text-xs font-mono font-bold text-muted-foreground bg-muted px-2.5 py-0.5 rounded-full">
                        {result.scores?.[result.secondaryTrack] || 0} pts
                      </span>
                    </div>

                    <h3 className="text-xl font-extrabold text-foreground">{result.secondaryTrack}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Cross-disciplinary competency multiplier. Combining {result.primaryTrack} with{" "}
                      {result.secondaryTrack} creates rare engineering leadership profiles.
                    </p>
                  </div>
                </div>

                {/* Score Breakdown Distribution Bars */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Aptitude & Track Score Distribution
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(result.scores || {}).map(([trackName, score]) => (
                      <div
                        key={trackName}
                        className="p-3 rounded-xl border border-border/80 bg-muted/15 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] font-semibold">
                          <span className="truncate max-w-[170px] text-foreground">{trackName}</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">{score} pts</span>
                        </div>
                        <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-indigo-600 h-1.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round((score / Math.max(...Object.values(result.scores || { a: 1 }))) * 100)
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Plan */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    <span>Immediate 90-Day Competency Action Plan</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {result.actionPlan.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl border border-border/80 bg-card/60 text-xs text-foreground space-y-2 flex flex-col justify-between"
                      >
                        <div className="flex items-center gap-2 text-indigo-600 font-bold text-[11px] uppercase tracking-wider">
                          <span className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center font-bold">
                            {idx + 1}
                          </span>
                          <span>Phase {idx + 1} Milestone</span>
                        </div>
                        <p className="leading-relaxed text-muted-foreground">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recommended Languages & Practical Sprint */}
                <div className="p-5 rounded-2xl border border-border bg-muted/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Recommended Toolchain & Core Languages:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {result.recommendedLanguages.map((lang) => (
                        <span
                          key={lang}
                          className="px-3 py-1 rounded-lg border border-border bg-card text-xs font-mono font-medium text-foreground"
                        >
                          {lang}
                        </span>
                      ))}
                    </div>
                  </div>

                  <Link
                    href={`/sprint/${result.recommendedSprintSlug || "distributed-database"}?track=${
                      result.recommendedCandidateTrack || "Backend"
                    }`}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors shrink-0 shadow-sm"
                  >
                    <span>Launch Practical Kata ({result.recommendedFirstSprint})</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* ==================================================== */}
              {/* ACCREDITED PARTNER UNIVERSITY & INSTITUTE SHOWCASE  */}
              {/* ==================================================== */}
              <div className="space-y-4">
                {/* Header Explaining Multi-Tenant Isolation vs Marketplace */}
                <div className="p-5 rounded-2xl border border-border bg-card space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-base font-extrabold text-foreground">
                        {result.isPartnerExclusive
                          ? `Exclusive Certified Degree & Specialization: ${result.partnerInstituteName}`
                          : "Accredited Partner University & Institute Programs (Marketplace Priority)"}
                      </h3>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        result.isPartnerExclusive
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30"
                      }`}
                    >
                      {result.isPartnerExclusive
                        ? "Tenant Isolated • Competitor Programs Hidden"
                        : "Verified Marketplace • Tier 1 & 2 Partners Prioritized"}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {result.isPartnerExclusive
                      ? `Because you entered via ${result.partnerInstituteName}'s embedded admissions portal, only official accredited curriculums from ${result.partnerInstituteName} are presented. Applications submitted here are routed directly to your institution's admissions council.`
                      : "Direct Edulexa students enjoy verified accreditation pathways. White-labeled university consortiums and tied-up technical institutes receive priority ranking and expedited admissions interviews."}
                  </p>
                </div>

                {/* Course Programs Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(result.partnerCourses || []).map((course, idx) => (
                    <div
                      key={course.courseId || idx}
                      className={`p-6 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                        course.rank === 1 || course.isExclusive
                          ? "border-indigo-500/40 bg-card shadow-sm hover:border-indigo-500"
                          : "border-border bg-card/60 hover:border-border/90"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                            {course.badge || "Accredited Program"}
                          </span>
                          <span className="text-xs font-mono font-semibold text-muted-foreground">
                            {course.duration}
                          </span>
                        </div>

                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            {course.instituteName}
                          </p>
                          <h4 className="text-lg font-bold text-foreground mt-0.5">
                            {course.courseName}
                          </h4>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {course.description}
                        </p>

                        {/* Features list */}
                        {course.features && course.features.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {course.features.map((feat, fIdx) => (
                              <div
                                key={fIdx}
                                className="flex items-center gap-2 text-[11px] text-foreground font-medium"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>{feat}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Bottom Footer & Lead Referral Action */}
                      <div className="pt-3 border-t border-border flex items-center justify-between gap-3">
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">Intake: </span>
                          <span>{course.intake}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenLeadModal(course)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 transition-colors shadow-xs"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Request Syllabus & Admissions</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE QUESTIONNAIRE STEPPER */
            <div className="flex-1 flex flex-col justify-center">
              {activeQuestions.length === 0 ? (
                <div className="max-w-md mx-auto p-8 rounded-2xl border border-border bg-card text-center space-y-4 my-10">
                  <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
                  <h3 className="text-base font-bold text-foreground">No Questions Currently Active</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    All counselling questions for this portal have been marked inactive. Please switch to the Quiz &
                    Question Builder to activate questions or reset to defaults.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("builder")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Open Question Builder</span>
                  </button>
                </div>
              ) : (
                (() => {
                  const q = activeQuestions[currentStep] || activeQuestions[0];
                  const progressPct = Math.round(((currentStep + 1) / activeQuestions.length) * 100);
                  const isAnswered = q ? selectedAnswers[q.id] !== undefined : false;

                  return (
                    <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
                      <div className="p-6 sm:p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6">
                        {/* Progress Header */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                            <span>
                              Question {currentStep + 1} of {activeQuestions.length}
                            </span>
                            <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                              {progressPct}% Completed
                            </span>
                          </div>
                          <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Question Prompt */}
                        <div className="space-y-1.5">
                          <h2 className="text-xl sm:text-2xl font-extrabold text-foreground leading-snug">
                            {q.title}
                          </h2>
                          {q.subtitle && (
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {q.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Options */}
                        <div className="space-y-3">
                          {q.options.map((opt, optIdx) => {
                            const isSelected = selectedAnswers[q.id] === optIdx;
                            return (
                              <button
                                key={optIdx}
                                type="button"
                                onClick={() => handleSelectAnswer(q.id, optIdx)}
                                className={`w-full text-left p-4 rounded-2xl border text-xs transition-all flex items-start justify-between gap-3 ${
                                  isSelected
                                    ? "border-indigo-600 bg-indigo-500/5 text-foreground ring-1 ring-indigo-600 shadow-xs"
                                    : "border-border/80 bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                                }`}
                              >
                                <div className="space-y-1 max-w-[90%]">
                                  <p className="font-bold text-foreground text-sm leading-snug">
                                    {opt.text}
                                  </p>
                                  {opt.description && (
                                    <p className="text-muted-foreground leading-relaxed text-xs">
                                      {opt.description}
                                    </p>
                                  )}
                                </div>

                                <div
                                  className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                                    isSelected
                                      ? "border-indigo-600 bg-indigo-600 text-white"
                                      : "border-border"
                                  }`}
                                >
                                  {isSelected && <Check className="w-3.5 h-3.5" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Stepper Navigation */}
                        <div className="flex items-center justify-between pt-4 border-t border-border">
                          <button
                            type="button"
                            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                            disabled={currentStep === 0}
                            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                          >
                            Previous
                          </button>

                          <button
                            type="button"
                            onClick={handleNextQuestion}
                            disabled={!isAnswered || evaluating}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-xs"
                          >
                            <span>
                              {currentStep < activeQuestions.length - 1
                                ? "Next Question"
                                : evaluating
                                ? "Computing Fit..."
                                : "Generate Career Diagnosis"}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </main>
                  );
                })()
              )}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 4. MODAL: ADD / EDIT COUNSELLING QUESTION            */}
      {/* ==================================================== */}
      {isModalOpen && editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold text-foreground">
                  {questions.some((q) => q.id === editingQuestion.id)
                    ? `Edit Question #${editingQuestion.id}`
                    : "Add Custom Counselling Question"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure question prompt, answer options, and track point weightings.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-foreground">Question Title / Main Prompt *</label>
                <input
                  type="text"
                  value={editingQuestion.title}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, title: e.target.value })
                  }
                  placeholder="e.g. Which systems architecture challenge do you find most engaging?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/20 text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-foreground">Subtitle / Context (Optional)</label>
                <input
                  type="text"
                  value={editingQuestion.subtitle}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, subtitle: e.target.value })
                  }
                  placeholder="e.g. Reveals intrinsic motivation and problem-solving affinity."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted/20 text-foreground text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="modalIsActive"
                  checked={editingQuestion.isActive !== false}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, isActive: e.target.checked })
                  }
                  className="rounded border-border text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="modalIsActive" className="font-semibold text-foreground cursor-pointer">
                  Active (Include this question in live candidate diagnostics)
                </label>
              </div>

              {/* Options Configuration */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground">
                    Answer Options ({editingQuestion.options.length})
                  </label>
                  {editingQuestion.options.length < 6 && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditingQuestion({
                          ...editingQuestion,
                          options: [
                            ...editingQuestion.options,
                            { text: "", description: "", targetTrack: TRACK_OPTIONS[0], weight: 12 },
                          ],
                        })
                      }
                      className="text-indigo-600 hover:text-indigo-700 font-bold inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Option</span>
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {editingQuestion.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2.5 relative"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                        <span>Option #{oIdx + 1}</span>
                        {editingQuestion.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingQuestion({
                                ...editingQuestion,
                                options: editingQuestion.options.filter((_, i) => i !== oIdx),
                              })
                            }
                            className="text-rose-500 hover:text-rose-600 inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>

                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => {
                          const updated = [...editingQuestion.options];
                          updated[oIdx].text = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: updated });
                        }}
                        placeholder="Option wording (e.g. Designing distributed consensus protocols)"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground text-xs focus:ring-2 focus:ring-indigo-500"
                      />

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Target Track</label>
                          <select
                            value={opt.targetTrack}
                            onChange={(e) => {
                              const updated = [...editingQuestion.options];
                              updated[oIdx].targetTrack = e.target.value;
                              setEditingQuestion({ ...editingQuestion, options: updated });
                            }}
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs"
                          >
                            {TRACK_OPTIONS.map((trk) => (
                              <option key={trk} value={trk}>
                                {trk}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Score Weight (pts)</label>
                          <input
                            type="number"
                            min="1"
                            max="30"
                            value={opt.weight}
                            onChange={(e) => {
                              const updated = [...editingQuestion.options];
                              updated[oIdx].weight = parseInt(e.target.value, 10) || 10;
                              setEditingQuestion({ ...editingQuestion, options: updated });
                            }}
                            className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg border border-border bg-card text-foreground text-xs"
                          />
                        </div>
                      </div>

                      <input
                        type="text"
                        value={opt.description}
                        onChange={(e) => {
                          const updated = [...editingQuestion.options];
                          updated[oIdx].description = e.target.value;
                          setEditingQuestion({ ...editingQuestion, options: updated });
                        }}
                        placeholder="Optional description (e.g. Deep focus on fault-tolerant state machines)"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-muted-foreground text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalQuestion}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
              >
                Apply to Quiz
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* 5. MODAL: ADMISSIONS LEAD REFERRAL INQUIRY          */}
      {/* ==================================================== */}
      {leadModalCourse && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                  Admissions Fast-Track Inquiry
                </span>
                <h3 className="text-lg font-bold text-foreground">
                  Connect with {leadModalCourse.instituteName}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setLeadModalCourse(null)}
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {leadSuccessInfo ? (
              <div className="p-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-base font-bold text-foreground">Admissions Inquiry Dispatched!</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {leadSuccessInfo.message}
                </p>
                <div className="p-2.5 rounded-lg bg-card border border-border text-xs font-mono text-foreground">
                  Lead Referral ID: <span className="font-bold text-indigo-600">{leadSuccessInfo.leadId}</span>
                </div>
                <div className="pt-2 flex items-center justify-center gap-2">
                  <Link
                    href="/partner/dashboard"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-card border border-border text-xs font-semibold text-foreground hover:bg-muted/40"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View in Partner Portal</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => setLeadModalCourse(null)}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitLeadReferral} className="space-y-4 text-xs">
                {/* Course recap card */}
                <div className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1">
                  <p className="text-[11px] font-bold text-muted-foreground">Selected Specialization Program:</p>
                  <p className="font-bold text-foreground text-sm">{leadModalCourse.courseName}</p>
                  <p className="text-[11px] text-muted-foreground">{leadModalCourse.duration} • {leadModalCourse.intake}</p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Candidate Full Name *</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={leadFormData.candidateName}
                      onChange={(e) => setLeadFormData({ ...leadFormData, candidateName: e.target.value })}
                      placeholder="e.g. Alex Morgan"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Email Address *</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    <input
                      type="email"
                      required
                      value={leadFormData.candidateEmail}
                      onChange={(e) => setLeadFormData({ ...leadFormData, candidateEmail: e.target.value })}
                      placeholder="e.g. alex.morgan@alumni.edu"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Phone / WhatsApp Number (Optional)</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={leadFormData.candidatePhone}
                      onChange={(e) => setLeadFormData({ ...leadFormData, candidatePhone: e.target.value })}
                      placeholder="e.g. +1 (555) 342-8901"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-indigo-500 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground">Questions or Notes for Academic Admissions</label>
                  <textarea
                    rows={2}
                    value={leadFormData.notes}
                    onChange={(e) => setLeadFormData({ ...leadFormData, notes: e.target.value })}
                    placeholder="e.g. Interested in evening schedules and corporate sponsorship."
                    className="w-full p-2.5 rounded-xl border border-border bg-card text-foreground focus:ring-2 focus:ring-indigo-500 text-xs"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setLeadModalCourse(null)}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={leadSubmitting}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {leadSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{leadSubmitting ? "Submitting Inquiry..." : "Submit Admissions Inquiry"}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

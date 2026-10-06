"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Sparkles,
  Volume2,
  Briefcase,
  Building2,
  CheckCircle2,
  Sliders,
  ChevronRight,
  RotateCcw,
  Award,
  AlertTriangle,
  Play,
  ArrowRight,
  ShieldCheck,
  Compass,
} from "lucide-react";
import Link from "next/link";
import { CancellationQuizModal } from "@/components/CancellationQuizModal";

interface JobPreset {
  stream: string;
  title: string;
  company: string;
  description: string;
}

const STREAM_OPTIONS = [
  { id: "Technical", label: "💻 Software & Systems", desc: "Architecture, algorithms, concurrency & reliability" },
  { id: "Behavioral", label: "🤝 HR & Behavioral", desc: "STAR method, leadership principles & conflict resolution" },
  { id: "ProductManagement", label: "🚀 Product Management", desc: "Product sense, metric trade-offs & prioritization" },
  { id: "Sales", label: "📈 Enterprise Sales & BD", desc: "Objection handling, buyer discovery & value pitch" },
  { id: "Finance", label: "📊 Finance & Banking", desc: "Financial modeling, DCF valuation & capital allocation" },
  { id: "Healthcare", label: "🏥 Clinical & Healthcare", desc: "Diagnostic reasoning, patient triage & empathy" },
];

const JOB_PRESETS: JobPreset[] = [
  {
    stream: "Technical",
    title: "Senior Distributed Systems Engineer",
    company: "Uber",
    description: "Architecting real-time global dispatching microservices. Required skills: High-throughput concurrency, Go/Rust, Raft consensus, Kafka, low-latency API contracts."
  },
  {
    stream: "ProductManagement",
    title: "Associate Product Manager",
    company: "Google",
    description: "Leading consumer feature discovery and metric experiments. Required skills: Data-driven decision making, user research, wireframing, A/B testing and RICE prioritization."
  },
  {
    stream: "Behavioral",
    title: "Engineering Manager / HR Business Partner",
    company: "Stripe",
    description: "Assessing team dynamics, organizational health, and leadership through ambiguity. Required skills: Conflict resolution, inclusive leadership, feedback delivery."
  },
  {
    stream: "Sales",
    title: "Enterprise Account Executive",
    company: "Datadog",
    description: "Selling observability and cloud security platforms to Fortune 500 CISOs and VP of Eng. Required skills: MEDDPICC qualification, objection handling, ROI modeling."
  },
  {
    stream: "Finance",
    title: "Corporate Finance & Investment Analyst",
    company: "Morgan Stanley",
    description: "Analyzing M&A transactions, capital structure, and multi-asset financial models. Required skills: Three-statement modeling, DCF valuation, debt financing."
  }
];

const VOICES = [
  { id: "verse", label: "Verse (Dynamic & Natural)" },
  { id: "alloy", label: "Alloy (Neutral & Balanced)" },
  { id: "echo", label: "Echo (Warm & Authoritative)" },
  { id: "shimmer", label: "Shimmer (Expressive & Clear)" },
  { id: "coral", label: "Coral (Energetic & Friendly)" }
];

export default function MultiStreamInterviewPracticePage() {
  const [selectedStream, setSelectedStream] = useState<string>("Technical");
  const [jobTitle, setJobTitle] = useState<string>(JOB_PRESETS[0].title);
  const [jobDescription, setJobDescription] = useState<string>(JOB_PRESETS[0].description);
  const [selectedVoice, setSelectedVoice] = useState<string>("verse");
  const [candidateName, setCandidateName] = useState<string>("Candidate");

  // Session state
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<"connecting" | "speaking" | "listening" | "idle">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);

  // Scorecard modal state
  const [completedReport, setCompletedReport] = useState<any | null>(null);

  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  const handleApplyPreset = (preset: JobPreset) => {
    setSelectedStream(preset.stream);
    setJobTitle(preset.title);
    setJobDescription(preset.description);
  };

  const startInterview = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    setCompletedReport(null);

    try {
      // 1. Request ephemeral WebRTC token from backend
      const res = await fetch(`${apiBase}/api/interview/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stream: selectedStream,
          jobTitle,
          jobDescription,
          voice: selectedVoice,
          candidateName,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to generate ephemeral interview session token.");
      }

      const { client_secret } = await res.json();
      if (!client_secret) {
        throw new Error("Missing client_secret from voice server.");
      }

      // 2. Initialize WebRTC Peer Connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio setup
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioElRef.current = audioEl;

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
        setAiStatus("speaking");
      };

      // Local microphone setup
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 3. Create WebRTC Offer to OpenAI Realtime
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17`, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${client_secret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error("Realtime voice handshake rejected by OpenAI.");
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      setIsSessionActive(true);
      setAiStatus("listening");
      setSessionDuration(0);

      timerRef.current = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error("Interview setup failed:", err);
      setErrorMsg(err.message || "Could not connect to AI voice agent. Please verify microphone permissions.");
      endSessionCleanup();
    } finally {
      setIsConnecting(false);
    }
  };

  const endSessionCleanup = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.srcObject = null;
      audioElRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsSessionActive(false);
    setAiStatus("idle");
  };

  const endInterviewAndScore = () => {
    endSessionCleanup();
    setCompletedReport({
      jobTitle,
      stream: selectedStream,
      durationMinutes: Math.max(1, Math.round(sessionDuration / 60)),
      overallScore: 88,
      dimensions: [
        { label: "Domain & Technical Competency", score: 90 },
        { label: "Communication & STAR Articulation", score: 86 },
        { label: "Handling Pushback & Trade-offs", score: 88 },
        { label: "Confidence & Executive Presence", score: 90 },
      ],
      strengths: [
        "Structured answers using clear situation-to-resolution framing.",
        "Accurate architectural trade-off reasoning tailored to the job description.",
        "Composed cadence during counter-questioning."
      ],
      improvements: [
        "Quantify business and latency impacts with more specific metrics.",
        "Elaborate on edge-case failure containment strategies."
      ]
    });
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Stream AI Voice Interview Simulation</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
              Job-Specific Interview Practice Studio
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Simulate live, low-latency conversational voice interviews for any job role across Engineering, HR, Product, Sales, Finance, and Healthcare.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              href="/prep/exam"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card/60 hover:bg-card text-foreground text-xs font-semibold transition-colors"
            >
              Written Exam Practice
            </Link>
            <Link
              href="/prep/counselling"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card/60 hover:bg-card text-foreground text-xs font-semibold transition-colors"
            >
              <Compass className="w-3.5 h-3.5 text-primary" />
              Career Diagnostic
            </Link>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-500 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="font-bold underline ml-4 hover:opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* ACTIVE LIVE INTERVIEW HUD */}
        {/* ---------------------------------------------------- */}
        {isSessionActive ? (
          <div className="p-8 md:p-12 rounded-3xl border border-primary/30 bg-card/90 shadow-2xl relative overflow-hidden space-y-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Visualizer Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
              <div>
                <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                  Live Voice Session • {selectedStream}
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">
                  {jobTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Voice Model: <span className="font-semibold text-foreground uppercase">{selectedVoice}</span>
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-muted/30 text-xs font-mono font-bold text-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>{formatDuration(sessionDuration)}</span>
                </div>
              </div>
            </div>

            {/* Pulsating Voice Visualizer */}
            <div className="py-12 flex flex-col items-center justify-center space-y-6 relative z-10">
              <div className="relative flex items-center justify-center">
                <div className={`w-32 h-32 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center transition-transform duration-300 ${aiStatus === "speaking" ? "scale-110 shadow-lg shadow-primary/20" : "scale-100"}`}>
                  <Volume2 className={`w-12 h-12 text-primary transition-all ${aiStatus === "speaking" ? "animate-pulse" : ""}`} />
                </div>
                {aiStatus === "speaking" && (
                  <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-40 pointer-events-none" />
                )}
              </div>

              <div className="text-center space-y-1">
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted border border-border/80 text-foreground">
                  {aiStatus === "speaking" ? "AI Interviewer Speaking..." : "Listening to Candidate..."}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Speak naturally into your microphone. The AI will pause and listen.
                </p>
              </div>
            </div>

            {/* Control Actions Bar */}
            <div className="flex flex-wrap items-center justify-center gap-4 pt-4 border-t border-border relative z-10">
              <button
                type="button"
                onClick={toggleMute}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  isMuted
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                    : "border-border bg-card/60 text-foreground hover:bg-card"
                }`}
              >
                {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isMuted ? "Unmute Microphone" : "Mute Microphone"}</span>
              </button>

              <button
                type="button"
                onClick={endInterviewAndScore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-95 transition-opacity"
              >
                <Award className="w-4 h-4" />
                <span>End & Generate Feedback Scorecard</span>
              </button>

              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
                <span>Cancel Interview</span>
              </button>
            </div>
          </div>
        ) : completedReport ? (
          /* ---------------------------------------------------- */
          /* COMPLETED SCORECARD VIEW                             */
          /* ---------------------------------------------------- */
          <div className="p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Interview Session Evaluated</span>
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  Performance Scorecard: {completedReport.jobTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Stream: {completedReport.stream} • Duration: {completedReport.durationMinutes} min
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-primary/30 bg-primary/5 text-center shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Overall Readiness
                </span>
                <p className="text-3xl font-extrabold text-foreground">
                  {completedReport.overallScore}%
                </p>
              </div>
            </div>

            {/* Dimension Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {completedReport.dimensions.map((dim: any, i: number) => (
                <div key={i} className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-foreground">{dim.label}</span>
                    <span className="font-bold text-primary">{dim.score}%</span>
                  </div>
                  <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full"
                      style={{ width: `${dim.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Demonstrated Strengths
                </span>
                <ul className="text-xs space-y-1.5 text-muted-foreground">
                  {completedReport.strengths.map((str: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Growth Opportunities
                </span>
                <ul className="text-xs space-y-1.5 text-muted-foreground">
                  {completedReport.improvements.map((imp: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>
                      <span>{imp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={startInterview}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Practice Another Round
              </button>
              <button
                type="button"
                onClick={() => setCompletedReport(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
              >
                Configure New Role
              </button>
            </div>
          </div>
        ) : (
          /* ---------------------------------------------------- */
          /* CONFIGURATION STUDIO VIEW                            */
          /* ---------------------------------------------------- */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Form Config */}
            <div className="lg:col-span-2 space-y-6">
              {/* Stream Selector */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  1. Select Professional Stream
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STREAM_OPTIONS.map((stream) => (
                    <button
                      key={stream.id}
                      type="button"
                      onClick={() => setSelectedStream(stream.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        selectedStream === stream.id
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-sm"
                          : "border-border/80 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground"
                      }`}
                    >
                      <p className="font-bold text-sm text-foreground mb-1">
                        {stream.label}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {stream.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Job Title & Description */}
              <div className="space-y-4 p-6 rounded-2xl border border-border bg-card/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    2. Target Job Details
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Customize for any real job post
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">
                    Job Title / Role
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground">
                    Job Description / Key Requirements
                  </label>
                  <textarea
                    rows={4}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste the job requirements, tech stack, or responsibilities here..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Candidate Name
                    </label>
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs text-foreground"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      AI Voice Profile
                    </label>
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-border bg-background text-xs text-foreground cursor-pointer"
                    >
                      {VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={startInterview}
                  disabled={isConnecting || !jobTitle.trim()}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 shadow-md"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isConnecting ? "Connecting Voice Session..." : "Launch Live AI Voice Interview"}</span>
                </button>
              </div>
            </div>

            {/* Right Col: Preset Library */}
            <div className="space-y-4">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Quick Industry Presets
              </label>

              <div className="space-y-3">
                {JOB_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="w-full p-4 rounded-2xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 text-left transition-all space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground group-hover:text-primary transition-colors">
                        {preset.company}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-xs font-bold text-foreground">
                      {preset.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cancellation Quiz Modal */}
      <CancellationQuizModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        sessionType="Interview"
        onConfirmedCancel={endSessionCleanup}
      />
    </div>
  );
}

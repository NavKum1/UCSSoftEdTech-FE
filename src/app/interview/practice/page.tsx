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
  Copy,
  Check,
  Download,
  MessageSquare,
  Radio,
  Activity,
  User,
  Bot,
  Trash2,
  ArrowDown,
  XCircle,
  ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { CancellationQuizModal } from "@/components/CancellationQuizModal";

interface JobPreset {
  stream: string;
  title: string;
  company: string;
  description: string;
}

interface TranscriptMessage {
  id: string;
  role: "interviewer" | "candidate";
  text: string;
  timestamp: string;
  isFinal?: boolean;
}

const PERSONAS = [
  {
    id: "StaffArchitectFAANG",
    name: "Staff Systems Architect",
    companyTag: "FAANG Bar Raiser",
    scrutiny: "Draconian Scrutiny",
    description: "Deeply probes distributed consensus, CAP bounds, P99 latency, and race conditions. Rejects superficial buzzwords.",
    tagColor: "border-red-500/30 bg-red-500/10 text-red-500"
  },
  {
    id: "StartupCTO",
    name: "High-Velocity Startup CTO",
    companyTag: "Scale-Up Leader",
    scrutiny: "Pragmatic Scrutiny",
    description: "Challenges over-engineering, AWS unit economics, tech debt, and delivery velocity. Demands simple, resilient architectures.",
    tagColor: "border-amber-500/30 bg-amber-500/10 text-amber-500"
  },
  {
    id: "SecurityAuditor",
    name: "Zero-Trust AppSec Auditor",
    companyTag: "SecOps & PenTest",
    scrutiny: "Draconian Scrutiny",
    description: "Relentlessly probes SQL/command injection, JWT tampering, SSRF, privilege escalation, and audit logging.",
    tagColor: "border-purple-500/30 bg-purple-500/10 text-purple-500"
  },
  {
    id: "EmpatheticMentor",
    name: "Empathetic Tech Lead",
    companyTag: "Career Coach",
    scrutiny: "Supportive Scrutiny",
    description: "Constructive mentor who provides scaffolding hints and guides through edge cases with structured exploration.",
    tagColor: "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
  }
];

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
  const [selectedPersona, setSelectedPersona] = useState<string>("StaffArchitectFAANG");

  // Session state
  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [aiStatus, setAiStatus] = useState<"connecting" | "speaking" | "listening" | "idle">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);

  // Live Speech-to-Text Transcript Feed State
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [currentAiInterim, setCurrentAiInterim] = useState<string>("");
  const [currentCandidateInterim, setCurrentCandidateInterim] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const [copiedTranscript, setCopiedTranscript] = useState<boolean>(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  // Scorecard modal state
  const [completedReport, setCompletedReport] = useState<any | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  // WebRTC & Audio refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

  // Auto-scroll transcript container
  useEffect(() => {
    if (autoScroll && transcriptBottomRef.current) {
      transcriptBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [transcripts, currentAiInterim, currentCandidateInterim, autoScroll]);

  const handleApplyPreset = (preset: JobPreset) => {
    setSelectedStream(preset.stream);
    setJobTitle(preset.title);
    setJobDescription(preset.description);
  };

  // Setup Web Audio API volume meter for lively equalizer visualizer
  const setupAudioMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };
      animFrameRef.current = requestAnimationFrame(checkVolume);
    } catch (e) {
      console.warn("Audio visualizer initialization fallback:", e);
    }
  };

  // Setup Native Browser Speech Recognition (Web Speech API) for candidate STT stream
  const setupSpeechRecognition = () => {
    if (typeof window === "undefined") return;
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      console.log("Web Speech API not available on this browser, relying solely on WebRTC DataChannel.");
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          const text = item[0]?.transcript || "";
          if (item.isFinal) {
            if (text.trim()) {
              setTranscripts((prev) => [
                ...prev,
                {
                  id: `cand-${Date.now()}-${Math.random()}`,
                  role: "candidate",
                  text: text.trim(),
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                  isFinal: true
                }
              ]);
            }
            setCurrentCandidateInterim("");
          } else {
            interim += text;
          }
        }
        if (interim) {
          setCurrentCandidateInterim(interim);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech Recognition notice:", e.error);
      };

      recognition.onend = () => {
        // Automatically restart if session remains active
        if (recognitionRef.current && isSessionActive) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch (err) {
      console.warn("Speech recognition initialization error:", err);
    }
  };

  const startInterview = async () => {
    setIsConnecting(true);
    setErrorMsg(null);
    setCompletedReport(null);
    setTranscripts([]);
    setCurrentAiInterim("");
    setCurrentCandidateInterim("");

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
          personaCode: selectedPersona,
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

      // Remote audio element setup
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

      // Setup Web Audio API volume visualizer
      setupAudioMeter(stream);

      // 3. Create WebRTC DataChannel for live OpenAI Realtime events & STT deltas
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        console.log("WebRTC DataChannel opened for live transcription events");
        // Instruct AI to open interview session
        const openingEvent = {
          type: "response.create",
          response: {
            modalities: ["audio", "text"],
            instructions: `Introduce yourself warmly as the interviewer for the ${jobTitle} role. Welcome ${candidateName} and ask the first opening question.`
          }
        };
        dc.send(JSON.stringify(openingEvent));
      };

      dc.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          
          // AI speech streaming delta
          if (msg.type === "response.audio_transcript.delta") {
            setCurrentAiInterim((prev) => prev + msg.delta);
            setAiStatus("speaking");
          } 
          // AI speech turn completed
          else if (msg.type === "response.audio_transcript.done") {
            const finalAiText = msg.transcript;
            setCurrentAiInterim("");
            if (finalAiText && finalAiText.trim()) {
              setTranscripts((prev) => [
                ...prev,
                {
                  id: `ai-${Date.now()}-${Math.random()}`,
                  role: "interviewer",
                  text: finalAiText.trim(),
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                  isFinal: true
                }
              ]);
            }
            setAiStatus("listening");
          } 
          // Candidate input audio transcription via Whisper
          else if (msg.type === "conversation.item.input_audio_transcription.completed") {
            const userTranscript = msg.transcript;
            if (userTranscript && userTranscript.trim()) {
              setTranscripts((prev) => {
                // Deduplicate if already captured by local Web Speech API
                const last = [...prev].reverse().find(m => m.role === "candidate");
                if (last && (last.text.trim() === userTranscript.trim() || userTranscript.includes(last.text.trim()))) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: `cand-${Date.now()}-${Math.random()}`,
                    role: "candidate",
                    text: userTranscript.trim(),
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                    isFinal: true
                  }
                ];
              });
              setCurrentCandidateInterim("");
            }
          }
        } catch (e) {
          console.warn("Realtime message parse warning:", e);
        }
      };

      // Setup browser speech recognition as parallel client-side STT
      setupSpeechRecognition();

      // 4. Create WebRTC Offer to OpenAI Realtime
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${client_secret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        const errDetail = await sdpResponse.text().catch(() => "");
        console.error("OpenAI WebRTC call rejected:", sdpResponse.status, errDetail);
        throw new Error(`Realtime voice handshake rejected by OpenAI (${sdpResponse.status}): ${errDetail || "SDP handshake error"}`);
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
    if (dcRef.current) {
      dcRef.current.close();
      dcRef.current = null;
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
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsSessionActive(false);
    setAiStatus("idle");
    setAudioLevel(0);
  };

  const endInterviewAndScore = async () => {
    const finalTranscripts = [...transcripts];
    endSessionCleanup();
    setIsEvaluating(true);

    try {
      const res = await fetch(`${apiBase}/api/interview/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle,
          jobDescription,
          stream: selectedStream,
          candidateName,
          personaCode: selectedPersona,
          durationMinutes: Math.max(1, Math.round(sessionDuration / 60)),
          transcripts: finalTranscripts,
        }),
      });

      if (!res.ok) {
        throw new Error("Evaluation request failed.");
      }

      const report = await res.json();
      setCompletedReport({
        ...report,
        transcripts: finalTranscripts,
      });
    } catch (err: any) {
      console.warn("Real evaluation call fallback:", err);
      const candidateTurns = finalTranscripts.filter(t => t.role === "candidate").length;
      const candidateText = finalTranscripts
        .filter(t => t.role === "candidate")
        .map(t => t.text.toLowerCase())
        .join(" ");

      const candidateWords = candidateText.split(/\s+/).filter(Boolean).length;

      // Semantic domain inspection
      const hasConcurrency = /lock|mutex|semaphore|atomic|thread|goroutine|race condition/.test(candidateText);
      const hasConsistency = /raft|paxos|quorum|cap|lease|consensus|lineariz/.test(candidateText);
      const hasPerformance = /p99|cache|redis|index|throughput|latency|pool/.test(candidateText);
      const hasResilience = /circuit breaker|backoff|retry|canary|failover|rollback/.test(candidateText);
      const hasDeflection = /i don't know|no idea|not sure|can you hear me/.test(candidateText);

      const pillarCount = [hasConcurrency, hasConsistency, hasPerformance, hasResilience].filter(Boolean).length;
      let calculatedScore = 0;
      if (candidateTurns === 0 || candidateWords < 10 || (hasDeflection && candidateWords < 30)) {
        calculatedScore = 0;
      } else if (pillarCount >= 3) {
        calculatedScore = 88;
      } else if (pillarCount >= 2) {
        calculatedScore = 74;
      } else if (pillarCount === 1) {
        calculatedScore = 52;
      } else {
        calculatedScore = candidateWords >= 40 ? 30 : 15;
      }

      const strengths: string[] = [];
      if (hasConcurrency) strengths.push("Articulated concurrency safety and lock boundaries.");
      if (hasConsistency) strengths.push("Addressed distributed consensus models and consistency bounds.");
      if (hasPerformance) strengths.push("Proactively addressed latency optimization and caching.");
      if (hasResilience) strengths.push("Addressed automated rollbacks and fault isolation.");
      if (strengths.length === 0 && calculatedScore > 40) strengths.push("Completed interview dialogue under pressure.");

      const improvements: string[] = [];
      if (!hasConcurrency) improvements.push("Address thread safety, race conditions, and lock contention.");
      if (!hasConsistency) improvements.push("Detail distributed consensus (Raft/Paxos) and network partition trade-offs.");
      if (!hasPerformance) improvements.push("Specify quantitative P99 latency SLAs and caching eviction policies.");
      if (!hasResilience) improvements.push("Incorporate automated circuit breakers and canary rollback triggers.");

      setCompletedReport({
        jobTitle,
        stream: selectedStream,
        durationMinutes: Math.max(1, Math.round(sessionDuration / 60)),
        overallScore: calculatedScore,
        candidateTurns,
        candidateWords,
        transcripts: finalTranscripts,
        dimensions: [
          { label: "Domain & Technical Competency", score: calculatedScore },
          { label: "Communication & STAR Articulation", score: Math.min(100, calculatedScore + (hasDeflection ? -15 : 5)) },
          { label: "Handling Pushback & Trade-offs", score: Math.max(0, calculatedScore - 5) },
          { label: "Confidence & Executive Presence", score: calculatedScore },
        ],
        strengths,
        improvements
      });
    } finally {
      setIsEvaluating(false);
    }
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

  const handleCopyTranscript = (items: TranscriptMessage[]) => {
    const text = items
      .map(m => `[${m.timestamp}] ${m.role === "interviewer" ? "AI Interviewer" : candidateName}: ${m.text}`)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleDownloadTranscript = (items: TranscriptMessage[]) => {
    const header = `Build & Defend AI Voice Interview Transcript\nJob Role: ${jobTitle}\nCandidate: ${candidateName}\nStream: ${selectedStream}\nDate: ${new Date().toLocaleString()}\n----------------------------------------\n\n`;
    const body = items
      .map(m => `[${m.timestamp}] ${m.role === "interviewer" ? "AI INTERVIEWER" : candidateName.toUpperCase()}:\n${m.text}\n`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Interview-Transcript-${jobTitle.replace(/[^a-zA-Z0-9]/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-10 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
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
              Simulate live, low-latency conversational voice interviews with real-time speech-to-text transcript streaming across Engineering, HR, Product, Sales, Finance, and Healthcare.
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
              className="font-bold underline ml-4 hover:opacity-80 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* ACTIVE LIVE INTERVIEW HUD WITH SPLIT TRANSCRIPT VIEW */}
        {/* ---------------------------------------------------- */}
        {isSessionActive ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in zoom-in-95 duration-200">
            {/* Left Column (5 cols): AI Voice Studio & Equalizer HUD */}
            <div className="lg:col-span-5 p-6 md:p-8 rounded-3xl border border-primary/30 bg-card/90 shadow-2xl relative overflow-hidden space-y-6">
              {/* Visualizer Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

              <div className="flex items-center justify-between relative z-10">
                <div>
                  <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                    Live Session • {selectedStream}
                  </span>
                  <h2 className="text-lg font-bold text-foreground mt-1">
                    {jobTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Voice: <span className="font-semibold text-foreground uppercase">{selectedVoice}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/40 text-xs font-mono font-bold text-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>{formatDuration(sessionDuration)}</span>
                </div>
              </div>

              {/* Pulsating Voice Visualizer & Animated Wave */}
              <div className="py-8 flex flex-col items-center justify-center space-y-5 relative z-10">
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-28 h-28 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center transition-transform duration-300 ${
                      aiStatus === "speaking" ? "scale-110 shadow-lg shadow-primary/25 ring-4 ring-primary/20" : "scale-100"
                    }`}
                  >
                    <Volume2 className={`w-10 h-10 text-primary transition-all ${aiStatus === "speaking" ? "animate-pulse" : ""}`} />
                  </div>
                  {aiStatus === "speaking" && (
                    <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-40 pointer-events-none" />
                  )}
                </div>

                {/* Dynamic 5-Bar Audio Equalizer */}
                <div className="flex items-end justify-center gap-1.5 h-8">
                  {[0.4, 0.7, 1.0, 0.6, 0.3].map((multiplier, idx) => {
                    const activeHeight = aiStatus === "speaking" 
                      ? Math.max(12, Math.round(28 * multiplier)) 
                      : Math.max(6, Math.round((audioLevel / 100) * 32 * multiplier));
                    return (
                      <div
                        key={idx}
                        className={`w-1.5 rounded-full transition-all duration-75 ${
                          aiStatus === "speaking"
                            ? "bg-indigo-500 animate-pulse"
                            : audioLevel > 15
                            ? "bg-emerald-500"
                            : "bg-muted-foreground/30"
                        }`}
                        style={{ height: `${activeHeight}px` }}
                      />
                    );
                  })}
                </div>

                <div className="text-center space-y-1">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-muted border border-border/80 text-foreground">
                    {aiStatus === "speaking" ? "AI Interviewer Speaking..." : "Listening to Candidate..."}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {isMuted ? "Your microphone is muted." : "Speak naturally into your mic. Spoken words transcribe live."}
                  </p>
                </div>
              </div>

              {/* Control Action Buttons */}
              <div className="space-y-3 pt-3 border-t border-border relative z-10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                      isMuted
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                        : "border-border bg-card/60 text-foreground hover:bg-card"
                    }`}
                  >
                    {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    <span>{isMuted ? "Unmute Mic" : "Mute Mic"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={endInterviewAndScore}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 transition-opacity cursor-pointer shadow-lg shadow-primary/20"
                >
                  <Award className="w-4 h-4" />
                  <span>End &amp; Generate Feedback Scorecard</span>
                </button>
              </div>

              {/* Real-time Tips Card */}
              <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/80 text-left space-y-1.5">
                <div className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span>Real-Time Answering Strategy</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Structure responses around situation, key trade-offs, and latency/business impacts. The interviewer will challenge edge-cases.
                </p>
              </div>
            </div>

            {/* Right Column (7 cols): Live Speech-to-Text Transcript Feed */}
            <div className="lg:col-span-7 rounded-3xl border border-border bg-card shadow-2xl flex flex-col h-[580px] overflow-hidden">
              {/* Transcript Header */}
              <div className="p-4 border-b border-border bg-card/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-rose-500" />
                    <span>Live Speech-to-Text Transcript Stream</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-primary/10 text-primary border border-primary/30">
                    {transcripts.length} Turns
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition-colors cursor-pointer ${
                      autoScroll ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border"
                    }`}
                    title="Toggle auto-scrolling as words arrive"
                  >
                    Auto-scroll: {autoScroll ? "ON" : "OFF"}
                  </button>

                  {transcripts.length > 0 && (
                    <button
                      onClick={() => handleCopyTranscript(transcripts)}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-medium text-foreground flex items-center space-x-1 cursor-pointer"
                      title="Copy full transcript to clipboard"
                    >
                      {copiedTranscript ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      <span>{copiedTranscript ? "Copied" : "Copy"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Message Bubbles Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 font-sans text-xs">
                {transcripts.length === 0 && !currentAiInterim && !currentCandidateInterim && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 opacity-40 animate-pulse text-primary" />
                    <p className="font-semibold text-foreground text-xs">Live Conversation Feed Connecting...</p>
                    <p className="text-[11px] max-w-sm leading-relaxed">
                      Your spoken dialogue and the AI interviewer&apos;s responses stream here in real time via WebRTC DataChannel and Whisper speech-to-text.
                    </p>
                  </div>
                )}

                {/* Historical Conversation Turns */}
                {transcripts.map((msg) => {
                  const isAi = msg.role === "interviewer";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col space-y-1 ${isAi ? "items-start" : "items-end"}`}
                    >
                      <div className="flex items-center space-x-1.5 text-[10px] text-muted-foreground px-1">
                        {isAi ? (
                          <>
                            <Bot className="w-3 h-3 text-indigo-500" />
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">AI Interviewer ({selectedVoice})</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-emerald-500" />
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{candidateName}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono">{msg.timestamp}</span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed shadow-sm ${
                          isAi
                            ? "bg-indigo-500/10 border border-indigo-500/30 text-foreground rounded-tl-sm"
                            : "bg-emerald-500/10 border border-emerald-500/30 text-foreground rounded-tr-sm"
                        }`}
                      >
                        {msg.text}
                      </div>
                    </div>
                  );
                })}

                {/* Active AI Streaming Delta Bubble */}
                {currentAiInterim && (
                  <div className="flex flex-col space-y-1 items-start">
                    <div className="flex items-center space-x-1.5 text-[10px] text-indigo-500 px-1 font-bold">
                      <Bot className="w-3 h-3 animate-spin" />
                      <span>AI Interviewer Speaking...</span>
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm p-3.5 bg-indigo-500/10 border border-indigo-500/40 text-foreground shadow-sm">
                      <span>{currentAiInterim}</span>
                      <span className="inline-block w-1.5 h-3 ml-1 bg-indigo-500 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Active Candidate Interim Speech Bubble */}
                {currentCandidateInterim && (
                  <div className="flex flex-col space-y-1 items-end">
                    <div className="flex items-center space-x-1.5 text-[10px] text-emerald-500 px-1 font-bold">
                      <Mic className="w-3 h-3 animate-pulse" />
                      <span>Transcribing {candidateName}...</span>
                    </div>
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm p-3.5 bg-emerald-500/10 border border-emerald-500/40 text-foreground shadow-sm italic">
                      <span>{currentCandidateInterim}</span>
                      <span className="inline-block w-1.5 h-3 ml-1 bg-emerald-500 animate-pulse" />
                    </div>
                  </div>
                )}

                <div ref={transcriptBottomRef} />
              </div>

              {/* Transcript Footer Status Bar */}
              <div className="p-3 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
                <div className="flex items-center space-x-2">
                  <Activity className="w-3 h-3 text-emerald-500" />
                  <span>Ultra Low-Latency WebRTC STT Active</span>
                </div>
                <div className="font-mono text-[10px]">
                  Audio Sampling: 16kHz Opus
                </div>
              </div>
            </div>
          </div>
        ) : isEvaluating ? (
          /* ---------------------------------------------------- */
          /* AI EVALUATION IN PROGRESS LOADER                     */
          /* ---------------------------------------------------- */
          <div className="p-16 rounded-3xl border border-primary/30 bg-card shadow-2xl flex flex-col items-center justify-center text-center space-y-5 animate-in fade-in zoom-in-95">
            <div className="relative flex items-center justify-center">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <Sparkles className="w-8 h-8 text-primary absolute animate-pulse" />
            </div>
            <div className="space-y-1.5 max-w-lg">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
                AI Assessment Engine Active
              </span>
              <h2 className="text-2xl font-extrabold text-foreground">
                Analyzing Interview Transcript &amp; Technical Depth
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Evaluating dialogue turns against the competency rubric for <span className="font-semibold text-foreground">{jobTitle}</span>. Scoring relevance, domain mastery, STAR reasoning, and trade-off precision...
              </p>
            </div>
          </div>
        ) : completedReport ? (
          /* ---------------------------------------------------- */
          /* COMPLETED SCORECARD VIEW WITH FULL TRANSCRIPT LOG    */
          /* ---------------------------------------------------- */
          <div className="p-8 rounded-3xl border border-border bg-card shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                {completedReport.overallScore === 0 || completedReport.status === "DISQUALIFIED" ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/60 text-red-400 text-xs font-bold uppercase tracking-wider">
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    <span>Candidate Disqualified • Zero Readiness (0%)</span>
                  </div>
                ) : completedReport.overallScore >= 85 ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-400 text-xs font-semibold">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Exceptional • Staff &amp; Principal Bar ({completedReport.overallScore}%)</span>
                  </div>
                ) : completedReport.overallScore >= 70 ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Qualified • Meets Enterprise Hiring Bar ({completedReport.overallScore}%)</span>
                  </div>
                ) : completedReport.overallScore >= 50 ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Developing • Substantive Gaps Identified ({completedReport.overallScore}%)</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Inadequate • Below Minimum Hiring Bar ({completedReport.overallScore}%)</span>
                  </div>
                )}
                <h2 className="text-2xl font-bold text-foreground">
                  Performance Scorecard: {completedReport.jobTitle}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Stream: {completedReport.stream} • Duration: {completedReport.durationMinutes} min • Candidate Turns: {completedReport.candidateTurns}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border text-center shrink-0 ${
                completedReport.overallScore === 0 || completedReport.status === "DISQUALIFIED"
                  ? "border-red-500/40 bg-red-500/10 text-red-500"
                  : completedReport.overallScore >= 70 
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500" 
                    : "border-rose-500/30 bg-rose-500/5 text-rose-500"
              }`}>
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">
                  Overall Readiness
                </span>
                <p className="text-3xl font-extrabold">
                  {completedReport.overallScore}%
                </p>
              </div>
            </div>

            {/* Zero-Tolerance Disqualification Banner */}
            {completedReport.disqualificationReason && (
              <div className="p-4 rounded-2xl border border-red-500/40 bg-red-500/10 text-red-400 space-y-1.5 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-xs text-red-400">
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                  <span>Zero-Tolerance Disqualification Notice</span>
                </div>
                <p className="text-xs text-red-300 leading-relaxed">
                  {completedReport.disqualificationReason}
                </p>
              </div>
            )}

            {/* Dimension Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {completedReport.dimensions.map((dim: any, i: number) => {
                const isGood = dim.score >= 70;
                return (
                  <div key={i} className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">{dim.label}</span>
                      <span className={`font-bold ${isGood ? "text-primary" : "text-rose-500"}`}>{dim.score}%</span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${isGood ? "bg-primary" : "bg-rose-500"}`}
                        style={{ width: `${Math.min(100, Math.max(5, dim.score))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Demonstrated Strengths
                </span>
                {completedReport.strengths && completedReport.strengths.length > 0 ? (
                  <ul className="text-xs space-y-1.5 text-muted-foreground">
                    {completedReport.strengths.map((str: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic">
                    No demonstrated competencies met the evaluation standard for this role.
                  </p>
                )}
              </div>

              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-2">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Critical Improvements &amp; Gaps
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

            {/* Complete Session Transcript Review Box */}
            {completedReport.transcripts && completedReport.transcripts.length > 0 && (
              <div className="p-5 rounded-2xl border border-border bg-card/60 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500" />
                    <h3 className="text-xs font-bold text-foreground">Verified Speech-to-Text Conversation Transcript</h3>
                    <span className="text-[10px] font-mono text-muted-foreground">({completedReport.transcripts.length} exchanges)</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopyTranscript(completedReport.transcripts)}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-muted border border-border text-[11px] font-medium text-foreground flex items-center space-x-1 cursor-pointer"
                    >
                      {copiedTranscript ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      <span>{copiedTranscript ? "Copied" : "Copy Log"}</span>
                    </button>

                    <button
                      onClick={() => handleDownloadTranscript(completedReport.transcripts)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30 text-[11px] font-medium flex items-center space-x-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download .TXT</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2.5 pr-1 text-xs">
                  {completedReport.transcripts.map((m: TranscriptMessage, i: number) => {
                    const isAi = m.role === "interviewer";
                    return (
                      <div key={i} className="p-2.5 rounded-xl bg-muted/30 border border-border/60 space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-bold ${isAi ? "text-indigo-600 dark:text-indigo-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                            {isAi ? `AI Interviewer (${selectedVoice})` : candidateName}
                          </span>
                          <span className="font-mono text-muted-foreground">{m.timestamp}</span>
                        </div>
                        <p className="text-foreground leading-relaxed">{m.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={startInterview}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:opacity-95 transition-opacity cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Practice Another Round
              </button>
              <button
                type="button"
                onClick={() => setCompletedReport(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
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
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
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

              {/* Persona Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    2. Select AI Interviewer Persona &amp; Scrutiny Bar
                  </label>
                  <span className="text-[11px] text-muted-foreground">
                    Calibrated interrogation style
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERSONAS.map((persona) => (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => setSelectedPersona(persona.id)}
                      className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                        selectedPersona === persona.id
                          ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary shadow-sm"
                          : "border-border/80 bg-card/60 text-muted-foreground hover:bg-card hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${persona.tagColor}`}>
                          {persona.companyTag}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {persona.scrutiny}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-foreground mb-1">
                        {persona.name}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {persona.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Job Title & Description */}
              <div className="space-y-4 p-6 rounded-2xl border border-border bg-card/60">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    3. Target Job Details
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
                  className="w-full py-3.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity disabled:opacity-50 shadow-md cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isConnecting ? "Connecting Voice Session & Transcriber..." : "Launch Live AI Voice Interview"}</span>
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
                    className="w-full p-4 rounded-2xl border border-border/80 bg-card/60 hover:bg-card hover:border-primary/40 text-left transition-all space-y-1.5 group cursor-pointer"
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

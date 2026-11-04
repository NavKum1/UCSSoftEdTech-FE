"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  PhoneOff,
  Volume2,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Award,
  AlertTriangle,
  Play,
  Compass,
  Copy,
  Check,
  Download,
  MessageSquare,
  User,
  Bot,
  XCircle,
  ShieldAlert
} from "lucide-react";
import Link from "next/link";
import { CancellationQuizModal } from "@/components/CancellationQuizModal";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, PageHeader, StatTile, buttonClass } from "@/components/career/ui";

interface JobPreset {
  stream: string;
  title: string;
  description: string;
}

interface TranscriptMessage {
  id: string;
  role: "interviewer" | "candidate";
  text: string;
  timestamp: string;
  isFinal?: boolean;
}

// Scorecard: the /api/interview/evaluate response (plus the session transcript), or the local fallback below.
interface InterviewScoreDimension {
  label: string;
  score: number;
}

interface InterviewReport {
  jobTitle: string;
  stream: string;
  durationMinutes: number;
  overallScore: number;
  candidateTurns?: number;
  candidateWords?: number;
  status?: string;
  disqualificationReason?: string | null;
  dimensions: InterviewScoreDimension[];
  strengths: string[];
  improvements: string[];
  transcripts: TranscriptMessage[];
}

// The parts of the Web Speech API this page uses (not in TypeScript's DOM lib), and the prefixed browser globals.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  [index: number]: { transcript: string } | undefined;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

type BrowserSpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  webkitAudioContext?: typeof AudioContext;
};

const PERSONAS = [
  {
    id: "StaffArchitectFAANG",
    name: "Staff systems architect",
    companyTag: "Big-tech bar raiser",
    scrutiny: "Draconian scrutiny",
    description: "Deeply probes distributed consensus, CAP bounds, P99 latency, and race conditions. Rejects superficial buzzwords.",
  },
  {
    id: "StartupCTO",
    name: "Fast-moving startup CTO",
    companyTag: "Scale-up leader",
    scrutiny: "Pragmatic scrutiny",
    description: "Challenges over-engineering, AWS unit economics, tech debt, and delivery velocity. Demands simple, resilient architectures.",
  },
  {
    id: "SecurityAuditor",
    name: "Zero-trust AppSec auditor",
    companyTag: "SecOps & PenTest",
    scrutiny: "Draconian scrutiny",
    description: "Relentlessly probes SQL/command injection, JWT tampering, SSRF, privilege escalation, and audit logging.",
  },
  {
    id: "EmpatheticMentor",
    name: "Supportive tech lead",
    companyTag: "Career coach",
    scrutiny: "Supportive scrutiny",
    description: "Constructive mentor who provides scaffolding hints and guides through edge cases with structured exploration.",
  }
];

const STREAM_OPTIONS = [
  { id: "Technical", label: "Software and systems", desc: "Architecture, algorithms, concurrency & reliability" },
  { id: "Behavioral", label: "HR and behavioral", desc: "STAR method, leadership principles & conflict resolution" },
  { id: "ProductManagement", label: "Product management", desc: "Product sense, metric trade-offs & prioritization" },
  { id: "Sales", label: "Enterprise sales", desc: "Objection handling, buyer discovery & value pitch" },
  { id: "Finance", label: "Finance and banking", desc: "Financial modeling, DCF valuation & capital allocation" },
  { id: "Healthcare", label: "Clinical and healthcare", desc: "Diagnostic reasoning, patient triage & empathy" },
];

const JOB_PRESETS: JobPreset[] = [
  {
    stream: "Technical",
    title: "Senior Distributed Systems Engineer",
    description: "Architecting real-time global dispatching microservices. Required skills: High-throughput concurrency, Go/Rust, Raft consensus, Kafka, low-latency API contracts."
  },
  {
    stream: "ProductManagement",
    title: "Associate Product Manager",
    description: "Leading consumer feature discovery and metric experiments. Required skills: Data-driven decision making, user research, wireframing, A/B testing and RICE prioritization."
  },
  {
    stream: "Behavioral",
    title: "Engineering Manager / HR Business Partner",
    description: "Assessing team dynamics, organizational health, and leadership through ambiguity. Required skills: Conflict resolution, inclusive leadership, feedback delivery."
  },
  {
    stream: "Sales",
    title: "Enterprise Account Executive",
    description: "Selling observability and cloud security platforms to Fortune 500 CISOs and VP of Eng. Required skills: MEDDPICC qualification, objection handling, ROI modeling."
  },
  {
    stream: "Finance",
    title: "Corporate Finance & Investment Analyst",
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
  const en = useEn();
  const { apiFetch, access } = useLegacyApi();
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
  const [completedReport, setCompletedReport] = useState<InterviewReport | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);

  // Cancellation modal
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);

  // WebRTC & Audio refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const transcriptBottomRef = useRef<HTMLDivElement | null>(null);


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
      const AudioCtx = window.AudioContext || (window as BrowserSpeechWindow).webkitAudioContext;
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
    const speechWindow = window as BrowserSpeechWindow;
    const SpeechRec = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRec) {
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEventLike) => {
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

      recognition.onerror = (e: { error: string }) => {
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
      const res = await apiFetch(`/api/interview/token`, {
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
        throw new Error(errJson.error || "We couldn't start the interview. Please try again.");
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
    } catch (err) {
      console.error("Interview setup failed:", err);
      setErrorMsg(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (err as Error).message || "We couldn't start the voice interview. Please allow microphone access and try again.");
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
      const res = await apiFetch(`/api/interview/evaluate`, {
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
    } catch (err) {
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
          { label: en("Domain & Technical Competency"), score: calculatedScore },
          { label: en("Communication & STAR Articulation"), score: Math.min(100, calculatedScore + (hasDeflection ? -15 : 5)) },
          { label: en("Handling Pushback & Trade-offs"), score: Math.max(0, calculatedScore - 5) },
          { label: en("Confidence & Executive Presence"), score: calculatedScore },
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
    const header = `Edulexa voice interview transcript\nJob Role: ${jobTitle}\nCandidate: ${candidateName}\nStream: ${selectedStream}\nDate: ${new Date().toLocaleString()}\n----------------------------------------\n\n`;
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

  if (access) return <AccessNotice problem={access} feature="Interview practice" />;

  return (
    <div className="text-foreground">
      <PageHeader
          title={en("Interview practice")}
          description={en("Practice a spoken interview for a specific role with an AI interviewer, then get a scorecard and transcript.")}
          actions={
            <>
              <Link href="/prep/exam" className={buttonClass("secondary")}>
                {en("Written exam practice")}
              </Link>
              <Link href="/prep/counselling" className={buttonClass("secondary")}>
                <Compass className="h-4 w-4" />
                {en("Career quiz")}
              </Link>
            </>
          }
        />

      <div className="space-y-8">
        {errorMsg && (
          <div role="alert" className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="font-medium underline ms-4 hover:opacity-80 cursor-pointer"
            >
              {en("Dismiss")}
            </button>
          </div>
        )}

        {/* ---------------------------------------------------- */}
        {/* ACTIVE LIVE INTERVIEW HUD WITH SPLIT TRANSCRIPT VIEW */}
        {/* ---------------------------------------------------- */}
        {isSessionActive ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-in fade-in zoom-in-95 duration-200">
            {/* Left Column (5 cols): AI Voice Studio & Equalizer HUD */}
            <div className="lg:col-span-5 p-6 rounded-xl border border-border bg-card shadow-sm relative overflow-hidden space-y-6">

              <div className="flex items-center justify-between relative z-10">
                <div>
                  <Badge tone="info">{en("Live session • {selectedStream}", { selectedStream })}</Badge>
                  <h2 className="text-lg font-semibold text-foreground mt-2">
                    {jobTitle}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {en("Voice: ")}<span className="font-medium text-foreground capitalize">{selectedVoice}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/40 text-sm font-mono font-semibold tabular-nums text-foreground">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>{formatDuration(sessionDuration)}</span>
                </div>
              </div>

              {/* Pulsating Voice Visualizer & Animated Wave */}
              <div className="py-8 flex flex-col items-center justify-center space-y-5 relative z-10">
                <div className="relative flex items-center justify-center">
                  <div
                    className={`w-28 h-28 rounded-full border-2 border-primary/40 bg-primary/10 flex items-center justify-center transition-transform duration-300 ${
                      aiStatus === "speaking" ? "scale-105 ring-4 ring-primary/20" : "scale-100"
                    }`}
                  >
                    <Volume2 className="w-10 h-10 text-primary" />
                  </div>
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
                            ? "bg-indigo-500"
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
                    {aiStatus === "speaking" ? en("AI interviewer speaking…") : en("Listening…")}
                  </span>
                  <p className="text-xs text-muted-foreground pt-1">
                    {isMuted ? en("Your microphone is muted.") : en("Speak naturally into your mic. Spoken words transcribe live.")}
                  </p>
                </div>
              </div>

              {/* Control Action Buttons */}
              <div className="space-y-3 pt-3 border-t border-border relative z-10">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleMute}
                    className={`${buttonClass("secondary")} flex-1 ${isMuted ? "ring-1 ring-amber-500" : ""}`}
                  >
                    {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isMuted ? en("Unmute") : en("Mute")}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className={`${buttonClass("secondary")} text-red-700 dark:text-red-400`}
                  >
                    <PhoneOff className="w-4 h-4" />
                    <span>{en("Cancel")}</span>
                  </button>
                </div>

                <Button type="button" onClick={endInterviewAndScore} className="w-full">
                  <Award className="w-4 h-4" />
                  <span>{en("End and get my scorecard")}</span>
                </Button>
              </div>

              {/* Real-time Tips Card */}
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border text-start space-y-1">
                <div className="text-sm font-medium text-foreground">
                  {en("Answering tip")}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {en("Structure responses around situation, key trade-offs, and latency/business impacts. The interviewer will challenge edge-cases.")}
                </p>
              </div>
            </div>

            {/* Right Column (7 cols): Live Speech-to-Text Transcript Feed */}
            <div className="lg:col-span-7 rounded-xl border border-border bg-card shadow-sm flex flex-col h-[580px] overflow-hidden">
              {/* Transcript Header */}
              <div className="p-4 border-b border-border bg-card flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                  <span className="text-sm font-semibold text-foreground">{en("Live transcript")}</span>
                  <Badge>{en("{length} turns", { length: transcripts.length })}</Badge>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={buttonClass("ghost")}
                    title={en("Toggle auto-scrolling as words arrive")}
                  >
                    {en("Auto-scroll: {value}", { value: autoScroll ? en("on") : en("off") })}
                  </button>

                  {transcripts.length > 0 && (
                    <button
                      onClick={() => handleCopyTranscript(transcripts)}
                      className={buttonClass("secondary")}
                      title={en("Copy full transcript to clipboard")}
                    >
                      {copiedTranscript ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      <span>{copiedTranscript ? en("Copied") : en("Copy")}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable Message Bubbles Stream */}
              <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm">
                {transcripts.length === 0 && !currentAiInterim && !currentCandidateInterim && (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 text-muted-foreground">
                    <MessageSquare className="w-8 h-8 opacity-40 text-primary" />
                    <p className="font-medium text-foreground text-sm">{en("Connecting…")}</p>
                    <p className="text-xs max-w-sm leading-relaxed">
                      {en("Your spoken dialogue and the AI interviewer's responses appear here as you speak.")}
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
                      <div className="flex items-center space-x-1.5 text-xs text-muted-foreground px-1">
                        {isAi ? (
                          <>
                            <Bot className="w-3 h-3 text-indigo-500" />
                            <span className="font-medium text-foreground">{en("AI interviewer ({selectedVoice})", { selectedVoice })}</span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium text-foreground">{candidateName}</span>
                          </>
                        )}
                        <span>•</span>
                        <span className="font-mono">{msg.timestamp}</span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-xl p-3.5 leading-relaxed ${
                          isAi
                            ? "bg-muted border border-border text-foreground rounded-ss-sm"
                            : "bg-indigo-600 text-white rounded-se-sm"
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
                    <div className="flex items-center space-x-1.5 text-xs text-muted-foreground px-1 font-medium">
                      <Bot className="w-3 h-3" />
                      <span>{en("AI interviewer speaking…")}</span>
                    </div>
                    <div className="max-w-[85%] rounded-xl rounded-ss-sm p-3.5 bg-muted border border-border text-foreground">
                      <span>{currentAiInterim}</span>
                      <span className="inline-block w-1.5 h-3 ms-1 bg-indigo-500 animate-pulse" />
                    </div>
                  </div>
                )}

                {/* Active Candidate Interim Speech Bubble */}
                {currentCandidateInterim && (
                  <div className="flex flex-col space-y-1 items-end">
                    <div className="flex items-center space-x-1.5 text-xs text-muted-foreground px-1 font-medium">
                      <Mic className="w-3 h-3" />
                      <span>{en("Transcribing {candidateName}…", { candidateName })}</span>
                    </div>
                    <div className="max-w-[85%] rounded-xl rounded-se-sm p-3.5 bg-indigo-600/80 text-white italic">
                      <span>{currentCandidateInterim}</span>
                      <span className="inline-block w-1.5 h-3 ms-1 bg-white/70 animate-pulse" />
                    </div>
                  </div>
                )}

                <div ref={transcriptBottomRef} />
              </div>

            </div>
          </div>
        ) : isEvaluating ? (
          /* ---------------------------------------------------- */
          /* AI EVALUATION IN PROGRESS LOADER                     */
          /* ---------------------------------------------------- */
          <div className="p-16 rounded-xl border border-border bg-card shadow-sm flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
            <div className="space-y-1.5 max-w-lg">
              <h2 className="text-lg font-semibold text-foreground">
                {en("Scoring your interview")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {en("Reviewing your answers for ")}<span className="font-medium text-foreground">{jobTitle}</span>{en(": relevance, depth, structure and trade-offs.")}
              </p>
            </div>
          </div>
        ) : completedReport ? (
          /* ---------------------------------------------------- */
          /* COMPLETED SCORECARD VIEW WITH FULL TRANSCRIPT LOG    */
          /* ---------------------------------------------------- */
          <div className="p-6 rounded-xl border border-border bg-card shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                {completedReport.overallScore === 0 || completedReport.status === "DISQUALIFIED" ? (
                  <Badge tone="bad"><XCircle className="me-1 w-3.5 h-3.5" />{en("Disqualified (0%)")}</Badge>
                ) : completedReport.overallScore >= 85 ? (
                  <Badge tone="good"><CheckCircle2 className="me-1 w-3.5 h-3.5" />{en("Exceptional ({overallScore}%)", { overallScore: completedReport.overallScore })}</Badge>
                ) : completedReport.overallScore >= 70 ? (
                  <Badge tone="good"><CheckCircle2 className="me-1 w-3.5 h-3.5" />{en("Ready ({overallScore}%)", { overallScore: completedReport.overallScore })}</Badge>
                ) : completedReport.overallScore >= 50 ? (
                  <Badge tone="warn"><AlertTriangle className="me-1 w-3.5 h-3.5" />{en("Developing: some gaps ({overallScore}%)", { overallScore: completedReport.overallScore })}</Badge>
                ) : (
                  <Badge tone="bad"><AlertTriangle className="me-1 w-3.5 h-3.5" />{en("Not ready yet ({overallScore}%)", { overallScore: completedReport.overallScore })}</Badge>
                )}
                <h2 className="text-xl font-semibold text-foreground pt-1">
                  {en("Scorecard: {jobTitle}", { jobTitle: completedReport.jobTitle })}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {en("Track: ")}{completedReport.stream}{en(" • Length: ")}{completedReport.durationMinutes}{en(" min • Your answers: ")}{completedReport.candidateTurns}
                </p>
              </div>

              <div className="shrink-0 sm:w-48">
                <StatTile
                  label={en("Overall readiness")}
                  value={`${completedReport.overallScore}%`}
                  tone={completedReport.overallScore >= 70 && completedReport.status !== "DISQUALIFIED" ? "good" : "bad"}
                />
              </div>
            </div>

            {/* Zero-Tolerance Disqualification Banner */}
            {completedReport.disqualificationReason && (
              <div role="alert" className="p-4 rounded-lg border border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{en("Why this interview was disqualified")}</span>
                </div>
                <p className="text-sm leading-relaxed">
                  {completedReport.disqualificationReason}
                </p>
              </div>
            )}

            {/* Dimension Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {completedReport.dimensions.map((dim: InterviewScoreDimension, i: number) => {
                const isGood = dim.score >= 70;
                return (
                  <div key={i} className="p-4 rounded-lg border border-border bg-card space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-foreground">{dim.label}</span>
                      <span className={`font-semibold tabular-nums ${isGood ? "text-foreground" : "text-red-700 dark:text-red-400"}`}>{dim.score}%</span>
                    </div>
                    <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${isGood ? "bg-indigo-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(100, Math.max(5, dim.score))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg border border-border bg-card space-y-2">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  {en("Strengths")}
                </span>
                {completedReport.strengths && completedReport.strengths.length > 0 ? (
                  <ul className="text-sm space-y-1.5 text-muted-foreground">
                    {completedReport.strengths.map((str: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-emerald-500 mt-0.5">•</span>
                        <span>{str}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {en("No demonstrated competencies met the evaluation standard for this role.")}
                  </p>
                )}
              </div>

              <div className="p-4 rounded-lg border border-border bg-card space-y-2">
                <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                  {en("What to improve")}
                </span>
                <ul className="text-sm space-y-1.5 text-muted-foreground">
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
              <div className="p-5 rounded-lg border border-border bg-card space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-semibold text-foreground">{en("Transcript")}</h3>
                    <span className="text-xs text-muted-foreground">{en("({length} exchanges)", { length: completedReport.transcripts.length })}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleCopyTranscript(completedReport.transcripts)}
                      className={buttonClass("secondary")}
                    >
                      {copiedTranscript ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                      <span>{copiedTranscript ? en("Copied") : en("Copy")}</span>
                    </button>

                    <button
                      onClick={() => handleDownloadTranscript(completedReport.transcripts)}
                      className={buttonClass("secondary")}
                    >
                      <Download className="w-3 h-3" />
                      <span>{en("Download .txt")}</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto space-y-2.5 pe-1 text-sm">
                  {completedReport.transcripts.map((m: TranscriptMessage, i: number) => {
                    const isAi = m.role === "interviewer";
                    return (
                      <div key={i} className="p-2.5 rounded-lg bg-muted/40 border border-border space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {isAi ? en("AI interviewer ({selectedVoice})", { selectedVoice }) : candidateName}
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
              <Button type="button" onClick={startInterview}>
                <RotateCcw className="w-4 h-4" />
                {en("Practice again")}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setCompletedReport(null)}>
                {en("Set up a new role")}
              </Button>
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
                <h2 className="text-base font-semibold text-foreground">
                  {en("1. Choose a track")}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {STREAM_OPTIONS.map((stream) => (
                    <button
                      key={stream.id}
                      type="button"
                      onClick={() => setSelectedStream(stream.id)}
                      className={`p-4 rounded-xl border bg-card shadow-sm text-start transition-colors cursor-pointer ${
                        selectedStream === stream.id
                          ? "border-primary ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <p className="font-medium text-sm text-foreground mb-1">
                        {en(stream.label)}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {en(stream.desc)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Persona Selector */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">
                    {en("2. Choose an interviewer")}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {en("How tough the questions are")}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PERSONAS.map((persona) => (
                    <button
                      key={persona.id}
                      type="button"
                      onClick={() => setSelectedPersona(persona.id)}
                      className={`p-4 rounded-xl border bg-card shadow-sm text-start transition-colors cursor-pointer ${
                        selectedPersona === persona.id
                          ? "border-primary ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge>{en(persona.companyTag)}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {en(persona.scrutiny)}
                        </span>
                      </div>
                      <p className="font-medium text-sm text-foreground mb-1">
                        {en(persona.name)}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {en(persona.description)}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Job Title & Description */}
              <div className="space-y-4 p-5 rounded-xl border border-border bg-card shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">
                    {en("3. The job")}
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {en("Paste details from any job post")}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {en("Job title")}
                  </label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder={en("e.g. Senior Backend Engineer")}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card shadow-sm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {en("Job description or key requirements")}
                  </label>
                  <textarea
                    rows={4}
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder={en("Paste the job requirements, tech stack, or responsibilities here...")}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card shadow-sm text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {en("Your name")}
                    </label>
                    <input
                      type="text"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card shadow-sm text-sm text-foreground"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">
                      {en("Interviewer voice")}
                    </label>
                    <select
                      value={selectedVoice}
                      onChange={(e) => setSelectedVoice(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card shadow-sm text-sm text-foreground cursor-pointer"
                    >
                      {VOICES.map((v) => (
                        <option key={v.id} value={v.id}>
                          {en(v.label)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <Button type="button" onClick={startInterview} disabled={!jobTitle.trim()} busy={isConnecting} className="h-10 w-full">
                  {!isConnecting && <Play className="w-4 h-4" />}
                  <span>{isConnecting ? en("Connecting…") : en("Start interview")}</span>
                </Button>
              </div>
            </div>

            {/* Right Col: Preset Library */}
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-foreground">
                {en("Example roles")}
              </h2>

              <div className="space-y-3">
                {JOB_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="w-full p-4 rounded-xl border border-border bg-card shadow-sm hover:bg-muted/50 text-start transition-colors space-y-1.5 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <Badge>{en(STREAM_OPTIONS.find((s) => s.id === preset.stream)?.label ?? preset.stream)}</Badge>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {en(preset.title)}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {en(preset.description)}
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

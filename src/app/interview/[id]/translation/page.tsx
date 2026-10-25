"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import {
  Globe2,
  Play,
  Pause,
  Languages,
  Download,
  Sparkles,
  Bot,
  User,
  ArrowLeft,
  Send,
  Radio,
  Headphones,
} from "lucide-react";

interface TranscriptSegment {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  speaker: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  originalText: string;
  originalLanguage: string;
  translatedText_JSON: string;
}

const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸", native: "English" },
  { code: "es", label: "Spanish", flag: "🇪🇸", native: "Español" },
  { code: "zh", label: "Mandarin", flag: "🇨🇳", native: "中文" },
  { code: "hi", label: "Hindi", flag: "🇮🇳", native: "हिन्दी" },
  { code: "de", label: "German", flag: "🇩🇪", native: "Deutsch" },
  { code: "fr", label: "French", flag: "🇫🇷", native: "Français" },
  { code: "ja", label: "Japanese", flag: "🇯🇵", native: "日本語" },
  { code: "pt", label: "Portuguese", flag: "🇧🇷", native: "Português" },
  { code: "ar", label: "Arabic", flag: "🇸🇦", native: "العربية" },
  { code: "ko", label: "Korean", flag: "🇰🇷", native: "한국어" }
];

export default function MultiLanguageTranslationStudioPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || "";

  const [selectedLanguage, setSelectedLanguage] = useState<string>("es");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [audioTrackMode, setAudioTrackMode] = useState<"original" | "dubbed">("dubbed");
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);

  // Live dialogue simulator state
  const [inputSpeaker, setInputSpeaker] = useState<string>("Candidate");
  const [inputText, setInputText] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Preference state
  const [autoTranslateRecruiter, setAutoTranslateRecruiter] = useState<boolean>(true);
  const [candidatePrefLang, setCandidatePrefLang] = useState<string>("en");

  const fetchTranscript = async () => {
    if (!sessionId) {
      setFetchError("Invalid session identifier provided.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch(`/api/translation/session/${sessionId}/transcript`);
      if (res.ok) {
        const json = await res.json();
        setSegments(json.transcript || []);
      } else {
        setFetchError("There is no transcript to translate for this interview yet.");
        setSegments([]);
      }
    } catch (e) {
      console.warn("[TRANSCRIPT FETCH NOTICE]:", e);
      setFetchError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message || "We couldn't load the translation. Please try again.");
      setSegments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscriptRef = useLatestRef(fetchTranscript);
  useEffect(() => {
    if (!ready) return;
    fetchTranscriptRef.current();
  }, [sessionId, ready, fetchTranscriptRef]);

  // Audio timer ticker simulation
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= 20.0) {
            setIsPlaying(false);
            return 0.0;
          }
          return prev + 0.25 * playbackSpeed;
        });
      }, 250);
    }
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  const handleIngestSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsSubmitting(true);
    try {
      const lastSegment = segments[segments.length - 1];
      const start = lastSegment ? lastSegment.endTimeSeconds + 0.5 : 0.0;
      const end = start + Math.max(3.0, inputText.length * 0.08);

      const res = await apiFetch(`/api/translation/segment/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          speaker: inputSpeaker,
          startTimeSeconds: start,
          endTimeSeconds: end,
          originalText: inputText,
          originalLanguage: "en"
        })
      });

      if (res.ok) {
        const json = await res.json();
        setSegments((prev) => [...prev, json.segment]);
        setInputText("");
      }
    } catch (e) {
      console.error("[SEGMENT INGEST ERROR]:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // The subtitles endpoint needs the bearer token, so download through fetch instead of opening the URL
  const handleDownloadWebVtt = async () => {
    try {
      const res = await apiFetch(`/api/translation/session/${sessionId}/subtitles.vtt?lang=${encodeURIComponent(selectedLanguage)}`);
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${sessionId}-${selectedLanguage}.vtt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error("[SUBTITLE DOWNLOAD ERROR]:", e);
    }
  };

  const getTranslatedText = (segment: TranscriptSegment) => {
    if (selectedLanguage === "en" || !segment.translatedText_JSON) {
      return segment.originalText;
    }
    try {
      const dict = JSON.parse(segment.translatedText_JSON);
      return dict[selectedLanguage] || segment.originalText;
    } catch {
      return segment.originalText;
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms}`;
  };

  if (access) return <AccessNotice problem={access} feature="The translation studio" />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans pb-16">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-muted hover:bg-slate-700 text-muted-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
                <Globe2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base text-foreground tracking-wide">
                    MULTI-LANGUAGE SUBTITLES &amp; AUDIO TRANSLATION
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-semibold border border-cyan-500/40">
                    Live Subtitles
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Real-time multilingual subtitles, bilingual transcript review, and voice translation.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadWebVtt}
              className="px-3.5 py-1.5 rounded-xl bg-muted hover:bg-slate-700 text-foreground border border-border text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-700 dark:text-cyan-400" />
              <span>Download Subtitles ({selectedLanguage.toUpperCase()})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Language Selection Ribbon */}
        <div className="p-4 rounded-2xl bg-card/60 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center space-x-2">
              <Languages className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
              <span>Select Subtitle &amp; Audio Language</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Active: <strong className="text-cyan-700 dark:text-cyan-400">{SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.label}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = selectedLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`p-2.5 rounded-xl border flex flex-col items-center space-y-1 transition-all cursor-pointer ${
                    isActive
                      ? "bg-cyan-950/40 border-cyan-500/70 shadow-md shadow-cyan-900/30"
                      : "bg-background/40 border-border hover:border-border hover:bg-card/60"
                  }`}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className={`text-[11px] font-bold ${isActive ? "text-cyan-600 dark:text-cyan-300" : "text-muted-foreground"}`}>
                    {lang.code.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-muted-foreground truncate w-full text-center">
                    {lang.native}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Audio Player & Dual-Track Controller */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-cyan-950/20 to-slate-900 border border-cyan-900/30 shadow-2xl space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 transition-all cursor-pointer"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
              </button>

              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-foreground">Interview Audio Channel</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 font-semibold border border-cyan-500/30">
                    {audioTrackMode === "dubbed" ? "Simulated Neural Dubbing" : "Original Dialect"}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {formatSeconds(currentTime)} / 00:20.0 (Scrubbing position)
                </div>
              </div>
            </div>

            {/* Dual-Track Audio Selector */}
            <div className="flex items-center space-x-2 bg-background p-1.5 rounded-xl border border-border">
              <button
                onClick={() => setAudioTrackMode("original")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                  audioTrackMode === "original"
                    ? "bg-muted text-white font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Original Audio</span>
              </button>

              <button
                onClick={() => setAudioTrackMode("dubbed")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                  audioTrackMode === "dubbed"
                    ? "bg-cyan-600 text-white font-semibold shadow-md shadow-cyan-600/30"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Neural Dubbed Track ({selectedLanguage.toUpperCase()})</span>
              </button>
            </div>
          </div>

          {/* Timeline Scrubber Bar */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-background overflow-hidden relative cursor-pointer">
              <div
                style={{ width: `${(currentTime / 20.0) * 100}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-200"
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
              <span>00:00.0</span>
              <span>Timeline synchronized with WebVTT captions</span>
              <span>00:20.0</span>
            </div>
          </div>
        </div>

        {/* Synchronized Bilingual Subtitle Transcript */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-foreground flex items-center space-x-2">
              <Languages className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
              <span>Synchronized Bilingual Subtitle Timeline</span>
            </h3>
            <span className="text-xs text-muted-foreground">
              {segments.length} dialogue segments recorded
            </span>
          </div>

          {segments.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-card/60 border border-border text-muted-foreground text-xs">
              {fetchError || "No translated dialogue segments recorded for this session yet."}
            </div>
          ) : (
            <div className="space-y-3">
              {segments.map((seg) => {
                const isCurrent = currentTime >= seg.startTimeSeconds && currentTime <= seg.endTimeSeconds;
                const isAi = seg.speaker === "AiInterviewer";

                return (
                  <div
                    key={seg.id || seg.sequenceNumber}
                    onClick={() => setCurrentTime(seg.startTimeSeconds)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer space-y-2 ${
                      isCurrent
                        ? "bg-cyan-950/30 border-cyan-500/60 shadow-lg shadow-cyan-900/20"
                        : "bg-card/40 border-border hover:border-border hover:bg-card/60"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`p-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 ${
                          isAi 
                            ? "bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30"
                            : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
                        }`}>
                          {isAi ? <Bot className="w-3.5 h-3.5 mr-1" /> : <User className="w-3.5 h-3.5 mr-1" />}
                          <span>{isAi ? "AI Technical Interviewer" : "Candidate"}</span>
                        </span>

                        <span className="text-[11px] font-mono text-muted-foreground">
                          [{formatSeconds(seg.startTimeSeconds)} - {formatSeconds(seg.endTimeSeconds)}]
                        </span>
                      </div>

                      <span className="text-[10px] uppercase font-bold text-muted-foreground">
                        Segment #{seg.sequenceNumber}
                      </span>
                    </div>

                    {/* Original Spoken Text */}
                    <div className="text-xs text-muted-foreground leading-relaxed pl-2 border-l-2 border-border">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-0.5">
                        Spoken Original ({seg.originalLanguage.toUpperCase()}):
                      </span>
                      {seg.originalText}
                    </div>

                    {/* Translated Text in Active Target Language */}
                    <div className="text-sm font-medium text-cyan-200 leading-relaxed pl-2 border-l-2 border-cyan-500">
                      <span className="text-[10px] uppercase font-semibold text-cyan-700 dark:text-cyan-400 block mb-0.5">
                        Subtitles / Dubbing ({selectedLanguage.toUpperCase()}):
                      </span>
                      {getTranslatedText(seg)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Real-time Dialogue Injection Simulator */}
        <div className="p-6 rounded-2xl bg-card/50 border border-border space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
            <h3 className="text-base font-bold text-foreground">Live Conversation &amp; Subtitle Preview</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter a question or response to see real-time translation and captions across supported languages.
          </p>

          <form onSubmit={handleIngestSegment} className="space-y-3">
            <div className="flex items-center space-x-3">
              <label className="text-xs text-muted-foreground font-medium">Speaker:</label>
              <div className="flex items-center space-x-2">
                {["Candidate", "AiInterviewer", "Mentor"].map((spk) => (
                  <button
                    key={spk}
                    type="button"
                    onClick={() => setInputSpeaker(spk)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border ${
                      inputSpeaker === spk
                        ? "bg-cyan-600 text-white border-cyan-500"
                        : "bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {spk}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter technical interview speech to translate (e.g. 'I designed an async memory buffer queue...')"
                className="flex-1 rounded-xl bg-background border border-border px-4 py-2.5 text-xs text-foreground focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isSubmitting || !inputText.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Translating..." : "Translate"}</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

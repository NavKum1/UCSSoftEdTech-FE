"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Globe2,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  Languages,
  Download,
  Settings2,
  Sparkles,
  Bot,
  User,
  ArrowLeft,
  CheckCircle2,
  Send,
  Radio,
  Headphones,
  Sliders,
  Share2
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
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || "sess-demo-001";

  const [selectedLanguage, setSelectedLanguage] = useState<string>("es");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
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
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/translation/session/${sessionId}/transcript`);
      if (res.ok) {
        const json = await res.json();
        if (json.transcript && json.transcript.length > 0) {
          setSegments(json.transcript);
        } else {
          loadFallbackSegments();
        }
      } else {
        loadFallbackSegments();
      }
    } catch (e) {
      console.warn("[TRANSCRIPT FETCH NOTICE]:", e);
      loadFallbackSegments();
    } finally {
      setLoading(false);
    }
  };

  const loadFallbackSegments = () => {
    setSegments([
      {
        id: "seg-01",
        sessionId,
        sequenceNumber: 1,
        speaker: "AiInterviewer",
        startTimeSeconds: 0.0,
        endTimeSeconds: 3.5,
        originalText: "Hello! Welcome to the technical sprint defense. Can you walk me through your memory queue design?",
        originalLanguage: "en",
        translatedText_JSON: JSON.stringify({
          es: "¡Hola! Bienvenido a la defensa técnica. ¿Puedes explicarme el diseño de tu cola de memoria?",
          zh: "你好！欢迎来到技术冲刺答辩。你能向我介绍一下你的内存队列设计吗？",
          hi: "नमस्ते! तकनीकी स्प्रिंट रक्षा में आपका स्वागत है। क्या आप मुझे अपने मेमोरी कतार डिज़ाइन के बारे में बता सकते हैं?",
          de: "Hallo! Willkommen zur Verteidigung des technischen Sprints. Können Sie mir das Design Ihrer Warteschlange erläutern?",
          fr: "Bonjour! Bienvenue à la soutenance technique. Pouvez-vous me présenter la conception de votre file d'attente?",
          ja: "こんにちは！技術スプリント防衛へようこそ。メモリキューの設計について説明していただけますか？",
          pt: "Olá! Bem-vindo à defesa técnica. Você pode me explicar o design da sua fila de memória?",
          ar: "مرحبًا! مرحبًا بك في الدفاع الفني. هل يمكنك إطلاعي على تصميم قائمة الانتظار المؤقتة الخاصة بك؟",
          ko: "안녕하세요! 기술 스프린트 방어에 오신 것을 환영합니다. 메모리 대기열 설계에 대해 설명해 주시겠습니까?"
        })
      },
      {
        id: "seg-02",
        sessionId,
        sequenceNumber: 2,
        speaker: "Candidate",
        startTimeSeconds: 3.8,
        endTimeSeconds: 8.5,
        originalText: "I implemented a concurrent ring buffer queue in C# with lock-free atomics to minimize thread contention.",
        originalLanguage: "en",
        translatedText_JSON: JSON.stringify({
          es: "Implementé una cola de búfer circular concurrente en C# con atómicos sin bloqueo para minimizar la contención de hilos.",
          zh: "我在C#中实现了一个无锁原子操作的并发环形缓冲区队列，以最大限度地减少线程争用。",
          hi: "मैंने थ्रेड विवाद को कम करने के लिए लॉक-मुक्त परमाणु संचालन के साथ C# में एक समवर्ती रिंग बफर कतार लागू की।",
          de: "Ich habe eine nebenläufige Ringpuffer-Warteschlange in C# mit sperrenfreien atomaren Operationen implementiert.",
          fr: "J'ai implémenté une file d'attente tampon circulaire concurrente en C# avec des opérations atomiques sans verrou.",
          ja: "スレッドの競合を最小限に抑えるため、ロックフリーのアトミック操作を使用してC#で並行リングバッファキューを実装しました。",
          pt: "Implementei uma fila de buffer circular simultânea em C# com atômicos sem bloqueio para minimizar a contenção de threads.",
          ar: "لقد قمت بتنفيذ قائمة انتظار مؤقتة دائرية متزامنة في C# باستخدام عمليات ذرية خالية من الأقفال لتقليل تعارض الخيوط.",
          ko: "스레드 경합을 최소화하기 위해 락 프리 원자적 연산을 사용하여 C#에서 동시 링 버퍼 대기열을 구현했습니다."
        })
      },
      {
        id: "seg-03",
        sessionId,
        sequenceNumber: 3,
        speaker: "AiInterviewer",
        startTimeSeconds: 9.0,
        endTimeSeconds: 14.0,
        originalText: "Excellent approach. What happens when the buffer reaches maximum capacity under a high-throughput load spike?",
        originalLanguage: "en",
        translatedText_JSON: JSON.stringify({
          es: "Excelente enfoque. ¿Qué sucede cuando el búfer alcanza su capacidad máxima bajo un pico de carga alta?",
          zh: "非常出色的方法。当高吞吐量负载高峰导致缓冲区达到最大容量时会发生什么？",
          hi: "उत्कृष्ट दृष्टिकोण। जब उच्च-थ्रूपुट लोड स्पाइक के तहत बफर अधिकतम क्षमता तक पहुँच जाता है तो क्या होता है?",
          de: "Hervorragender Ansatz. Was passiert, wenn der Puffer unter Lastspitzen seine maximale Kapazität erreicht?",
          fr: "Excellente approche. Que se passe-t-il lorsque le tampon atteint sa capacité maximale lors d'un pic de charge?",
          ja: "素晴らしいアプローチです。高スループットの負荷急増時にバッファが最大容量に達するとどうなりますか？",
          pt: "Excelente abordagem. O que acontece quando o buffer atinge a capacidade máxima sob um pico de carga alta?",
          ar: "نهج ممتاز. ماذا يحدث عندما يصل المخزن المؤقت إلى أقصى سعة له أثناء ذروة التحميل العالية؟",
          ko: "탁월한 접근 방식입니다. 높은 처리량 부하 급증 시 버퍼가 최대 용량에 도달하면 어떻게 됩니까?"
        })
      }
    ]);
  };

  useEffect(() => {
    fetchTranscript();
  }, [sessionId]);

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

      const res = await fetch("http://localhost:5000/api/translation/segment/ingest", {
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

  const handleDownloadWebVtt = () => {
    window.open(`http://localhost:5000/api/translation/session/${sessionId}/subtitles.vtt?lang=${selectedLanguage}`, "_blank");
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans pb-16">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-cyan-500/20">
                <Globe2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base text-white tracking-wide">
                    MULTI-LANGUAGE SUBTITLE & AUDIO TRANSLATION STUDIO
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40">
                    Phase 24 Live
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Real-time WebVTT stream generation, bilingual transcript timeline & simulated neural dubbing.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadWebVtt}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export WebVTT ({selectedLanguage.toUpperCase()})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
        {/* Language Selection Ribbon */}
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300 flex items-center space-x-2">
              <Languages className="w-4 h-4 text-cyan-400" />
              <span>Select Active Subtitle & Dubbing Language (10 Global Locales)</span>
            </span>
            <span className="text-xs text-slate-500">
              Active: <strong className="text-cyan-400">{SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage)?.label}</strong>
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
                      : "bg-slate-950/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                  }`}
                >
                  <span className="text-xl">{lang.flag}</span>
                  <span className={`text-[11px] font-bold ${isActive ? "text-cyan-300" : "text-slate-300"}`}>
                    {lang.code.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-slate-500 truncate w-full text-center">
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
                  <h3 className="text-base font-bold text-white">Interview Audio Channel</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30">
                    {audioTrackMode === "dubbed" ? "Simulated Neural Dubbing" : "Original Dialect"}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5 font-mono">
                  {formatSeconds(currentTime)} / 00:20.0 (Scrubbing position)
                </div>
              </div>
            </div>

            {/* Dual-Track Audio Selector */}
            <div className="flex items-center space-x-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              <button
                onClick={() => setAudioTrackMode("original")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1.5 transition-all cursor-pointer ${
                  audioTrackMode === "original"
                    ? "bg-slate-800 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
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
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Neural Dubbed Track ({selectedLanguage.toUpperCase()})</span>
              </button>
            </div>
          </div>

          {/* Timeline Scrubber Bar */}
          <div className="space-y-1.5">
            <div className="h-2.5 w-full rounded-full bg-slate-950 overflow-hidden relative cursor-pointer">
              <div
                style={{ width: `${(currentTime / 20.0) * 100}%` }}
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-200"
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>00:00.0</span>
              <span>Timeline synchronized with WebVTT captions</span>
              <span>00:20.0</span>
            </div>
          </div>
        </div>

        {/* Synchronized Bilingual Subtitle Transcript */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center space-x-2">
              <Languages className="w-4 h-4 text-cyan-400" />
              <span>Synchronized Bilingual Subtitle Timeline</span>
            </h3>
            <span className="text-xs text-slate-400">
              {segments.length} dialogue segments recorded
            </span>
          </div>

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
                      : "bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`p-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 ${
                        isAi 
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      }`}>
                        {isAi ? <Bot className="w-3.5 h-3.5 mr-1" /> : <User className="w-3.5 h-3.5 mr-1" />}
                        <span>{isAi ? "AI Technical Interviewer" : "Candidate"}</span>
                      </span>

                      <span className="text-[11px] font-mono text-slate-500">
                        [{formatSeconds(seg.startTimeSeconds)} - {formatSeconds(seg.endTimeSeconds)}]
                      </span>
                    </div>

                    <span className="text-[10px] uppercase font-bold text-slate-500">
                      Segment #{seg.sequenceNumber}
                    </span>
                  </div>

                  {/* Original Spoken Text */}
                  <div className="text-xs text-slate-400 leading-relaxed pl-2 border-l-2 border-slate-700">
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block mb-0.5">
                      Spoken Original ({seg.originalLanguage.toUpperCase()}):
                    </span>
                    {seg.originalText}
                  </div>

                  {/* Translated Text in Active Target Language */}
                  <div className="text-sm font-medium text-cyan-200 leading-relaxed pl-2 border-l-2 border-cyan-500">
                    <span className="text-[10px] uppercase font-semibold text-cyan-400 block mb-0.5">
                      Subtitles / Dubbing ({selectedLanguage.toUpperCase()}):
                    </span>
                    {getTranslatedText(seg)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real-time Dialogue Injection Simulator */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h3 className="text-base font-bold text-white">Live Dialogue & Subtitle Stream Simulator</h3>
          </div>
          <p className="text-xs text-slate-400">
            Inject a live candidate answer or interviewer probing question to trigger instant multi-language translation and WebVTT caption synthesis across all 10 locales.
          </p>

          <form onSubmit={handleIngestSegment} className="space-y-3">
            <div className="flex items-center space-x-3">
              <label className="text-xs text-slate-300 font-medium">Speaker:</label>
              <div className="flex items-center space-x-2">
                {["Candidate", "AiInterviewer", "Mentor"].map((spk) => (
                  <button
                    key={spk}
                    type="button"
                    onClick={() => setInputSpeaker(spk)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer border ${
                      inputSpeaker === spk
                        ? "bg-cyan-600 text-white border-cyan-500"
                        : "bg-slate-800 text-slate-300 border-slate-700"
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
                className="flex-1 rounded-xl bg-slate-950 border border-slate-800 px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={isSubmitting || !inputText.trim()}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? "Translating..." : "Inject & Translate"}</span>
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

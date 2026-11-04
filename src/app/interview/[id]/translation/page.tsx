"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import { ArrowLeft, Bot, Download, Send, User } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, Card, EmptyState, Loading, PageHeader } from "@/components/career/ui";

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
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || "";

  const [selectedLanguage, setSelectedLanguage] = useState<string>("es");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // The segment the reader last clicked (highlighted in the transcript)
  const [currentTime, setCurrentTime] = useState<number>(0);

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
    <div className="text-foreground">
      <PageHeader
        title={en("Interview translation")}
        description={en("Read this interview's transcript in another language and download subtitles.")}
        actions={
          <>
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
              {en("Back")}
            </Button>
            <Button variant="secondary" onClick={handleDownloadWebVtt}>
              <Download className="h-4 w-4" />
              <span>{en("Download subtitles ({value})", { value: selectedLanguage.toUpperCase() })}</span>
            </Button>
          </>
        }
      />

      <div className="space-y-8">
        {/* Language Selection Ribbon */}
        <Card
          title={en("Subtitle language")}
          actions={
            <span className="text-sm text-muted-foreground">
              {en("Showing: ")}
              <strong className="font-medium text-foreground">{SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.label}</strong>
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 md:grid-cols-10">
            {SUPPORTED_LANGUAGES.map((lang) => {
              const isActive = selectedLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border p-2.5 transition-colors ${
                    isActive ? "border-indigo-500 bg-card ring-1 ring-indigo-500" : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{en(lang.label)}</span>
                  <span className="w-full truncate text-center text-xs text-muted-foreground">{en(lang.native)}</span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Synchronized Bilingual Subtitle Transcript */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{en("Transcript")}</h2>
            <span className="text-sm text-muted-foreground">{en("{length} segments", { length: segments.length })}</span>
          </div>

          {loading ? (
            <Loading />
          ) : segments.length === 0 ? (
            <EmptyState title={fetchError || en("No translated transcript for this interview yet.")} />
          ) : (
            <div className="space-y-3">
              {segments.map((seg) => {
                const isCurrent = currentTime >= seg.startTimeSeconds && currentTime <= seg.endTimeSeconds;
                const isAi = seg.speaker === "AiInterviewer";

                return (
                  <div
                    key={seg.id || seg.sequenceNumber}
                    onClick={() => setCurrentTime(seg.startTimeSeconds)}
                    className={`cursor-pointer space-y-2 rounded-xl border bg-card p-4 shadow-sm transition-colors ${
                      isCurrent ? "border-indigo-500 ring-1 ring-indigo-500" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                          {isAi ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                          <span>{isAi ? en("AI interviewer") : en("Candidate")}</span>
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatSeconds(seg.startTimeSeconds)} – {formatSeconds(seg.endTimeSeconds)}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">{en("Segment {sequenceNumber}", { sequenceNumber: seg.sequenceNumber })}</span>
                    </div>

                    {/* Original Spoken Text */}
                    <div className="border-s-2 border-border ps-2 text-sm leading-relaxed text-muted-foreground">
                      <span className="mb-0.5 block text-xs font-medium text-muted-foreground">
                        {en("Original ({value})", { value: seg.originalLanguage.toUpperCase() })}
                      </span>
                      {seg.originalText}
                    </div>

                    {/* Translated Text in Active Target Language */}
                    <div className="border-s-2 border-indigo-500 ps-2 text-sm font-medium leading-relaxed text-foreground">
                      <span className="mb-0.5 block text-xs font-medium text-indigo-700 dark:text-indigo-400">
                        {en("Translation ({value})", { value: selectedLanguage.toUpperCase() })}
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
        <Card title={en("Translate a new line")}>
          <p className="mb-4 text-sm text-muted-foreground">
            {en("Add a question or answer to this transcript and see it translated into the supported languages.")}
          </p>

          <form onSubmit={handleIngestSegment} className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">{en("Speaker")}</span>
              <div className="flex items-center gap-2">
                {["Candidate", "AiInterviewer", "Mentor"].map((spk) => (
                  <Button key={spk} type="button" variant={inputSpeaker === spk ? "primary" : "secondary"} onClick={() => setInputSpeaker(spk)}>
                    {spk === "AiInterviewer" ? en("AI interviewer") : en(spk)}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={en("Type what was said")}
                aria-label={en("Line to translate")}
                className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:border-indigo-500 focus:outline-none"
              />
              <Button type="submit" busy={isSubmitting} disabled={!inputText.trim()}>
                {!isSubmitting && <Send className="h-4 w-4" />}
                <span>{isSubmitting ? en("Translating…") : en("Translate")}</span>
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

"use client";

// P6 (5 Nov 2026): no translation service is connected, so this page shows the interview's transcript in its original language
// and says that translated subtitles aren't available. It used to show canned sentences and "[ES] text" copies as translations,
// and let people type lines with made-up timestamps into the transcript.
import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import { ArrowLeft, Bot, Download, User } from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, EmptyState, ErrorBanner, Loading, PageHeader } from "@/components/career/ui";

interface TranscriptSegment {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  speaker: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  originalText: string;
  originalLanguage: string;
}

export default function InterviewTranscriptPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const params = useParams();
  const router = useRouter();
  const sessionId = (params?.id as string) || "";

  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const fetchTranscript = async () => {
    if (!sessionId) {
      setFetchError(en("This interview link is incomplete."));
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
        setFetchError(en("There is no transcript for this interview yet."));
        setSegments([]);
      }
    } catch (e) {
      setFetchError(e instanceof TypeError ? en("We couldn't reach Edulexa. Check your internet connection and try again.") : en("We couldn't load the transcript. Please try again."));
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

  const originalLanguage = segments[0]?.originalLanguage || "en";

  // The subtitles endpoint needs the bearer token, so download through fetch instead of opening the URL
  const handleDownloadWebVtt = async () => {
    setDownloadError(null);
    try {
      const res = await apiFetch(`/api/translation/session/${sessionId}/subtitles.vtt?lang=${encodeURIComponent(originalLanguage)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setDownloadError(body?.message || en("We couldn't prepare the subtitles. Please try again."));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `interview-${sessionId}-${originalLanguage}.vtt`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError(en("We couldn't reach Edulexa. Check your internet connection and try again."));
    }
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  if (access) return <AccessNotice problem={access} feature="The interview transcript" />;

  return (
    <div className="text-foreground">
      <PageHeader
        title={en("Interview transcript")}
        description={en("The interview's transcript in its original language. Translated subtitles aren't available yet.")}
        actions={
          <>
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              {en("Back")}
            </Button>
            {segments.length > 0 && (
              <Button variant="secondary" onClick={handleDownloadWebVtt}>
                <Download aria-hidden="true" className="h-4 w-4" />
                <span>{en("Download subtitles")}</span>
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-4">
        <ErrorBanner error={downloadError} />
        {loading ? (
          <Loading />
        ) : segments.length === 0 ? (
          <EmptyState title={fetchError || en("There is no transcript for this interview yet.")} />
        ) : (
          <ol className="space-y-3">
            {segments.map((seg) => {
              const isAi = seg.speaker === "AiInterviewer";
              return (
                <li key={seg.id || seg.sequenceNumber} className="space-y-2 rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {isAi ? <Bot aria-hidden="true" className="h-3.5 w-3.5" /> : <User aria-hidden="true" className="h-3.5 w-3.5" />}
                      <span>{isAi ? en("AI interviewer") : en("Candidate")}</span>
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatSeconds(seg.startTimeSeconds)} – {formatSeconds(seg.endTimeSeconds)}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">{seg.originalText}</p>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

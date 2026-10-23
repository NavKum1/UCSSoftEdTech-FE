"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Loader2, Lock, ShieldOff, AlertTriangle } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import SignInRequired from "@/components/SignInRequired";

interface TelemetryPoint {
  id: string;
  interviewId: string;
  timestamp: string;
  pitchVarianceHz: number;
  speechCadenceWpm: number;
  hesitationCount: number;
  acousticStressScore: number;
  sentimentScore: number;
  psychologicalSafetyState: string;
  pacingDirective: string;
  telemetrySnippet: string;
}

interface SentimentSummary {
  id: string;
  interviewId: string;
  candidateId: string;
  overallConfidenceScore: number;
  resilienceScore: number;
  averageSpeechWpm: number;
  stressSpikeCount: number;
  adaptivePacingInterventionsCount: number;
  executivePresenceRating: string;
  executiveCoachingFeedback: string[];
  createdAt: string;
}

interface SentimentAvailability {
  enabled: boolean;
  requiresConsent: boolean;
  hasConsent: boolean;
  usable: boolean;
  reason?: string | null;
}

type GetToken = () => Promise<string | null>;

const UNAVAILABLE_FALLBACK = "Speaking and composure coaching isn't available in your region.";

// Returns the decision from a 451 response body, if any
async function readBlockedDecision(res: Response): Promise<SentimentAvailability | null> {
  if (res.status !== 451) return null;
  const body = (await res.json().catch(() => null)) as (SentimentAvailability & { decision?: SentimentAvailability }) | null;
  return body?.decision ?? body ?? { enabled: false, requiresConsent: true, hasConsent: false, usable: false, reason: null };
}

async function fetchCoachData(interviewId: string, getToken: GetToken) {
  const [timelineRes, summaryRes] = await Promise.all([
    authenticatedFetch(`/api/sentiment/timeline/${interviewId}`, {}, getToken).catch(() => null),
    authenticatedFetch(`/api/sentiment/summary/${interviewId}`, {}, getToken).catch(() => null),
  ]);
  const blocked =
    (timelineRes && (await readBlockedDecision(timelineRes))) || (summaryRes && (await readBlockedDecision(summaryRes))) || null;
  let timeline: TelemetryPoint[] = [];
  let summary: SentimentSummary | null = null;
  if (!blocked && timelineRes?.ok) {
    const data = await timelineRes.json().catch(() => null);
    if (data?.success) timeline = data.timeline || [];
  }
  if (!blocked && summaryRes?.ok) {
    const data = await summaryRes.json().catch(() => null);
    if (data?.success) summary = data.summary;
  }
  return { blocked, timeline, summary };
}

function SentimentCoach({
  interviewId,
  onBlocked,
  onWithdrawConsent,
  withdrawing,
}: {
  interviewId: string;
  onBlocked: (decision: SentimentAvailability) => void;
  onWithdrawConsent: () => void;
  withdrawing: boolean;
}) {
  const { getToken } = useAuth();

  const [timeline, setTimeline] = useState<TelemetryPoint[]>([]);
  const [summary, setSummary] = useState<SentimentSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Simulation form states
  const [pitchVariance, setPitchVariance] = useState<number>(18.5);
  const [speechWpm, setSpeechWpm] = useState<number>(135);
  const [hesitations, setHesitations] = useState<number>(1);
  const [latencyMs, setLatencyMs] = useState<number>(450);
  const [snippetContext, setSnippetContext] = useState<string>(
    "Explaining consistent hashing ring with virtual nodes under network partition..."
  );

  const applyCoachData = useCallback(
    (result: Awaited<ReturnType<typeof fetchCoachData>>) => {
      if (result.blocked) {
        onBlocked(result.blocked);
        return;
      }
      setTimeline(result.timeline);
      setSummary(result.summary);
    },
    [onBlocked]
  );

  useEffect(() => {
    let cancelled = false;
    fetchCoachData(interviewId, getToken).then((result) => {
      if (!cancelled) applyCoachData(result);
    });
    return () => {
      cancelled = true;
    };
  }, [interviewId, getToken, applyCoachData]);

  const fetchTimeline = async () => {
    try {
      const res = await authenticatedFetch(`/api/sentiment/timeline/${interviewId}`, {}, getToken);
      const blocked = await readBlockedDecision(res);
      if (blocked) return onBlocked(blocked);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setTimeline(data.timeline || []);
        }
      }
    } catch (e) {
      console.error("Error fetching timeline:", e);
    }
  };

  const handleIngestTelemetry = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await authenticatedFetch(
        "/api/sentiment/telemetry",
        {
          method: "POST",
          body: JSON.stringify({
            interviewId,
            pitchVarianceHz: pitchVariance,
            speechCadenceWpm: speechWpm,
            hesitationCount: hesitations,
            acousticLatencyMs: latencyMs,
            audioSnippetContext: snippetContext,
          }),
        },
        getToken
      );

      const blocked = await readBlockedDecision(res);
      if (blocked) return onBlocked(blocked);

      const data = await res.json();
      if (data.success) {
        const evalRes = data.evaluation;
        setActionMessage(
          `Speech sample recorded! Composure: ${evalRes.psychologicalSafetyState} | Interviewer Approach: ${evalRes.pacingDirective}`
        );
        await fetchTimeline();
      } else {
        setActionMessage(data.message || "Failed to record speech sample.");
      }
    } catch (e) {
      console.error("Error ingesting telemetry:", e);
      setActionMessage("Failed to record speech sample.");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSummary = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(
        "/api/sentiment/summary/generate",
        { method: "POST", body: JSON.stringify({ interviewId }) },
        getToken
      );

      const blocked = await readBlockedDecision(res);
      if (blocked) return onBlocked(blocked);

      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setActionMessage("Communication and composure summary generated successfully!");
      } else {
        setActionMessage(data.message || "Could not generate a summary.");
      }
    } catch (e) {
      console.error("Error generating summary:", e);
    } finally {
      setLoading(false);
    }
  };


  const applyPreset = (type: "optimal" | "tension" | "freeze") => {
    if (type === "optimal") {
      setPitchVariance(14.0);
      setSpeechWpm(142);
      setHesitations(0);
      setLatencyMs(350);
      setSnippetContext("Clearly articulating raft log replication and quorum consensus invariants.");
    } else if (type === "tension") {
      setPitchVariance(26.5);
      setSpeechWpm(122);
      setHesitations(2);
      setLatencyMs(1100);
      setSnippetContext("Pausing to calculate database IOPS saturation under multi-region replication lag.");
    } else {
      setPitchVariance(42.0);
      setSpeechWpm(62);
      setHesitations(6);
      setLatencyMs(3800);
      setSnippetContext("Vocal tremor and silent freeze when asked about split-brain recovery failure cases.");
    }
  };

  const latestTelemetry = timeline.length > 0 ? timeline[timeline.length - 1] : null;

  return (
    <div className="min-h-screen bg-background text-foreground p-6 font-sans">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-border gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider bg-violet-500/10 text-violet-400 border border-violet-500/20 rounded">
              Speaking & Composure Analysis
            </span>
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Speech Analysis Active
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1">
            AI Communication & Delivery Coach
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time speaking pace, confidence tracking, and communication recommendations.
          </p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Private coaching for you only — never shared with employers or used in hiring evidence.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onWithdrawConsent}
            disabled={withdrawing}
            className="px-4 py-2 text-sm font-medium rounded-lg transition border border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-60"
          >
            {withdrawing ? "Withdrawing..." : "Withdraw consent"}
          </button>
          <Link
            href={`/interview/${interviewId}/replay`}
            className="px-4 py-2 bg-muted hover:bg-slate-700 text-foreground text-sm font-medium rounded-lg transition border border-border"
          >
            Audio Replay
          </Link>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-muted hover:bg-slate-700 text-foreground text-sm font-medium rounded-lg transition border border-border"
          >
            Dashboard
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="max-w-7xl mx-auto mt-4 p-3.5 bg-blue-900/30 border border-blue-700/50 rounded-lg text-blue-200 text-sm flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-xs text-blue-700 dark:text-blue-400 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Left Column: Live Gauges & Adaptive Directive */}
        <div className="space-y-6">
          {/* Live Status Card */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
              Current Composure State
            </h2>

            <div className="text-center py-4 bg-background/60 border border-border rounded-lg">
              <span
                className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold uppercase tracking-wider ${
                  latestTelemetry?.psychologicalSafetyState === "Optimal"
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40"
                    : latestTelemetry?.psychologicalSafetyState === "Moderate_Tension"
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                    : latestTelemetry?.psychologicalSafetyState === "High_Stress_Fatigue"
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/40"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                }`}
              >
                {latestTelemetry?.psychologicalSafetyState || "Confident & Steady"}
              </span>

              <div className="mt-4 grid grid-cols-2 gap-3 px-4 text-left">
                <div className="bg-card/80 p-2.5 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Vocal Tension</div>
                  <div className="text-lg font-bold text-foreground">
                    {latestTelemetry ? `${latestTelemetry.acousticStressScore.toFixed(1)}/100` : "15.0/100"}
                  </div>
                </div>
                <div className="bg-card/80 p-2.5 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Speaking Pace</div>
                  <div className="text-lg font-bold text-foreground">
                    {latestTelemetry ? `${latestTelemetry.speechCadenceWpm.toFixed(0)} WPM` : "135 WPM"}
                  </div>
                </div>
                <div className="bg-card/80 p-2.5 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Voice Variation</div>
                  <div className="text-lg font-bold text-foreground">
                    {latestTelemetry ? `${latestTelemetry.pitchVarianceHz.toFixed(1)} Hz` : "18.5 Hz"}
                  </div>
                </div>
                <div className="bg-card/80 p-2.5 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Tone / Sentiment</div>
                  <div className="text-lg font-bold text-foreground">
                    {latestTelemetry ? latestTelemetry.sentimentScore.toFixed(2) : "+0.65"}
                  </div>
                </div>
              </div>
            </div>

            {/* Adaptive Pacing Directive */}
            <div className="mt-5 p-4 bg-violet-950/20 border border-violet-800/40 rounded-lg">
              <div className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                AI Interviewer Style
              </div>
              <div className="mt-1 text-sm font-bold text-foreground">
                {latestTelemetry?.pacingDirective === "IntensifyRigor" && "🚀 Deep-Dive Exploration"}
                {latestTelemetry?.pacingDirective === "MaintainPacing" && "⚖️ Steady Conversational Pace"}
                {latestTelemetry?.pacingDirective === "SocraticSupport" && "💡 Helpful Hints & Guidance"}
                {latestTelemetry?.pacingDirective === "DeescalateStress" && "🛡️ Calm & Supportive Assistance"}
                {!latestTelemetry && "🚀 Deep-Dive Exploration"}
              </div>
              <p className="mt-1.5 text-xs text-violet-200/80 leading-relaxed">
                {latestTelemetry?.pacingDirective === "DeescalateStress"
                  ? "Tension detected. The interviewer pauses deeper questions and provides a clear, supportive prompt."
                  : latestTelemetry?.pacingDirective === "SocraticSupport"
                  ? "Hesitation detected. The interviewer provides hints without penalizing your score."
                  : "Great composure and clarity. The interviewer explores deeper technical topics and trade-offs."}
              </p>
            </div>
          </div>

          {/* Interactive Simulation Preset Tray */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Practice Speech Presets
            </h2>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => applyPreset("optimal")}
                className="px-2.5 py-2 text-xs font-medium bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-600 dark:text-emerald-300 rounded transition text-center"
              >
                Confident & Clear
              </button>
              <button
                onClick={() => applyPreset("tension")}
                className="px-2.5 py-2 text-xs font-medium bg-sky-950/40 hover:bg-sky-900/60 border border-sky-800/50 text-sky-300 rounded transition text-center"
              >
                Standard Pace
              </button>
              <button
                onClick={() => applyPreset("freeze")}
                className="px-2.5 py-2 text-xs font-medium bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 text-rose-300 rounded transition text-center"
              >
                Hesitant / Nervous
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground">Voice Variation ({pitchVariance} Hz)</label>
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={pitchVariance}
                  onChange={(e) => setPitchVariance(Number(e.target.value))}
                  className="w-full mt-1 accent-violet-500"
                />
              </div>
              <div>
                <label className="text-muted-foreground">Speaking Pace ({speechWpm} WPM)</label>
                <input
                  type="range"
                  min="50"
                  max="220"
                  value={speechWpm}
                  onChange={(e) => setSpeechWpm(Number(e.target.value))}
                  className="w-full mt-1 accent-violet-500"
                />
              </div>
              <div>
                <label className="text-muted-foreground">Pauses & Hesitations ({hesitations})</label>
                <input
                  type="range"
                  min="0"
                  max="8"
                  value={hesitations}
                  onChange={(e) => setHesitations(Number(e.target.value))}
                  className="w-full mt-1 accent-violet-500"
                />
              </div>
            </div>

            <button
              onClick={handleIngestTelemetry}
              disabled={loading}
              className="mt-4 w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition shadow"
            >
              {loading ? "Analyzing Speech..." : "Add Speaking Sample"}
            </button>
          </div>
        </div>

        {/* Center & Right Column: Telemetry Timeline & Executive Presence Summary */}
        <div className="lg:col-span-2 space-y-6">
          {/* Executive Presence Summary Card */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h2 className="text-base font-semibold text-foreground">Confidence & Communication Summary</h2>
                <p className="text-xs text-muted-foreground">Overall confidence, speaking pace, and delivery insights</p>
              </div>
              <button
                onClick={handleGenerateSummary}
                disabled={loading}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition"
              >
                Generate Summary Report
              </button>
            </div>

            {summary ? (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-background p-3 rounded-lg border border-border text-center">
                    <div className="text-xs text-muted-foreground">Confidence Score</div>
                    <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                      {summary.overallConfidenceScore}%
                    </div>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border text-center">
                    <div className="text-xs text-muted-foreground">Stress Composure</div>
                    <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-0.5">
                      {summary.resilienceScore}%
                    </div>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border text-center">
                    <div className="text-xs text-muted-foreground">Average Pace</div>
                    <div className="text-2xl font-black text-foreground mt-0.5">
                      {summary.averageSpeechWpm.toFixed(0)} WPM
                    </div>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border text-center">
                    <div className="text-xs text-muted-foreground">Overall Rating</div>
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-400 mt-2">
                      {summary.executivePresenceRating}
                    </div>
                  </div>
                </div>

                {/* Coaching Feedback Notes */}
                <div className="bg-background p-4 rounded-lg border border-border">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    Personalized Delivery & Speaking Tips
                  </div>
                  <ul className="space-y-2 text-xs text-muted-foreground">
                    {summary.executiveCoachingFeedback.map((fb, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">✓</span>
                        <span>{fb}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs">
                No summary generated yet. Add speaking samples and click &quot;Generate Summary Report&quot;.
              </div>
            )}
          </div>

          {/* Telemetry Chronological Timeline */}
          <div className="bg-card border border-border rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Speaking Timeline & Highlights</h2>
              <span className="text-xs text-muted-foreground">{timeline.length} Recorded Samples</span>
            </div>

            <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
              {timeline.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No speaking samples recorded for this session yet. Use the panel on the left to test or record samples.
                </div>
              ) : (
                timeline.map((point) => (
                  <div
                    key={point.id}
                    className="p-3 bg-background rounded-lg border border-border/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            point.psychologicalSafetyState === "Optimal"
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                              : point.psychologicalSafetyState === "Moderate_Tension"
                              ? "bg-sky-500/20 text-sky-400"
                              : point.psychologicalSafetyState === "High_Stress_Fatigue"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}
                        >
                          {point.psychologicalSafetyState}
                        </span>
                        <span className="text-muted-foreground">Tension: {point.acousticStressScore.toFixed(0)}/100</span>
                        <span className="text-muted-foreground">Pace: {point.speechCadenceWpm.toFixed(0)} WPM</span>
                        <span className="text-muted-foreground">Variation: {point.pitchVarianceHz.toFixed(1)} Hz</span>
                      </div>
                      <p className="text-muted-foreground italic">&ldquo;{point.telemetrySnippet}&rdquo;</p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-mono text-violet-400 block">{point.pacingDirective}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(point.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchAvailability(getToken: GetToken): Promise<SentimentAvailability | "unauthorized" | null> {
  try {
    const res = await authenticatedFetch("/api/sentiment/availability", {}, getToken);
    if (res.status === 401) return "unauthorized";
    const blocked = await readBlockedDecision(res);
    if (blocked) return blocked;
    return res.ok ? ((await res.json()) as SentimentAvailability) : null;
  } catch {
    return null;
  }
}

export default function BehavioralSentimentPage() {
  const params = useParams<{ id: string }>();
  const interviewId = params?.id ?? "";
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [availability, setAvailability] = useState<SentimentAvailability | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "unauthorized">("loading");
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchAvailability(getToken).then((result) => {
      if (cancelled) return;
      if (result === "unauthorized") setStatus("unauthorized");
      else if (result) {
        setAvailability(result);
        setStatus("ready");
      } else setStatus("error");
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const handleBlocked = useCallback((decision: SentimentAvailability) => {
    setAvailability(decision);
    setStatus("ready");
  }, []);

  const setConsent = async (granted: boolean) => {
    setConsentBusy(true);
    setConsentError(null);
    try {
      const res = await authenticatedFetch(
        "/api/sentiment/consent",
        { method: "POST", body: JSON.stringify({ granted }) },
        getToken
      );
      const blocked = await readBlockedDecision(res);
      if (blocked) {
        setAvailability(blocked);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setAvailability((await res.json()) as SentimentAvailability);
    } catch {
      setConsentError(granted ? "Could not record your consent. Please try again." : "Could not withdraw consent. Please try again.");
    } finally {
      setConsentBusy(false);
    }
  };

  if ((isLoaded && !isSignedIn) || status === "unauthorized") {
    return (
      <SignInRequired title="Speaking & composure coach" message="Sign in to view coaching for your own interviews." />
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking availability...
      </div>
    );
  }

  if (status === "error" || !availability) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-400" />
        <p className="text-sm text-muted-foreground">We couldn&apos;t check whether speaking coaching is available. Please try again later.</p>
      </div>
    );
  }

  if (!availability.enabled) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="glass-panel rounded-2xl p-6 border border-border text-center space-y-3">
          <ShieldOff className="w-8 h-8 mx-auto text-muted-foreground" />
          <h1 className="text-lg font-bold text-foreground">Speaking &amp; composure coaching is unavailable</h1>
          <p className="text-sm text-muted-foreground">{availability.reason || UNAVAILABLE_FALLBACK}</p>
        </div>
      </div>
    );
  }

  if (!availability.usable) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
            <h1 className="text-lg font-bold text-foreground">Turn on private speaking coaching?</h1>
          </div>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              With your consent, we analyse voice signals such as speaking pace, pauses and pitch variation during your interviews to
              give you delivery tips.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>This is private coaching for you only.</li>
              <li>It is never shared with employers or reviewers and is never used in hiring evidence or scores.</li>
              <li>You can withdraw consent at any time from this page.</li>
            </ul>
          </div>
          {consentError && <p className="text-xs text-red-700 dark:text-red-400">{consentError}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setConsent(true)}
              disabled={consentBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-semibold"
            >
              {consentBusy && <Loader2 className="w-4 h-4 animate-spin" />}I agree — turn on coaching
            </button>
            <Link href="/dashboard" className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-muted">
              Not now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {consentError && (
        <div className="max-w-7xl mx-auto px-6 pt-4 text-xs text-red-700 dark:text-red-400">{consentError}</div>
      )}
      <SentimentCoach
        interviewId={interviewId}
        onBlocked={handleBlocked}
        onWithdrawConsent={() => setConsent(false)}
        withdrawing={consentBusy}
      />
    </>
  );
}

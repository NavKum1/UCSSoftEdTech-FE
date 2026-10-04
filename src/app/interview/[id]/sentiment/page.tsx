"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

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

export default function BehavioralSentimentPage() {
  const params = useParams();
  const interviewId = (params?.id as string) || "e95cfc9b-513b-4890-a548-261546959b81";
  const candidateId = "1e0463a7-f9cf-4ff0-8070-74fadcf2dd78";

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

  const fetchTimeline = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sentiment/timeline/${interviewId}`);
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

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sentiment/summary/${interviewId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSummary(data.summary);
        }
      }
    } catch (e) {
      console.error("Error fetching summary:", e);
    }
  };

  useEffect(() => {
    fetchTimeline();
    fetchSummary();
  }, [interviewId]);

  const handleIngestTelemetry = async () => {
    setLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sentiment/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          pitchVarianceHz: pitchVariance,
          speechCadenceWpm: speechWpm,
          hesitationCount: hesitations,
          acousticLatencyMs: latencyMs,
          audioSnippetContext: snippetContext,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const evalRes = data.evaluation;
        setActionMessage(
          `Speech sample recorded! Composure: ${evalRes.psychologicalSafetyState} | Interviewer Approach: ${evalRes.pacingDirective}`
        );
        await fetchTimeline();
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/sentiment/summary/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          candidateId,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setActionMessage("Communication and composure summary generated successfully!");
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
            <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Speech Analysis Active
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
            AI Communication & Delivery Coach
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time speaking pace, confidence tracking, and communication recommendations.
          </p>
        </div>

        <div className="flex items-center gap-3">
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
          <button onClick={() => setActionMessage(null)} className="text-xs text-blue-400 hover:underline">
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
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : latestTelemetry?.psychologicalSafetyState === "Moderate_Tension"
                    ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                    : latestTelemetry?.psychologicalSafetyState === "High_Stress_Fatigue"
                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                    : "bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse"
                }`}
              >
                {latestTelemetry?.psychologicalSafetyState || "Confident & Steady"}
              </span>

              <div className="mt-4 grid grid-cols-2 gap-3 px-4 text-left">
                <div className="bg-card/80 p-2.5 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Vocal Tension</div>
                  <div className="text-lg font-bold text-white">
                    {latestTelemetry ? `${latestTelemetry.acousticStressScore.toFixed(1)}/100` : "15.0/100"}
                  </div>
                </div>
                <div className="bg-card/80 p-2.5 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Speaking Pace</div>
                  <div className="text-lg font-bold text-white">
                    {latestTelemetry ? `${latestTelemetry.speechCadenceWpm.toFixed(0)} WPM` : "135 WPM"}
                  </div>
                </div>
                <div className="bg-card/80 p-2.5 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Voice Variation</div>
                  <div className="text-lg font-bold text-white">
                    {latestTelemetry ? `${latestTelemetry.pitchVarianceHz.toFixed(1)} Hz` : "18.5 Hz"}
                  </div>
                </div>
                <div className="bg-card/80 p-2.5 rounded border border-border">
                  <div className="text-xs text-muted-foreground">Tone / Sentiment</div>
                  <div className="text-lg font-bold text-white">
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
              <div className="mt-1 text-sm font-bold text-white">
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
                className="px-2.5 py-2 text-xs font-medium bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/50 text-emerald-300 rounded transition text-center"
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
                <h2 className="text-base font-semibold text-white">Confidence & Communication Summary</h2>
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
                    <div className="text-2xl font-black text-emerald-400 mt-0.5">
                      {summary.overallConfidenceScore}%
                    </div>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border text-center">
                    <div className="text-xs text-muted-foreground">Stress Composure</div>
                    <div className="text-2xl font-black text-indigo-400 mt-0.5">
                      {summary.resilienceScore}%
                    </div>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border text-center">
                    <div className="text-xs text-muted-foreground">Average Pace</div>
                    <div className="text-2xl font-black text-white mt-0.5">
                      {summary.averageSpeechWpm.toFixed(0)} WPM
                    </div>
                  </div>
                  <div className="bg-background p-3 rounded-lg border border-border text-center">
                    <div className="text-xs text-muted-foreground">Overall Rating</div>
                    <div className="text-sm font-bold text-amber-400 mt-2">
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
                        <span className="text-emerald-400 font-bold">✓</span>
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
              <h2 className="text-base font-semibold text-white">Speaking Timeline & Highlights</h2>
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
                              ? "bg-emerald-500/20 text-emerald-400"
                              : point.psychologicalSafetyState === "Moderate_Tension"
                              ? "bg-sky-500/20 text-sky-400"
                              : point.psychologicalSafetyState === "High_Stress_Fatigue"
                              ? "bg-amber-500/20 text-amber-400"
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

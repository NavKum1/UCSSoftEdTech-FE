'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface ViolationMarker {
  id: string;
  timestampSeconds: number;
  timestampFormatted: string;
  violationType: string;
  severity: string;
  notes: string;
  snapshotUrl?: string;
}

interface PlayerPayload {
  recordingId: string;
  sessionId: string;
  trackType: string;
  status: string;
  transcodedUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  totalMarkers: number;
  summary: {
    criticalViolations: number;
    highViolations: number;
    mediumViolations: number;
  };
  markers: ViolationMarker[];
}

export default function ProctoringVideoReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const recordingId = resolvedParams.id;

  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<PlayerPayload | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activeTrack, setActiveTrack] = useState<'Webcam' | 'ScreenCapture'>('Webcam');
  const [selectedMarker, setSelectedMarker] = useState<ViolationMarker | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlayerData() {
      try {
        setLoading(true);
        setFetchError(null);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/video/recording/${recordingId}/player`);
        if (res.ok) {
          const data = await res.json();
          setPlayerData(data);
          if (data.markers && data.markers.length > 0) {
            setSelectedMarker(data.markers[0]);
          }
        } else {
          setFetchError(`Recording not found in forensic vault (HTTP ${res.status}).`);
          setPlayerData(null);
        }
      } catch (err: any) {
        console.error('Failed to load video player payload', err);
        setFetchError(err.message || 'Failed to connect to video recording service.');
        setPlayerData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchPlayerData();
  }, [recordingId]);

  // Simulated video playback timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isPlaying && playerData) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= playerData.durationSeconds) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, playerData, playbackSpeed]);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const jumpToSeconds = (sec: number) => {
    setCurrentTime(sec);
    const markerAtTime = playerData?.markers.find((m) => m.timestampSeconds === sec);
    if (markerAtTime) {
      setSelectedMarker(markerAtTime);
    }
  };

  const handleAdminAction = (action: string) => {
    setActionNotice(`[AUDIT LEDGER] Action executed: ${action}. Notification dispatched to university dean and candidate record.`);
    setTimeout(() => setActionNotice(null), 5000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-mono text-sm">Loading Assessment Video Recording...</p>
        </div>
      </div>
    );
  }

  if (fetchError || !playerData) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center font-sans p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-slate-900 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-lg font-bold">
            !
          </div>
          <h2 className="text-lg font-bold text-white">Recording Not Found</h2>
          <p className="text-xs text-slate-400">
            {fetchError || "The requested assessment recording could not be found or has expired."}
          </p>
          <Link
            href="/partner/dashboard"
            className="inline-block px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition"
          >
            &larr; Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const duration = playerData?.durationSeconds || 180;
  const progressPercent = (currentTime / duration) * 100;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link
            href="/partner/dashboard"
            className="text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 font-mono transition"
          >
            &larr; Back to Reviews
          </Link>
          <div className="h-4 w-[1px] bg-slate-700"></div>
          <h1 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            Assessment Video Review
          </h1>
          <span className="text-xs px-2 py-0.5 rounded font-mono bg-indigo-950/80 text-indigo-300 border border-indigo-700/50">
            HD Recording
          </span>
        </div>

        <div className="flex items-center gap-2">
          {actionNotice && (
            <span className="text-xs text-amber-400 font-mono bg-amber-950/60 px-3 py-1 rounded border border-amber-800/40 animate-fade-in">
              {actionNotice}
            </span>
          )}
          <button
            onClick={() => handleAdminAction('Approved Integrity Score (Pass)')}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
          >
            Approve Session
          </button>
          <button
            onClick={() => handleAdminAction('Disqualified Candidate (Integrity Breach)')}
            className="px-3 py-1.5 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
          >
            Disqualify Candidate
          </button>
        </div>
      </header>

      {/* Main Review Workspace */}
      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
        {/* Left Column: Dual Video Stream & Synchronized Scrubber (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Track Switcher */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg p-1.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTrack('Webcam')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  activeTrack === 'Webcam'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Webcam Stream (HD)
              </button>
              <button
                onClick={() => setActiveTrack('ScreenCapture')}
                className={`px-3 py-1 rounded text-xs font-medium transition ${
                  activeTrack === 'ScreenCapture'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Screen Capture (1080p)
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-400 pr-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Audio Synced (Opus 128kbps)
            </div>
          </div>

          {/* Video Player Display Container */}
          <div className="relative aspect-video bg-black rounded-xl border border-slate-800 overflow-hidden shadow-2xl flex items-center justify-center group">
            {/* Background Stream Simulation Canvas */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-black flex items-center justify-center">
              {activeTrack === 'Webcam' ? (
                <div className="text-center p-6">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-950/60 border border-indigo-700/40 flex items-center justify-center text-indigo-400 text-2xl font-bold">
                    REC
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    Proctored Webcam Candidate Feed
                  </p>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Continuous AI Face &amp; Eye Gaze Tracking Active
                  </p>
                </div>
              ) : (
                <div className="text-center p-6">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-xl bg-cyan-950/60 border border-cyan-700/40 flex items-center justify-center text-cyan-400 text-2xl font-bold">
                    SCR
                  </div>
                  <p className="text-sm font-semibold text-slate-200">
                    Candidate Primary Display (1920x1080)
                  </p>
                  <p className="text-xs text-slate-400 font-mono mt-1">
                    Keystroke &amp; Window Switch Activity Recorded
                  </p>
                </div>
              )}

              {/* PiP Inset (Picture in Picture for other track) */}
              <div className="absolute bottom-4 right-4 w-44 aspect-video bg-slate-900/90 rounded-lg border border-slate-800 overflow-hidden shadow-lg flex items-center justify-center cursor-pointer hover:border-indigo-500 transition">
                <span className="text-[10px] font-mono text-slate-400">
                  {activeTrack === 'Webcam' ? 'Screen (PiP)' : 'Webcam (PiP)'}
                </span>
              </div>

              {/* Real-Time Violation Flash Overlay if current time matches marker */}
              {playerData?.markers.some((m) => Math.abs(m.timestampSeconds - currentTime) <= 2) && (
                <div className="absolute top-4 left-4 bg-rose-950/90 border border-rose-600 px-3 py-1.5 rounded-lg flex items-center gap-2 text-rose-300 text-xs font-mono animate-bounce">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  Active Violation Flagged at {formatSeconds(currentTime)}
                </div>
              )}
            </div>

            {/* Play/Pause Center Overlay */}
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="absolute z-20 w-16 h-16 rounded-full bg-slate-900/80 hover:bg-indigo-600 text-white flex items-center justify-center text-xl transition shadow-xl border border-slate-800 hover:scale-105"
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
          </div>

          {/* Interactive Timeline Scrubber & Marker Pins */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
            {/* Scrubber Bar */}
            <div className="relative w-full h-8 flex items-center cursor-pointer select-none">
              {/* Background Track */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full relative overflow-visible">
                {/* Progress Fill */}
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                ></div>

                {/* Violation Marker Pins along scrubber */}
                {playerData?.markers.map((marker) => {
                  const markerPercent = (marker.timestampSeconds / duration) * 100;
                  const isCritical = marker.severity === 'Critical';
                  const isHigh = marker.severity === 'High';
                  const pinColor = isCritical
                    ? 'bg-rose-500 hover:bg-rose-400 ring-rose-900'
                    : isHigh
                    ? 'bg-amber-500 hover:bg-amber-400 ring-amber-900'
                    : 'bg-yellow-400 hover:bg-yellow-300 ring-yellow-900';

                  return (
                    <div
                      key={marker.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        jumpToSeconds(marker.timestampSeconds);
                      }}
                      title={`[${marker.severity}] ${marker.violationType} (${marker.timestampFormatted})`}
                      className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full ring-4 shadow-lg cursor-pointer transition transform hover:scale-125 z-10 ${pinColor}`}
                      style={{ left: `${markerPercent}%` }}
                    ></div>
                  );
                })}
              </div>
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium transition"
                >
                  {isPlaying ? 'Pause' : 'Play'}
                </button>
                <button
                  onClick={() => jumpToSeconds(0)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 transition"
                >
                  Rewind
                </button>
                <div className="flex items-center gap-1">
                  <span className="text-white font-semibold">{formatSeconds(currentTime)}</span>
                  <span>/</span>
                  <span>{formatSeconds(duration)}</span>
                </div>
              </div>

              {/* Speed Controls */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Speed:</span>
                {[1.0, 1.5, 2.0].map((s) => (
                  <button
                    key={s}
                    onClick={() => setPlaybackSpeed(s)}
                    className={`px-2 py-0.5 rounded text-xs transition ${
                      playbackSpeed === s
                        ? 'bg-indigo-600 text-white font-semibold'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-400'
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Violation Event Ledger & Inspector (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Summary Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-3">
              Integrity &amp; Audio Summary
            </h2>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-rose-950/40 border border-rose-800/40 rounded-lg p-2.5">
                <span className="text-xl font-bold text-rose-400">
                  {playerData?.summary.criticalViolations}
                </span>
                <p className="text-[10px] font-mono text-rose-300/80 mt-0.5">Critical</p>
              </div>
              <div className="bg-amber-950/40 border border-amber-800/40 rounded-lg p-2.5">
                <span className="text-xl font-bold text-amber-400">
                  {playerData?.summary.highViolations}
                </span>
                <p className="text-[10px] font-mono text-amber-300/80 mt-0.5">High</p>
              </div>
              <div className="bg-yellow-950/40 border border-yellow-800/40 rounded-lg p-2.5">
                <span className="text-xl font-bold text-yellow-400">
                  {playerData?.summary.mediumViolations}
                </span>
                <p className="text-[10px] font-mono text-yellow-300/80 mt-0.5">Medium</p>
              </div>
            </div>
          </div>

          {/* Violation Event Pins List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex-1 flex flex-col">
            <h2 className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-3 flex items-center justify-between">
              <span>Incident Timestamp Log</span>
              <span className="text-indigo-400">{playerData?.markers.length} Tagged</span>
            </h2>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[380px]">
              {playerData?.markers.map((marker) => {
                const isSelected = selectedMarker?.id === marker.id;
                const isCritical = marker.severity === 'Critical';
                const isHigh = marker.severity === 'High';
                const badgeColor = isCritical
                  ? 'bg-rose-950 text-rose-300 border-rose-700/60'
                  : isHigh
                  ? 'bg-amber-950 text-amber-300 border-amber-700/60'
                  : 'bg-yellow-950 text-yellow-300 border-yellow-700/60';

                return (
                  <div
                    key={marker.id}
                    onClick={() => {
                      jumpToSeconds(marker.timestampSeconds);
                      setSelectedMarker(marker);
                    }}
                    className={`p-3 rounded-lg border cursor-pointer transition ${
                      isSelected
                        ? 'bg-slate-800/90 border-indigo-500 shadow-md ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                        <span className="text-indigo-400">⏱</span> {marker.timestampFormatted}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${badgeColor}`}>
                        {marker.severity}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-slate-200">{marker.violationType}</p>
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {marker.notes}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Incident Snapshot Inspector */}
          {selectedMarker && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-xs font-mono uppercase text-slate-400 mb-2">
                Frame Snapshot: {selectedMarker.timestampFormatted}
              </h3>
              {selectedMarker.snapshotUrl ? (
                <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-800 bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedMarker.snapshotUrl}
                    alt="Proctoring Frame Snapshot"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-1 right-2 text-[10px] font-mono text-white/80 bg-black/60 px-1.5 py-0.5 rounded">
                    Tagged by Vision Sensor
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 font-mono">No snapshot frame captured.</p>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

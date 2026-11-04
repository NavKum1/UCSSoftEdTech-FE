'use client';

/**
 * Proctoring recording review: plays the session recording the API returns and lists the flagged moments so a reviewer can
 * jump to each one. Decisions are recorded on the session integrity review page; this page does not approve or disqualify
 * anyone. (It used to simulate playback with a timer, show invented capture details and offer approve/disqualify buttons
 * that only displayed a notice.)
 */

import React, { useState, useEffect, useRef, use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import { Badge, Card, EmptyState, Loading, PageHeader, StatTile, brandFill, buttonClass } from "@/components/career/ui";

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

const SPEEDS = [1.0, 1.5, 2.0];

function severityTone(severity: string): "bad" | "warn" | "neutral" {
  return severity === 'Critical' ? 'bad' : severity === 'High' ? 'warn' : 'neutral';
}

function pinColor(severity: string) {
  return severity === 'Critical' ? 'bg-red-600' : severity === 'High' ? 'bg-amber-500' : 'bg-amber-300';
}

const formatSeconds = (sec: number) => {
  const whole = Math.max(0, Math.floor(sec));
  const mins = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
};

export default function ProctoringVideoReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { apiFetch, ready, access } = useLegacyApi();
  const resolvedParams = use(params);
  const recordingId = resolvedParams.id;

  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(true);
  const [playerData, setPlayerData] = useState<PlayerPayload | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [mediaDuration, setMediaDuration] = useState<number>(0);
  const [selectedMarker, setSelectedMarker] = useState<ViolationMarker | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    async function fetchPlayerData() {
      try {
        setLoading(true);
        setFetchError(null);
        const res = await apiFetch(`/api/video/recording/${recordingId}/player`);
        if (res.ok) {
          const data = await res.json();
          setPlayerData(data);
          if (data.markers && data.markers.length > 0) {
            setSelectedMarker(data.markers[0]);
          }
        } else {
          setFetchError("We couldn't find this recording. It may have been removed.");
          setPlayerData(null);
        }
      } catch (err) {
        console.error('Failed to load video player payload', err);
        setFetchError("We couldn't load this recording. Please check your connection and try again.");
        setPlayerData(null);
      } finally {
        setLoading(false);
      }
    }

    fetchPlayerData();
  }, [recordingId, ready, apiFetch]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed, playerData]);

  const jumpToSeconds = (sec: number) => {
    setCurrentTime(sec);
    if (videoRef.current) videoRef.current.currentTime = sec;
    const markerAtTime = playerData?.markers.find((m) => m.timestampSeconds === sec);
    if (markerAtTime) {
      setSelectedMarker(markerAtTime);
    }
  };

  if (access) return <AccessNotice problem={access} feature="Proctoring video review" />;

  const backLink = (
    <Link href="/partner/dashboard" className={buttonClass('secondary')}>
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Back to dashboard
    </Link>
  );

  if (loading) {
    return <Loading label="Loading recording..." />;
  }

  if (fetchError || !playerData) {
    return (
      <div className="space-y-6">
        <PageHeader title="Recording review" actions={backLink} />
        <EmptyState title="Recording not found">
          {fetchError || "The requested recording could not be found or has expired."}
        </EmptyState>
      </div>
    );
  }

  const duration = playerData.durationSeconds || mediaDuration;
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const nearbyMarker = playerData.markers.find((m) => Math.abs(m.timestampSeconds - currentTime) <= 2);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recording review"
        description="Play back the session recording and jump to each flagged moment. Flags are prompts for a person to review, not proof of misconduct; record your review on the session integrity page."
        actions={
          <>
            {backLink}
            <Link href="/recruiter/proctoring" className={buttonClass('primary')} style={brandFill}>
              Record a review
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recording and timeline */}
        <div className="min-w-0 lg:col-span-8 flex flex-col gap-4">
          <Card>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {playerData.trackType && <Badge>{playerData.trackType}</Badge>}
              {playerData.status && <Badge>{playerData.status}</Badge>}
              {nearbyMarker && (
                <Badge tone={severityTone(nearbyMarker.severity) === 'bad' ? 'bad' : 'warn'}>
                  Flagged moment at {nearbyMarker.timestampFormatted}
                </Badge>
              )}
            </div>

            {playerData.transcodedUrl ? (
              <video
                ref={videoRef}
                src={playerData.transcodedUrl}
                poster={playerData.thumbnailUrl || undefined}
                controls
                preload="metadata"
                className="aspect-video w-full rounded-lg bg-black"
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  e.currentTarget.playbackRate = playbackSpeed;
                  if (Number.isFinite(e.currentTarget.duration)) setMediaDuration(e.currentTarget.duration);
                }}
              >
                Your browser does not support video playback.
              </video>
            ) : (
              <EmptyState title="This recording isn't ready to play yet">
                {playerData.status ? `Status: ${playerData.status}` : null}
              </EmptyState>
            )}

            {/* Timeline with flagged moments */}
            <div className="mt-4 space-y-3">
              <div className="relative flex h-8 w-full items-center">
                <div className="relative h-2 w-full rounded-full bg-muted">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${progressPercent}%` }} />
                  {duration > 0 &&
                    playerData.markers.map((marker) => (
                      <button
                        key={marker.id}
                        type="button"
                        onClick={() => jumpToSeconds(marker.timestampSeconds)}
                        title={`${marker.severity}: ${marker.violationType} (${marker.timestampFormatted})`}
                        aria-label={`Jump to ${marker.violationType} at ${marker.timestampFormatted} (${marker.severity})`}
                        className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card transition-transform hover:scale-125 ${pinColor(marker.severity)}`}
                        style={{ left: `${Math.min(100, (marker.timestampSeconds / duration) * 100)}%` }}
                      />
                    ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  <span className="font-medium text-foreground">{formatSeconds(currentTime)}</span> / {duration > 0 ? formatSeconds(duration) : '—'}
                </span>
                <div className="flex items-center gap-1.5" role="group" aria-label="Playback speed">
                  <span>Speed</span>
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setPlaybackSpeed(s)}
                      aria-pressed={playbackSpeed === s}
                      className={`rounded-md px-2 py-0.5 text-xs tabular-nums transition-colors ${
                        playbackSpeed === s ? 'bg-muted font-medium text-foreground' : 'hover:bg-muted'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Flag summary, list and snapshot */}
        <div className="min-w-0 lg:col-span-4 flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2">
            <StatTile label="Critical" value={playerData.summary.criticalViolations} tone={playerData.summary.criticalViolations > 0 ? 'bad' : undefined} />
            <StatTile label="High" value={playerData.summary.highViolations} />
            <StatTile label="Medium" value={playerData.summary.mediumViolations} />
          </div>

          <Card title="Flagged moments" actions={<span className="text-sm text-muted-foreground">{playerData.markers.length} flagged</span>}>
            {playerData.markers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No moments were flagged in this recording.</p>
            ) : (
              <ul className="max-h-[380px] space-y-2 overflow-y-auto pe-1">
                {playerData.markers.map((marker) => {
                  const isSelected = selectedMarker?.id === marker.id;
                  return (
                    <li key={marker.id}>
                      <button
                        type="button"
                        onClick={() => {
                          jumpToSeconds(marker.timestampSeconds);
                          setSelectedMarker(marker);
                        }}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`w-full rounded-lg border p-3 text-start transition-colors ${
                          isSelected ? 'border-indigo-500 bg-muted/60' : 'border-border hover:bg-muted/40'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium tabular-nums text-foreground">{marker.timestampFormatted}</span>
                          <Badge tone={severityTone(marker.severity)}>{marker.severity}</Badge>
                        </div>
                        <p className="text-sm text-foreground">{marker.violationType}</p>
                        {marker.notes && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{marker.notes}</p>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {selectedMarker && (
            <Card title={`Frame at ${selectedMarker.timestampFormatted}`}>
              {selectedMarker.snapshotUrl ? (
                <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedMarker.snapshotUrl}
                    alt={`Frame captured at ${selectedMarker.timestampFormatted}`}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No frame was captured for this moment.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

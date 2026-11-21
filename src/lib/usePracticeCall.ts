"use client";

/**
 * One practice voice call, started through an Edulexa API route (a try of one question or moment, or a Talk it through
 * conversation; stage 3, 21 Nov 2026). It asks for the microphone, opens the call, and ends it on the server when the person
 * ends it, when it ends by itself (its time limit or a dropped line), or when they leave the page, so its minutes are settled
 * and the unused ones go back. Shared by the coaching page's tries and Workplace practice's Talk it through.
 */

import { useEffect, useRef, useState } from "react";
import { useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { openRealtimeCall, type RealtimeCall } from "@/lib/realtimeCall";

type ApiFetch = (path: string, init?: RequestInit, opts?: { quiet?: boolean }) => Promise<Response>;

export interface PracticeCallEnd {
  status?: string;
  minutesUsed?: number;
  minutesGivenBack?: number;
  message?: string;
}

export interface PracticeCallStarted {
  practiceId: string;
  /** Everything else the start route sent back (the plan, the style chosen, …) */
  body: Record<string, unknown>;
}

export function usePracticeCall(apiFetch: ApiFetch) {
  const en = useEn();
  const [phase, setPhase] = useState<null | "connecting" | "live" | "ending">(null);
  const callRef = useRef<RealtimeCall | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const idRef = useRef<string | null>(null);
  const endingRef = useRef(false);
  // Set when the person leaves (the page or this part of it): a call still connecting then ends itself instead of going on
  const cancelledRef = useRef(false);

  const stopAudio = () => {
    callRef.current?.close();
    callRef.current = null;
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
  };

  /**
   * Starts a call through `route` (which answers with practiceId and sdpAnswer). `onEnded` runs when the call ends by
   * itself. Returns the new session, or { error } with a plain message.
   */
  const start = async (route: string, body: object, onEnded: () => void): Promise<PracticeCallStarted | { error: string }> => {
    cancelledRef.current = false;
    setPhase("connecting");
    let mic: MediaStream;
    try {
      mic = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase(null);
      return { error: en("We couldn't use your microphone. Allow microphone access in your browser, then try again.") };
    }
    if (cancelledRef.current) {
      mic.getTracks().forEach((t) => t.stop());
      return { error: "" };
    }
    micRef.current = mic;
    const audio = document.createElement("audio");
    audio.autoplay = true;
    let started: Record<string, unknown> = {};
    try {
      callRef.current = await openRealtimeCall({
        mic,
        audio,
        exchange: async (sdpOffer) => {
          const res = await apiFetch(route, { method: "POST", body: JSON.stringify({ ...body, sdpOffer }) });
          const b = (await res.json().catch(() => null)) as { practiceId?: string; sdpAnswer?: string; error?: string } | null;
          if (!res.ok || !b?.practiceId || !b.sdpAnswer) throw new Error(b?.error || en("We couldn't start the call. Please try again."));
          idRef.current = b.practiceId;
          started = b as Record<string, unknown>;
          // Left while it was connecting: stop here, and the call is ended on the server below
          if (cancelledRef.current) throw new Error("");
          return b.sdpAnswer;
        },
        onEnded: () => {
          if (!cancelledRef.current) onEnded();
        },
      });
      setPhase("live");
      return { practiceId: idRef.current!, body: started };
    } catch (err) {
      stopAudio();
      // If the server opened the call, end it: a call that never connected uses no minutes
      if (idRef.current) void apiFetch(`/api/interview/practice/${idRef.current}/end`, { method: "POST", body: "{}", keepalive: true }, { quiet: true });
      idRef.current = null;
      setPhase(null);
      if (cancelledRef.current) return { error: "" };
      return { error: err instanceof TypeError ? en("We couldn't reach Edulexa. Check your internet connection and try again.") : (err as Error).message };
    }
  };

  /** Ends the call on the server (which settles its minutes). Returns the session id and what the server said, once. */
  const end = async (): Promise<{ id: string; result: PracticeCallEnd | null } | null> => {
    if (endingRef.current) return null;
    endingRef.current = true;
    stopAudio();
    const id = idRef.current;
    try {
      if (!id) return null;
      setPhase("ending");
      const res = await apiFetch(`/api/interview/practice/${id}/end`, { method: "POST", body: "{}" }, { quiet: true });
      const result = (await res.json().catch(() => null)) as PracticeCallEnd | null;
      return { id, result };
    } finally {
      idRef.current = null;
      endingRef.current = false;
      setPhase(null);
    }
  };

  // Leaving the page during a call ends it on the server, so it's settled now and its unused minutes go back
  const leaveRef = useLatestRef(() => {
    cancelledRef.current = true;
    const id = idRef.current;
    if (!id || endingRef.current) return;
    callRef.current?.close();
    micRef.current?.getTracks().forEach((t) => t.stop());
    void apiFetch(`/api/interview/practice/${id}/end`, { method: "POST", body: "{}", keepalive: true }, { quiet: true });
    idRef.current = null;
  });
  useEffect(() => {
    const leave = () => leaveRef.current();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [leaveRef]);

  return { phase, start, end };
}

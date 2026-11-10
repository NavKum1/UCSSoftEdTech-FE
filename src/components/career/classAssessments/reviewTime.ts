"use client";

/**
 * Build & Defend Stage 3: the teacher's active review time on an attempt, for the school's pilot results. While the evidence
 * page is open, in front and in use (someone moved, typed, scrolled or touched in the last 2 minutes), it tells the API every
 * 30 seconds how long it was active since the last beat. Only before the decision; the API never adds more than a minute a
 * beat, nor more than the time that passed.
 */
import { useEffect } from "react";
import type { useApi } from "@/lib/appAuth";
import { CA_API } from "@/components/career/classAssessments/types";

const BEAT_MS = 30_000;
const IDLE_MS = 120_000;

type Api = ReturnType<typeof useApi>;

export function useReviewTime(api: Api, attemptId: string, counting: boolean) {
  useEffect(() => {
    if (!counting) return;
    let lastActivity = Date.now();
    let since = Date.now();
    let active = 0;
    const inUse = () => document.visibilityState === "visible" && document.hasFocus() && Date.now() - lastActivity < IDLE_MS;
    const touch = () => {
      lastActivity = Date.now();
    };
    // Active time accrues in small steps, so a page left in front with nobody there stops counting after 2 minutes
    const tick = window.setInterval(() => {
      const now = Date.now();
      if (inUse()) active += now - since;
      since = now;
    }, 5_000);
    const send = () => {
      const seconds = Math.round(active / 1000);
      if (seconds <= 0) return;
      active = 0;
      api(`${CA_API}/faculty/attempts/${attemptId}/review-time`, { method: "POST", json: { seconds } }).catch(() => {
        /* a lost beat only undercounts */
      });
    };
    const beat = window.setInterval(send, BEAT_MS);
    const hidden = () => {
      if (document.visibilityState === "hidden") send();
    };
    const events = ["pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;
    events.forEach((ev) => window.addEventListener(ev, touch, { passive: true }));
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(beat);
      events.forEach((ev) => window.removeEventListener(ev, touch));
      document.removeEventListener("visibilitychange", hidden);
      send();
    };
  }, [api, attemptId, counting]);
}

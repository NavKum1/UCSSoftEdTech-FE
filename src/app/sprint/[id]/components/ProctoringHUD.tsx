"use client";

// The coding challenge's session check (proctoring panel, back in the workspace on 18 Nov 2026).
// - The session is named after the submission: a timed attempt's submission takes the attempt's id, so `sessionId` is the
//   attempt id from the start, and the server links the session to the challenge (and so to the company that set it).
// - Nothing is recorded until the candidate reads the notice and chooses to start. They can carry on without it.
// - It notes leaving full screen only. Edits, pastes, AI help and time away from the editor belong to the editor record
//   (the workspace's notice above says so), so the two never count the same thing.
// - The region policy can turn it off (the server answers 451 with the reason); then nothing extra is recorded.

import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Maximize2, ShieldCheck, ShieldOff } from "lucide-react";

import { API_BASE_URL, authenticatedFetch } from "@/lib/apiClient";
import { useAppAuth } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { useLatestRef } from "@/lib/legacyApi";
import { buttonClass, brandFill } from "@/components/career/ui";

interface ProctoringHUDProps {
  /** The submission id: the timed attempt's id, which its submission takes */
  sessionId: string;
  /** True while the candidate is working (before they hand in); recording stops when it turns false */
  active: boolean;
}

type CheckState =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "unavailable"; reason: string }
  | { kind: "notice"; declined: boolean }
  | { kind: "running" };

const declinedKey = (sessionId: string) => `edulexa_session_check_declined_${sessionId}`;

function readDeclined(sessionId: string): boolean {
  try {
    return sessionStorage.getItem(declinedKey(sessionId)) === "1";
  } catch {
    return false;
  }
}

function writeDeclined(sessionId: string, declined: boolean) {
  try {
    if (declined) sessionStorage.setItem(declinedKey(sessionId), "1");
    else sessionStorage.removeItem(declinedKey(sessionId));
  } catch {
    /* storage blocked: the choice lasts for this page only */
  }
}

// Whether the page is in full screen right now, read from the browser
function subscribeFullScreen(callback: () => void) {
  document.addEventListener("fullscreenchange", callback);
  return () => document.removeEventListener("fullscreenchange", callback);
}
const readFullScreen = () => Boolean(document.fullscreenElement);

const fullScreenSupported = () => typeof document !== "undefined" && document.fullscreenEnabled === true && !!document.documentElement.requestFullscreen;

export default function ProctoringHUD({ sessionId, active }: ProctoringHUDProps) {
  const en = useEn();
  const { getToken } = useAppAuth();
  const [state, setState] = useState<CheckState>({ kind: "loading" });
  const inFullScreen = useSyncExternalStore(subscribeFullScreen, readFullScreen, () => false);
  const [leftFullScreen, setLeftFullScreen] = useState(0);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const getTokenRef = useLatestRef(getToken);

  const api = useCallback(
    (path: string, init?: RequestInit) => authenticatedFetch(`${API_BASE_URL}/api/proctoring/${path}`, init ?? {}, getTokenRef.current),
    [getTokenRef]
  );

  // What the server says: offered for this attempt, allowed where the candidate is, already started (a page reload)
  useEffect(() => {
    if (!sessionId || !active) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api(`session/${sessionId}/check`);
        const data = res.ok ? await res.json() : null;
        if (cancelled) return;
        if (!data?.offered) setState({ kind: "hidden" });
        else if (!data.available) setState({ kind: "unavailable", reason: data.reason || en("The session check isn't offered where you are, so nothing extra is recorded.") });
        else if (data.started) {
          setLeftFullScreen(Number(data.leftFullScreen) || 0);
          setState({ kind: "running" });
        } else setState({ kind: "notice", declined: readDeclined(sessionId) });
      } catch {
        if (!cancelled) setState({ kind: "hidden" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, active, api, en]);

  // While it runs: note each time the candidate leaves full screen (and only that)
  const running = state.kind === "running" && active;
  useEffect(() => {
    if (!running) return;
    const onChange = () => {
      if (document.fullscreenElement) return;
      setLeftFullScreen((n) => n + 1);
      api("event", { method: "POST", body: JSON.stringify({ sessionId, eventType: "FullScreenExit", metadata: {} }) }).catch(() => {
        /* the count on screen stays; the server copy is what reviewers see */
      });
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [running, sessionId, api]);

  // Handed in: nothing more to note, so leave full screen quietly (the listener above is already gone)
  useEffect(() => {
    if (active || state.kind !== "running") return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, [active, state.kind]);

  const enterFullScreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      return true;
    } catch {
      return false;
    }
  };

  const start = async () => {
    setProblem(null);
    setBusy(true);
    // Full screen must be asked for straight from the click, before anything is sent
    const full = await enterFullScreen();
    if (!full) {
      setBusy(false);
      setProblem(en("Your browser didn't switch to full screen, so the session check hasn't started. Try again, or carry on without it."));
      return;
    }
    try {
      const res = await api(`session/${sessionId}/start`, { method: "POST" });
      if (res.ok) {
        writeDeclined(sessionId, false);
        setState({ kind: "running" });
        return;
      }
      const data = await res.json().catch(() => null);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      if (res.status === 451) setState({ kind: "unavailable", reason: data?.error || en("The session check isn't offered where you are, so nothing extra is recorded.") });
      else setProblem(data?.error || en("The session check couldn't start. Try again."));
    } catch {
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      setProblem(en("The session check couldn't start. Check your connection and try again."));
    } finally {
      setBusy(false);
    }
  };

  const decline = () => {
    writeDeclined(sessionId, true);
    setProblem(null);
    setState({ kind: "notice", declined: true });
  };

  if (!active || state.kind === "loading" || state.kind === "hidden") return null;

  if (state.kind === "unavailable") {
    return (
      <section aria-label={en("Session check")} className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <ShieldOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{state.reason}</p>
      </section>
    );
  }

  if (state.kind === "running") {
    return (
      <section
        aria-label={en("Session check")}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-2">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
          <div className="space-y-0.5 text-sm">
            <p className="font-medium text-foreground">{en("Session check on")}</p>
            <p className="text-muted-foreground" role="status">
              {inFullScreen ? en("You're in full screen.") : en("You're not in full screen. Each time you leave it, it's noted for the reviewer.")}{" "}
              {leftFullScreen === 0
                ? en("You haven't left full screen.")
                : leftFullScreen === 1
                  ? en("You've left full screen once.")
                  : en("You've left full screen {count} times.", { count: leftFullScreen })}
            </p>
          </div>
        </div>
        {!inFullScreen && fullScreenSupported() && (
          <button type="button" onClick={() => void enterFullScreen()} className={`${buttonClass("primary")} shrink-0`} style={brandFill}>
            <Maximize2 aria-hidden="true" className="h-4 w-4" />
            {en("Return to full screen")}
          </button>
        )}
      </section>
    );
  }

  // Before anything is recorded. A browser without full screen (most phones): only a short line, nothing to choose
  const canFullScreen = fullScreenSupported();
  if (!canFullScreen) {
    return (
      <section aria-label={en("Session check")} className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
        <ShieldOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{en("This challenge has a session check, but full screen isn't available in this browser (for example on most phones), so it can't run here. Nothing extra is noted. Carry on with the challenge.")}</p>
      </section>
    );
  }
  if (state.declined) {
    return (
      <section
        aria-label={en("Session check")}
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldOff aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{en("The session check is off for this challenge. Nothing extra is noted, and the reviewer sees no session check.")}</p>
        </div>
        <button type="button" onClick={() => void start()} disabled={busy} className={`${buttonClass("secondary")} shrink-0`}>
          {en("Turn on the session check")}
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="session-check-title" className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-2">
        <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand,#0e7490)]" />
        <div className="min-w-0 space-y-3">
          <div className="space-y-1">
            <h2 id="session-check-title" className="text-base font-semibold text-foreground">
              {en("This challenge has a session check")}
            </h2>
            <p className="text-sm text-foreground">
              {en("You work in full screen. Each time you leave full screen, it's noted for the reviewer.")}
            </p>
          </div>
          <ul className="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            <li>{en("Only leaving full screen is noted. There's no camera, microphone or screen recording.")}</li>
            <li>{en("Your edits, pastes and switching away from this window are recorded either way, as the line above says.")}</li>
            <li>{en("Who sees it: you, Edulexa staff, and the reviewers of the company or school that gave you this challenge. A person reviews it; no one is disqualified automatically.")}</li>
            <li>
              {en("The session's result is kept for 3 years, for reviews and appeals.")}{" "}
              <Link href="/help/download-or-delete-your-data" className="font-medium text-foreground underline underline-offset-2">
                {en("How Edulexa handles your data")}
              </Link>
            </li>
          </ul>
          {problem && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-400">
              {problem}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void start()} disabled={busy} className={buttonClass("primary")} style={brandFill}>
              <Maximize2 aria-hidden="true" className="h-4 w-4" />
              {busy ? en("Starting...") : en("Start in full screen")}
            </button>
            <button type="button" onClick={decline} disabled={busy} className={buttonClass("secondary")}>
              {en("Continue without it")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {en("You can turn it on later. Without it, the reviewer sees no session check for this challenge.")}
          </p>
        </div>
      </div>
    </section>
  );
}

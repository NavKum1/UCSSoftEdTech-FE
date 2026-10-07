"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { API_BASE_URL, authenticatedFetch } from "@/lib/apiClient";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Info,
  Languages,
  Loader2,
  Mic,
  Wifi,
} from "lucide-react";

interface Assignment {
  assignmentId: string;
  cohortName: string;
  instituteName?: string | null;
  sprintId: string;
  sprintTitle: string;
  requiredLanguage?: string;
  opensAt: string;
  dueAt: string;
  isOpen: boolean;
  isOverdue: boolean;
  link: string;
  status: "not-started" | "in-progress" | "submitted" | "defended";
  submittedAt?: string | null;
  testsPercent?: number | null;
  defenseScore?: number | null;
}

interface MyAssignments {
  email: string | null;
  inCohort: boolean;
  preferredLanguage: string | null;
  assignments: Assignment[];
  message?: string | null;
}

interface LanguageOption {
  key: string;
  label: string;
}

interface ConnectionResult {
  rtts: number[];
  failures: number;
  medianRtt: number | null;
  jitter: number | null;
  kbps: number | null;
  verdict: "good" | "fair" | "poor";
}

const STATUS_LABEL: Record<Assignment["status"], string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  submitted: "Submitted",
  defended: "Defended",
};

const STATUS_CLASS: Record<Assignment["status"], string> = {
  "not-started": "bg-muted text-muted-foreground border-border",
  "in-progress": "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
  submitted: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30",
  defended: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

async function runConnectionCheck(): Promise<ConnectionResult> {
  const rtts: number[] = [];
  let failures = 0;
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    try {
      const res = await fetch(`${API_BASE_URL}/health/live?ts=${Date.now()}-${i}`, { cache: "no-store" });
      await res.text();
      if (res.ok) rtts.push(performance.now() - start);
      else failures++;
    } catch {
      failures++;
    }
  }

  // Download speed from a small static file, fetched a few times without caching
  let bytes = 0;
  let ms = 0;
  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    try {
      const res = await fetch(`/favicon.ico?ts=${Date.now()}-${i}`, { cache: "no-store" });
      const buf = await res.arrayBuffer();
      if (res.ok) {
        bytes += buf.byteLength;
        ms += performance.now() - start;
      }
    } catch {
      // counted as no data
    }
  }

  const sorted = [...rtts].sort((a, b) => a - b);
  const medianRtt = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
  const jitter = sorted.length > 1 ? sorted[sorted.length - 1] - sorted[0] : null;
  const kbps = bytes > 0 && ms > 0 ? (bytes * 8) / ms : null; // bits per ms = kbit/s

  let verdict: ConnectionResult["verdict"] = "poor";
  if (failures <= 1 && medianRtt !== null) {
    if (medianRtt <= 300 && (kbps ?? 0) >= 1000) verdict = "good";
    else if (medianRtt <= 800 && (kbps ?? 0) >= 250) verdict = "fair";
  }
  return { rtts, failures, medianRtt, jitter, kbps, verdict };
}

const ADVICE: Record<ConnectionResult["verdict"], { title: string; text: string; className: string }> = {
  good: {
    title: "Good",
    text: "Your connection looks fine for the coding task and the voice conversation.",
    className: "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
  },
  fair: {
    title: "Usable, with care",
    text: "Keep the conversation audio-only, close other apps and browser tabs (especially video), and stay close to your Wi-Fi router or in good mobile signal.",
    className: "border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200",
  },
  poor: {
    title: "Try a better network",
    text: "The voice conversation may drop on this connection. If you can, move to campus Wi-Fi, a lab computer or a stronger mobile signal, then check again before you start.",
    className: "border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200",
  },
};

export default function CampusStudentPage() {
  const { getToken } = useAuth();

  const [data, setData] = useState<MyAssignments | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [language, setLanguage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);

  useEffect(() => {
    let active = true;
    authenticatedFetch("/api/campus/my-assignments", {}, getToken)
      .then(async (res) => {
        if (res.status === 401) throw new Error("Please sign in to see your assignments.");
        if (!res.ok) throw new Error(`Could not load your assignments (HTTP ${res.status}).`);
        return (await res.json()) as MyAssignments;
      })
      .then((d) => {
        if (!active) return;
        setData(d);
        if (d.preferredLanguage) setLanguage(d.preferredLanguage);
      })
      .catch((e) => active && setLoadError(e instanceof Error ? e.message : "Could not load your assignments."));

    fetch(`${API_BASE_URL}/api/interview/languages`)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { defaultLanguage?: string; languages?: LanguageOption[] } | null) => {
        if (!active || !d?.languages) return;
        setLanguages(d.languages);
        setLanguage((current) => current || d.defaultLanguage || d.languages?.[0]?.key || "");
      })
      .catch(() => {
        // the selector stays empty; the defense uses the server default
      });
    return () => {
      active = false;
    };
  }, [getToken]);

  const savePreference = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await authenticatedFetch(
        "/api/campus/my-preferences",
        { method: "PUT", body: JSON.stringify({ preferredLanguage: language || null }) },
        getToken
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setSaveMessage({ ok: false, text: body?.error || `Could not save (HTTP ${res.status}).` });
        return;
      }
      setSaveMessage({ ok: true, text: `Saved. Your defense will default to ${body?.label || "this language"}.` });
    } catch {
      setSaveMessage({ ok: false, text: "Network error while saving." });
    } finally {
      setSaving(false);
    }
  };

  const checkConnection = async () => {
    setChecking(true);
    setConnection(null);
    try {
      setConnection(await runConnectionCheck());
    } finally {
      setChecking(false);
    }
  };

  const assignments = data?.assignments ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8 space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
          <GraduationCap className="w-4 h-4" /> Campus placements
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground mt-1">My placement assessments</h1>
        {data?.email && <p className="text-xs text-muted-foreground mt-1">Signed in as {data.email}</p>}
      </div>

      {/* Assignments */}
      <section className="glass-panel rounded-2xl border border-border p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Assignments
        </h2>
        {loadError ? (
          <p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {loadError}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {data.message || "No assessments have been assigned to you yet."} If you expected one, ask your placement cell to check the email address they added for you.
          </p>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a) => (
              <li key={a.assignmentId} className="rounded-xl border border-border bg-card/60 p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground break-words">{a.sprintTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.cohortName}
                      {a.instituteName ? ` · ${a.instituteName}` : ""}
                      {a.requiredLanguage ? ` · ${a.requiredLanguage}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_CLASS[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Opens {formatDate(a.opensAt)} · <span className={a.isOverdue ? "text-rose-700 dark:text-rose-400 font-semibold" : ""}>Due {formatDate(a.dueAt)}</span>
                  {a.isOverdue && " (past due)"}
                </p>
                {(a.testsPercent != null || a.defenseScore != null) && (
                  <p className="text-xs text-foreground mt-1">
                    {a.testsPercent != null && <>Tests passed: {Math.round(a.testsPercent)}%</>}
                    {a.testsPercent != null && a.defenseScore != null && " · "}
                    {a.defenseScore != null && <>Defense score: {Math.round(a.defenseScore)}</>}
                  </p>
                )}
                {a.status !== "defended" && (
                  <Link
                    href={a.link}
                    className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
                  >
                    {a.status === "not-started" ? "Start" : a.status === "submitted" ? "Open assignment" : "Continue"}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Language */}
      <section className="glass-panel rounded-2xl border border-border p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Languages className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Defense language
        </h2>
        <p className="text-xs text-muted-foreground">
          Choose the language you are most comfortable explaining your code in. Technical terms can stay in English. You can still change it on the defense screen.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground"
            aria-label="Preferred defense language"
          >
            {languages.length === 0 && <option value="">Loading languages...</option>}
            {languages.map((l) => (
              <option key={l.key} value={l.key}>{l.label}</option>
            ))}
          </select>
          <button
            onClick={savePreference}
            disabled={saving || !language || !data?.inCohort}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save
          </button>
        </div>
        {data && !data.inCohort && (
          <p className="text-[11px] text-muted-foreground">You can save a preference once your placement cell adds you to a cohort.</p>
        )}
        {saveMessage && (
          <p className={`text-xs flex items-center gap-1.5 ${saveMessage.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {saveMessage.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {saveMessage.text}
          </p>
        )}
      </section>

      {/* Connection check */}
      <section className="glass-panel rounded-2xl border border-border p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Wifi className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Check my connection
        </h2>
        <p className="text-xs text-muted-foreground">
          A quick, rough check from this browser: 5 small requests to our server and a small download. It uses very little data.
        </p>
        <button
          onClick={checkConnection}
          disabled={checking}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted text-sm font-semibold text-foreground flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
        >
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
          {checking ? "Checking..." : "Check my connection"}
        </button>
        {connection && (
          <div className={`rounded-xl border p-3 text-sm space-y-1 ${ADVICE[connection.verdict].className}`}>
            <p className="font-semibold">{ADVICE[connection.verdict].title}</p>
            <p className="text-xs">{ADVICE[connection.verdict].text}</p>
            <p className="text-[11px] opacity-80">
              Response time: {connection.medianRtt != null ? `${Math.round(connection.medianRtt)} ms (median)` : "no response"}
              {connection.jitter != null && ` · variation ${Math.round(connection.jitter)} ms`}
              {` · download: ${connection.kbps != null ? (connection.kbps >= 1000 ? `${(connection.kbps / 1000).toFixed(1)} Mbit/s` : `${Math.round(connection.kbps)} kbit/s`) : "not measured"}`}
              {connection.failures > 0 && ` · ${connection.failures} of 5 requests failed`}
            </p>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="glass-panel rounded-2xl border border-border p-4 sm:p-5 space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> How the assessment works
        </h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-foreground">
          <li><strong>Build.</strong> Open the assignment and write or fix code in the browser. A laptop or desktop is easiest. Your edits are sent to the server as you go, so you can usually pick up where you left off after a dropped connection.</li>
          <li><strong>Test.</strong> When you submit, hidden tests run on your code. Your score is the share of tests that pass.</li>
          <li>
            <strong>Defend.</strong> <Mic className="inline w-3.5 h-3.5" /> You then have a short voice conversation with an AI interviewer about the code you wrote: why you made your choices and what you would change. It is audio only. You need a microphone and a quiet place.
          </li>
          <li><strong>Results.</strong> You see your tests and defense scores here. Your placement cell sees your scores and a readiness band (Ready, Nearly ready, Needs practice) to plan practice and support.</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          Only work you start after your placement cell assigns a sprint is shared with them. Integrity checks (for example, large pastes) flag work for a person to review; they never fail you automatically.
          Speak in the language you chose; mixing in English technical words is normal and fine.
        </p>
      </section>
    </div>
  );
}

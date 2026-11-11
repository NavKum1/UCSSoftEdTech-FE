"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL, authenticatedFetch } from "@/lib/apiClient";
import { useAppAuth } from "@/lib/appAuth";
import SignInRequired from "@/components/SignInRequired";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Info,
  Languages,
  Loader2,
  Mic,
  Wifi,
} from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, PageHeader, brandFill, buttonClass } from "@/components/career/ui";

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
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
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
  const en = useEn();
  const { getToken, isLoaded, isSignedIn } = useAppAuth();
  // Signed out: the connection check and the guide below stay usable; assignments and the language preference need an account
  const signedOut = isLoaded && !isSignedIn;

  const [data, setData] = useState<MyAssignments | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [language, setLanguage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [connection, setConnection] = useState<ConnectionResult | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let active = true;
    authenticatedFetch("/api/campus/my-assignments", {}, getToken)
      .then(async (res) => {
        if (res.status === 401) throw new Error("Please sign in to see your assignments.");
        if (!res.ok) throw new Error("We couldn't load your assignments. Please try again.");
        return (await res.json()) as MyAssignments;
      })
      .then((d) => {
        if (!active) return;
        setData(d);
        if (d.preferredLanguage) setLanguage(d.preferredLanguage);
      })
      .catch((e) => active && setLoadError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not load your assignments."));

    authenticatedFetch("/api/interview/languages", {}, getToken)
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
  }, [getToken, isLoaded, isSignedIn]);

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
        setSaveMessage({ ok: false, text: body?.error || "We couldn't save your changes. Please try again." });
        return;
      }
      setSaveMessage({ ok: true, text: `Saved. Your defense will default to ${body?.label || "this language"}.` });
    } catch {
      setSaveMessage({ ok: false, text: en("Saving failed: check your internet connection.") });
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
    <div className="space-y-6">
      <PageHeader
        title={en("My placement assessments")}
        description={data?.email ? en("Assessments your placement office assigned to you. Signed in as {email}.", { email: data.email }) : en("Assessments your placement office assigned to you.")}
      />

      {/* Assignments */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />{en(" Assignments")}
        </h2>
        {signedOut ? (
          <SignInRequired
            variant="inline"
            title={en("Sign in to see your assignments")}
            message="Your placement office assigns assessments to your account. Sign in with the email address they added for you."
          />
        ) : loadError ? (
          <p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {loadError}</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{en(" Loading...")}</p>
        ) : assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {en("{value} If you expected one, ask your placement office to check the email address they added for you.", { value: data.message || en("No assessments have been assigned to you yet.") })}
          </p>
        ) : (
          <ul className="space-y-3">
            {assignments.map((a) => (
              <li key={a.assignmentId} className="rounded-lg border border-border p-3 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground break-words">{a.sprintTitle}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.cohortName}
                      {a.instituteName ? ` · ${a.instituteName}` : ""}
                      {a.requiredLanguage ? ` · ${a.requiredLanguage}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_CLASS[a.status]}`}>{en(STATUS_LABEL[a.status])}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {en("Opens {date} ·", { date: formatDate(a.opensAt) })}{" "}<span className={a.isOverdue ? "text-rose-700 dark:text-rose-400 font-semibold" : ""}>{en("Due {date}", { date: formatDate(a.dueAt) })}</span>
                  {a.isOverdue && en(" (past due)")}
                </p>
                {(a.testsPercent != null || a.defenseScore != null) && (
                  <p className="text-xs text-foreground mt-1">
                    {a.testsPercent != null && <>{en("Tests passed: {testsPercent}%", { testsPercent: Math.round(a.testsPercent) })}</>}
                    {a.testsPercent != null && a.defenseScore != null && " · "}
                    {a.defenseScore != null && <>{en("Defense score: {defenseScore}", { defenseScore: Math.round(a.defenseScore) })}</>}
                  </p>
                )}
                {a.status !== "defended" && (
                  <Link
                    href={a.link}
                    className={`${buttonClass("primary")} mt-3`}
                    style={brandFill}
                  >
                    {a.status === "not-started" ? en("Start") : a.status === "submitted" ? en("Open assignment") : en("Continue")}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Language */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Languages className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />{en(" Defense language")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {en("Choose the language you are most comfortable explaining your code in. Technical terms can stay in English. You can still change it on the defense screen.")}
        </p>
        {signedOut ? (
          <p className="text-xs text-muted-foreground">{en("Sign in above to save your preferred language.")}</p>
        ) : (
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="flex-1 h-9 px-3 rounded-lg bg-card border border-border text-sm text-foreground shadow-sm"
            aria-label={en("Preferred defense language")}
          >
            {languages.length === 0 && <option value="">{en("Loading languages...")}</option>}
            {languages.map((l) => (
              <option key={l.key} value={l.key}>{l.label}</option>
            ))}
          </select>
          <Button type="button" onClick={savePreference} disabled={!language || !data?.inCohort} busy={saving}>
            {en("Save")}
          </Button>
        </div>
        )}
        {data && !data.inCohort && (
          <p className="text-xs text-muted-foreground">{en("You can save a preference once your placement office adds you to a cohort.")}</p>
        )}
        {saveMessage && (
          <p className={`text-xs flex items-center gap-1.5 ${saveMessage.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
            {saveMessage.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {saveMessage.text}
          </p>
        )}
      </section>

      {/* Connection check */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Wifi className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />{en(" Check my connection")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {en("We test your connection from this browser with 5 quick checks and a small download. It uses very little data.")}
        </p>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={checkConnection} busy={checking}>
          {!checking && <Wifi className="w-4 h-4" />}
          {checking ? en("Checking…") : en("Check my connection")}
        </Button>
        {connection && (
          <div className={`rounded-lg border p-3 text-sm space-y-1 ${ADVICE[connection.verdict].className}`}>
            <p className="font-semibold">{en(ADVICE[connection.verdict].title)}</p>
            <p className="text-xs">{en(ADVICE[connection.verdict].text)}</p>
            <p className="text-xs opacity-80">
              {connection.medianRtt != null ? en("Typical delay: {ms} ms", { ms: Math.round(connection.medianRtt) }) : en("Typical delay: no answer")}
              {connection.jitter != null && en(" · delay varies by {ms} ms", { ms: Math.round(connection.jitter) })}
              {connection.kbps != null
                ? en(" · download speed: {speed}", { speed: connection.kbps >= 1000 ? `${(connection.kbps / 1000).toFixed(1)} Mbps` : `${Math.round(connection.kbps)} kbps` })
                : en(" · download speed: not measured")}
              {connection.failures > 0 && en(" · {failures} of 5 checks failed", { failures: connection.failures })}
            </p>
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 space-y-3">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />{en(" How the assessment works")}
        </h2>
        <ol className="list-decimal ps-5 space-y-2 text-sm text-foreground">
          <li><strong>{en("Build.")}</strong>{en(" Open the assignment and write or fix code in the browser. A laptop or desktop is easiest. Your changes are saved as you go, so you can usually pick up where you left off after a dropped connection.")}</li>
          <li><strong>{en("Test.")}</strong>{en(" When you submit, hidden tests run on your code. Your score is the share of tests that pass.")}</li>
          <li>
            <strong>{en("Defend.")}</strong> <Mic className="inline w-3.5 h-3.5" />{en(" You then have a short voice conversation with an AI interviewer about the code you wrote: why you made your choices and what you would change. It is audio only. You need a microphone and a quiet place.")}
          </li>
          <li><strong>{en("Results.")}</strong>{en(" You see your tests and defense scores here. Your placement office sees your scores and a readiness band (Ready, Nearly ready, Needs practice) to plan practice and support.")}</li>
        </ol>
        <p className="text-xs text-muted-foreground">
          {en("Only work you start after your placement office assigns a sprint is shared with them. Integrity checks (for example, large pastes) flag work for a person to review; they never fail you automatically. Speak in the language you chose; mixing in English technical words is normal and fine.")}
        </p>
      </section>
    </div>
  );
}

"use client";

/**
 * Campus (member menu, Your record). 12 Nov 2026, owner: keep "Campus" in the member menu and make it make sense for a
 * member with no school. The page holds:
 * - coding tasks a school or training program gave this person (the older campus groups, api/campus/my-assignments:
 *   matched by sign-in email). With none, it says how tasks arrive and offers practice instead, never an error;
 * - jobs through a school: campus jobs belong to a school's career center (feature campus-drives), so this page lists none.
 *   It sends a school's students and graduates to My school, and everyone else to Job check for jobs found elsewhere;
 * - the defense language (saved on the person's groups, so only shown once they're in one);
 * - a connection check for voice interviews and defenses (the only one in the app).
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL, authenticatedFetch } from "@/lib/apiClient";
import { useAppAuth } from "@/lib/appAuth";
import { schoolHome, type CareerMe } from "@/lib/roleHome";
import SignInRequired from "@/components/SignInRequired";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Code2,
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

const SECTION = "rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5 space-y-3";
const SECTION_TITLE = "text-base font-semibold text-foreground flex items-center gap-2";
const SECTION_ICON = "w-4 h-4 text-indigo-600 dark:text-indigo-400";

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
    text: "Your connection looks fine for coding tasks and voice conversations.",
    className: "border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200",
  },
  fair: {
    title: "Usable, with care",
    text: "Keep the conversation audio-only, close other apps and browser tabs (especially video), and stay close to your Wi-Fi router or in good mobile signal.",
    className: "border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200",
  },
  poor: {
    title: "Try a better network",
    text: "A voice conversation may drop on this connection. If you can, move closer to your Wi-Fi router, use a wired connection or find a stronger mobile signal, then check again before you start.",
    className: "border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200",
  },
};

export default function CampusPage() {
  const en = useEn();
  const { getToken, isLoaded, isSignedIn } = useAppAuth();
  // Signed out: the connection check and the jobs note stay usable; tasks and the language need an account
  const signedOut = isLoaded && !isSignedIn;

  const [data, setData] = useState<MyAssignments | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The person's school area (My school), if they study at or graduated from a school on Edulexa
  const [schoolArea, setSchoolArea] = useState<string | null>(null);
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
        if (res.status === 401) throw new Error("Your sign-in has ended. Sign in again to see your tasks.");
        if (!res.ok) throw new Error("We couldn't load your tasks. Please try again.");
        return (await res.json()) as MyAssignments;
      })
      .then((d) => {
        if (!active) return;
        setData(d);
        if (d.preferredLanguage) setLanguage(d.preferredLanguage);
      })
      .catch((e) => active && setLoadError(e instanceof Error && !(e instanceof TypeError) ? e.message : "We couldn't load your tasks. Check your internet connection and try again."));

    authenticatedFetch("/api/career/me", {}, getToken)
      .then((res) => (res.ok ? (res.json() as Promise<CareerMe>) : null))
      .then((me) => active && setSchoolArea(schoolHome(me)))
      .catch(() => {
        // no school link; the jobs note explains how to get one
      });

    authenticatedFetch("/api/interview/languages", {}, getToken)
      .then((res) => (res.ok ? res.json() : null))
      .then((d: { defaultLanguage?: string; languages?: LanguageOption[] } | null) => {
        if (!active || !d?.languages) return;
        setLanguages(d.languages);
        setLanguage((current) => current || d.defaultLanguage || d.languages?.[0]?.key || "");
      })
      .catch(() => {
        // the selector stays empty; the defense uses the usual language
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
        setSaveMessage({ ok: false, text: body?.error || en("We couldn't save your changes. Please try again.") });
        return;
      }
      setSaveMessage({ ok: true, text: en("Saved. Your defense will start in {language}.", { language: body?.label || en("this language") }) });
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
  const inGroup = !!data?.inCohort;

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Campus")}
        description={en("Coding tasks a school gives you, how campus jobs work, and a check of your connection before a voice interview.")}
      />

      {/* Tasks from a school */}
      <section aria-labelledby="campus-tasks" className={SECTION}>
        <h2 id="campus-tasks" className={SECTION_TITLE}>
          <CalendarClock aria-hidden="true" className={SECTION_ICON} />
          {en("Tasks from your school")}
        </h2>
        {signedOut ? (
          <SignInRequired
            variant="inline"
            title={en("Sign in to see your tasks")}
            message={en("A school gives tasks to your account. Sign in with the email address your school has for you.")}
          />
        ) : loadError ? (
          <p className="text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle aria-hidden="true" className="w-4 h-4 shrink-0" /> {en(loadError)}</p>
        ) : !data ? (
          <p role="status" className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" />{en("Loading...")}</p>
        ) : assignments.length > 0 ? (
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
                  <Link href={a.link} className={`${buttonClass("primary")} mt-3`} style={brandFill}>
                    {a.status === "not-started" ? en("Start") : a.status === "submitted" ? en("Open task") : en("Continue")}
                    <ArrowRight aria-hidden="true" className="w-4 h-4" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : inGroup ? (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-foreground">{en("No tasks yet")}</p>
            <p className="text-muted-foreground">
              {en("Your school hasn't given you a coding task here yet. When it does, the task shows up here with its due date.")}
              {schoolArea ? ` ${en("Assessments your teachers give you are in My school.")}` : ""}
            </p>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-foreground">{en("No tasks from a school yet")}</p>
            <p className="text-muted-foreground">
              {data.email
                ? en("Some schools and training programs give their students coding tasks on Edulexa. When one adds {email} to a class or group, its tasks show up here with their due dates.", { email: data.email })
                : en("Some schools and training programs give their students coding tasks on Edulexa. When one adds your email address to a class or group, its tasks show up here with their due dates.")}
            </p>
            <p className="text-muted-foreground">{en("You don't need a school to practice. Try a coding challenge, or an interview with an AI interviewer.")}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/sprint/distributed-database" className={buttonClass("primary")} style={brandFill}>
                <Code2 aria-hidden="true" className="w-4 h-4" />
                {en("Try a coding challenge")}
              </Link>
              <Link href="/interview/practice" className={buttonClass("secondary")}>
                <Mic aria-hidden="true" className="w-4 h-4" />
                {en("Practice an interview")}
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* Jobs through a school: campus jobs belong to the school's career center (campus-drives); none are listed here */}
      <section aria-labelledby="campus-jobs" className={SECTION}>
        <h2 id="campus-jobs" className={SECTION_TITLE}>
          <Briefcase aria-hidden="true" className={SECTION_ICON} />
          {en("Jobs through a school")}
        </h2>
        {schoolArea ? (
          <>
            <p className="text-sm text-muted-foreground">
              {en("Jobs, internships and interviews that employers offer through your school are in My school.")}
            </p>
            <Link href={schoolArea} className={buttonClass("secondary")}>
              {en("Open My school")}
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {en("Employers offer campus jobs, internships and interviews through a school's career center, so only that school's students and graduates can apply. If your school uses Edulexa, sign in with the email address your school has for you. My school then shows under Switch to in your account menu.")}
            </p>
            <p className="text-sm text-muted-foreground">{en("Applying for a job you found somewhere else? Job check shows where your résumé meets its requirements.")}</p>
            <Link href="/resumes/job-check" className={buttonClass("secondary")}>
              {en("Check your résumé against a job")}
              <ArrowRight aria-hidden="true" className="w-4 h-4" />
            </Link>
          </>
        )}
      </section>

      {/* Defense language: saved on the person's classes and groups, so only for someone in one */}
      {inGroup && (
        <section aria-labelledby="campus-language" className={SECTION}>
          <h2 id="campus-language" className={SECTION_TITLE}>
            <Languages aria-hidden="true" className={SECTION_ICON} />
            {en("Defense language")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {en("Choose the language you are most comfortable explaining your code in. Technical terms can stay in English. You can still change it on the defense screen.")}
          </p>
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
            <Button type="button" onClick={savePreference} disabled={!language} busy={saving}>
              {en("Save")}
            </Button>
          </div>
          {saveMessage && (
            <p role="status" className={`text-xs flex items-center gap-1.5 ${saveMessage.ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {saveMessage.ok ? <CheckCircle2 aria-hidden="true" className="w-3.5 h-3.5" /> : <AlertCircle aria-hidden="true" className="w-3.5 h-3.5" />} {saveMessage.text}
            </p>
          )}
        </section>
      )}

      {/* Connection check */}
      <section aria-labelledby="campus-connection" className={SECTION}>
        <h2 id="campus-connection" className={SECTION_TITLE}>
          <Wifi aria-hidden="true" className={SECTION_ICON} />
          {en("Check your connection")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {en("Before a voice interview or a defense, check that your internet connection can carry a voice conversation. We run 5 quick checks and a small download on this device. It uses very little data.")}
        </p>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={checkConnection} busy={checking}>
          {!checking && <Wifi aria-hidden="true" className="w-4 h-4" />}
          {checking ? en("Checking…") : en("Check my connection")}
        </Button>
        {connection && (
          <div role="status" className={`rounded-lg border p-3 text-sm space-y-1 ${ADVICE[connection.verdict].className}`}>
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

      {/* How a school's task works: only for someone a school has added */}
      {inGroup && (
        <section aria-labelledby="campus-how" className={SECTION}>
          <h2 id="campus-how" className={SECTION_TITLE}>
            <Info aria-hidden="true" className={SECTION_ICON} />
            {en("How a task from your school works")}
          </h2>
          <ol className="list-decimal ps-5 space-y-2 text-sm text-foreground">
            <li><strong>{en("Build.")}</strong>{en(" Open the task and write or fix code in the browser. A laptop or desktop is easiest. Your changes are saved as you go, so you can usually pick up where you left off after a dropped connection.")}</li>
            <li><strong>{en("Test.")}</strong>{en(" When you submit, hidden tests run on your code. Your score is the share of tests that pass.")}</li>
            <li>
              <strong>{en("Defend.")}</strong> <Mic aria-hidden="true" className="inline w-3.5 h-3.5" />{en(" You then have a short voice conversation with an AI interviewer about the code you wrote: why you made your choices and what you would change. It is audio only. You need a microphone and a quiet place.")}
            </li>
            <li><strong>{en("Results.")}</strong>{en(" You see your test and defense scores here. Your school sees your scores and a readiness level (Ready, Nearly ready or Needs practice) to plan practice and support.")}</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            {en("Your school sees only work you start after it gives you the task. If something looks unusual, such as a large paste, a person at your school looks at it; it never fails you on its own. Speak in the language you chose; mixing in English technical words is normal and fine.")}
          </p>
        </section>
      )}
    </div>
  );
}

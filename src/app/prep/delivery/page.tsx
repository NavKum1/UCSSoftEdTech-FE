"use client";

/**
 * Speaking practice: voice delivery coaching (phase E, 24 Oct 2026, owner decision 2). The member answers a practice
 * question aloud and gets feedback on what can be measured: pace (words a minute), filler words, pauses and the time
 * taken to start. Pauses are measured here in the browser from the microphone level; the audio never leaves the browser.
 * Words are counted from the browser's own speech recognition (where it has one); the text goes to the API only to count
 * words and filler words and isn't stored. Nothing about emotion, stress or confidence is inferred, and the results are
 * never shown to recruiters or institutes. Opt-in, off where the region policy forbids it; turning it off deletes the
 * member's answers. (This replaces a "sentiment" coach that scored stress, confidence and "executive presence".)
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Lock, Mic, ShieldOff, Square, Trash2 } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Decision {
  enabled: boolean;
  requiresConsent: boolean;
  hasConsent: boolean;
  usable: boolean;
  reason?: string | null;
}
interface Tip {
  area: string;
  text: string;
}
interface Sample {
  id: string;
  prompt: string;
  recordedAt: string;
  speakingSeconds: number;
  wordCount: number | null;
  wordsPerMinute: number | null;
  fillerCount: number | null;
  fillerWords: Record<string, number>;
  pauseCount: number;
  longestPauseMs: number;
  responseDelayMs: number;
  tips: Tip[];
}
interface Summary {
  samples: number;
  recentSamples: number;
  averageWordsPerMinute: number | null;
  fillersPerMinute: number | null;
  averageLongestPauseSeconds: number;
  averageResponseDelaySeconds: number;
  commonFillers: string[];
  tips: Tip[];
  note: string;
}

// The browser's speech recognition (Chrome, Edge, Safari); not in TypeScript's DOM types
interface RecognitionResultList {
  length: number;
  [i: number]: { isFinal: boolean; 0: { transcript: string } };
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;
function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const PAUSE_MS = 1500; // a silence this long after the first speech counts as a pause
const MAX_SECONDS = 180;
const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";
const AREA: Record<string, string> = { pace: "Pace", fillers: "Filler words", pauses: "Pauses", start: "Getting started" };

/** What the microphone measured, kept in a ref while recording. */
interface Meter {
  startedAt: number;
  firstSpeech: number | null;
  lastSpeech: number | null;
  silenceSince: number | null;
  pauses: number;
  longestPause: number;
  noise: number;
}

function secs(ms: number) {
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function DeliveryCoachingPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompts, setPrompts] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [ownPrompt, setOwnPrompt] = useState("");
  const [countWords, setCountWords] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [result, setResult] = useState<Sample | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [history, setHistory] = useState<Sample[]>([]);
  const [recognitionAvailable] = useState(() => recognitionCtor() !== null);

  const meter = useRef<Meter | null>(null);
  const stopAudio = useRef<(() => void) | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const transcript = useRef<string[]>([]);
  const stopping = useRef(false);

  const loadData = useCallback(async () => {
    const [s, h] = await Promise.all([apiFetch("/api/delivery-coaching/summary", {}, { quiet: true }), apiFetch("/api/delivery-coaching/samples", {}, { quiet: true })]);
    if (s.ok) setSummary((await s.json()) as Summary);
    if (h.ok) setHistory(((await h.json()) as { samples: Sample[] }).samples);
  }, [apiFetch]);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([apiFetch("/api/delivery-coaching/availability"), apiFetch("/api/delivery-coaching/prompts")]);
      if (!a.ok) return setFailed(true);
      const body = (await a.json()) as { decision: Decision; note: string };
      setDecision(body.decision);
      setNote(body.note);
      if (p.ok) {
        const list = ((await p.json()) as { prompts: string[] }).prompts;
        setPrompts(list);
        setPrompt((cur) => cur || list[0] || "");
      }
      if (body.decision.usable) await loadData();
    } catch {
      setFailed(true);
    }
  }, [apiFetch, loadData]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  // Release the microphone if the member leaves mid-answer
  useEffect(() => () => stopAudio.current?.(), []);

  const setConsent = async (granted: boolean) => {
    if (!granted && !window.confirm("Turn off speaking practice? Your saved answers and their measurements are deleted.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/delivery-coaching/consent", { method: "POST", body: JSON.stringify({ granted }) });
      const body = (await res.json().catch(() => null)) as { decision?: Decision } | null;
      if (body?.decision) setDecision(body.decision);
      if (!res.ok && res.status !== 451) throw new Error();
      if (granted && body?.decision?.usable) await loadData();
      if (!granted) {
        setSummary(null);
        setHistory([]);
        setResult(null);
      }
    } catch {
      setError(granted ? "We couldn't turn it on. Please try again." : "We couldn't turn it off. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm("Delete all your saved answers and their measurements?")) return;
    setBusy(true);
    try {
      const res = await apiFetch("/api/delivery-coaching/samples", { method: "DELETE" });
      if (!res.ok) throw new Error();
      setSummary(null);
      setHistory([]);
      setResult(null);
      await loadData();
    } catch {
      setError("We couldn't delete your answers. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (m: Meter, endedAt: number) => {
    stopAudio.current?.();
    stopAudio.current = null;
    setRecording(false);
    setLevel(0);
    if (m.firstSpeech == null || m.lastSpeech == null) {
      setError("We didn't hear an answer. Check that the right microphone is selected and try again.");
      return;
    }
    // A silence still running at the end is the end of the answer, not a pause
    const speakingSeconds = Math.max(0.5, (Math.min(endedAt, m.lastSpeech + 300) - m.firstSpeech) / 1000);
    setBusy(true);
    try {
      const res = await apiFetch("/api/delivery-coaching/samples", {
        method: "POST",
        body: JSON.stringify({
          prompt: ownPrompt.trim() || prompt,
          transcript: transcript.current.join(" ").trim() || null,
          speakingSeconds: Math.min(600, Number(speakingSeconds.toFixed(1))),
          pauseCount: m.pauses,
          longestPauseMs: Math.round(Math.min(m.longestPause, speakingSeconds * 1000)),
          responseDelayMs: Math.round(m.firstSpeech - m.startedAt),
        }),
      });
      if (res.status === 451) {
        const body = (await res.json().catch(() => null)) as { decision?: Decision } | null;
        if (body?.decision) setDecision(body.decision);
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error);
      }
      setResult((await res.json()) as Sample);
      await loadData();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "We couldn't save your answer. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    const m = meter.current;
    if (!m || stopping.current) return;
    stopping.current = true;
    const endedAt = performance.now();
    const rec = recognition.current;
    recognition.current = null;
    if (!rec) return void submit(m, endedAt);
    // Wait for the recogniser's last words (briefly)
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      void submit(m, endedAt);
    };
    rec.onend = finish;
    window.setTimeout(finish, 1500);
    try {
      rec.stop();
    } catch {
      finish();
    }
  };
  const stopRef = useLatestRef(stop);

  const start = async () => {
    setError(null);
    setResult(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setError("We couldn't use your microphone. Allow microphone access for this site and try again.");
      return;
    }
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const m: Meter = { startedAt: performance.now(), firstSpeech: null, lastSpeech: null, silenceSince: null, pauses: 0, longestPause: 0, noise: 0.01 };
    meter.current = m;
    transcript.current = [];
    stopping.current = false;

    const tick = window.setInterval(() => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      // The first half-second sets the room's noise level; speech is well above it
      if (now - m.startedAt < 500) m.noise = Math.max(m.noise, rms);
      const speaking = now - m.startedAt >= 500 && rms > Math.max(0.02, m.noise * 2.5);
      setLevel(Math.min(1, rms * 8));
      setElapsed(Math.floor((now - m.startedAt) / 1000));
      if (speaking) {
        if (m.firstSpeech == null) m.firstSpeech = now;
        if (m.silenceSince != null && m.firstSpeech != null) {
          const gap = now - m.silenceSince;
          if (gap >= PAUSE_MS) {
            m.pauses += 1;
            m.longestPause = Math.max(m.longestPause, gap);
          }
        }
        m.silenceSince = null;
        m.lastSpeech = now;
      } else if (m.firstSpeech != null && m.silenceSince == null) m.silenceSince = now;
      if (now - m.startedAt >= MAX_SECONDS * 1000) stopRef.current();
    }, 50);

    stopAudio.current = () => {
      window.clearInterval(tick);
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    };

    const Ctor = countWords ? recognitionCtor() : null;
    if (Ctor) {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = navigator.language || "en-US";
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) transcript.current.push(e.results[i][0].transcript);
      };
      // Some browsers end recognition after a silence; carry on while the member is still answering
      rec.onend = () => {
        if (recognition.current === rec) {
          try {
            rec.start();
          } catch {
            /* already started */
          }
        }
      };
      rec.onerror = () => undefined;
      recognition.current = rec;
      try {
        rec.start();
      } catch {
        recognition.current = null;
      }
    }
    setElapsed(0);
    setRecording(true);
  };

  if (access) return <AccessNotice problem={access} feature="Speaking practice" />;
  if (failed)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto h-8 w-8 text-amber-600" />
        <h1 className="mt-3 text-xl font-semibold">We couldn&apos;t load speaking practice</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh the page to try again.</p>
      </main>
    );
  if (!decision)
    return (
      <main className="mx-auto max-w-4xl px-4 py-10" aria-busy="true" aria-label="Loading speaking practice">
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const header = (
    <header>
      <h1 className="text-2xl font-semibold tracking-tight">Speaking practice</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Answer a practice question aloud and see your pace, filler words and pauses. {note}
      </p>
    </header>
  );

  if (!decision.enabled)
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
        {header}
        <section className={`${card} p-6 text-center`}>
          <ShieldOff aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-2 text-base font-semibold">Speaking practice isn&apos;t available</h2>
          <p className="mt-1 text-sm text-muted-foreground">{decision.reason || "It isn't offered in your region."}</p>
        </section>
      </main>
    );

  if (!decision.usable)
    return (
      <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
        {header}
        <section className={`${card} space-y-4 p-6`}>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Lock aria-hidden="true" className="h-4 w-4 text-indigo-600" /> Turn on speaking practice?
          </h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>We measure your pace (words a minute), filler words such as &ldquo;um&rdquo;, pauses, and how long you take to start.</li>
            <li>We don&apos;t judge emotion, stress or confidence.</li>
            <li>Your audio stays in your browser. Pauses are measured there from the microphone level.</li>
            <li>
              To count words, your browser&apos;s speech recognition turns your answer into text. In some browsers, such as Chrome, the browser
              maker&apos;s speech service does this. We use the text only to count words and filler words, and we don&apos;t keep it.
            </li>
            <li>Your results are only for you. Recruiters and institutes never see them, and they&apos;re never used in any score.</li>
            <li>We keep your measurements for 180 days. Turn this off at any time and they&apos;re deleted.</li>
          </ul>
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void setConsent(true)}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}Turn on speaking practice
            </button>
            <Link href="/dashboard" className="rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
              Not now
            </Link>
          </div>
        </section>
      </main>
    );

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      {header}

      <section className={`${card} space-y-4 p-5`} aria-labelledby="dc-practice">
        <h2 id="dc-practice" className="text-base font-semibold">
          Practise an answer
        </h2>
        <label className="block text-sm">
          <span className="font-medium">Question</span>
          <select
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={recording}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {prompts.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium">Or your own question</span> <span className="text-muted-foreground">(optional)</span>
          <input
            value={ownPrompt}
            onChange={(e) => setOwnPrompt(e.target.value)}
            maxLength={300}
            disabled={recording}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        {recognitionAvailable ? (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={countWords} onChange={(e) => setCountWords(e.target.checked)} disabled={recording} className="mt-1" />
            <span>
              Count words and filler words (uses your browser&apos;s speech recognition). Without it, only pauses and your start time are measured.
            </span>
          </label>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your browser has no speech recognition, so only pauses and your start time are measured. Chrome, Edge or Safari can also measure pace and
            filler words.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          {recording ? (
            <button
              type="button"
              onClick={stop}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
            >
              <Square aria-hidden="true" className="h-4 w-4" /> Stop and see feedback
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Mic aria-hidden="true" className="h-4 w-4" />} Start answering
            </button>
          )}
          {recording && (
            <div className="flex items-center gap-3 text-sm" role="status">
              <span className="tabular-nums">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")} / 3:00
              </span>
              <span className="h-2 w-32 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full bg-emerald-500 transition-[width] duration-75" style={{ width: `${Math.round(level * 100)}%` }} />
              </span>
              <span className="text-muted-foreground">Listening</span>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      </section>

      {result && (
        <section className={`${card} p-5`} aria-labelledby="dc-result" aria-live="polite">
          <h2 id="dc-result" className="text-base font-semibold">
            Your answer
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
            {[
              ["Pace", result.wordsPerMinute == null ? "Not measured" : `${Math.round(result.wordsPerMinute)} words/min`],
              ["Filler words", result.fillerCount == null ? "Not measured" : String(result.fillerCount)],
              ["Pauses", `${result.pauseCount} (longest ${secs(result.longestPauseMs)})`],
              ["Time to start", secs(result.responseDelayMs)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-sm font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          {Object.keys(result.fillerWords).length > 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              Heard:{" "}
              {Object.entries(result.fillerWords)
                .map(([w, n]) => `“${w}” ×${n}`)
                .join(", ")}
              . Browser speech recognition can leave some out, so the real count may be higher.
            </p>
          )}
          <ul className="mt-3 space-y-2 text-sm">
            {result.tips.map((t) => (
              <li key={t.area}>
                <span className="font-medium">{AREA[t.area] ?? t.area}:</span> {t.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${card} p-5`} aria-labelledby="dc-summary">
        <h2 id="dc-summary" className="text-base font-semibold">
          Across your recent answers
        </h2>
        {!summary || summary.samples === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No answers yet. Your averages appear here after your first one.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              Your last {summary.recentSamples} of {summary.samples} answers.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[
                ["Average pace", summary.averageWordsPerMinute == null ? "Not measured" : `${Math.round(summary.averageWordsPerMinute)} words/min`],
                ["Filler words", summary.fillersPerMinute == null ? "Not measured" : `${summary.fillersPerMinute} a minute`],
                ["Longest pause (average)", `${summary.averageLongestPauseSeconds} s`],
                ["Time to start (average)", `${summary.averageResponseDelaySeconds} s`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-muted/60 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-3 space-y-2 text-sm">
              {summary.tips.map((t) => (
                <li key={t.area}>
                  <span className="font-medium">{AREA[t.area] ?? t.area}:</span> {t.text}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {history.length > 0 && (
        <section className={`${card} overflow-x-auto p-5`} aria-labelledby="dc-history">
          <h2 id="dc-history" className="text-base font-semibold">
            Your answers
          </h2>
          <table className="mt-3 w-full min-w-140 text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Question</th>
                <th className="py-2 pr-3 font-medium">Pace</th>
                <th className="py-2 pr-3 font-medium">Filler words</th>
                <th className="py-2 font-medium">Longest pause</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} className="border-t border-border">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(h.recordedAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">{h.prompt}</td>
                  <td className="py-2 pr-3 tabular-nums">{h.wordsPerMinute == null ? "—" : Math.round(h.wordsPerMinute)}</td>
                  <td className="py-2 pr-3 tabular-nums">{h.fillerCount ?? "—"}</td>
                  <td className="py-2 tabular-nums">{secs(h.longestPauseMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          onClick={() => void deleteAll()}
          disabled={busy || recording || history.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 font-medium hover:bg-muted disabled:opacity-50"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" /> Delete my answers
        </button>
        <button
          type="button"
          onClick={() => void setConsent(false)}
          disabled={busy || recording}
          className="rounded-xl border border-border px-3 py-2 font-medium hover:bg-muted disabled:opacity-50"
        >
          Turn off speaking practice
        </button>
      </section>
    </main>
  );
}

"use client";

/**
 * Public drop-in check-in kiosk (/kiosk/<secret>). Runs on a front-desk device without sign-in.
 * Students enter their school email or student number; the screen shows only a queue number and wait,
 * never names or other student details, and resets itself for the next person.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";

interface KioskInfo {
  school: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  brandName: string;
  showPoweredBy: boolean;
  sessions: { id: string; name: string; location?: string | null; waiting: number; estimatedWaitMinutes: number }[];
}

interface CheckInResult {
  queueNumber: number;
  ahead: number;
  estimatedWaitMinutes: number;
}

async function kioskFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const text = await res.text();
  let body: unknown;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const message = body && typeof body === "object" && "message" in body ? String((body as { message: unknown }).message) : `Something went wrong (${res.status}).`;
    throw Object.assign(new Error(message), { status: res.status });
  }
  return body as T;
}

const RESET_MS = 12000;

export default function KioskPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [info, setInfo] = useState<KioskInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [identifier, setIdentifier] = useState("");
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await kioskFetch<KioskInfo>(`/api/career/appointments/public/kiosk/${encodeURIComponent(token)}`);
      setInfo(data);
      setLoadError(null);
      setSessionId((cur) => (data.sessions.some((s) => s.id === cur) ? cur : data.sessions[0]?.id ?? ""));
    } catch (e) {
      setLoadError((e as { status?: number }).status === 404 ? "This kiosk link is no longer active. Ask career-center staff for the current link." : (e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    // Initial load plus a light refresh so waits stay current and closed sessions disappear
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 30000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    if (info?.school) document.title = `Check in · ${info.school}`;
  }, [info?.school]);

  // After a check-in, clear the screen for the next student
  useEffect(() => {
    if (!result) return;
    const t = setTimeout(() => {
      setResult(null);
      inputRef.current?.focus();
    }, RESET_MS);
    return () => clearTimeout(t);
  }, [result]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await kioskFetch<CheckInResult>(`/api/career/appointments/public/kiosk/${encodeURIComponent(token)}/check-in`, {
        method: "POST",
        body: JSON.stringify({ sessionId, identifier, topic }),
      });
      setIdentifier("");
      setTopic("");
      setResult(r);
      void load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const brand = info?.primaryColor || "#4f46e5";
  const session = info?.sessions.find((s) => s.id === sessionId);

  return (
    <div className="min-h-screen bg-background text-foreground" style={{ ["--brand" as string]: brand }}>
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          {info?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={info.logoUrl} alt="" className="h-10 w-auto" />
          ) : (
            <span aria-hidden className="inline-block h-10 w-10 rounded-lg" style={{ background: brand }} />
          )}
          <div>
            <p className="text-lg font-semibold">{info?.school ?? "Career center"}</p>
            <p className="text-sm text-muted-foreground">Drop-in check-in</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {loadError ? (
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-6 text-lg text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {loadError}
          </p>
        ) : !info ? (
          <p role="status" className="text-lg text-muted-foreground">
            Loading…
          </p>
        ) : result ? (
          <section role="status" aria-live="assertive" className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="text-2xl font-semibold">You&apos;re checked in</h1>
            <p className="mt-6 text-sm uppercase tracking-wide text-muted-foreground">Your number</p>
            <p className="text-7xl font-bold" style={{ color: brand }}>
              {result.queueNumber}
            </p>
            <p className="mt-6 text-lg">
              {result.ahead === 0 ? "You're next." : `${result.ahead} ${result.ahead === 1 ? "person" : "people"} ahead of you.`} About {result.estimatedWaitMinutes} minutes.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Please take a seat; we&apos;ll call your number. Signed-in students also get a notification.</p>
            <button
              type="button"
              onClick={() => setResult(null)}
              className="mt-8 rounded-lg px-6 py-3 text-lg font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: brand, outlineColor: brand }}
            >
              Done
            </button>
          </section>
        ) : info.sessions.length === 0 ? (
          <section className="rounded-2xl border border-border bg-card p-8 text-center">
            <h1 className="text-2xl font-semibold">Drop-in advising is closed right now</h1>
            <p className="mt-2 text-muted-foreground">Please check back later or book an appointment online.</p>
          </section>
        ) : (
          <form onSubmit={submit} className="space-y-6 rounded-2xl border border-border bg-card p-6 sm:p-8">
            <h1 className="text-2xl font-semibold">Check in for drop-in advising</h1>
            {info.sessions.length > 1 ? (
              <fieldset>
                <legend className="mb-2 text-base font-medium">Which line?</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {info.sessions.map((s) => (
                    <label key={s.id} className={`flex cursor-pointer flex-col rounded-lg border p-3 focus-within:ring-2 ${sessionId === s.id ? "border-[var(--brand)] ring-1 ring-[var(--brand)]" : "border-border"}`}>
                      <span className="flex items-center gap-2">
                        <input type="radio" name="session" value={s.id} checked={sessionId === s.id} onChange={() => setSessionId(s.id)} />
                        <span className="font-medium">{s.name}</span>
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {s.location ? `${s.location} · ` : ""}
                        {s.waiting} waiting · about {s.estimatedWaitMinutes} min
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              session && (
                <p className="text-base text-muted-foreground">
                  {session.name}
                  {session.location ? ` · ${session.location}` : ""} · {session.waiting} waiting · about {session.estimatedWaitMinutes} min
                </p>
              )
            )}
            <div className="space-y-1">
              <label htmlFor="kiosk-id" className="block text-base font-medium">
                School email or student number
              </label>
              <input
                id="kiosk-id"
                ref={inputRef}
                required
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                aria-describedby={error ? "kiosk-err" : undefined}
                aria-invalid={error ? true : undefined}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg focus-visible:outline-2 focus-visible:outline-offset-1"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="kiosk-topic" className="block text-base font-medium">
                What would you like help with? (optional)
              </label>
              <input
                id="kiosk-topic"
                maxLength={300}
                autoComplete="off"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 text-lg focus-visible:outline-2 focus-visible:outline-offset-1"
              />
            </div>
            {error && (
              <p id="kiosk-err" role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || !sessionId}
              className="w-full rounded-lg px-6 py-4 text-lg font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              style={{ background: brand, outlineColor: brand }}
            >
              {busy ? "Checking in…" : "Check in"}
            </button>
          </form>
        )}
      </main>
      {info?.showPoweredBy && <footer className="pb-6 text-center text-xs text-muted-foreground">Powered by {info.brandName}</footer>}
    </div>
  );
}

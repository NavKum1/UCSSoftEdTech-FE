"use client";

/**
 * The parts of a website guidance form that keep bots out: the phone number checked by an SMS code (forms that require
 * it) and Cloudflare Turnstile's human check (when Edulexa has it set up; usually invisible, at most one click).
 */

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

const field = "block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-2 focus:outline-[var(--gf-accent)]";

/** Phone number with "Send code" and the code box; reports the check id once the code is right. */
export function PhoneCheck({
  apiBase,
  formId,
  phone,
  setPhone,
  onVerified,
  label,
}: {
  /** e.g. https://api…/api/public/guidance/{instituteId} */
  apiBase: string;
  formId: string;
  phone: string;
  setPhone: (p: string) => void;
  onVerified: (checkId: string | null) => void;
  label: string;
}) {
  const [checkId, setCheckId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const post = async (path: string, body: unknown) => {
    const res = await fetch(`${apiBase}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error ?? (res.status === 429 ? "Too many tries just now. Please wait a little and try again." : "That didn't work. Please try again."));
    return data;
  };

  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const d = await post("/phone-check", { form: formId, phone });
      setCheckId(d.checkId);
      setMsg(`We sent a code by SMS. It works for ${d.minutes} minutes.`);
    } catch (e) {
      setMsg(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!checkId) return;
    setBusy(true);
    setMsg(null);
    try {
      await post(`/phone-check/${checkId}/verify`, { code: code.trim() });
      setVerified(true);
      onVerified(checkId);
    } catch (e) {
      setMsg(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="block">
        <span className="font-medium">{label}</span>
        <div className="mt-1 flex gap-2">
          <input
            type="tel"
            required
            value={phone}
            maxLength={64}
            autoComplete="tel"
            placeholder="+91 98765 43210"
            disabled={verified}
            onChange={(e) => {
              setPhone(e.target.value);
              if (checkId) {
                setCheckId(null);
                setCode("");
                onVerified(null);
              }
            }}
            className={field}
          />
          {!verified && (
            <button type="button" disabled={busy || phone.trim().length < 8} onClick={send} className="shrink-0 rounded-xl border border-border px-3 py-2 font-medium hover:bg-muted disabled:opacity-50">
              {checkId ? "Send again" : "Send code"}
            </button>
          )}
        </div>
      </label>
      {checkId && !verified && (
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="Code from the SMS"
            aria-label="Code from the SMS"
            className={field}
          />
          <button type="button" disabled={busy || code.length < 4} onClick={verify} className="shrink-0 rounded-xl bg-[var(--gf-accent)] px-4 py-2 font-medium text-[var(--gf-on)] disabled:opacity-50">
            Verify
          </button>
        </div>
      )}
      {verified && (
        <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Phone number verified
        </p>
      )}
      {msg && !verified && <p className="text-xs text-muted-foreground" role="status">{msg}</p>}
    </div>
  );
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/** Cloudflare Turnstile: usually passes on its own; reports its token (null when it expires). */
export function HumanCheck({ siteKey, onToken, theme }: { siteKey: string; onToken: (t: string | null) => void; theme?: "light" | "dark" | "auto" }) {
  const box = useRef<HTMLDivElement>(null);
  const tokenRef = useRef(onToken);
  useEffect(() => {
    tokenRef.current = onToken;
  });

  useEffect(() => {
    let id: string | undefined;
    let cancelled = false;
    const render = () => {
      if (cancelled || !box.current || !window.turnstile) return;
      id = window.turnstile.render(box.current, {
        sitekey: siteKey,
        theme: theme ?? "auto",
        callback: (t: string) => tokenRef.current(t),
        "expired-callback": () => tokenRef.current(null),
        "error-callback": () => tokenRef.current(null),
      });
    };
    if (window.turnstile) render();
    else {
      let s = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
      if (!s) {
        s = document.createElement("script");
        s.src = SCRIPT;
        s.async = true;
        document.head.appendChild(s);
      }
      s.addEventListener("load", render);
    }
    return () => {
      cancelled = true;
      if (id && window.turnstile) window.turnstile.remove(id);
    };
  }, [siteKey, theme]);

  return <div ref={box} className="min-h-[65px]" />;
}

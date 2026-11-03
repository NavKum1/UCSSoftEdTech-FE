"use client";

/**
 * When a staff page answers "two-step sign-in needed" (a 403 with code mfa_required, A6), this asks the person to sign in
 * again: the sign-in service then has them set up an authenticator app. Signing out ends the Keycloak session too, so the
 * next sign-in asks for the second factor.
 */
import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { MFA_REQUIRED_EVENT } from "@/lib/apiClient";
import { useEn } from "@/lib/english/EnglishProvider";

export default function MfaRequiredNotice() {
  const en = useEn();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(MFA_REQUIRED_EVENT, show);
    return () => window.removeEventListener(MFA_REQUIRED_EVENT, show);
  }, []);
  useEffect(() => {
    if (open) button.current?.focus();
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="mfa-title" aria-describedby="mfa-text" className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <ShieldCheck aria-hidden="true" className="h-8 w-8 text-emerald-600" />
        <h2 id="mfa-title" className="mt-3 text-lg font-semibold">
          {en("Two-step sign-in is needed for your role")}
        </h2>
        <p id="mfa-text" className="mt-2 text-sm text-muted-foreground">
          {en("Staff accounts can see students' information, so they sign in with a code from an authenticator app as well as their password. Sign in again, and you'll be asked to set it up. It takes about a minute.")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {/* Full-page GET: the route ends the Keycloak session as well, then opens the sign-in page */}
          <form method="get" action="/api/auth/federated-logout">
            <button
              ref={button}
              type="submit"
              className="inline-flex items-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900"
            >
              {en("Sign in again")}
            </button>
          </form>
          <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            {en("Not now")}
          </button>
        </div>
      </div>
    </div>
  );
}

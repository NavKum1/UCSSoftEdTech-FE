"use client";

/**
 * After the payment provider (S1): waits for the school to be created (the provider's confirmation can take a few
 * seconds), then opens it. Opening goes through sign-in once more, so the account picks up its new admin role and its
 * school, and the sign-in service has the new admin set up two-step sign-in.
 */
import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { keycloakSignIn, useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { getDevSession } from "@/lib/devSession";
import { useEn } from "@/lib/english/EnglishProvider";

interface SignupStatus {
  status: "Pending" | "Creating" | "Created" | "Expired";
  instituteId: string | null;
  schoolName: string;
  slug: string;
  plan: string;
}

export default function StartDonePage() {
  return (
    <Suspense fallback={null}>
      <Done />
    </Suspense>
  );
}

function Done() {
  const en = useEn();
  const id = useSearchParams().get("signup");
  const { getToken, isSignedIn } = useAppAuth();
  const [status, setStatus] = useState<SignupStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id || !isSignedIn) return;
    let live = true;
    let tries = 0;
    const poll = async () => {
      const res = await authenticatedFetch(`/api/signup/${encodeURIComponent(id)}`, {}, getToken).catch(() => null);
      if (!live) return;
      const body = res?.ok ? ((await res.json()) as SignupStatus) : null;
      if (body) setStatus(body);
      if (body?.status === "Created") {
        try {
          sessionStorage.removeItem("edulexa.start");
        } catch {
          // storage blocked
        }
        return;
      }
      if (++tries > 40 || body?.status === "Expired") return setFailed(true);
      setTimeout(poll, 1500);
    };
    void poll();
    return () => {
      live = false;
    };
  }, [id, isSignedIn, getToken]);

  const open = () => {
    // A local developer session already acts as the admin; a real account signs in again to pick up its school
    if (getDevSession()) window.location.replace("/institute/setup");
    else void keycloakSignIn("/institute/setup");
  };

  const ready = status?.status === "Created";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_60px_-30px_rgb(30_27_75/0.35)] dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        {ready ? (
          <>
            <CheckCircle2 aria-hidden="true" className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">{status.schoolName}{en(" is ready")}</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              {en("Your 30-day free trial of the ")}{status.plan}{en(" plan has started. We've e-mailed you the details.")}
            </p>
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-start text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
              {en("As your school's administrator you'll sign in with a code from an authenticator app as well as your password. You'll set it up next.")}
            </p>
            <button
              type="button"
              onClick={open}
              className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 px-5 py-3 text-[15px] font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {en("Open your school")}
            </button>
          </>
        ) : failed || !id ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{en("We couldn't confirm your sign-up yet")}</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-400">
              {en("If you added your payment details, your school will be ready in a few minutes and we'll e-mail you. Otherwise, start again.")}
            </p>
            <Link href="/start" className="mt-7 inline-flex rounded-xl border border-slate-300 px-5 py-3 text-[15px] font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
              {en("Back to the sign-up")}
            </Link>
          </>
        ) : (
          <>
            <Loader2 aria-hidden="true" className="mx-auto h-10 w-10 animate-spin text-indigo-600" />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">{en("Setting up your school")}</h1>
            <p className="mt-3 text-slate-600 dark:text-slate-400">{en("This takes a few seconds.")}</p>
          </>
        )}
      </div>
    </main>
  );
}

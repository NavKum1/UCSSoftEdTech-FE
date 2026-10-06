"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Mic, Zap, PlusCircle, CreditCard, Loader2, AlertTriangle, Clock } from "lucide-react";
import { API_BASE_URL, authenticatedFetch } from "@/lib/apiClient";

export interface BillingPlan {
  id: string;
  priceCents: number;
  monthlyVoiceMinutes: number;
  interval?: string;
}

export interface BillingPlans {
  currency: string;
  maxSessionMinutes: number;
  plans: BillingPlan[];
  topUp: { minutes: number; priceCents: number; expires?: boolean };
}

export interface VoiceUsage {
  subscriptionTier: string;
  subscriptionStatus?: string | null;
  allocatedMinutes: number;
  usedMinutes: number;
  bonusMinutes: number;
  remainingMinutes: number;
  usageResetsAt?: string | null;
  maxSessionMinutes: number;
  isQuotaExhausted: boolean;
}

export function formatPrice(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

export async function fetchBillingPlans(): Promise<BillingPlans | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/billing/plans`);
    return res.ok ? ((await res.json()) as BillingPlans) : null;
  } catch {
    return null;
  }
}

export type BillingAction = "checkout" | "topup" | "portal";

const BILLING_ENDPOINTS: Record<BillingAction, string> = {
  checkout: "/api/billing/create-checkout-session",
  topup: "/api/billing/create-topup-session",
  portal: "/api/billing/customer-portal",
};

// Creates the Stripe session and redirects; returns an error message on failure
export async function startBillingRedirect(
  action: BillingAction,
  getToken: () => Promise<string | null>
): Promise<string | null> {
  try {
    const res = await authenticatedFetch(BILLING_ENDPOINTS[action], { method: "POST", body: "{}" }, getToken);
    const data = (await res.json().catch(() => null)) as { checkoutUrl?: string; portalUrl?: string; error?: string } | null;
    if (res.status === 401) return "Please sign in first.";
    const url = data?.checkoutUrl || data?.portalUrl;
    if (!res.ok || !url) return data?.error || `Billing is unavailable right now (HTTP ${res.status}).`;
    window.location.href = url;
    return null;
  } catch {
    return "Could not reach the billing service.";
  }
}

export default function VoiceUsageCard() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [plans, setPlans] = useState<BillingPlans | null>(null);
  const [usage, setUsage] = useState<VoiceUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<BillingAction | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      const [planData, usageData] = await Promise.all([
        fetchBillingPlans(),
        isSignedIn
          ? authenticatedFetch("/api/billing/usage", {}, getToken)
              .then((r) => (r.ok ? (r.json() as Promise<VoiceUsage>) : null))
              .catch(() => null)
          : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setPlans(planData);
      setUsage(usageData);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const runAction = async (action: BillingAction) => {
    setBusy(action);
    setError(null);
    const err = await startBillingRedirect(action, getToken);
    if (err) {
      setError(err);
      setBusy(null);
    }
  };

  const proPlan = plans?.plans.find((p) => p.id.toLowerCase() === "pro");
  const isPro = usage?.subscriptionTier?.toLowerCase() === "pro";
  const usedPct =
    usage && usage.allocatedMinutes > 0 ? Math.min(100, Math.round((usage.usedMinutes / usage.allocatedMinutes) * 100)) : 0;
  const sessionCap = usage?.maxSessionMinutes ?? plans?.maxSessionMinutes;

  return (
    <div className="glass-panel rounded-2xl p-5 border border-border">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-start gap-4 min-w-0">
          <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 dark:text-indigo-400 shrink-0">
            <Mic className="w-5 h-5" />
          </div>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">Voice defense minutes</h2>
              {usage && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                    isPro
                      ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {usage.subscriptionTier} plan
                </span>
              )}
            </div>

            {loading ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading usage...
              </p>
            ) : usage ? (
              <>
                <p className="text-xs text-muted-foreground">
                  <span className={`text-lg font-black ${usage.isQuotaExhausted ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                    {usage.remainingMinutes}
                  </span>{" "}
                  min remaining · {usage.usedMinutes} of {usage.allocatedMinutes} monthly min used
                  {usage.bonusMinutes > 0 && <> · {usage.bonusMinutes} top-up min (never expire)</>}
                </p>
                <div className="h-1.5 w-full max-w-sm rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${usage.isQuotaExhausted ? "bg-red-500" : "bg-indigo-500"}`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                  {usage.usageResetsAt && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Monthly minutes reset {new Date(usage.usageResetsAt).toLocaleDateString()}
                    </span>
                  )}
                  {sessionCap ? <span>Max {sessionCap} min per session</span> : null}
                </p>
                {usage.isQuotaExhausted && (
                  <p className="text-[11px] font-semibold text-red-600 dark:text-red-400 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> You&apos;re out of minutes for this period.
                  </p>
                )}
              </>
            ) : isLoaded && !isSignedIn ? (
              <p className="text-xs text-muted-foreground">Sign in to see your voice minutes.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Usage is unavailable right now.</p>
            )}
          </div>
        </div>

        {usage && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isPro && (
              <button
                type="button"
                onClick={() => runAction("checkout")}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white text-xs font-semibold shadow-md"
              >
                {busy === "checkout" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                Upgrade to Pro
                {proPlan && plans && (
                  <span className="opacity-80 font-normal">
                    · {formatPrice(proPlan.priceCents, plans.currency)}/{proPlan.interval ?? "month"}
                  </span>
                )}
              </button>
            )}
            {plans && (
              <button
                type="button"
                onClick={() => runAction("topup")}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-60 text-foreground text-xs font-semibold"
              >
                {busy === "topup" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlusCircle className="w-3.5 h-3.5" />}
                Buy {plans.topUp.minutes} minutes · {formatPrice(plans.topUp.priceCents, plans.currency)}
              </button>
            )}
            {isPro && (
              <button
                type="button"
                onClick={() => runAction("portal")}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-60 text-foreground text-xs font-semibold"
              >
                {busy === "portal" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                Manage billing
              </button>
            )}
            <Link href="/pricing" className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline px-1">
              Compare plans
            </Link>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </p>
      )}
    </div>
  );
}

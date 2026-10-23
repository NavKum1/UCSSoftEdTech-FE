"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Check, Zap, PlusCircle, Loader2, AlertTriangle, Clock, CreditCard } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  type BillingAction,
  type BillingPlans,
  type VoiceUsage,
  fetchBillingPlans,
  formatPrice,
  startBillingRedirect,
} from "@/components/VoiceUsageCard";
import { signInHref } from "@/components/SignInRequired";

export default function PricingPage() {
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

  const currentTier = usage?.subscriptionTier?.toLowerCase();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading plans...
      </div>
    );
  }

  if (!plans) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-400" />
        <h1 className="text-xl font-bold text-foreground">Pricing is unavailable</h1>
        <p className="text-sm text-muted-foreground">We couldn&apos;t load the plan catalogue. Please try again shortly.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-foreground">Plans &amp; voice minutes</h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
            Voice defenses are billed by the minute of conversation. Every plan includes a monthly allowance, and you can add
            top-up minutes at any time.
          </p>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/60 border border-border rounded-full px-3 py-1">
            <Clock className="w-3.5 h-3.5" /> Each voice session is capped at {plans.maxSessionMinutes} minutes
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {plans.plans.map((plan) => {
            const isPro = plan.id.toLowerCase() === "pro";
            const isCurrent = currentTier === plan.id.toLowerCase();
            return (
              <div
                key={plan.id}
                className={`glass-panel rounded-2xl p-6 border flex flex-col gap-5 ${
                  isPro ? "border-indigo-500/50 shadow-lg shadow-indigo-500/10" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-foreground">{plan.id}</h2>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      Current plan
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-4xl font-black text-foreground">{formatPrice(plan.priceCents, plans.currency)}</span>
                  <span className="text-sm text-muted-foreground"> / {plan.interval ?? "month"}</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {plan.monthlyVoiceMinutes} voice-defense minutes per month
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Up to {plans.maxSessionMinutes} minutes per session
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    Monthly minutes reset each billing period; unused monthly minutes don&apos;t roll over
                  </li>
                  {isPro && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      Cancel any time from the billing portal
                    </li>
                  )}
                </ul>

                {isPro ? (
                  !isSignedIn ? (
                    <Link
                      href={signInHref("/pricing")}
                      className="w-full text-center py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold"
                    >
                      Sign in to upgrade
                    </Link>
                  ) : isCurrent ? (
                    <button
                      type="button"
                      onClick={() => runAction("portal")}
                      disabled={busy !== null}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-60 text-foreground text-sm font-semibold"
                    >
                      {busy === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      Manage billing
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => runAction("checkout")}
                      disabled={busy !== null}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white text-sm font-semibold shadow-md"
                    >
                      {busy === "checkout" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                      Upgrade to {plan.id}
                    </button>
                  )
                ) : (
                  <div className="w-full text-center py-2.5 rounded-xl border border-border text-sm text-muted-foreground">
                    {isCurrent ? "Your current plan" : "Included with every account"}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="glass-panel rounded-2xl p-6 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
              Top-up: {plans.topUp.minutes} minutes for {formatPrice(plans.topUp.priceCents, plans.currency)}
            </h2>
            <p className="text-xs text-muted-foreground">
              One-time purchase, available on any plan.
              {plans.topUp.expires === false && " Top-up minutes never expire."} Top-up minutes are used after your monthly
              allowance.
            </p>
          </div>
          {isSignedIn ? (
            <button
              type="button"
              onClick={() => runAction("topup")}
              disabled={busy !== null}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-60 text-foreground text-sm font-semibold shrink-0"
            >
              {busy === "topup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
              Buy {plans.topUp.minutes} minutes
            </button>
          ) : (
            <Link href={signInHref("/pricing")} className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted text-center">
              Sign in to buy
            </Link>
          )}
        </div>

        {usage && (
          <p className="text-center text-xs text-muted-foreground">
            You have {usage.remainingMinutes} minutes remaining
            {usage.usageResetsAt && <> · monthly minutes reset {new Date(usage.usageResetsAt).toLocaleDateString()}</>}.
          </p>
        )}
      </div>
    </div>
  );
}

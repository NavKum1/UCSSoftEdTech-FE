"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { Check, Zap, PlusCircle, AlertTriangle, Clock, CreditCard } from "lucide-react";
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
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, Loading, PageHeader, brandFill, buttonClass } from "@/components/career/ui";

export default function PricingPage() {
  const en = useEn();
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
      <Loading label={en("Loading plans…")} />
    );
  }

  if (!plans) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 mx-auto text-amber-600 dark:text-amber-400" />
        <h1 className="text-xl font-semibold text-foreground">{en("Pricing is unavailable")}</h1>
        <p className="text-sm text-muted-foreground">{en("We couldn't load the plan catalogue. Please try again shortly.")}</p>
      </div>
    );
  }

  return (
    <div className="text-foreground">
      <div className="space-y-10">
        <div>
          <PageHeader
            title={en("Plans and voice minutes")}
            description={en("Voice defenses and practice interviews are billed by the minutes you use, rounded up to the next whole minute. Every plan includes a monthly allowance, and you can add top-up minutes at any time.")}
          />
          <p className="-mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/60 border border-border rounded-full px-3 py-1">
            <Clock className="w-3.5 h-3.5" />{" "}{en("Each voice session is capped at {maxSessionMinutes} minutes", { maxSessionMinutes: plans.maxSessionMinutes })}</p>
          <p className="mt-2 text-xs text-muted-foreground max-w-2xl">
            {en("When a practice interview starts, a whole session's minutes are set aside so you can't run out partway. When it ends, the minutes you didn't use go back to your balance. If no answers were recorded, no minutes are used.")}
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
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
                className={`rounded-xl border bg-card p-6 shadow-sm flex flex-col gap-5 ${isPro ? "border-indigo-500/50" : "border-border"}`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">{plan.id}</h2>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      {en("Current plan")}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-3xl font-semibold tracking-tight text-foreground">{formatPrice(plan.priceCents, plans.currency)}</span>
                  <span className="text-sm text-muted-foreground"> / {plan.interval ?? "month"}</span>
                </div>
                <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {en("{monthlyVoiceMinutes} voice minutes per month, for voice defenses and practice interviews", { monthlyVoiceMinutes: plan.monthlyVoiceMinutes })}
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {en("Up to {maxSessionMinutes} minutes per session", { maxSessionMinutes: plans.maxSessionMinutes })}
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    {en("Monthly minutes reset each billing period; unused monthly minutes don't roll over")}
                  </li>
                  {isPro && (
                    <li className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      {en("Cancel any time from the billing portal")}
                    </li>
                  )}
                </ul>

                {isPro ? (
                  !isSignedIn ? (
                    <Link
                      href={signInHref("/pricing")}
                      className={`${buttonClass("primary")} w-full`}
                      style={brandFill}
                    >
                      {en("Sign in to upgrade")}
                    </Link>
                  ) : isCurrent ? (
                    <Button type="button" variant="secondary" className="w-full" onClick={() => runAction("portal")} disabled={busy !== null} busy={busy === "portal"}>
                      {busy !== "portal" && <CreditCard className="w-4 h-4" />}
                      {en("Manage billing")}
                    </Button>
                  ) : (
                    <Button type="button" className="w-full" onClick={() => runAction("checkout")} disabled={busy !== null} busy={busy === "checkout"}>
                      {busy !== "checkout" && <Zap className="w-4 h-4" />}
                      {en("Upgrade to ")}{plan.id}
                    </Button>
                  )
                ) : (
                  <div className="w-full text-center py-2 rounded-lg border border-border text-sm text-muted-foreground">
                    {isCurrent ? en("Your current plan") : en("Included with every account")}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-indigo-700 dark:text-indigo-400" />
              {en("Top-up: {minutes} minutes for {amount}", { minutes: plans.topUp.minutes, amount: formatPrice(plans.topUp.priceCents, plans.currency) })}
            </h2>
            <p className="text-xs text-muted-foreground">
              {en("One-time purchase, available on any plan.")}
              {plans.topUp.expires === false && en(" Top-up minutes never expire.")}{en(" Top-up minutes are used after your monthly allowance.")}
            </p>
          </div>
          {isSignedIn ? (
            <Button type="button" variant="secondary" className="shrink-0" onClick={() => runAction("topup")} disabled={busy !== null} busy={busy === "topup"}>
              {busy !== "topup" && <PlusCircle className="w-4 h-4" />}
              {en("Buy {minutes} minutes", { minutes: plans.topUp.minutes })}
            </Button>
          ) : (
            <Link href={signInHref("/pricing")} className={`${buttonClass("secondary")} shrink-0`}>
              {en("Sign in to buy")}
            </Link>
          )}
        </div>

        {usage && (
          <p className="text-center text-xs text-muted-foreground">
            {en("You have ")}{usage.remainingMinutes}{en(" minutes remaining")}
            {usage.usageResetsAt && <>{" "}{en("· monthly minutes reset {date}", { date: new Date(usage.usageResetsAt).toLocaleDateString() })}</>}.
          </p>
        )}
      </div>
    </div>
  );
}

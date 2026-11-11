"use client";

/**
 * Billing for a self-serve school (S2): its plan and state, the team and voice minutes used, changing plan, cancelling or
 * undoing it, the card (Stripe's billing page), and paying again when the school is read-only. C1: buying packs of extra AI
 * voice minutes. A school on a contract with Edulexa's team sees a note instead.
 */
import React, { useEffect, useState } from "react";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { REASONS, day, money, type PlanOption, type SchoolPlanState } from "@/components/institute/SchoolPlan";
import { openRazorpayCheckout, openRazorpayOrder } from "@/lib/razorpayCheckout";
import { Button, PageHeader } from "@/components/career/ui";
import { HelpLink } from "@/components/help/HelpLink";
import { useEn } from "@/lib/english/EnglishProvider";

const STATUS: Record<string, { label: string; tone: string }> = {
  Trialing: { label: "Free trial", tone: "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200" },
  Active: { label: "Active", tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" },
  PastDue: { label: "Payment failed", tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200" },
  ReadOnly: { label: "Read-only", tone: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200" },
};

export default function SchoolBillingPage() {
  const en = useEn();
  const { apiFetch, ready, access, getToken } = useLegacyApi();
  const [s, setS] = useState<SchoolPlanState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [interval, setIntervalChoice] = useState<"month" | "year" | null>(null);

  const fetchState = async () => {
    const res = await apiFetch("/api/school-billing");
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setError(body?.error ?? "Billing couldn't be loaded.");
      return null;
    }
    setS(body);
    return body as SchoolPlanState;
  };
  // Back from paying again: the provider's confirmation reopens the school within a few seconds
  const waitForReopen = async () => {
    setMessage(en("Payment received. Reopening your school…"));
    for (let i = 0; i < 20; i++) {
      const b = await fetchState();
      if (b && b.status !== "ReadOnly" && b.status !== "PastDue") return setMessage(en("Your school is open again. Thank you."));
      await new Promise((r) => setTimeout(r, 1500));
    }
    setMessage(en("We're still waiting for the payment provider to confirm. This page updates when you reload it, and we'll e-mail you."));
  };
  // C1: back from paying for voice minutes; the provider's confirmation adds them within a few seconds
  const waitForMinutes = async (before: number | null) => {
    setMessage(en("Payment received. Adding your minutes…"));
    for (let i = 0; i < 20; i++) {
      const b = await fetchState();
      if (b && (before == null ? b.voice.extra > 0 : b.voice.extra > before)) return setMessage(en("Your minutes are added. Thank you."));
      await new Promise((r) => setTimeout(r, 1500));
    }
    setMessage(en("We're still waiting for the payment provider to confirm. Your minutes appear here when it does."));
  };
  const load = async () => {
    const q = new URLSearchParams(window.location.search);
    if (q.has("renewed")) {
      window.history.replaceState(null, "", "/institute/billing");
      return waitForReopen();
    }
    if (q.get("minutes") === "paid") {
      window.history.replaceState(null, "", "/institute/billing");
      return waitForMinutes(null);
    }
    await fetchState();
  };
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  if (access) return <AccessNotice problem={access} feature="billing" />;

  const act = async (key: string, path: string, body?: object) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    const res = await apiFetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
    const b = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) {
      setError(b?.error ?? "That didn't work. Please try again.");
      return null;
    }
    return b;
  };

  const changePlan = async (p: PlanOption, i: "month" | "year") => {
    const b = await act(p.key + i, "/api/school-billing/plan", { plan: p.key, interval: i });
    if (b) {
      setS(b);
      setMessage(i === "year" ? en("You're now on the {plan} plan, paid yearly.", { plan: p.name }) : en("You're now on the {plan} plan, paid monthly.", { plan: p.name }));
    }
  };
  const renew = async (p: PlanOption, i: "month" | "year") => {
    const b = await act("renew" + p.key + i, "/api/school-billing/renew", { plan: p.key, interval: i });
    if (b?.checkout?.url) return window.location.assign(b.checkout.url);
    if (!b?.checkout?.razorpay) return;
    setBusy("renew" + p.key + i);
    try {
      await openRazorpayCheckout({
        signupId: b.signupId,
        start: b.checkout.razorpay,
        description: `${p.name} plan, paid ${i === "year" ? "yearly" : "monthly"}`,
        getToken,
        onDone: () => {
          setBusy(null);
          void waitForReopen();
        },
        onClose: () => setBusy(null),
      });
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Razorpay couldn't be opened.");
    }
  };

  const buyMinutes = async () => {
    if (!s) return;
    const before = s.voice.extra;
    const b = await act("minutes", "/api/school-billing/voice-pack");
    if (b?.checkout?.url) return window.location.assign(b.checkout.url);
    if (!b?.checkout?.razorpay) return;
    setBusy("minutes");
    try {
      await openRazorpayOrder({
        start: b.checkout.razorpay,
        confirmPath: `/api/school-billing/voice-pack/${b.packId}/razorpay`,
        getToken,
        onDone: () => {
          setBusy(null);
          void waitForMinutes(before);
        },
        onClose: () => setBusy(null),
      });
    } catch (e) {
      setBusy(null);
      setError(e instanceof Error ? e.message : "Razorpay couldn't be opened.");
    }
  };

  if (!s) {
    return (
      <div>
        {error ? <p className="text-sm text-red-700">{error}</p> : <Loader2 aria-label={en("Loading")} className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>
    );
  }
  if (s.managed) {
    return (
      <PageHeader title={en("Billing")} description={en("Your school's contract is managed by Edulexa's team. Contact us about invoices or changes.")} />
    );
  }

  const running = s.status === "Trialing" || s.status === "Active";
  const chosen = interval ?? s.interval;
  const badge = STATUS[s.status] ?? STATUS.Active;
  const current = s.plans.find((p) => p.key === s.plan);
  const card = "rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6";

  return (
    <div className="space-y-6">
      <PageHeader title={en("Billing")} description={en("Your plan, what it includes and how you pay.")} actions={<HelpLink slug="billing-and-voice-minutes" />} />

      <section aria-labelledby="plan-now" className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="plan-now" className="text-lg font-semibold">
              {current?.name ?? s.plan} plan
            </h2>
            {current && (
              <p className="text-sm text-muted-foreground">
                {money(s.interval === "year" ? current.yearMinor : current.monthMinor, s.currency)} {s.interval === "year" ? en("a year") : en("a month")}
              </p>
            )}
          </div>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${badge.tone}`}>{en(badge.label)}</span>
        </div>
        <p className="mt-4 text-sm leading-6">
          {s.status === "Trialing" &&
            (s.cancelAtPeriodEnd
              ? en(`Your free trial ends on ${day(s.trialEndsAt)}. You cancelled, so nothing will be charged and your school becomes read-only then.`)
              : `Your free trial ends on ${day(s.trialEndsAt)}. Then the first payment is taken from the ${s.provider === "razorpay" ? "card or UPI mandate" : "card"} you gave.`)}
          {s.status === "Active" &&
            (s.cancelAtPeriodEnd
              ? en(`Cancelled: your school stays open until ${day(s.currentPeriodEnd)}, then becomes read-only.`)
              : `Paid until ${day(s.currentPeriodEnd)}; it renews automatically.`)}
          {s.status === "PastDue" && en("The last payment didn't go through. Update your payment method; the school becomes read-only a week after a failed payment.")}
          {s.status === "ReadOnly" &&
            en(`Your school is read-only because ${REASONS[s.readOnlyReason ?? ""] ?? "its plan isn't paid"}. You can see and export everything until ${day(s.deleteAfter)}, when its data is deleted. Choose a plan below to carry on.`)}
        </p>
        <dl className="mt-5 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">{en("Team members")}</dt>
            <dd className="mt-0.5 font-medium">
              {s.team.used} {s.team.limit == null ? en("(unlimited)") : `of ${s.team.limit}`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{en("AI voice minutes this month")}</dt>
            <dd className="mt-0.5 font-medium">{s.voice.limit > 0 ? `${s.voice.used} of ${s.voice.limit}` : en("Not in this plan")}</dd>
            {s.voice.extra > 0 && <dd className="mt-0.5 text-muted-foreground">{en("Plus {count} bought minutes left", { count: s.voice.extra })}</dd>}
          </div>
        </dl>
        {s.voicePack?.canBuy && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <p className="max-w-prose">
              <span className="font-medium">{en("Need more voice minutes?")}</span>{" "}
              {en("Buy {minutes} minutes for {price}. They're used after your plan's monthly minutes and kept until your plan ends.", {
                minutes: s.voicePack.minutes,
                price: money(s.voicePack.priceMinor, s.currency),
              })}
            </p>
            <Button type="button" variant="secondary" disabled={busy != null} busy={busy === "minutes"} onClick={() => void buyMinutes()}>
              {en("Buy {minutes} minutes", { minutes: s.voicePack.minutes })}
            </Button>
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          {s.portal && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={async () => {
                const b = await act("portal", "/api/school-billing/portal");
                if (b?.url) window.location.assign(b.url);
              }}
            >
              <CreditCard aria-hidden="true" className="h-4 w-4" />{en(" Card and invoices")}
            </Button>
          )}
          {running && !s.cancelAtPeriodEnd && (
            <Button
              type="button"
              variant="secondary"
              disabled={busy != null}
              onClick={async () => {
                if (!window.confirm(en("Cancel your plan? Your school stays open until the end of the trial or the paid period, then becomes read-only."))) return;
                const b = await act("cancel", "/api/school-billing/cancel");
                if (b) setS(b);
              }}
            >
              {en("Cancel plan")}
            </Button>
          )}
          {s.canResume && (
            <Button
              type="button"
              disabled={busy != null}
              onClick={async () => {
                const b = await act("resume", "/api/school-billing/resume");
                if (b) setS(b);
              }}
            >
              {en("Keep my plan")}
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="plans">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans" className="text-lg font-semibold">
            {s.status === "ReadOnly" || s.status === "PastDue" ? en("Choose a plan to carry on") : en("Change plan")}
          </h2>
          <div role="radiogroup" aria-label={en("Billing period")} className="inline-flex rounded-lg border border-border bg-card p-1 shadow-sm">
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={chosen === i}
                onClick={() => setIntervalChoice(i)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${chosen === i ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {i === "month" ? en("Monthly") : en("Yearly: 2 months free")}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {s.plans.map((p) => {
            const isCurrent = p.key === s.plan && chosen === s.interval;
            return (
              <div key={p.key} className={`flex flex-col ${card} ${isCurrent ? "ring-2 ring-indigo-600" : ""}`}>
                <h3 className="font-semibold">{p.name}</h3>
                <p className="mt-1 text-2xl font-semibold tracking-tight">
                  {money(chosen === "year" ? p.yearMinor : p.monthMinor, s.currency)}
                  <span className="text-sm font-normal text-muted-foreground"> {chosen === "year" ? en("a year") : en("a month")}</span>
                </p>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">
                  {p.includes.map((x) => (
                    <li key={x} className="flex gap-2">
                      <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={3} />
                      {x}
                    </li>
                  ))}
                </ul>
                {s.status === "ReadOnly" || s.status === "PastDue" ? (
                  <Button type="button" className="mt-5" disabled={busy != null} busy={busy === "renew" + p.key + chosen} onClick={() => void renew(p, chosen)}>
                    {en("Pay and reopen")}
                  </Button>
                ) : isCurrent ? (
                  <p className="mt-5 text-center text-sm font-medium text-indigo-700 dark:text-indigo-300">{en("Your plan")}</p>
                ) : (
                  <Button type="button" variant="secondary" className="mt-5" disabled={busy != null || !running} busy={busy === p.key + chosen} onClick={() => void changePlan(p, chosen)}>
                    {en("Switch to ")}{p.name}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {message && (
        <p role="status" className="text-sm text-emerald-800 dark:text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

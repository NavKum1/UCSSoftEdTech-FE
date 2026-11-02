"use client";

/**
 * Billing for a self-serve school (S2): its plan and state, the team and voice minutes used, changing plan, cancelling or
 * undoing it, the card (Stripe's billing page), and paying again when the school is read-only. A school on a contract
 * with Edulexa's team sees a note instead.
 */
import React, { useEffect, useState } from "react";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { REASONS, day, money, type PlanOption, type SchoolPlanState } from "@/components/institute/SchoolPlan";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";

const STATUS: Record<string, { label: string; tone: string }> = {
  Trialing: { label: "Free trial", tone: "border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200" },
  Active: { label: "Active", tone: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200" },
  PastDue: { label: "Payment failed", tone: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200" },
  ReadOnly: { label: "Read-only", tone: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200" },
};

export default function SchoolBillingPage() {
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
    setMessage("Payment received. Reopening your school…");
    for (let i = 0; i < 20; i++) {
      const b = await fetchState();
      if (b && b.status !== "ReadOnly" && b.status !== "PastDue") return setMessage("Your school is open again. Thank you.");
      await new Promise((r) => setTimeout(r, 1500));
    }
    setMessage("We're still waiting for the payment provider to confirm. This page updates when you reload it, and we'll e-mail you.");
  };
  const load = async () => {
    if (new URLSearchParams(window.location.search).has("renewed")) {
      window.history.replaceState(null, "", "/institute/billing");
      return waitForReopen();
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
      setMessage(`You're now on the ${p.name} plan, paid ${i === "year" ? "yearly" : "monthly"}.`);
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

  if (!s) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        {error ? <p className="text-sm text-red-700">{error}</p> : <Loader2 aria-label="Loading" className="h-5 w-5 animate-spin text-slate-400" />}
      </div>
    );
  }
  if (s.managed) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-6">
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-slate-600 dark:text-slate-400">Your school&apos;s contract is managed by Edulexa&apos;s team. Contact us about invoices or changes.</p>
      </div>
    );
  }

  const running = s.status === "Trialing" || s.status === "Active";
  const chosen = interval ?? s.interval;
  const badge = STATUS[s.status] ?? STATUS.Active;
  const current = s.plans.find((p) => p.key === s.plan);
  const card = "rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Your plan, what it includes and how you pay.</p>
      </div>

      <section aria-labelledby="plan-now" className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="plan-now" className="text-lg font-semibold">
              {current?.name ?? s.plan} plan
            </h2>
            {current && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {money(s.interval === "year" ? current.yearMinor : current.monthMinor, s.currency)} {s.interval === "year" ? "a year" : "a month"}
              </p>
            )}
          </div>
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${badge.tone}`}>{badge.label}</span>
        </div>
        <p className="mt-4 text-[15px]">
          {s.status === "Trialing" &&
            (s.cancelAtPeriodEnd
              ? `Your free trial ends on ${day(s.trialEndsAt)}. You cancelled, so nothing will be charged and your school becomes read-only then.`
              : `Your free trial ends on ${day(s.trialEndsAt)}. Then the first payment is taken from the ${s.provider === "razorpay" ? "card or UPI mandate" : "card"} you gave.`)}
          {s.status === "Active" &&
            (s.cancelAtPeriodEnd
              ? `Cancelled: your school stays open until ${day(s.currentPeriodEnd)}, then becomes read-only.`
              : `Paid until ${day(s.currentPeriodEnd)}; it renews automatically.`)}
          {s.status === "PastDue" && "The last payment didn't go through. Update your payment method; the school becomes read-only a week after a failed payment."}
          {s.status === "ReadOnly" &&
            `Your school is read-only because ${REASONS[s.readOnlyReason ?? ""] ?? "its plan isn't paid"}. You can see and export everything until ${day(s.deleteAfter)}, when its data is deleted. Choose a plan below to carry on.`}
        </p>
        <dl className="mt-5 grid gap-4 border-t border-slate-100 pt-5 text-sm dark:border-slate-800 sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Team members</dt>
            <dd className="mt-0.5 font-medium">
              {s.team.used} {s.team.limit == null ? "(unlimited)" : `of ${s.team.limit}`}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">AI voice minutes this month</dt>
            <dd className="mt-0.5 font-medium">{s.voice.limit > 0 ? `${s.voice.used} of ${s.voice.limit}` : "Not in this plan"}</dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          {s.portal && (
            <button
              type="button"
              disabled={busy != null}
              onClick={async () => {
                const b = await act("portal", "/api/school-billing/portal");
                if (b?.url) window.location.assign(b.url);
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <CreditCard aria-hidden="true" className="h-4 w-4" /> Card and invoices
            </button>
          )}
          {running && !s.cancelAtPeriodEnd && (
            <button
              type="button"
              disabled={busy != null}
              onClick={async () => {
                if (!window.confirm("Cancel your plan? Your school stays open until the end of the trial or the paid period, then becomes read-only.")) return;
                const b = await act("cancel", "/api/school-billing/cancel");
                if (b) setS(b);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel plan
            </button>
          )}
          {s.canResume && (
            <button
              type="button"
              disabled={busy != null}
              onClick={async () => {
                const b = await act("resume", "/api/school-billing/resume");
                if (b) setS(b);
              }}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Keep my plan
            </button>
          )}
        </div>
      </section>

      <section aria-labelledby="plans">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="plans" className="text-lg font-semibold">
            {s.status === "ReadOnly" || s.status === "PastDue" ? "Choose a plan to carry on" : "Change plan"}
          </h2>
          <div role="radiogroup" aria-label="Billing period" className="inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            {(["month", "year"] as const).map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={chosen === i}
                onClick={() => setIntervalChoice(i)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${chosen === i ? "bg-indigo-600 text-white" : "text-slate-600 dark:text-slate-400"}`}
              >
                {i === "month" ? "Monthly" : "Yearly: 2 months free"}
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
                  <span className="text-sm font-normal text-slate-500"> {chosen === "year" ? "a year" : "a month"}</span>
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
                  <button
                    type="button"
                    disabled={busy != null}
                    onClick={() => void renew(p, chosen)}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {busy === "renew" + p.key + chosen && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />} Pay and reopen
                  </button>
                ) : isCurrent ? (
                  <p className="mt-5 text-center text-sm font-medium text-indigo-700 dark:text-indigo-300">Your plan</p>
                ) : (
                  <button
                    type="button"
                    disabled={busy != null || !running}
                    onClick={() => void changePlan(p, chosen)}
                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {busy === p.key + chosen && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />} Switch to {p.name}
                  </button>
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
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}

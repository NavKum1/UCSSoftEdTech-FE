"use client";

/**
 * Enterprise plan and usage statements for an institute (phase C, 24 Oct 2026). Amounts are shown as billed, in US
 * dollars; no exchange rates are applied. An institute without a plan sees that it has none (opening this page used to
 * create an active plan with made-up usage). Statements are drafts until a payment is recorded and are not tax invoices.
 * Plans and statements are set up by Edulexa (SuperAdmin); institute admins read them.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";

interface Quota {
  monthlyQuota?: number;
  purchased?: number;
  quotaGB?: number;
  used?: number;
  usedGB?: number;
  utilizationPercent: number;
}
interface Subscription {
  hasSubscription: boolean;
  instituteId: string;
  planTier?: string;
  billingCycle?: string;
  status?: string;
  pricePerMonthCents?: number;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  seats?: Quota;
  voiceMinutes?: Quota;
  candidateEvaluations?: Quota;
  videoStorage?: Quota;
}
interface Statement {
  invoiceId: string;
  invoiceNumber: string;
  billingPeriod: string;
  totalCents: number;
  status: string;
  createdAt: string;
}
interface StatementDetail extends Statement {
  lineItems: { description: string; quantity: number; unitPriceCents: number; totalCents: number }[];
}

const PLANS = [
  { id: "UniversityStandard", label: "University Standard", price: 249, seats: 20 },
  { id: "UniversityEnterprise", label: "University Enterprise", price: 499, seats: 50 },
  { id: "CorporateScale", label: "Corporate Scale", price: 999, seats: 100 },
  { id: "CorporateCustom", label: "Corporate Custom", price: 1999, seats: 250 },
];
const usd = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const planLabel = (id?: string) => PLANS.find((p) => p.id === id)?.label ?? id ?? "";
const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";

export default function InstituteBillingPage() {
  const { apiFetch, ready, access, roles } = useLegacyApi();
  const isSuper = roles.includes("SuperAdmin");
  const [sub, setSub] = useState<Subscription | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [open, setOpen] = useState<StatementDetail | null>(null);
  const [tier, setTier] = useState("UniversityEnterprise");
  const [cycle, setCycle] = useState("Monthly");
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, i] = await Promise.all([apiFetch("/api/billing/enterprise/subscription"), apiFetch("/api/billing/enterprise/invoices", {}, { quiet: true })]);
      if (!s.ok) return setFailed(true);
      const data = (await s.json()) as Subscription;
      setSub(data);
      if (data.planTier) setTier(data.planTier);
      if (data.billingCycle) setCycle(data.billingCycle);
      if (i.ok) setStatements((await i.json()) as Statement[]);
    } catch {
      setFailed(true);
    }
  }, [apiFetch]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  const setPlan = async () => {
    const res = await apiFetch("/api/billing/enterprise/subscription/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planTier: tier, billingCycle: cycle, seats: PLANS.find((p) => p.id === tier)?.seats ?? 50 }),
    });
    setMessage(res.ok ? "Plan saved." : "The plan couldn't be saved.");
    if (res.ok) await load();
  };

  const makeStatement = async () => {
    const res = await apiFetch("/api/billing/enterprise/invoices/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingPeriod: new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }) }),
    });
    setMessage(res.ok ? "Draft statement created." : "The statement couldn't be created.");
    if (res.ok) await load();
  };

  const openStatement = async (id: string) => {
    const res = await apiFetch(`/api/billing/enterprise/invoices/${id}`);
    if (res.ok) setOpen((await res.json()) as StatementDetail);
  };

  if (access) return <AccessNotice problem={access} feature="Billing" />;
  if (failed)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">We couldn&apos;t load billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh the page to try again.</p>
      </main>
    );
  if (!sub)
    return (
      <main className="mx-auto max-w-5xl px-4 py-10" aria-busy="true" aria-label="Loading billing">
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const meters: [string, Quota | undefined, (q: Quota) => string][] = [
    ["Seats", sub.seats, (q) => `${q.used ?? 0} of ${q.purchased ?? 0}`],
    ["Voice minutes this month", sub.voiceMinutes, (q) => `${q.used ?? 0} of ${q.monthlyQuota ?? 0}`],
    ["Candidate evaluations this month", sub.candidateEvaluations, (q) => `${q.used ?? 0} of ${q.monthlyQuota ?? 0}`],
    ["Video storage", sub.videoStorage, (q) => `${q.usedGB ?? 0} of ${q.quotaGB ?? 0} GB`],
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-8 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Plan and billing</h1>
        <Link href="/partner/dashboard" className="text-sm font-medium text-indigo-700 hover:underline dark:text-indigo-300">
          Back to the dashboard
        </Link>
      </header>

      {!sub.hasSubscription ? (
        <section className={`${card} p-6`}>
          <h2 className="text-base font-semibold">No enterprise plan yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Enterprise plans are set up with the Edulexa team. Once your plan is active, its seats, usage and statements appear here.
          </p>
        </section>
      ) : (
        <section className={`${card} p-6`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Current plan</p>
              <h2 className="text-xl font-semibold">{planLabel(sub.planTier)}</h2>
              <p className="text-sm text-muted-foreground">
                {usd(sub.pricePerMonthCents ?? 0)} a month, billed {sub.billingCycle?.toLowerCase()} · {(sub.status ?? "").replace(/([a-z])([A-Z])/g, "$1 $2")}
              </p>
            </div>
            {sub.currentPeriodEnd && <p className="text-sm text-muted-foreground">Current period ends {new Date(sub.currentPeriodEnd).toLocaleDateString()}</p>}
          </div>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {meters.map(([label, q, text]) =>
              q ? (
                <li key={label}>
                  <div className="flex justify-between text-sm">
                    <span>{label}</span>
                    <span className="tabular-nums text-muted-foreground">{text(q)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className={`h-full ${q.utilizationPercent > 100 ? "bg-red-500" : "bg-indigo-600"}`} style={{ width: `${Math.min(100, q.utilizationPercent)}%` }} />
                  </div>
                </li>
              ) : null,
            )}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">Usage as recorded for this period.</p>
        </section>
      )}

      {isSuper && (
        <section className={`${card} p-6`}>
          <h2 className="text-base font-semibold">Set the plan (Edulexa staff)</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="font-medium">Plan</span>
              <select value={tier} onChange={(e) => setTier(e.target.value)} className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm">
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label} (${p.price} a month, {p.seats} seats)
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="font-medium">Billing</span>
              <select value={cycle} onChange={(e) => setCycle(e.target.value)} className="mt-1 block rounded-xl border border-border bg-background px-3 py-2 text-sm">
                <option value="Monthly">Monthly</option>
                <option value="Annual">Annual</option>
              </select>
            </label>
            <button type="button" onClick={() => void setPlan()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              Save plan
            </button>
            {sub.hasSubscription && (
              <button type="button" onClick={() => void makeStatement()} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted">
                Create this month&apos;s statement
              </button>
            )}
          </div>
        </section>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}

      <section aria-labelledby="bl-statements" className={`${card} overflow-hidden`}>
        <div className="p-5">
          <h2 id="bl-statements" className="text-base font-semibold">
            Statements
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Usage statements in US dollars. They are not tax invoices; tax is handled when a payment is arranged.</p>
        </div>
        {statements.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">No statements yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-y border-border text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3 font-medium">Statement</th>
                <th className="p-3 font-medium">Period</th>
                <th className="p-3 text-right font-medium">Amount</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {statements.map((st) => (
                <tr key={st.invoiceId}>
                  <td className="p-3 font-mono text-xs">{st.invoiceNumber}</td>
                  <td className="p-3">{st.billingPeriod}</td>
                  <td className="p-3 text-right tabular-nums">{usd(st.totalCents)}</td>
                  <td className="p-3">{st.status === "Draft" ? "Draft, unpaid" : st.status.replace(/([a-z])([A-Z])/g, "$1 $2")}</td>
                  <td className="p-3 text-right">
                    <button type="button" onClick={() => void openStatement(st.invoiceId)} className="text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {open && (
        <section aria-labelledby="bl-detail" className={`${card} p-5`}>
          <div className="flex items-start justify-between gap-3">
            <h2 id="bl-detail" className="text-base font-semibold">
              {open.invoiceNumber} · {open.billingPeriod}
            </h2>
            <button type="button" onClick={() => setOpen(null)} className="text-sm text-muted-foreground hover:text-foreground">
              Close
            </button>
          </div>
          <table className="mt-3 w-full text-sm">
            <tbody className="divide-y divide-border">
              {open.lineItems.map((li, i) => (
                <tr key={i}>
                  <td className="py-2">{li.description}</td>
                  <td className="py-2 text-right tabular-nums">{usd(li.totalCents)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2">Total (before any tax)</td>
                <td className="py-2 text-right tabular-nums">{usd(open.lineItems.reduce((n, li) => n + li.totalCents, 0))}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

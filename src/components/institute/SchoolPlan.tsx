"use client";

/**
 * A self-serve school's plan (S2): the shape the API returns, how to say its state in words, and the banner the institute
 * pages show its administrators when the trial ends soon, a payment failed, or the school is read-only.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, Info } from "lucide-react";
import { useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";

export interface PlanOption {
  key: string;
  name: string;
  summary: string;
  includes: string[];
  monthMinor: number;
  yearMinor: number;
}

export interface SchoolPlanState {
  managed: boolean;
  plan: string;
  interval: "month" | "year";
  currency: "USD" | "INR";
  status: "Trialing" | "Active" | "PastDue" | "ReadOnly" | "Deleted";
  provider: "stripe" | "razorpay";
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  readOnlySince: string | null;
  deleteAfter: string | null;
  readOnlyReason: string | null;
  team: { used: number; limit: number | null };
  voice: { used: number; limit: number; periodStart: string };
  portal: boolean;
  canResume: boolean;
  plans: PlanOption[];
}

export const day = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) : "");
export const money = (minor: number, currency: string) =>
  new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: minor % 100 === 0 ? 0 : 2 }).format(minor / 100);
const daysLeft = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export const REASONS: Record<string, string> = {
  Cancelled: "the plan was cancelled",
  PaymentFailed: "the payment for the plan didn't go through",
  Suspended: "Edulexa's team suspended it",
  TrialEnded: "the free trial ended without a payment",
};

/** The banner over the institute pages (administrators only; nothing for managed schools or a plan running normally) */
export function SchoolPlanBanner() {
  const { getToken, isSignedIn, roles } = useAppAuth();
  const [s, setS] = useState<SchoolPlanState | null>(null);
  const admin = roles.includes("InstituteAdmin");
  // The Billing page says all of this itself; leaving it (after paying, say) checks the plan again
  const pathname = usePathname();
  const onBilling = pathname === "/institute/billing";

  useEffect(() => {
    if (!isSignedIn || !admin) return;
    let live = true;
    authenticatedFetch("/api/school-billing", {}, getToken)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => live && setS(b))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isSignedIn, admin, getToken, pathname]);

  if (!s || s.managed || onBilling) return null;
  let tone: "info" | "warn" | "error" | null = null;
  let text = "";
  if (s.status === "ReadOnly") {
    tone = "error";
    text = `Your school is read-only because ${REASONS[s.readOnlyReason ?? ""] ?? "its plan isn't paid"}. You can still see and export everything until ${day(s.deleteAfter)}; then its data is deleted.`;
  } else if (s.status === "PastDue") {
    tone = "warn";
    text = "The last payment for your plan didn't go through. Update your payment method in Billing so your school stays open.";
  } else if (s.status === "Trialing" && daysLeft(s.trialEndsAt) <= 7) {
    tone = "info";
    text = s.cancelAtPeriodEnd
      ? `Your free trial ends on ${day(s.trialEndsAt)}. You cancelled, so your school becomes read-only then.`
      : `Your free trial ends on ${day(s.trialEndsAt)}. Your ${s.plan} plan starts then.`;
  }
  if (!tone) return null;
  const styles = {
    info: "border-indigo-200 bg-indigo-50 text-indigo-950 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100",
    warn: "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    error: "border-red-300 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100",
  }[tone];
  const Icon = tone === "info" ? Info : AlertTriangle;
  return (
    <div role={tone === "info" ? "status" : "alert"} className={`mx-auto mb-4 flex max-w-7xl flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 text-sm ${styles}`}>
      <span className="flex items-start gap-2">
        <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        {text}
      </span>
      <Link href="/institute/billing" className="font-semibold underline underline-offset-2">
        {s.status === "ReadOnly" ? "Choose a plan" : "Billing"}
      </Link>
    </div>
  );
}

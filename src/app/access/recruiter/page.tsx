"use client";

/**
 * Ask for recruiter access. Signing up makes everyone a student; employers and recruiters ask here and a platform
 * administrator approves them (backend /api/access-requests/recruiter). Non-recruiters opening /recruiter land here.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle } from "lucide-react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useLatestRef } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, PageHeader, brandFill, buttonClass } from "@/components/career/ui";

type Request = {
  id: string;
  company: string;
  status: "pending" | "approved" | "rejected";
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-600/20";

export default function RecruiterAccessPage() {
  const en = useEn();
  const { getToken, isLoaded, isSignedIn, roles } = useAuth();
  const [state, setState] = useState<{ hasRole: boolean; granted: boolean; request: Request | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ company: "", website: "", jobTitle: "", message: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authenticatedFetch("/api/access-requests/recruiter", {}, getToken);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "We couldn't load your request. Please try again.");
      setState(data);
    } catch (e) {
      setError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    }
  }, [getToken]);

  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (isLoaded && isSignedIn) void loadRef.current();
  }, [isLoaded, isSignedIn, loadRef]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        "/api/access-requests/recruiter",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) },
        getToken
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "We couldn't send your request. Please try again.");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="space-y-6">
      <PageHeader title={en("Recruiter access")} description={en("For employers who want to review candidates and their verified work.")} />

      {!isSignedIn ? (
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm shadow-sm">
          <p>{en("First create a free Edulexa account (or sign in), then come back to this page to ask for recruiter access.")}</p>
          <Link href="/login?redirect_url=%2Faccess%2Frecruiter" className={buttonClass("primary")} style={brandFill}>
            {en("Sign in or create an account")}
          </Link>
        </div>
      ) : state === null && !error ? (
        <p className="text-sm text-muted-foreground">{en("Loading…")}</p>
      ) : state?.hasRole || roles.includes("Recruiter") ? (
        <Status icon={CheckCircle2} tone="emerald" title={en("You have recruiter access")}>
          <Link href="/recruiter/dashboard" className="font-medium text-indigo-700 underline dark:text-indigo-300">
            {en("Open the recruiter portal")}
          </Link>
        </Status>
      ) : state?.request?.status === "pending" ? (
        <Status icon={Clock} tone="amber" title={en("Your request is waiting for a decision")}>
          {en("We'll e-mail you when it's decided. Request for {company}, sent {date}.", { company: state.request.company, date: new Date(state.request.createdAt).toLocaleDateString() })}</Status>
      ) : state?.request?.status === "approved" && state.granted ? (
        <Status icon={CheckCircle2} tone="emerald" title={en("Your request was approved")}>
          {en("Sign out and sign in again to start using the recruiter portal.")}
        </Status>
      ) : (
        <>
          {state?.request?.status === "approved" && !state.granted && (
            <Status icon={XCircle} tone="amber" title={en("Your recruiter access was removed")}>
              {en("If you still need it, send a new request.")}
            </Status>
          )}
          {state?.request?.status === "rejected" && (
            <Status icon={XCircle} tone="red" title={en("Your last request wasn't approved")}>
              {state.request.decisionNote ?? "You can send a new request with more detail about your company."}
            </Status>
          )}
          <form onSubmit={submit} className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:grid-cols-2" aria-label={en("Ask for recruiter access")}>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{en("Company")}</span>
              <input required minLength={2} maxLength={200} className={input} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{en("Company website")}</span>
              <input type="url" maxLength={300} placeholder="https://" className={input} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">{en("Your job title")}</span>
              <input maxLength={120} className={input} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">{en("What are you hiring for? (optional)")}</span>
              <textarea rows={3} maxLength={1000} className={input} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </label>
            <p className="text-xs text-muted-foreground sm:col-span-2">{en("Requests from a company e-mail address are approved faster. We check every request before giving access to candidate data.")}</p>
            <Button type="submit" busy={busy} className="justify-self-start sm:col-span-2">
              {busy ? en("Sending…") : en("Send request")}
            </Button>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function Status({ icon: Icon, tone, title, children }: { icon: React.ElementType; tone: "emerald" | "amber" | "red"; title: string; children: React.ReactNode }) {
  const colors = { emerald: "border-emerald-500/30 bg-emerald-500/5", amber: "border-amber-500/30 bg-amber-500/5", red: "border-red-500/30 bg-red-500/5" }[tone];
  return (
    <div className={`flex gap-3 rounded-lg border p-4 text-sm ${colors}`} role="status">
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

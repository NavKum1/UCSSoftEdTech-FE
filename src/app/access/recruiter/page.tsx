"use client";

/**
 * Ask for recruiter access. Signing up makes everyone a student; employers and recruiters ask here and a platform
 * administrator approves them (backend /api/access-requests/recruiter). Non-recruiters opening /recruiter land here.
 */

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useLatestRef } from "@/lib/legacyApi";

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
    <main className="mx-auto max-w-xl space-y-6 px-4 py-10">
      <div className="flex items-center gap-3">
        <span className="rounded-xl bg-indigo-600 p-2 text-white">
          <Briefcase aria-hidden="true" className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold">Recruiter access</h1>
          <p className="text-sm text-muted-foreground">For employers who want to review candidates and their verified work.</p>
        </div>
      </div>

      {!isSignedIn ? (
        <div className="space-y-3 rounded-2xl border border-border p-5 text-sm">
          <p>First create a free Edulexa account (or sign in), then come back to this page to ask for recruiter access.</p>
          <Link href="/login?redirect_url=%2Faccess%2Frecruiter" className="inline-flex rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700">
            Sign in or create an account
          </Link>
        </div>
      ) : state === null && !error ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : state?.hasRole || roles.includes("Recruiter") ? (
        <Status icon={CheckCircle2} tone="emerald" title="You have recruiter access">
          <Link href="/recruiter/dashboard" className="font-medium text-indigo-700 underline dark:text-indigo-300">
            Open the recruiter portal
          </Link>
        </Status>
      ) : state?.request?.status === "pending" ? (
        <Status icon={Clock} tone="amber" title="Your request is waiting for a decision">
          We&apos;ll e-mail you when it&apos;s decided. Request for {state.request.company}, sent {new Date(state.request.createdAt).toLocaleDateString()}.
        </Status>
      ) : state?.request?.status === "approved" && state.granted ? (
        <Status icon={CheckCircle2} tone="emerald" title="Your request was approved">
          Sign out and sign in again to start using the recruiter portal.
        </Status>
      ) : (
        <>
          {state?.request?.status === "approved" && !state.granted && (
            <Status icon={XCircle} tone="amber" title="Your recruiter access was removed">
              If you still need it, send a new request.
            </Status>
          )}
          {state?.request?.status === "rejected" && (
            <Status icon={XCircle} tone="red" title="Your last request wasn't approved">
              {state.request.decisionNote ?? "You can send a new request with more detail about your company."}
            </Status>
          )}
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-5" aria-label="Ask for recruiter access">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Company</span>
              <input required minLength={2} maxLength={200} className={input} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Company website</span>
              <input type="url" maxLength={300} placeholder="https://" className={input} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Your job title</span>
              <input maxLength={120} className={input} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">What are you hiring for? (optional)</span>
              <textarea rows={3} maxLength={1000} className={input} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </label>
            <p className="text-xs text-muted-foreground">Requests from a company e-mail address are approved faster. We check every request before giving access to candidate data.</p>
            <button type="submit" disabled={busy} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {busy ? "Sending…" : "Send request"}
            </button>
          </form>
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </p>
      )}
    </main>
  );
}

function Status({ icon: Icon, tone, title, children }: { icon: React.ElementType; tone: "emerald" | "amber" | "red"; title: string; children: React.ReactNode }) {
  const colors = { emerald: "border-emerald-500/30 bg-emerald-500/5", amber: "border-amber-500/30 bg-amber-500/5", red: "border-red-500/30 bg-red-500/5" }[tone];
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 text-sm ${colors}`} role="status">
      <Icon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="font-medium">{title}</p>
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

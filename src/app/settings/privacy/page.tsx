"use client";

import React, { useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { AlertTriangle, CheckCircle2, Download, Loader2, Lock, Trash2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { errorMessage } from "@/lib/candidateExperience";
import SignInRequired from "@/components/SignInRequired";

const CONFIRM = "DELETE MY DATA";

interface EraseResult {
  erased: boolean;
  referralProvidersNotified: number;
  deleted: Record<string, number>;
  changed: Record<string, number>;
  keptDeidentified: { submissions: number; description: string };
  notDeleted: string[];
}

const DELETED = [
  "Editor activity recordings (keystroke and edit telemetry) and AI-assistant conversations",
  "Interview transcripts and links to voice recordings",
  "Voluntary self-identification (demographic) answers",
  "Sentiment-coaching data",
  "GitHub repository defenses, résumés and language preferences",
  "Course referrals (providers are told to stop contact and delete your data)",
  "Personalised feedback, accommodation requests and written-defense answers",
];

const ANONYMISED = [
  "Your name becomes “Deleted user” and your email is replaced; your country and GitHub login are removed",
  "Credentials you earned are revoked (verification links show them as revoked)",
  "The text of your appeals is removed; their outcome stays with the employer's decision record",
];

const KEPT = [
  "Submitted code, test results and defense scores",
  "Integrity analyses and employers' human decisions (with their rationale)",
];

export default function PrivacySettingsPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [result, setResult] = useState<EraseResult | null>(null);

  const downloadExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await authenticatedFetch("/api/me/export", {}, getToken);
      if (!res.ok) {
        setExportError(await errorMessage(res, "Could not prepare your export"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edulexa-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError("Network error while preparing your export.");
    } finally {
      setExporting(false);
    }
  };

  const erase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirm !== CONFIRM) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await authenticatedFetch("/api/me", { method: "DELETE", body: JSON.stringify({ confirm }) }, getToken);
      if (!res.ok) {
        setDeleteError(await errorMessage(res, "Could not delete your data"));
        return;
      }
      setResult((await res.json()) as EraseResult);
      setConfirm("");
    } catch {
      setDeleteError("Network error while deleting your data. The deletion may or may not have completed; try again (it is safe to repeat).");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title="Privacy and your data" message="Sign in to export or delete your data." />
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Lock className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
            Privacy and your data
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Download a copy of your data, or delete it. These are your rights under data-protection laws such as the GDPR and
            India&apos;s DPDP Act.
          </p>
        </div>

        <section className="glass-panel rounded-2xl p-5 border border-border space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Export your data
          </h2>
          <p className="text-xs text-muted-foreground">
            A JSON file with your profile, assessment attempts and editor activity, AI-assistant conversations, submissions, interviews
            and transcripts, evaluations, credentials, referrals, repository defenses, self-identification answers, appeals,
            accommodations and sentiment-coaching data. Integrity-analysis details and reviewers&apos; internal rationale are not
            included in the self-service export; the file explains why and how to request them.
          </p>
          <button
            onClick={downloadExport}
            disabled={exporting}
            className="py-2 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download my data (JSON)
          </button>
          {exportError && <p className="text-xs text-rose-700 dark:text-rose-400">{exportError}</p>}
        </section>

        <section className="glass-panel rounded-2xl p-5 border border-rose-500/30 space-y-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Delete my data
          </h2>

          {result ? (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" /> Your data has been deleted and your account anonymised.
              </p>
              <ul className="text-xs text-muted-foreground list-disc ml-5 space-y-0.5">
                {Object.entries(result.deleted)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => (
                    <li key={k}>{k}: {n} deleted</li>
                  ))}
                {Object.entries(result.changed)
                  .filter(([, n]) => n > 0)
                  .map(([k, n]) => (
                    <li key={k}>{k}: {n}</li>
                  ))}
                {result.referralProvidersNotified > 0 && <li>Course providers notified: {result.referralProvidersNotified}</li>}
              </ul>
              <p className="text-xs text-foreground">{result.keptDeidentified.description}</p>
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Not covered by this deletion:</p>
                <ul className="list-disc ml-5 mt-1 space-y-0.5">
                  {result.notDeleted.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
              <button
                onClick={() => signOut({ redirectUrl: "/" })}
                className="py-2 px-4 rounded-xl bg-card hover:bg-muted border border-border text-sm font-semibold text-foreground cursor-pointer"
              >
                Sign out
              </button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 text-xs">
                <div>
                  <p className="font-semibold text-foreground">Deleted</p>
                  <ul className="list-disc ml-5 mt-1 space-y-0.5 text-muted-foreground">
                    {DELETED.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Anonymised</p>
                  <ul className="list-disc ml-5 mt-1 space-y-0.5 text-muted-foreground">
                    {ANONYMISED.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Kept, de-identified</p>
                  <ul className="list-disc ml-5 mt-1 space-y-0.5 text-muted-foreground">
                    {KEPT.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                  <p className="mt-1 text-muted-foreground">
                    Employers must be able to show how past hiring decisions were made, so these records stay, linked only to an
                    anonymised account with no name, email, country or GitHub login.
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-foreground flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  This cannot be undone. Download your data first if you want a copy. Your sign-in account with our identity provider is
                  separate: delete it from your account settings too, otherwise signing in again reconnects to the anonymised record.
                </span>
              </div>

              <form onSubmit={erase} className="space-y-2">
                <label htmlFor="confirm" className="text-xs font-semibold text-foreground">
                  Type <span className="font-mono">{CONFIRM}</span> to confirm
                </label>
                <input
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground font-mono"
                />
                <button
                  type="submit"
                  disabled={deleting || confirm !== CONFIRM}
                  className="py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Delete my data
                </button>
                {deleteError && <p className="text-xs text-rose-700 dark:text-rose-400">{deleteError}</p>}
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { endDevSession, getDevSession } from "@/lib/devSession";
import { AlertTriangle, CheckCircle2, Download, Trash2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { errorMessage } from "@/lib/candidateExperience";
import SignInRequired from "@/components/SignInRequired";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, PageHeader } from "@/components/career/ui";

const CONFIRM = "DELETE MY DATA";

interface EraseResult {
  erased: boolean;
  referralProvidersNotified: number;
  deleted: Record<string, number>;
  changed: Record<string, number>;
  keptDeidentified: { submissions: number; description: string };
  notDeleted: string[];
  /** Schools that got an erasure request for the records they hold (docs/data_rights_groups_nov2026.md) */
  sentToSchools?: { instituteId: string; school: string; records: string }[];
}

const DELETED = [
  "Editor activity recordings (keystroke and edit telemetry) and AI-assistant conversations",
  "Interview transcripts and links to voice recordings",
  "Voluntary self-identification (demographic) answers",
  "Speaking-practice measurements (pace, filler words, pauses)",
  "GitHub repository defenses, résumés and language preferences",
  "Course referrals (providers are told to stop contact and delete your data)",
  "Personalised feedback, accommodation requests and written-defense answers", // en() where shown
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

// Records others are responsible for, or the law requires us to keep (owner's rule of 9 Nov 2026)
const ELSEWHERE = [
  "Records a school holds about you (class work, class rosters, proctoring, LMS links): we send your school an erasure request, and the school decides",
  "Records the law or security requires us to keep (access changes, call consents, tax records for mentor payouts): kept without your name and email until their time limit",
];

export default function PrivacySettingsPage() {
  const en = useEn();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  // After erasure: end the session (Keycloak signs out everywhere; a local dev session just ends)
  const signOut = () => {
    if (getDevSession()) {
      endDevSession();
      window.location.replace("/");
    } else window.location.replace("/api/auth/federated-logout");
  };
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
      setExportError("We couldn't reach the server while preparing your export. Please check your connection and try again.");
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
      setDeleteError("We couldn't reach the server while deleting your data. The deletion may or may not have completed; try again (it is safe to repeat).");
    } finally {
      setDeleting(false);
    }
  };

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title={en("Privacy and your data")} message="Sign in to export or delete your data." />
    );
  }

  return (
    <div className="text-foreground">
      <div className="space-y-6">
        <PageHeader
          title={en("Privacy and your data")}
          description={en("Download a copy of your data, or delete it. These are your rights under data-protection laws such as the CCPA in California, the GDPR in Europe and India's DPDP Act.")}
        />

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Download className="w-4 h-4 text-muted-foreground" />{en(" Export your data")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {en("A JSON file with your profile, assessment attempts and editor activity, AI-assistant conversations, submissions, interviews and transcripts, evaluations, credentials, referrals, repository defenses, self-identification answers, appeals, accommodations and speaking-practice measurements, your other practice and activity, and the records schools, employers and the law keep about you. Integrity-analysis details and reviewers' internal rationale are not included in the self-service export; the file explains why and how to request them.")}
          </p>
          <Button onClick={downloadExport} busy={exporting}>
            {!exporting && <Download className="w-4 h-4" />}
            {en("Download my data (JSON)")}
          </Button>
          {exportError && <p className="text-xs text-rose-700 dark:text-rose-400">{exportError}</p>}
        </section>

        <section className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />{en(" Delete my data")}
          </h2>

          {result ? (
            <div className="space-y-3 text-sm">
              <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4" />{en(" Your data has been deleted and your account anonymised.")}
              </p>
              <ul className="text-xs text-muted-foreground list-disc ms-5 space-y-0.5">
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
                {result.referralProvidersNotified > 0 && <li>{en("Course providers notified: {referralProvidersNotified}", { referralProvidersNotified: result.referralProvidersNotified })}</li>}
              </ul>
              <p className="text-xs text-foreground">{result.keptDeidentified.description}</p>
              {(result.sentToSchools ?? []).length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">{en("Sent to your schools:")}</p>
                  <ul className="list-disc ms-5 mt-1 space-y-0.5">
                    {result.sentToSchools!.map((s) => (
                      <li key={s.instituteId}>
                        {en("{school} got an erasure request for: {records}. The school decides, usually within the time its privacy notice gives.", { school: s.school, records: s.records })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">{en("Not covered by this deletion:")}</p>
                <ul className="list-disc ms-5 mt-1 space-y-0.5">
                  {result.notDeleted.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
              <Button variant="secondary" onClick={signOut}>
                {en("Sign out")}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid gap-3 text-xs md:grid-cols-3">
                <div>
                  <p className="font-semibold text-foreground">{en("Deleted")}</p>
                  <ul className="list-disc ms-5 mt-1 space-y-0.5 text-muted-foreground">
                    {DELETED.map((d) => <li key={d}>{en(d)}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{en("Anonymised")}</p>
                  <ul className="list-disc ms-5 mt-1 space-y-0.5 text-muted-foreground">
                    {ANONYMISED.map((d) => <li key={d}>{en(d)}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">{en("Kept, de-identified")}</p>
                  <ul className="list-disc ms-5 mt-1 space-y-0.5 text-muted-foreground">
                    {KEPT.map((d) => <li key={d}>{en(d)}</li>)}
                  </ul>
                  <p className="mt-1 text-muted-foreground">
                    {en("Employers must be able to show how past hiring decisions were made, so these records stay, linked only to an anonymised account with no name, email, country or GitHub login.")}
                  </p>
                </div>
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">{en("Handled by others, or kept by law")}</p>
                <ul className="list-disc ms-5 mt-1 space-y-0.5 text-muted-foreground">
                  {ELSEWHERE.map((d) => <li key={d}>{en(d)}</li>)}
                </ul>
              </div>

              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 flex gap-2 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>
                  {en("This cannot be undone. Download your data first if you want a copy. Your sign-in account with our identity provider is separate: delete it from your account settings too, otherwise signing in again reconnects to the anonymised record.")}
                </span>
              </div>

              <form onSubmit={erase} className="space-y-2">
                <label htmlFor="confirm" className="block text-sm font-medium text-foreground">
                  {en("Type ")}<span className="font-mono">{CONFIRM}</span>{en(" to confirm")}
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  id="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="off"
                  className="w-full sm:max-w-md px-3 py-2 rounded-lg border border-border bg-card shadow-sm text-sm text-foreground font-mono"
                />
                <Button type="submit" variant="danger" busy={deleting} disabled={confirm !== CONFIRM}>
                  {!deleting && <Trash2 className="w-4 h-4" />}
                  {en("Delete my data")}
                </Button>
                </div>
                {deleteError && <p className="text-xs text-rose-700 dark:text-rose-400">{deleteError}</p>}
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

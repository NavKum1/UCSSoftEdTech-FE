"use client";

/**
 * Platform admin: Email and uploads (plan item A7, 1 Nov 2026). The email provider, key and sender (what is saved here
 * wins over the server file; the key is never shown again), a test send and the last failure; and the virus check on
 * uploads: whether it answers, its background check of stored files, and the files it refused or removed.
 */
import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Mail, Send, ShieldCheck } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";

interface EmailState {
  working: boolean;
  providers: string[];
  effective: { provider: string; fromEmail: string; fromName: string; providerSource: string; keySource: string; fromSource: string };
  page: { provider: string | null; fromEmail: string | null; fromName: string | null; hasKey: boolean } | null;
  server: { provider: string | null; fromEmail: string | null; fromName: string | null; hasKey: boolean };
  changedAt: string | null;
  changedBy: string | null;
  lastFailure: { at: string; message: string } | null;
}

interface UploadsState {
  enabled: boolean;
  scannerUp: boolean;
  version: string | null;
  stored: { since: string; done: boolean; checked: number; removed: number } | null;
  records: { source: string; action: string; fileName: string; signature: string; instituteId: string | null; at: string }[];
}

// en() where shown
const SOURCE_NAMES: Record<string, string> = { career: "Career centre files", guidance: "Guidance form uploads", crm: "CRM email attachments", branding: "School logos" };
const card = "rounded-2xl border border-border bg-card p-5";
const input = "mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const button = "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium disabled:opacity-50";

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const from = (source: string) => (source === "page" ? "saved on this page" : source === "server" ? "from the server file" : "default");

export default function PlatformSettingsPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [email, setEmail] = useState<EmailState | null>(null);
  const [uploads, setUploads] = useState<UploadsState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ provider: "", fromEmail: "", fromName: "", apiKey: "" });
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [testTo, setTestTo] = useState("");

  const showEmail = (d: EmailState) => {
    setEmail(d);
    setForm({ provider: d.page?.provider ?? "", fromEmail: d.page?.fromEmail ?? "", fromName: d.page?.fromName ?? "", apiKey: "" });
  };

  const load = async () => {
    const [e, u] = await Promise.all([apiFetch("/api/admin/platform/email"), apiFetch("/api/admin/platform/uploads")]);
    if (!e.ok || !u.ok) return setError("The settings couldn't be loaded. Please try again.");
    showEmail(await e.json());
    setUploads(await u.json());
  };
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  if (access) return <AccessNotice problem={access} feature="platform settings" />;

  const save = async (extra: { removeKey?: boolean } = {}) => {
    setBusy("save");
    setMessage(null);
    const res = await apiFetch("/api/admin/platform/email", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, apiKey: form.apiKey.trim() || null, ...extra }),
    });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) return setMessage({ ok: false, text: d?.error ?? "The settings couldn't be saved." });
    showEmail(d);
    setMessage({ ok: true, text: extra.removeKey ? "The saved key was removed." : "Saved." });
  };

  const reset = async () => {
    setBusy("reset");
    setMessage(null);
    const res = await apiFetch("/api/admin/platform/email", { method: "DELETE" });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) return setMessage({ ok: false, text: "The settings couldn't be removed." });
    showEmail(d);
    setMessage({ ok: true, text: "Removed: the server file's settings are used." });
  };

  const test = async () => {
    setBusy("test");
    setMessage(null);
    const res = await apiFetch("/api/admin/platform/email/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: testTo }) });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) return setMessage({ ok: false, text: d?.error ?? "The test couldn't be sent." });
    setMessage(d.sent ? { ok: true, text: `Test email sent to ${testTo}. Check that inbox (and its spam folder).` } : { ok: false, text: d.error ?? "The test wasn't sent." });
    void load();
  };

  const keyPlaceholder = !email
    ? ""
    : email.page?.hasKey
      ? "A key is saved here. Type a new one to replace it."
      : email.server.hasKey
        ? "The server file's key is used. Type one to use it instead."
        : "Paste the API key from your email provider";

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Email and uploads</h1>
        <p className="mt-1 text-sm text-muted-foreground">How this region sends email, and the virus check on files people upload.</p>
      </div>

      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-800 dark:text-red-300">{error}</p>}
      {!email && !error && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> Loading…
        </p>
      )}

      {email && (
        <section aria-labelledby="email-title" className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="email-title" className="flex items-center gap-2 text-lg font-semibold">
              <Mail aria-hidden="true" className="h-5 w-5" /> Email
            </h2>
            {email.working ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> Set up
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-300">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> Not set up
              </span>
            )}
          </div>
          {!email.working && (
            <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-900 dark:text-red-200">
              Email isn&apos;t set up, so no email is being sent: no confirmations, results or messages. Add your provider&apos;s API key below.
            </p>
          )}
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Sending with</dt>
              <dd>
                {email.effective.provider} <span className="text-muted-foreground">({from(email.effective.providerSource)})</span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">API key</dt>
              <dd>{email.effective.keySource === "none" ? "none yet" : from(email.effective.keySource)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sender</dt>
              <dd className="wrap-anywhere">
                {email.effective.fromName} &lt;{email.effective.fromEmail}&gt; <span className="text-muted-foreground">({from(email.effective.fromSource)})</span>
              </dd>
            </div>
            {email.changedAt && (
              <div>
                <dt className="text-muted-foreground">Last changed here</dt>
                <dd>
                  {when(email.changedAt)}
                  {email.changedBy ? ` by ${email.changedBy}` : ""}
                </dd>
              </div>
            )}
          </dl>
          {email.lastFailure && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
              <span className="font-medium">Last failure, {when(email.lastFailure.at)}:</span> <span className="break-words">{email.lastFailure.message}</span>
            </p>
          )}

          <form
            className="mt-5 space-y-3 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <p className="text-sm text-muted-foreground">What you save here is used instead of the server file. Leave a field empty to use the server file&apos;s.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Provider
                <select className={input} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                  <option value="">From the server file ({email.server.provider ?? "Resend"})</option>
                  {email.providers.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium">
                API key
                <input
                  type="password"
                  autoComplete="off"
                  className={input}
                  value={form.apiKey}
                  placeholder={keyPlaceholder}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                />
              </label>
              <label className="block text-sm font-medium">
                Sender address
                <input
                  type="email"
                  className={input}
                  value={form.fromEmail}
                  placeholder={email.server.fromEmail ? `From the server file: ${email.server.fromEmail}` : "no-reply@your-domain.com"}
                  onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
                />
                <span className="mt-1 block text-xs font-normal text-muted-foreground">On a domain you&apos;ve verified with the provider.</span>
              </label>
              <label className="block text-sm font-medium">
                Sender name
                <input
                  className={input}
                  maxLength={100}
                  value={form.fromName}
                  placeholder={email.server.fromName ? `From the server file: ${email.server.fromName}` : "Edulexa"}
                  onChange={(e) => setForm({ ...form, fromName: e.target.value })}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={busy != null} className={`${button} bg-slate-800 text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900`}>
                {busy === "save" && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />} Save
              </button>
              {email.page?.hasKey && (
                <button type="button" disabled={busy != null} onClick={() => void save({ removeKey: true })} className={`${button} border border-border hover:bg-muted`}>
                  Remove the saved key
                </button>
              )}
              {email.page && (
                <button type="button" disabled={busy != null} onClick={() => void reset()} className={`${button} border border-border hover:bg-muted`}>
                  Use the server file only
                </button>
              )}
            </div>
          </form>

          <form
            className="mt-5 flex flex-wrap items-end gap-2 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              void test();
            }}
          >
            <label className="block min-w-60 flex-1 text-sm font-medium">
              Send a test email to
              <input type="email" required className={input} value={testTo} placeholder="you@your-domain.com" onChange={(e) => setTestTo(e.target.value)} />
            </label>
            <button type="submit" disabled={busy != null} className={`${button} border border-border hover:bg-muted`}>
              {busy === "test" ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Send aria-hidden="true" className="h-4 w-4" />} Send test
            </button>
          </form>
          {message && (
            <p role="status" className={`mt-3 text-sm ${message.ok ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>
              {message.text}
            </p>
          )}
        </section>
      )}

      {uploads && (
        <section aria-labelledby="uploads-title" className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="uploads-title" className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck aria-hidden="true" className="h-5 w-5" /> Virus check on uploads
            </h2>
            {!uploads.enabled ? (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">Off</span>
            ) : uploads.scannerUp ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" /> Checking every upload
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-300">
                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" /> Not answering
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {!uploads.enabled && <p>Uploads are not checked for viruses on this server (Uploads:Scan:Mode is Off).</p>}
            {uploads.enabled && !uploads.scannerUp && (
              <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-red-900 dark:text-red-200">
                The virus check isn&apos;t answering, so uploads are refused until it&apos;s back. Right after it first starts it takes a few minutes to download its
                signatures. If it stays down, check the server: docker compose logs clamav.
              </p>
            )}
            {uploads.version && <p className="text-muted-foreground">Scanner: {uploads.version}</p>}
            {uploads.stored && (
              <p>
                {uploads.stored.done && uploads.stored.checked === 0
                  ? "There were no files stored before the check was turned on."
                  : `${uploads.stored.done ? "Files stored before the check was turned on have all been checked" : "Checking the files stored before the check was turned on"}: ${uploads.stored.checked} checked, ${uploads.stored.removed} removed.`}
              </p>
            )}
          </div>
          <h3 className="mt-5 text-sm font-semibold">Files refused or removed</h3>
          {uploads.records.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">None so far.</p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pe-3 font-medium">When</th>
                    <th className="py-2 pe-3 font-medium">What happened</th>
                    <th className="py-2 pe-3 font-medium">Where</th>
                    <th className="py-2 pe-3 font-medium">File</th>
                    <th className="py-2 font-medium">Found</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.records.map((r, i) => (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="py-2 pe-3 whitespace-nowrap">{when(r.at)}</td>
                      <td className="py-2 pe-3">{r.action === "Refused" ? "Refused at upload" : "Removed from storage"}</td>
                      <td className="py-2 pe-3">{en(SOURCE_NAMES[r.source] ?? r.source)}</td>
                      <td className="py-2 pe-3 break-all">{r.fileName || "—"}</td>
                      <td className="py-2 break-all">{r.signature}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

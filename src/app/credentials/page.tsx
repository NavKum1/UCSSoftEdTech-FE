"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import {
  AlertTriangle,
  Award,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  KeyRound,
  Link2,
  Loader2,
  Share2,
  ShieldOff,
  Trash2,
  X,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { formatDate, statusBadgeClass } from "@/lib/credentialVerification";
import SignInRequired from "@/components/SignInRequired";

type GetToken = () => Promise<string | null>;

interface WalletCredential {
  id: string;
  status: string;
  task: { title: string; taskType?: string | null; aiPolicy?: string | null; language?: string | null };
  scores: { testsPassed?: number | null; testsTotal?: number | null; defenseScore: number; defectsFixed?: number; defectsTotal?: number };
  integrity: string;
  humanDecisionAvailable: boolean;
  issuedAt: string;
  validUntil: string;
  revokedAt?: string | null;
  activeShareCount: number;
}

interface WalletResponse {
  signingAvailable: boolean;
  validityMonths: number;
  credentials: WalletCredential[];
}

interface ShareLink {
  shareId: string;
  recipientLabel: string;
  purpose: string;
  includeCode: boolean;
  includeRecording: boolean;
  includeTranscript: boolean;
  includeHumanDecision: boolean;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  status: string;
  viewCount: number;
  lastViewedAt?: string | null;
}

interface ShareView {
  viewedAt: string;
  userAgent: string;
  ipHash: string;
}

interface PendingInvite {
  partnerInterviewId: string;
  sprintTitle: string;
  employer: string;
  invitedAt: string;
}

interface CreatedLink {
  url: string;
  expiresAt: string;
  employer?: string;
}

type Dialog =
  | { kind: "share"; credential: WalletCredential }
  | { kind: "invite"; credential: WalletCredential }
  | { kind: "revoke"; credential: WalletCredential }
  | { kind: "created"; link: CreatedLink }
  | { kind: "clr" };

async function readError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error || "Something went wrong on our side. Please try again in a moment.";
}

async function fetchWallet(getToken: GetToken): Promise<WalletResponse | string> {
  try {
    const res = await authenticatedFetch("/api/credentials/mine", {}, getToken);
    if (!res.ok) return await readError(res);
    return (await res.json()) as WalletResponse;
  } catch {
    return "We couldn't reach the server. Please check your connection and try again.";
  }
}

// Open Badges 3.0 / CLR 2.0 export: saves the server-generated file under the name the server chose
async function saveExport(res: Response): Promise<void> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
    throw new Error(body?.message || body?.error || "We couldn't prepare the download. Please try again.");
  }
  const disposition = res.headers.get("content-disposition") || "";
  const name = /filename*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] || "credential.json";
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = decodeURIComponent(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

interface ExportableResponse {
  credentials: { id: string; title: string; status: string; exportable: boolean }[];
  internships: { id: string; title: string; completedAt?: string | null }[];
}

function ClrDialog({ getToken, onClose, onDone }: { getToken: GetToken; onClose: () => void; onDone: () => void }) {
  const [items, setItems] = useState<ExportableResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [format, setFormat] = useState<"jwt" | "json">("jwt");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    authenticatedFetch("/api/career/openbadges/mine", {}, getToken)
      .then(async (res) => (res.ok ? setItems((await res.json()) as ExportableResponse) : setErr("We couldn't load your items. Please try again.")))
      .catch(() => setErr("We couldn't reach the server. Please check your connection and try again."));
  }, [getToken]);

  const chosen = Object.keys(selected).filter((k) => selected[k]);
  const download = async () => {
    if (!items) return;
    setWorking(true);
    setErr(null);
    try {
      const credentialIds = items.credentials.filter((c) => selected[c.id]).map((c) => c.id);
      const experienceIds = items.internships.filter((x) => selected[x.id]).map((x) => x.id);
      const res = await authenticatedFetch("/api/career/openbadges/clr", { method: "POST", body: JSON.stringify({ credentialIds, experienceIds, format }) }, getToken);
      await saveExport(res);
      onDone();
    } catch (e) {
      setErr(e instanceof Error && !(e instanceof TypeError) ? e.message : "We couldn't download the file. Please try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title="Download a learner record (CLR 2.0)" onClose={onClose}>
      <p className="text-sm text-muted-foreground">Choose what to include. The file is signed so anyone you give it to can check it. Nothing is sent to anyone until you share the file yourself.</p>
      {err && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{err}</p>}
      {!items ? (
        !err && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-muted-foreground mb-1">Credentials and completed internships</legend>
          {items.credentials.map((c) => (
            <Checkbox key={c.id} checked={!!selected[c.id]} disabled={!c.exportable} onChange={(v) => setSelected((s) => ({ ...s, [c.id]: v }))} label={c.title} hint={c.exportable ? `Assessment · ${c.status}` : "Revoked: can't be included"} />
          ))}
          {items.internships.map((x) => (
            <Checkbox key={x.id} checked={!!selected[x.id]} onChange={(v) => setSelected((s) => ({ ...s, [x.id]: v }))} label={x.title} hint={`Internship · completed ${formatDate(x.completedAt)}`} />
          ))}
          {items.credentials.length + items.internships.length === 0 && <p className="text-sm text-muted-foreground">Nothing to export yet.</p>}
        </fieldset>
      )}
      <label className="block text-xs text-muted-foreground">
        File format
        <select value={format} onChange={(e) => setFormat(e.target.value as "jwt" | "json")} className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="jwt">VC-JWT (recommended)</option>
          <option value="json">JSON-LD with embedded proof</option>
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold">Cancel</button>
        <button type="button" onClick={download} disabled={working || chosen.length === 0} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5">
          {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download CLR
        </button>
      </div>
    </Modal>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-1.5"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : label}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Checkbox({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-start gap-2.5 text-sm ${disabled ? "opacity-50" : "cursor-pointer"}`}>
      <input type="checkbox" className="mt-0.5 accent-indigo-600" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-foreground font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

function ShareDialog({ credential, getToken, onClose, onCreated }: { credential: WalletCredential; getToken: GetToken; onClose: () => void; onCreated: (link: CreatedLink) => void }) {
  const [recipientLabel, setRecipientLabel] = useState("");
  const [includeCode, setIncludeCode] = useState(true);
  const [includeRecording, setIncludeRecording] = useState(false);
  const [includeTranscript, setIncludeTranscript] = useState(false);
  const [includeHumanDecision, setIncludeHumanDecision] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        `/api/credentials/${credential.id}/shares`,
        { method: "POST", body: JSON.stringify({ recipientLabel, includeCode, includeRecording, includeTranscript, includeHumanDecision, expiresInDays }) },
        getToken
      );
      if (!res.ok) throw new Error(await readError(res));
      const body = (await res.json()) as { url: string; expiresAt: string };
      onCreated({ url: body.url, expiresAt: body.expiresAt });
    } catch (e) {
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not create the link.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title="Share this credential" onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        Anyone with the link can see the signed results and the evidence you tick below, until it expires or you revoke it.
      </p>
      <div className="space-y-1">
        <label htmlFor="recipient" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Who is it for? (only you see this label)
        </label>
        <input
          id="recipient"
          value={recipientLabel}
          maxLength={120}
          onChange={(e) => setRecipientLabel(e.target.value)}
          placeholder="e.g. Globex recruiting team"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="space-y-2.5">
        <Checkbox checked={includeCode} onChange={setIncludeCode} label="Submitted code" />
        <Checkbox checked={includeRecording} onChange={setIncludeRecording} label="Voice defense recording" />
        <Checkbox checked={includeTranscript} onChange={setIncludeTranscript} label="Voice defense transcript" />
        <Checkbox
          checked={includeHumanDecision}
          onChange={setIncludeHumanDecision}
          disabled={!credential.humanDecisionAvailable}
          label='Include "advanced by a human reviewer"'
          hint={credential.humanDecisionAvailable ? "A reviewer advanced this submission. Only the word \"Advanced\" is shared, not who or why." : "No reviewer has advanced this submission."}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="expiry" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Link expires after
        </label>
        <select
          id="expiry"
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(Number(e.target.value))}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {[1, 7, 14, 30, 60, 90].map((d) => (
            <option key={d} value={d}>
              {d === 1 ? "1 day" : `${d} days`}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground">
          Cancel
        </button>
        <button type="button" onClick={submit} disabled={working} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2">
          {working && <Loader2 className="w-4 h-4 animate-spin" />} Create link
        </button>
      </div>
    </Modal>
  );
}

function InviteDialog({ credential, getToken, onClose, onUsed }: { credential: WalletCredential; getToken: GetToken; onClose: () => void; onUsed: (link: CreatedLink) => void }) {
  const [invites, setInvites] = useState<PendingInvite[] | null>(null);
  const [inviteId, setInviteId] = useState("");
  const [includeCode, setIncludeCode] = useState(true);
  const [includeRecording, setIncludeRecording] = useState(true);
  const [includeTranscript, setIncludeTranscript] = useState(true);
  const [includeHumanDecision, setIncludeHumanDecision] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch("/api/credentials/invites", {}, getToken)
      .then((res) => (res.ok ? (res.json() as Promise<{ invites: PendingInvite[] }>) : { invites: [] }))
      .catch(() => ({ invites: [] as PendingInvite[] }))
      .then((body) => {
        if (!cancelled) setInvites(body.invites);
      });
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  const submit = async () => {
    if (!inviteId.trim()) return;
    setWorking(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        `/api/credentials/${credential.id}/use-for-invite`,
        { method: "POST", body: JSON.stringify({ partnerInterviewId: inviteId.trim(), includeCode, includeRecording, includeTranscript, includeHumanDecision }) },
        getToken
      );
      if (!res.ok) throw new Error(await readError(res));
      const body = (await res.json()) as { url: string; expiresAt: string; employer: string };
      onUsed({ url: body.url, expiresAt: body.expiresAt, employer: body.employer });
    } catch (e) {
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not use the credential.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title="Use for a job application" onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        If an employer invited you to an assessment through their hiring system, you can answer with this credential instead of re-testing. They
        receive a link to the signed results and the evidence you choose. A person at the company still decides; they may ask you to take their own
        assessment.
      </p>
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Invitations sent to your email</p>
        {invites === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
          </p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">None found for the email on your account. You can paste an invitation id instead.</p>
        ) : (
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <label key={inv.partnerInterviewId} className="flex items-start gap-2.5 text-sm cursor-pointer rounded-xl border border-border p-2.5 hover:bg-muted/50">
                <input type="radio" name="invite" className="mt-1 accent-indigo-600" checked={inviteId === inv.partnerInterviewId} onChange={() => setInviteId(inv.partnerInterviewId)} />
                <span>
                  <span className="font-semibold text-foreground">{inv.employer}</span>
                  <span className="block text-xs text-muted-foreground">
                    {inv.sprintTitle} · invited {formatDate(inv.invitedAt)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="invite-id" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Invitation id
        </label>
        <input
          id="invite-id"
          value={inviteId}
          onChange={(e) => setInviteId(e.target.value)}
          placeholder="Paste the invitation id"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="space-y-2.5">
        <Checkbox checked={includeCode} onChange={setIncludeCode} label="Submitted code" />
        <Checkbox checked={includeRecording} onChange={setIncludeRecording} label="Voice defense recording" />
        <Checkbox checked={includeTranscript} onChange={setIncludeTranscript} label="Voice defense transcript" />
        <Checkbox
          checked={includeHumanDecision}
          onChange={setIncludeHumanDecision}
          disabled={!credential.humanDecisionAvailable}
          label='Include "advanced by a human reviewer"'
        />
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={working || !inviteId.trim()}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2"
        >
          {working && <Loader2 className="w-4 h-4 animate-spin" />} Send credential
        </button>
      </div>
    </Modal>
  );
}

function RevokeDialog({ credential, getToken, onClose, onRevoked }: { credential: WalletCredential; getToken: GetToken; onClose: () => void; onRevoked: () => void }) {
  const [confirmText, setConfirmText] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await authenticatedFetch(`/api/credentials/${credential.id}/revoke`, { method: "POST", body: JSON.stringify({}) }, getToken);
      if (!res.ok) throw new Error(await readError(res));
      onRevoked();
    } catch (e) {
      setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not revoke the credential.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Modal title="Revoke this credential?" onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        Revoking <span className="font-semibold text-foreground">{credential.task.title}</span> is permanent. All its share links stop working, and
        anyone who checks a copy of the signed credential will see that it was revoked. You can&apos;t undo this.
      </p>
      <div className="space-y-1">
        <label htmlFor="confirm-revoke" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Type REVOKE to confirm
        </label>
        <input
          id="confirm-revoke"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-foreground">
          Keep it
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={working || confirmText.trim().toUpperCase() !== "REVOKE"}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2"
        >
          {working && <Loader2 className="w-4 h-4 animate-spin" />} Revoke credential
        </button>
      </div>
    </Modal>
  );
}

function ShareLinksPanel({ credential, getToken, reloadKey }: { credential: WalletCredential; getToken: GetToken; reloadKey: number }) {
  const [shares, setShares] = useState<ShareLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [views, setViews] = useState<Record<string, ShareView[] | "loading">>({});

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch(`/api/credentials/${credential.id}/shares`, {}, getToken)
      .then(async (res) => (res.ok ? ((await res.json()) as ShareLink[]) : Promise.reject(new Error(await readError(res)))))
      .then(
        (list) => {
          if (!cancelled) {
            setShares(list);
            setError(null);
          }
        },
        (e: unknown) => {
          if (!cancelled) setError(e instanceof Error && !(e instanceof TypeError) ? e.message : "Could not load share links.");
        }
      );
    return () => {
      cancelled = true;
    };
  }, [credential.id, getToken, reloadKey]);

  const revoke = async (shareId: string) => {
    const res = await authenticatedFetch(`/api/credentials/shares/${shareId}`, { method: "DELETE" }, getToken).catch(() => null);
    if (!res || !res.ok) {
      setError("Could not revoke the link.");
      return;
    }
    setShares((prev) => prev?.map((s) => (s.shareId === shareId ? { ...s, status: "Revoked", revokedAt: new Date().toISOString() } : s)) ?? null);
  };

  const toggleViews = async (shareId: string) => {
    if (views[shareId]) {
      setViews((prev) => {
        const next = { ...prev };
        delete next[shareId];
        return next;
      });
      return;
    }
    setViews((prev) => ({ ...prev, [shareId]: "loading" }));
    const res = await authenticatedFetch(`/api/credentials/shares/${shareId}/views`, {}, getToken).catch(() => null);
    const body = res && res.ok ? ((await res.json()) as { views: ShareView[] }) : { views: [] };
    setViews((prev) => ({ ...prev, [shareId]: body.views }));
  };

  if (error) return <p className="text-xs text-red-700 dark:text-red-300">{error}</p>;
  if (shares === null)
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading share links...
      </p>
    );
  if (shares.length === 0) return <p className="text-xs text-muted-foreground">You haven&apos;t shared this credential yet.</p>;

  return (
    <div className="space-y-2">
      {shares.map((s) => {
        const v = views[s.shareId];
        const scope = [s.includeCode && "code", s.includeRecording && "recording", s.includeTranscript && "transcript", s.includeHumanDecision && "reviewer decision"].filter(Boolean).join(", ");
        return (
          <div key={s.shareId} className="rounded-xl border border-border p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                  {s.purpose === "AtsInvite" ? <Briefcase className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
                  {s.recipientLabel || "Unlabelled link"}
                </p>
                <p className="text-muted-foreground">
                  Results{scope ? ` + ${scope}` : " only"} · created {formatDate(s.createdAt)} · {s.status === "Active" ? `expires ${formatDate(s.expiresAt)}` : s.status.toLowerCase()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleViews(s.shareId)} className="px-2.5 py-1 rounded-lg border border-border text-foreground hover:bg-muted flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" /> {s.viewCount} {s.viewCount === 1 ? "view" : "views"}
                </button>
                {s.status === "Active" && (
                  <button type="button" onClick={() => revoke(s.shareId)} className="px-2.5 py-1 rounded-lg border border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-1">
                    <Trash2 className="w-3.5 h-3.5" /> Revoke
                  </button>
                )}
              </div>
            </div>
            {v === "loading" && <p className="text-muted-foreground">Loading views...</p>}
            {Array.isArray(v) &&
              (v.length === 0 ? (
                <p className="text-muted-foreground">No views yet.</p>
              ) : (
                <table className="w-full text-left">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="font-semibold py-1">When</th>
                      <th className="font-semibold py-1">Browser</th>
                      <th className="font-semibold py-1">Visitor (hashed)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="py-1">{new Date(row.viewedAt).toLocaleString()}</td>
                        <td className="py-1">{row.userAgent}</td>
                        <td className="py-1 font-mono">{row.ipHash}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ))}
          </div>
        );
      })}
    </div>
  );
}

function CredentialCard({
  credential,
  signingAvailable,
  getToken,
  reloadKey,
  onDialog,
  onError,
}: {
  credential: WalletCredential;
  signingAvailable: boolean;
  getToken: GetToken;
  reloadKey: number;
  onDialog: (d: Dialog) => void;
  onError: (msg: string) => void;
}) {
  const [showShares, setShowShares] = useState(false);
  const [jwsCopied, setJwsCopied] = useState(false);
  const [includeDecisionInJws, setIncludeDecisionInJws] = useState(false);
  const { scores } = credential;
  const active = credential.status === "Valid" || credential.status === "Under review";

  const downloadBadge = async () => {
    try {
      await saveExport(await authenticatedFetch(`/api/career/openbadges/credentials/${credential.id}?format=jwt`, {}, getToken));
    } catch (e) {
      onError(e instanceof Error ? `Could not download the Open Badge: ${e.message}` : "Could not download the Open Badge.");
    }
  };

  const copyJws = async () => {
    try {
      const res = await authenticatedFetch(`/api/credentials/${credential.id}/jws?includeHumanDecision=${includeDecisionInJws}`, {}, getToken);
      if (!res.ok) throw new Error(await readError(res));
      const body = (await res.json()) as { jws: string };
      await navigator.clipboard.writeText(body.jws);
      setJwsCopied(true);
      setTimeout(() => setJwsCopied(false), 2000);
    } catch (e) {
      onError(e instanceof Error ? `Could not copy the JWS: ${e.message}` : "Could not copy the JWS.");
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-5 border border-border space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-foreground">{credential.task.title}</h3>
          <p className="text-xs text-muted-foreground">
            {[credential.task.taskType, credential.task.language].filter(Boolean).join(" · ") || "Voice defense"} · issued {formatDate(credential.issuedAt)} ·{" "}
            {credential.status === "Revoked" ? `revoked ${formatDate(credential.revokedAt)}` : `valid until ${formatDate(credential.validUntil)}`}
          </p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${statusBadgeClass(credential.status)}`}>{String(credential.status ?? "").replace(/([a-z])([A-Z])/g, (_m, a: string, b: string) => `${a} ${b.toLowerCase()}`)}</span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>
          <span className="text-muted-foreground">Tests </span>
          <span className="font-semibold">{scores.testsTotal ? `${scores.testsPassed ?? 0}/${scores.testsTotal}` : "—"}</span>
        </span>
        <span>
          <span className="text-muted-foreground">Defense </span>
          <span className="font-semibold">{Math.round(scores.defenseScore)}/100</span>
        </span>
        {scores.defectsTotal !== undefined && (
          <span>
            <span className="text-muted-foreground">Defects fixed </span>
            <span className="font-semibold">
              {scores.defectsFixed ?? 0}/{scores.defectsTotal}
            </span>
          </span>
        )}
        <span>
          <span className="text-muted-foreground">Integrity </span>
          <span className="font-semibold">{credential.integrity}</span>
        </span>
      </div>

      {credential.status === "Under review" && (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          A reviewer hasn&apos;t looked at this submission&apos;s integrity signals yet. You can share it, and viewers will see &quot;Under review&quot;.
        </p>
      )}

      {active && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onDialog({ kind: "share", credential })} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
          {credential.status === "Valid" && (
            <button type="button" onClick={() => onDialog({ kind: "invite", credential })} className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Use for a job application
            </button>
          )}
          <button
            type="button"
            onClick={copyJws}
            disabled={!signingAvailable}
            title={signingAvailable ? "Copy the signed credential for offline verification" : "Signing is not configured on this server"}
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 flex items-center gap-1.5"
          >
            {jwsCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <KeyRound className="w-3.5 h-3.5" />} {jwsCopied ? "Copied" : "Copy JWS"}
          </button>
          <button
            type="button"
            onClick={downloadBadge}
            disabled={!signingAvailable}
            title="Download as an Open Badges 3.0 credential (VC-JWT)"
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Download Open Badge
          </button>
          {credential.humanDecisionAvailable && (
            <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" className="accent-indigo-600" checked={includeDecisionInJws} onChange={(e) => setIncludeDecisionInJws(e.target.checked)} />
              include reviewer &quot;Advanced&quot; in JWS
            </label>
          )}
          <button
            type="button"
            onClick={() => onDialog({ kind: "revoke", credential })}
            className="ml-auto px-3 py-1.5 rounded-lg border border-red-500/40 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-semibold flex items-center gap-1.5"
          >
            <ShieldOff className="w-3.5 h-3.5" /> Revoke
          </button>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <button type="button" onClick={() => setShowShares((v) => !v)} className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1">
          {showShares ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          Share links ({credential.activeShareCount} active)
        </button>
        {showShares && (
          <div className="mt-3">
            <ShareLinksPanel credential={credential} getToken={getToken} reloadKey={reloadKey} />
          </div>
        )}
      </div>
    </div>
  );
}

export default function CredentialWalletPage() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const apply = useCallback((result: WalletResponse | string) => {
    if (typeof result === "string") setError(`We couldn't load your credentials: ${result}`);
    else {
      setWallet(result);
      setError(null);
    }
    setLoading(false);
  }, []);

  const reload = useCallback(async () => {
    apply(await fetchWallet(getToken));
    setReloadKey((k) => k + 1);
  }, [apply, getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchWallet(getToken).then((result) => {
      if (!cancelled) apply(result);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, apply]);

  if (isLoaded && !isSignedIn) {
    return (
      <SignInRequired title="Your credentials" message="Sign in to see and share the credentials you earned by defending your code." />
    );
  }

  const afterLink = (link: CreatedLink) => {
    setDialog({ kind: "created", link });
    void reload();
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Award className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
            Your credentials
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each passing defense gives you a credential signed by Edulexa. Share it with employers so they can check your results without asking you to
            re-test. You decide what evidence each link shows, and you can withdraw it at any time.
          </p>
        </div>

        {notice && (
          <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
            </span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </span>
            <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {wallet && !wallet.signingAvailable && (
          <div className="p-3 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-900 dark:text-amber-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Credential signing is not configured on this server yet, so links can&apos;t be verified right now.
          </div>
        )}

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your credentials...
          </div>
        ) : !wallet || wallet.credentials.length === 0 ? (
          !error && (
            <div className="glass-panel rounded-2xl p-6 border border-border text-sm text-muted-foreground">
              No credentials yet. Complete a coding sprint and pass its voice defense to earn one.{" "}
              <Link href="/dashboard" className="underline text-foreground">
                Find a sprint
              </Link>
            </div>
          )
        ) : (
          <div className="space-y-4">
            {wallet.credentials.map((c) => (
              <CredentialCard
                key={c.id}
                credential={c}
                signingAvailable={wallet.signingAvailable}
                getToken={getToken}
                reloadKey={reloadKey}
                onDialog={setDialog}
                onError={setError}
              />
            ))}
            <button
              type="button"
              onClick={() => setDialog({ kind: "clr" })}
              disabled={!wallet.signingAvailable}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Download CLR
            </button>
            <p className="text-xs text-muted-foreground">
              Credentials are valid for {wallet.validityMonths} months from issue. Employers can check any copied JWS at{" "}
              <Link href="/verify" className="underline">
                /verify
              </Link>
              .
            </p>
          </div>
        )}
      </div>

      {dialog?.kind === "share" && <ShareDialog credential={dialog.credential} getToken={getToken} onClose={() => setDialog(null)} onCreated={afterLink} />}
      {dialog?.kind === "invite" && <InviteDialog credential={dialog.credential} getToken={getToken} onClose={() => setDialog(null)} onUsed={afterLink} />}
      {dialog?.kind === "revoke" && (
        <RevokeDialog
          credential={dialog.credential}
          getToken={getToken}
          onClose={() => setDialog(null)}
          onRevoked={() => {
            setDialog(null);
            setNotice("Credential revoked. Its share links no longer work.");
            void reload();
          }}
        />
      )}
      {dialog?.kind === "clr" && (
        <ClrDialog
          getToken={getToken}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            setNotice("Learner record downloaded.");
          }}
        />
      )}
      {dialog?.kind === "created" && (
        <Modal title={dialog.link.employer ? `Sent to ${dialog.link.employer}` : "Your share link"} onClose={() => setDialog(null)}>
          <p className="text-sm text-muted-foreground">
            {dialog.link.employer
              ? "The employer's hiring system now has a link to your credential. You can also copy it here."
              : "Copy this link now. For your security we only show it once; you can always create another."}
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs break-all text-foreground">{dialog.link.url}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Expires {formatDate(dialog.link.expiresAt)}</span>
            <CopyButton text={dialog.link.url} label="Copy link" />
          </div>
        </Modal>
      )}
    </div>
  );
}

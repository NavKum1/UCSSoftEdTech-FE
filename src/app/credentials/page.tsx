"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import {
  AlertTriangle,
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
import { useEn } from "@/lib/english/EnglishProvider";
import { Loading, PageHeader, brandFill, buttonClass } from "@/components/career/ui";

type GetToken = () => Promise<string | null>;

interface WalletCredential {
  id: string;
  status: string;
  task: { title: string; taskType?: string | null; aiPolicy?: string | null; language?: string | null };
  scores: { testsPassed?: number | null; testsTotal?: number | null; defenseScore: number; defectsFixed?: number; defectsTotal?: number };
  integrity: string;
  humanDecisionAvailable: boolean;
  issuedAt: string;
  /** null: never expires (a class assessment's result) */
  validUntil: string | null;
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
  const en = useEn();
  const [items, setItems] = useState<ExportableResponse | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [format, setFormat] = useState<"jwt" | "json">("jwt");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    authenticatedFetch("/api/career/openbadges/mine", {}, getToken)
      .then(async (res) => (res.ok ? setItems((await res.json()) as ExportableResponse) : setErr(en("We couldn't load your items. Please try again."))))
      .catch(() => setErr(en("We couldn't reach the server. Please check your connection and try again.")));
  }, [getToken, en]);

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
    <Modal title={en("Download a learner record (CLR 2.0)")} onClose={onClose}>
      <p className="text-sm text-muted-foreground">{en("Choose what to include. The file is signed so anyone you give it to can check it. Nothing is sent to anyone until you share the file yourself.")}</p>
      {err && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{err}</p>}
      {!items ? (
        !err && <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />{en(" Loading...")}</p>
      ) : (
        <fieldset className="space-y-2">
          <legend className="text-xs font-semibold text-muted-foreground mb-1">{en("Credentials and completed internships")}</legend>
          {items.credentials.map((c) => (
            <Checkbox key={c.id} checked={!!selected[c.id]} disabled={!c.exportable} onChange={(v) => setSelected((s) => ({ ...s, [c.id]: v }))} label={c.title} hint={c.exportable ? `Assessment · ${c.status}` : en("Revoked: can't be included")} />
          ))}
          {items.internships.map((x) => (
            <Checkbox key={x.id} checked={!!selected[x.id]} onChange={(v) => setSelected((s) => ({ ...s, [x.id]: v }))} label={x.title} hint={`Internship · completed ${formatDate(x.completedAt)}`} />
          ))}
          {items.credentials.length + items.internships.length === 0 && <p className="text-sm text-muted-foreground">{en("Nothing to export yet.")}</p>}
        </fieldset>
      )}
      <label className="block text-xs text-muted-foreground">
        {en("File format")}
        <select value={format} onChange={(e) => setFormat(e.target.value as "jwt" | "json")} className="mt-1 block w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground">
          <option value="jwt">{en("VC-JWT (recommended)")}</option>
          <option value="json">{en("JSON-LD with embedded proof")}</option>
        </select>
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonClass("secondary")}>{en("Cancel")}</button>
        <button type="button" onClick={download} disabled={working || chosen.length === 0} className={buttonClass("primary")} style={brandFill}>
          {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}{en(" Download CLR")}
        </button>
      </div>
    </Modal>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const en = useEn();
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
      className={buttonClass("secondary")}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? en("Copied") : label}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const en = useEn();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label={en("Close")} className="text-muted-foreground hover:text-foreground">
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
  const en = useEn();
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
    <Modal title={en("Share this credential")} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        {en("Anyone with the link can see the signed results and the evidence you tick below, until it expires or you revoke it.")}
      </p>
      <div className="space-y-1">
        <label htmlFor="recipient" className="text-xs font-semibold text-muted-foreground">
          {en("Who is it for? (only you see this label)")}
        </label>
        <input
          id="recipient"
          value={recipientLabel}
          maxLength={120}
          onChange={(e) => setRecipientLabel(e.target.value)}
          placeholder={en("e.g. Globex recruiting team")}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="space-y-2.5">
        <Checkbox checked={includeCode} onChange={setIncludeCode} label={en("Submitted code")} />
        <Checkbox checked={includeRecording} onChange={setIncludeRecording} label={en("Voice defense recording")} />
        <Checkbox checked={includeTranscript} onChange={setIncludeTranscript} label={en("Voice defense transcript")} />
        <Checkbox
          checked={includeHumanDecision}
          onChange={setIncludeHumanDecision}
          disabled={!credential.humanDecisionAvailable}
          label={en('Include "advanced by a human reviewer"')}
          hint={credential.humanDecisionAvailable ? en("A reviewer advanced this submission. Only the word \"Advanced\" is shared, not who or why.") : en("No reviewer has advanced this submission.")}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="expiry" className="text-xs font-semibold text-muted-foreground">
          {en("Link expires after")}
        </label>
        <select
          id="expiry"
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(Number(e.target.value))}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
        >
          {[1, 7, 14, 30, 60, 90].map((d) => (
            <option key={d} value={d}>
              {d === 1 ? en("1 day") : `${d} days`}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonClass("secondary")}>
          {en("Cancel")}
        </button>
        <button type="button" onClick={submit} disabled={working} className={buttonClass("primary")} style={brandFill}>
          {working && <Loader2 className="w-4 h-4 animate-spin" />}{en(" Create link")}
        </button>
      </div>
    </Modal>
  );
}

function InviteDialog({ credential, getToken, onClose, onUsed }: { credential: WalletCredential; getToken: GetToken; onClose: () => void; onUsed: (link: CreatedLink) => void }) {
  const en = useEn();
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
    <Modal title={en("Use for a job application")} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        {en("If an employer invited you to an assessment through their hiring system, you can answer with this credential instead of re-testing. They receive a link to the signed results and the evidence you choose. A person at the company still decides; they may ask you to take their own assessment.")}
      </p>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground">{en("Invitations sent to your email")}</p>
        {invites === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />{en(" Loading...")}
          </p>
        ) : invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">{en("None found for the email on your account. You can paste an invitation id instead.")}</p>
        ) : (
          <div className="space-y-1.5">
            {invites.map((inv) => (
              <label key={inv.partnerInterviewId} className="flex items-start gap-2.5 text-sm cursor-pointer rounded-xl border border-border p-2.5 hover:bg-muted/50">
                <input type="radio" name="invite" className="mt-1 accent-indigo-600" checked={inviteId === inv.partnerInterviewId} onChange={() => setInviteId(inv.partnerInterviewId)} />
                <span>
                  <span className="font-semibold text-foreground">{inv.employer}</span>
                  <span className="block text-xs text-muted-foreground">
                    {en("{sprintTitle} · invited {date}", { sprintTitle: inv.sprintTitle, date: formatDate(inv.invitedAt) })}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="invite-id" className="text-xs font-semibold text-muted-foreground">
          {en("Invitation id")}
        </label>
        <input
          id="invite-id"
          value={inviteId}
          onChange={(e) => setInviteId(e.target.value)}
          placeholder={en("Paste the invitation id")}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>
      <div className="space-y-2.5">
        <Checkbox checked={includeCode} onChange={setIncludeCode} label={en("Submitted code")} />
        <Checkbox checked={includeRecording} onChange={setIncludeRecording} label={en("Voice defense recording")} />
        <Checkbox checked={includeTranscript} onChange={setIncludeTranscript} label={en("Voice defense transcript")} />
        <Checkbox
          checked={includeHumanDecision}
          onChange={setIncludeHumanDecision}
          disabled={!credential.humanDecisionAvailable}
          label={en('Include "advanced by a human reviewer"')}
        />
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonClass("secondary")}>
          {en("Cancel")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={working || !inviteId.trim()}
          className={buttonClass("primary")} style={brandFill}
        >
          {working && <Loader2 className="w-4 h-4 animate-spin" />}{en(" Send credential")}
        </button>
      </div>
    </Modal>
  );
}

function RevokeDialog({ credential, getToken, onClose, onRevoked }: { credential: WalletCredential; getToken: GetToken; onClose: () => void; onRevoked: () => void }) {
  const en = useEn();
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
    <Modal title={en("Revoke this credential?")} onClose={onClose}>
      <p className="text-sm text-muted-foreground">
        {en("Revoking ")}<span className="font-semibold text-foreground">{credential.task.title}</span>{en(" is permanent. All its share links stop working, and anyone who checks a copy of the signed credential will see that it was revoked. You can't undo this.")}
      </p>
      <div className="space-y-1">
        <label htmlFor="confirm-revoke" className="text-xs font-semibold text-muted-foreground">
          {en("Type REVOKE to confirm")}
        </label>
        <input
          id="confirm-revoke"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      {error && <p className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={buttonClass("secondary")}>
          {en("Keep it")}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={working || confirmText.trim().toUpperCase() !== "REVOKE"}
          className={buttonClass("danger")}
        >
          {working && <Loader2 className="w-4 h-4 animate-spin" />}{en(" Revoke credential")}
        </button>
      </div>
    </Modal>
  );
}

function ShareLinksPanel({ credential, getToken, reloadKey }: { credential: WalletCredential; getToken: GetToken; reloadKey: number }) {
  const en = useEn();
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
      setError(en("Could not revoke the link."));
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
        <Loader2 className="w-3.5 h-3.5 animate-spin" />{en(" Loading share links...")}
      </p>
    );
  if (shares.length === 0) return <p className="text-xs text-muted-foreground">{en("You haven't shared this credential yet.")}</p>;

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
                  {en("Results{value} · created {date} · {value2}", { value: scope ? ` + ${scope}` : en(" only"), date: formatDate(s.createdAt), value2: s.status === "Active" ? `expires ${formatDate(s.expiresAt)}` : s.status.toLowerCase() })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleViews(s.shareId)} className={`${buttonClass("secondary")} h-8 px-2.5 text-xs`}>
                  <Eye className="w-3.5 h-3.5" /> {s.viewCount} {s.viewCount === 1 ? "view" : "views"}
                </button>
                {s.status === "Active" && (
                  <button type="button" onClick={() => revoke(s.shareId)} className={`${buttonClass("secondary")} h-8 px-2.5 text-xs text-red-700 dark:text-red-300`}>
                    <Trash2 className="w-3.5 h-3.5" />{en(" Revoke")}
                  </button>
                )}
              </div>
            </div>
            {v === "loading" && <p className="text-muted-foreground">{en("Loading views...")}</p>}
            {Array.isArray(v) &&
              (v.length === 0 ? (
                <p className="text-muted-foreground">{en("No views yet.")}</p>
              ) : (
                <table className="w-full text-start">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="font-semibold py-1">{en("When")}</th>
                      <th className="font-semibold py-1">{en("Browser")}</th>
                      <th className="font-semibold py-1">{en("Visitor (hashed)")}</th>
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
  const en = useEn();
  // What kind of credential, in words (the API sends a type key)
  const kindLabel = (t?: string | null) =>
    t === "ClassAssessment" ? en("Class assessment") : t === "InternshipDefense" ? en("Internship defense") : t === "RealWork" ? en("Real-work defense") : t ?? null;
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
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground">{credential.task.title}</h3>
          <p className="text-xs text-muted-foreground">
            {en("{value} · issued {date} · {value2}", {
              value: [kindLabel(credential.task.taskType), credential.task.language].filter(Boolean).join(" · ") || en("Voice defense"),
              date: formatDate(credential.issuedAt),
              value2:
                credential.status === "Revoked"
                  ? en("revoked {date}", { date: formatDate(credential.revokedAt) })
                  : credential.validUntil
                    ? en("valid until {date}", { date: formatDate(credential.validUntil) })
                    : en("no expiry"),
            })}
          </p>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusBadgeClass(credential.status)}`}>{String(credential.status ?? "").replace(/([a-z])([A-Z])/g, (_m, a: string, b: string) => `${a} ${b.toLowerCase()}`)}</span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {/* A class assessment (Build & Defend 2.9) has no tests: its score is the teacher's, on the rubric */}
        {credential.task.taskType !== "ClassAssessment" && (
          <span>
            <span className="text-muted-foreground">{en("Tests ")}</span>
            <span className="font-semibold">{scores.testsTotal ? `${scores.testsPassed ?? 0}/${scores.testsTotal}` : "—"}</span>
          </span>
        )}
        <span>
          <span className="text-muted-foreground">{credential.task.taskType === "ClassAssessment" ? en("Teacher's score ") : en("Defense ")}</span>
          <span className="font-semibold">{credential.task.taskType === "ClassAssessment" ? scores.defenseScore : Math.round(scores.defenseScore)}/100</span>
        </span>
        {scores.defectsTotal !== undefined && (
          <span>
            <span className="text-muted-foreground">{en("Defects fixed ")}</span>
            <span className="font-semibold">
              {scores.defectsFixed ?? 0}/{scores.defectsTotal}
            </span>
          </span>
        )}
        <span>
          <span className="text-muted-foreground">{en("Integrity ")}</span>
          <span className="font-semibold">{credential.integrity}</span>
        </span>
      </div>

      {credential.status === "Under review" && (
        <p className="text-xs text-amber-800 dark:text-amber-200">
          {en("A reviewer hasn't looked at this submission's integrity signals yet. You can share it, and viewers will see \"Under review\".")}
        </p>
      )}

      {active && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => onDialog({ kind: "share", credential })} className={buttonClass("primary")} style={brandFill}>
            <Share2 className="w-3.5 h-3.5" />{en(" Share")}
          </button>
          {credential.status === "Valid" && (
            <button type="button" onClick={() => onDialog({ kind: "invite", credential })} className={buttonClass("secondary")}>
              <Briefcase className="w-3.5 h-3.5" />{en(" Use for a job application")}
            </button>
          )}
          <button
            type="button"
            onClick={copyJws}
            disabled={!signingAvailable}
            title={signingAvailable ? en("Copy the signed credential for offline verification") : en("Signing is not configured on this server")}
            className={buttonClass("secondary")}
          >
            {jwsCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <KeyRound className="w-3.5 h-3.5" />} {jwsCopied ? en("Copied") : en("Copy JWS")}
          </button>
          <button
            type="button"
            onClick={downloadBadge}
            disabled={!signingAvailable}
            title={en("Download as an Open Badges 3.0 credential (VC-JWT)")}
            className={buttonClass("secondary")}
          >
            <Download className="w-3.5 h-3.5" />{en(" Download Open Badge")}
          </button>
          {credential.humanDecisionAvailable && (
            <label className="text-xs text-muted-foreground flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" className="accent-indigo-600" checked={includeDecisionInJws} onChange={(e) => setIncludeDecisionInJws(e.target.checked)} />
              {en("include reviewer \"Advanced\" in JWS")}
            </label>
          )}
          <button
            type="button"
            onClick={() => onDialog({ kind: "revoke", credential })}
            className={`${buttonClass("secondary")} ms-auto text-red-700 dark:text-red-300`}
          >
            <ShieldOff className="w-3.5 h-3.5" />{en(" Revoke")}
          </button>
        </div>
      )}

      <div className="border-t border-border pt-3">
        <button type="button" onClick={() => setShowShares((v) => !v)} className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
          {showShares ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {en("Share links (")}{credential.activeShareCount}{en(" active)")}
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
  const en = useEn();
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const apply = useCallback((result: WalletResponse | string) => {
    if (typeof result === "string") setError(en("We couldn't load your credentials: {problem}", { problem: String(result) }));
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
      <SignInRequired title={en("Your credentials")} message="Sign in to see and share the credentials you earned by defending your code." />
    );
  }

  const afterLink = (link: CreatedLink) => {
    setDialog({ kind: "created", link });
    void reload();
  };

  return (
    <div className="text-foreground">
      <div className="space-y-6">
        <PageHeader
          title={en("Your credentials")}
          description={en("Each passing defense gives you a credential signed by Edulexa. Share it with employers so they can check your results without asking you to re-test. You decide what evidence each link shows, and you can withdraw it at any time.")}
        />

        {notice && (
          <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
            </span>
            <button type="button" onClick={() => setNotice(null)} aria-label={en("Dismiss")}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </span>
            <button type="button" onClick={() => setError(null)} aria-label={en("Dismiss")}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {wallet && !wallet.signingAvailable && (
          <div className="p-3 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 text-xs text-amber-900 dark:text-amber-100 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />{en(" Credential signing is not configured on this server yet, so links can't be verified right now.")}
          </div>
        )}

        {loading ? (
          <Loading label={en("Loading your credentials…")} />
        ) : !wallet || wallet.credentials.length === 0 ? (
          !error && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-sm text-muted-foreground">
              {en("No credentials yet. Complete a coding sprint and pass its voice defense to earn one.")}{" "}
              <Link href="/dashboard" className="underline text-foreground">
                {en("Find a sprint")}
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
              className={buttonClass("secondary")}
            >
              <Download className="w-3.5 h-3.5" />{en(" Download CLR")}
            </button>
            <p className="text-xs text-muted-foreground">
              {en("Credentials are valid for {validityMonths} months from issue; class assessment results don't expire. Employers can check any copied JWS at", { validityMonths: wallet.validityMonths })}{" "}
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
            setNotice(en("Credential revoked. Its share links no longer work."));
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
            setNotice(en("Learner record downloaded."));
          }}
        />
      )}
      {dialog?.kind === "created" && (
        <Modal title={dialog.link.employer ? `Sent to ${dialog.link.employer}` : en("Your share link")} onClose={() => setDialog(null)}>
          <p className="text-sm text-muted-foreground">
            {dialog.link.employer
              ? en("The employer's hiring system now has a link to your credential. You can also copy it here.")
              : en("Copy this link now. For your security we only show it once; you can always create another.")}
          </p>
          <div className="rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs break-all text-foreground">{dialog.link.url}</div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{en("Expires {date}", { date: formatDate(dialog.link.expiresAt) })}</span>
            <CopyButton text={dialog.link.url} label={en("Copy link")} />
          </div>
        </Modal>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  Calendar,
  CheckCircle2,
  FileCode2,
  Info,
  KeyRound,
  Loader2,
  Mic,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { API_BASE_URL } from "@/lib/apiClient";
import {
  CREDENTIAL_DISCLAIMER_POINTS,
  type ClientSignatureCheck,
  type CredentialClaims,
  formatDate,
  statusBadgeClass,
  verifyJwsInBrowser,
} from "@/lib/credentialVerification";

interface CodeFile {
  name: string;
  content: string;
}

interface VerifyResponse {
  status: string;
  claims: CredentialClaims;
  jws: string;
  issuerKeyId: string;
  alg: string;
  evidence: {
    included: { code: boolean; recording: boolean; transcript: boolean; humanDecision: boolean };
    codeFiles?: CodeFile[] | null;
    recordingUrl?: string | null;
    transcript?: string | null;
  };
  share: { recipientLabel?: string; expiresAt: string };
  issuedAt: string;
  validUntil: string;
  verifiedAt: string;
  disclaimer: string;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not-found" }
  | { kind: "error"; message: string }
  | { kind: "ok"; data: VerifyResponse; check: ClientSignatureCheck };

async function loadCredential(token: string): Promise<LoadState> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/verify/${encodeURIComponent(token)}`, { cache: "no-store", referrerPolicy: "no-referrer" });
    if (res.status === 404) return { kind: "not-found" };
    if (res.status === 429) return { kind: "error", message: "Too many verification requests. Please wait a minute and try again." };
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { kind: "error", message: body?.error || `Verification is unavailable right now (HTTP ${res.status}).` };
    }
    const data = (await res.json()) as VerifyResponse;
    const check = await verifyJwsInBrowser(data.jws);
    return { kind: "ok", data, check };
  } catch {
    return { kind: "error", message: "We couldn't reach the verification service." };
  }
}

function TranscriptView({ transcript }: { transcript: string }) {
  const lines = transcript.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className="space-y-2 max-h-112 overflow-y-auto pr-1">
      {lines.map((line, i) => {
        const colon = line.indexOf(":");
        const speaker = colon > 0 && colon <= 15 ? line.slice(0, colon).trim() : null;
        const text = speaker ? line.slice(colon + 1).trim() : line;
        const isInterviewer = speaker ? ["ai", "assistant", "interviewer", "bot"].includes(speaker.toLowerCase()) : false;
        return (
          <div key={i} className="text-sm leading-relaxed">
            {speaker && (
              <span className={`font-semibold mr-1.5 ${isInterviewer ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"}`}>
                {isInterviewer ? "Interviewer" : "Candidate"}:
              </span>
            )}
            <span className="text-muted-foreground">{text}</span>
          </div>
        );
      })}
    </div>
  );
}

function CodeViewer({ files }: { files: CodeFile[] }) {
  const [active, setActive] = useState(0);
  if (files.length === 0) return <p className="text-sm text-muted-foreground">No code was stored for this submission.</p>;
  const file = files[Math.min(active, files.length - 1)];
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {files.length > 1 && (
        <div className="flex flex-wrap gap-1 p-1.5 border-b border-border bg-muted/40">
          {files.map((f, i) => (
            <button
              key={f.name + i}
              type="button"
              onClick={() => setActive(i)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono ${
                i === active ? "bg-indigo-600 text-white" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
      {files.length === 1 && <div className="px-3 py-1.5 border-b border-border text-xs font-mono text-muted-foreground">{file.name}</div>}
      <pre role="region" tabIndex={0} aria-label={`Code: ${file.name}`} className="p-3 text-xs font-mono leading-relaxed overflow-auto max-h-128 bg-slate-50 dark:bg-slate-950/60 text-foreground">
        {file.content.split("\n").map((line, i) => (
          <div key={i} className="flex">
            <span className="select-none w-10 shrink-0 text-right pr-3 text-muted-foreground/60">{i + 1}</span>
            <span className="whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export default function VerifyTokenPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    loadCredential(token).then((result) => {
      if (!cancelled) setState(result);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Verifying credential...
      </div>
    );
  }

  if (state.kind === "not-found" || state.kind === "error") {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-6 py-20 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 mx-auto text-amber-600 dark:text-amber-400" />
          <h1 className="text-xl font-bold text-foreground">
            {state.kind === "not-found" ? "This link isn't valid" : "Verification unavailable"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {state.kind === "not-found"
              ? "It may have expired, or the holder may have withdrawn it. Ask them for a new link, or paste their credential JWS into the verifier."
              : state.message}
          </p>
          <Link href="/verify" className="inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
            Open the JWS verifier
          </Link>
        </div>
      </div>
    );
  }

  const { data, check } = state;
  const { claims, evidence } = data;
  const results = claims.results;
  const integrityTone =
    claims.integrity === "No concerns"
      ? "text-emerald-700 dark:text-emerald-300"
      : claims.integrity === "Under review"
        ? "text-amber-700 dark:text-amber-300"
        : "text-foreground";

  return (
    <div className="min-h-screen bg-background text-foreground pb-20">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Edulexa Build &amp; Defend credential</p>
            <h1 className="text-2xl font-black tracking-tight text-foreground mt-1">{claims.task.title}</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
              <User className="w-4 h-4" /> Held by <span className="font-semibold text-foreground">{claims.name}</span>
            </p>
          </div>
          <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${statusBadgeClass(data.status)}`}>
            {data.status}
          </span>
        </div>

        {data.status === "Expired" && (
          <div className="p-3 rounded-xl border border-slate-400/40 bg-slate-50 dark:bg-slate-500/10 text-sm text-foreground flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" /> This credential passed its validity date on {formatDate(claims.exp)}. The results below are historical.
          </div>
        )}
        {data.status === "Under review" && (
          <div className="p-3 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 text-sm text-amber-900 dark:text-amber-100 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" /> Some integrity signals on this submission are waiting for a human reviewer. That is not a finding of misconduct.
          </div>
        )}

        {/* Signature */}
        <div className="glass-panel rounded-2xl p-5 border border-border space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {check.state === "verified" ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300">Signature verified ✓ (ES256, key id {check.keyId})</span>
              </>
            ) : check.state === "failed" ? (
              <>
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-red-700 dark:text-red-300">Signature check failed in your browser</span>
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5 text-muted-foreground" />
                <span>Signature verified by the Edulexa server (ES256, key id {data.issuerKeyId})</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {check.detail} Issuer: <span className="font-mono">{claims.iss}</span>. Checked {formatDate(data.verifiedAt)}.
          </p>
          {claims.evidenceHash && (
            <p className="text-xs text-muted-foreground break-all">
              Evidence hash: <span className="font-mono">{claims.evidenceHash}</span>
            </p>
          )}
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-panel rounded-2xl p-4 border border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Tests passed</p>
            <p className="text-xl font-black mt-1">
              {results.testsTotal ? `${results.testsPassed ?? 0}/${results.testsTotal}` : "—"}
            </p>
          </div>
          <div className="glass-panel rounded-2xl p-4 border border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Voice defense</p>
            <p className="text-xl font-black mt-1">{Math.round(results.defenseScore)}/100</p>
          </div>
          {results.defectsTotal !== undefined && (
            <div className="glass-panel rounded-2xl p-4 border border-border">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Planted defects fixed</p>
              <p className="text-xl font-black mt-1">
                {results.defectsFixed ?? 0}/{results.defectsTotal}
              </p>
            </div>
          )}
          <div className="glass-panel rounded-2xl p-4 border border-border">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">Integrity</p>
            <p className={`text-sm font-bold mt-2 ${integrityTone}`}>{claims.integrity}</p>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Task type: </span>
            {claims.task.taskType ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">Language: </span>
            {claims.task.language ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">AI policy: </span>
            {claims.task.aiPolicy === "Prohibited"
              ? "No AI assistance allowed"
              : claims.task.aiPolicy === "Allowed"
                ? "Built-in AI assistant allowed (logged)"
                : claims.task.aiPolicy === "Evaluated"
                  ? "AI use allowed and part of the review"
                  : "—"}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            Issued {formatDate(claims.iat)} · valid until {formatDate(claims.exp)}
          </div>
          {evidence.included.humanDecision && (
            <div className="sm:col-span-2 flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {claims.humanDecision === "Advanced"
                ? "A human reviewer at a hiring company advanced this submission."
                : "No human reviewer decision is included."}
            </div>
          )}
        </div>

        {/* Evidence */}
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Evidence shared by the holder</h2>
          {!evidence.included.code && !evidence.included.recording && !evidence.included.transcript && (
            <div className="glass-panel rounded-2xl p-5 border border-border text-sm text-muted-foreground">
              The holder shared the signed results only, without code, recording or transcript.
            </div>
          )}
          {evidence.included.code && (
            <div className="glass-panel rounded-2xl p-5 border border-border space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <FileCode2 className="w-4 h-4" /> Submitted code
              </h3>
              {evidence.codeFiles ? <CodeViewer files={evidence.codeFiles} /> : <p className="text-sm text-muted-foreground">No code is attached to this credential.</p>}
            </div>
          )}
          {evidence.included.recording && (
            <div className="glass-panel rounded-2xl p-5 border border-border space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Mic className="w-4 h-4" /> Defense recording
              </h3>
              {evidence.recordingUrl ? (
                <audio controls preload="none" src={evidence.recordingUrl} className="w-full">
                  Your browser can&apos;t play this recording.
                </audio>
              ) : (
                <p className="text-sm text-muted-foreground">No recording is available for this defense.</p>
              )}
            </div>
          )}
          {evidence.included.transcript && (
            <div className="glass-panel rounded-2xl p-5 border border-border space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ScrollText className="w-4 h-4" /> Defense transcript
              </h3>
              {evidence.transcript ? <TranscriptView transcript={evidence.transcript} /> : <p className="text-sm text-muted-foreground">No transcript is available.</p>}
            </div>
          )}
        </section>

        {/* What this does and doesn't prove */}
        <section className="glass-panel rounded-2xl p-5 border border-border grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> What this shows
            </h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
              {CREDENTIAL_DISCLAIMER_POINTS.proves.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> What it doesn&apos;t show
            </h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-4">
              {CREDENTIAL_DISCLAIMER_POINTS.doesNotProve.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          This link was shared {data.share.recipientLabel ? `with ${data.share.recipientLabel} ` : ""}and stops working on{" "}
          {formatDate(data.share.expiresAt)}. The holder can see when it was viewed, the browser type and a one-way hash of the network address (never the address itself).{" "}
          <Link href="/verify" className="underline">
            Verify a credential JWS
          </Link>
        </p>
      </div>
    </div>
  );
}

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
  CLASS_ASSESSMENT_TASK,
  disclaimerFor,
  type ClientSignatureCheck,
  type CredentialClaims,
  formatDate,
  statusBadgeClass,
  verifyJwsInBrowser,
} from "@/lib/credentialVerification";
import { useEn } from "@/lib/english/EnglishProvider";
import { PageHeader, StatTile, brandFill, buttonClass } from "@/components/career/ui";

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
  const en = useEn();
  const lines = transcript.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className="space-y-2 max-h-112 overflow-y-auto pe-1">
      {lines.map((line, i) => {
        const colon = line.indexOf(":");
        const speaker = colon > 0 && colon <= 15 ? line.slice(0, colon).trim() : null;
        const text = speaker ? line.slice(colon + 1).trim() : line;
        const isInterviewer = speaker ? ["ai", "assistant", "interviewer", "bot"].includes(speaker.toLowerCase()) : false;
        return (
          <div key={i} className="text-sm leading-relaxed">
            {speaker && (
              <span className={`font-semibold me-1.5 ${isInterviewer ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"}`}>
                {isInterviewer ? en("Interviewer") : en("Candidate")}:
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
  const en = useEn();
  const [active, setActive] = useState(0);
  if (files.length === 0) return <p className="text-sm text-muted-foreground">{en("No code was stored for this submission.")}</p>;
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
            <span className="select-none w-10 shrink-0 text-end pe-3 text-muted-foreground/60">{i + 1}</span>
            <span className="whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export default function VerifyTokenPage() {
  const en = useEn();
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
      <div className="min-h-[60vh] flex items-center justify-center text-sm text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />{en(" Verifying credential...")}
      </div>
    );
  }

  if (state.kind === "not-found" || state.kind === "error") {
    return (
      <div>
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <ShieldAlert className="w-10 h-10 mx-auto text-amber-600 dark:text-amber-400" />
          <h1 className="text-xl font-semibold text-foreground">
            {state.kind === "not-found" ? en("This link isn't valid") : en("Verification unavailable")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {state.kind === "not-found"
              ? en("It may have expired, or the holder may have withdrawn it. Ask them for a new link, or paste their credential JWS into the verifier.")
              : state.message}
          </p>
          <Link href="/verify" className={buttonClass("primary")} style={brandFill}>
            {en("Open the JWS verifier")}
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
    <div className="text-foreground">
      <div className="space-y-6">
        <PageHeader
          title={claims.task.title}
          description={
            <span className="flex items-center gap-1.5">
              <User className="w-4 h-4" aria-hidden />
              {en("Edulexa credential held by ")}
              <span className="font-medium text-foreground">{claims.name}</span>
            </span>
          }
          actions={<span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusBadgeClass(data.status)}`}>{data.status}</span>}
        />

        {data.status === "Expired" && (
          <div className="p-3 rounded-lg border border-border bg-muted/50 text-sm text-foreground flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />{" "}{en("This credential passed its validity date on {date}. The results below are historical.", { date: formatDate(claims.exp) })}
          </div>
        )}
        {data.status === "Under review" && (
          <div className="p-3 rounded-xl border border-amber-400/50 bg-amber-50 dark:bg-amber-500/10 text-sm text-amber-900 dark:text-amber-100 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />{en(" Some integrity signals on this submission are waiting for a human reviewer. That is not a finding of misconduct.")}
          </div>
        )}

        {/* Signature */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            {check.state === "verified" ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-300">{en("Signature verified ✓ (ES256, key id ")}{check.keyId})</span>
              </>
            ) : check.state === "failed" ? (
              <>
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-red-700 dark:text-red-300">{en("Signature check failed in your browser")}</span>
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5 text-muted-foreground" />
                <span>{en("Signature verified by the Edulexa server (ES256, key id {issuerKeyId})", { issuerKeyId: data.issuerKeyId })}</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {en("{detail} Issuer:", { detail: check.detail })}{" "}<span className="font-mono">{claims.iss}</span>{en(". Checked {date}.", { date: formatDate(data.verifiedAt) })}</p>
          {claims.evidenceHash && (
            <p className="text-xs text-muted-foreground break-all">
              {en("Evidence hash: ")}<span className="font-mono">{claims.evidenceHash}</span>
            </p>
          )}
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatTile label={en("Tests passed")} value={results.testsTotal ? `${results.testsPassed ?? 0}/${results.testsTotal}` : "—"} />
          <StatTile label={en("Voice defense")} value={`${Math.round(results.defenseScore)}/100`} />
          {results.defectsTotal !== undefined && (
            <StatTile label={en("Planted defects fixed")} value={`${results.defectsFixed ?? 0}/${results.defectsTotal}`} />
          )}
          <StatTile label={en("Integrity")} value={<span className={`text-base ${integrityTone}`}>{claims.integrity}</span>} />
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">{en("Task type: ")}</span>
            {claims.task.taskType === CLASS_ASSESSMENT_TASK ? en("Class assessment, decided by a teacher") : claims.task.taskType ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">{en("Language: ")}</span>
            {claims.task.language ?? "—"}
          </div>
          <div>
            <span className="text-muted-foreground">{en("AI policy: ")}</span>
            {claims.task.aiPolicy === "Prohibited"
              ? en("No AI assistance allowed")
              : claims.task.aiPolicy === "Allowed"
                ? en("Built-in AI assistant allowed (logged)")
                : claims.task.aiPolicy === "Evaluated"
                  ? en("AI use allowed and part of the review")
                  : "—"}
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            {claims.exp
              ? en("Issued {date} · valid until {date2}", { date: formatDate(claims.iat), date2: formatDate(claims.exp) })
              : en("Issued {date} · no expiry", { date: formatDate(claims.iat) })}
          </div>
          {evidence.included.humanDecision && (
            <div className="sm:col-span-2 flex items-center gap-1.5">
              <BadgeCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              {claims.humanDecision === "Advanced"
                ? en("A human reviewer at a hiring company advanced this submission.")
                : en("No human reviewer decision is included.")}
            </div>
          )}
        </div>

        {/* Evidence */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground">{en("Evidence shared by the holder")}</h2>
          {!evidence.included.code && !evidence.included.recording && !evidence.included.transcript && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm text-sm text-muted-foreground">
              {en("The holder shared the signed results only, without code, recording or transcript.")}
            </div>
          )}
          {evidence.included.code && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileCode2 className="w-4 h-4" />{en(" Submitted code")}
              </h3>
              {evidence.codeFiles ? <CodeViewer files={evidence.codeFiles} /> : <p className="text-sm text-muted-foreground">{en("No code is attached to this credential.")}</p>}
            </div>
          )}
          {evidence.included.recording && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Mic className="w-4 h-4" />{en(" Defense recording")}
              </h3>
              {evidence.recordingUrl ? (
                <audio controls preload="none" src={evidence.recordingUrl} className="w-full">
                  {en("Your browser can't play this recording.")}
                </audio>
              ) : (
                <p className="text-sm text-muted-foreground">{en("No recording is available for this defense.")}</p>
              )}
            </div>
          )}
          {evidence.included.transcript && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <ScrollText className="w-4 h-4" />{en(" Defense transcript")}
              </h3>
              {evidence.transcript ? <TranscriptView transcript={evidence.transcript} /> : <p className="text-sm text-muted-foreground">{en("No transcript is available.")}</p>}
            </div>
          )}
        </section>

        {/* What this does and doesn't prove */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />{en(" What this shows")}
            </h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc ps-4">
              {disclaimerFor(claims.task.taskType).proves.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />{en(" What it doesn't show")}
            </h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc ps-4">
              {disclaimerFor(claims.task.taskType).doesNotProve.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          {en("This link was shared {value}and stops working on {date}. The holder can see when it was viewed, the browser type and a one-way hash of the network address (never the address itself).", { value: data.share.recipientLabel ? `with ${data.share.recipientLabel} ` : "", date: formatDate(data.share.expiresAt) })}{" "}
          <Link href="/verify" className="underline">
            {en("Verify a credential JWS")}
          </Link>
        </p>
      </div>
    </div>
  );
}

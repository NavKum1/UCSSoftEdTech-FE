"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, KeyRound, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/apiClient";
import {
  CREDENTIAL_DISCLAIMER_POINTS,
  CREDENTIAL_JWKS_PATH,
  type ClientSignatureCheck,
  type CredentialClaims,
  formatDate,
  statusBadgeClass,
  verifyJwsInBrowser,
} from "@/lib/credentialVerification";
import { useEn } from "@/lib/english/EnglishProvider";

interface JwsVerifyResponse {
  valid: boolean;
  error?: string | null;
  keyId?: string | null;
  claims?: CredentialClaims | null;
  revoked?: boolean | null;
  expired?: boolean | null;
  status?: string;
  checkedAt?: string;
}

// Open Badges 3.0 / CLR 2.0 VC-JWT result from POST /api/verify/ob3
interface Ob3VerifyResponse {
  valid: boolean;
  status: string;
  error?: string | null;
  type?: string;
  name?: string | null;
  issuer?: { id?: string | null; name?: string | null };
  validFrom?: string | null;
  validUntil?: string | null;
  revoked?: boolean | null;
  expired?: boolean;
  problems?: string[];
  items?: { name?: string | null; status: string; revoked?: boolean | null }[];
}

// Accepts a compact VC-JWT, a data:application/vc+jwt URL, or a downloaded EnvelopedVerifiableCredential .json file
function asVcJwt(input: string): string | null {
  let value = input.trim();
  if (value.startsWith("{")) {
    try {
      const env = JSON.parse(value) as { type?: string; id?: string };
      if (env.type !== "EnvelopedVerifiableCredential" || !env.id) return null;
      value = env.id;
    } catch {
      return null;
    }
  }
  if (value.startsWith("data:application/vc+jwt,")) return value.slice("data:application/vc+jwt,".length);
  try {
    const header = JSON.parse(atob(value.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"))) as { typ?: string };
    return header.typ === "vc+jwt" ? value : null;
  } catch {
    return null;
  }
}

export default function VerifyJwsPage() {
  const en = useEn();
  const [jws, setJws] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JwsVerifyResponse | null>(null);
  const [browserCheck, setBrowserCheck] = useState<ClientSignatureCheck | null>(null);
  const [ob3, setOb3] = useState<Ob3VerifyResponse | null>(null);

  const verify = async () => {
    const value = jws.trim();
    if (!value) return;
    setWorking(true);
    setError(null);
    setResult(null);
    setBrowserCheck(null);
    setOb3(null);
    const vcJwt = asVcJwt(value);
    if (vcJwt) {
      try {
        const [res, check] = await Promise.all([
          fetch(`${API_BASE_URL}/api/verify/ob3`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vcJwt }) }),
          verifyJwsInBrowser(vcJwt),
        ]);
        const body = (await res.json().catch(() => null)) as (Ob3VerifyResponse & { message?: string }) | null;
        if (!res.ok) setError(res.status === 429 ? "Too many requests. Please wait a minute." : body?.message || `Verification failed (HTTP ${res.status}).`);
        else {
          setOb3(body);
          setBrowserCheck(check);
        }
      } catch {
        setError(en("We couldn't reach the verification service."));
      } finally {
        setWorking(false);
      }
      return;
    }
    try {
      const [res, check] = await Promise.all([
        fetch(`${API_BASE_URL}/api/verify/jws`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jws: value }),
        }),
        verifyJwsInBrowser(value),
      ]);
      const body = (await res.json().catch(() => null)) as (JwsVerifyResponse & { error?: string }) | null;
      if (!res.ok) {
        setError(res.status === 429 ? "Too many requests. Please wait a minute." : body?.error || `Verification failed (HTTP ${res.status}).`);
      } else {
        setResult(body);
        setBrowserCheck(check);
      }
    } catch {
      setError(en("We couldn't reach the verification service."));
    } finally {
      setWorking(false);
    }
  };

  const claims = result?.valid ? result.claims : null;

  return (
    <div className="text-foreground">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-indigo-700 dark:text-indigo-400" />
            {en("Verify an Edulexa credential")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {en("Paste the credential JWS the candidate gave you, or an Open Badge 3.0 / CLR 2.0 VC-JWT (or its downloaded .json file). We check the ES256 signature against Edulexa's published keys, and whether the holder has revoked it or it has expired.")}
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-border space-y-3">
          <label htmlFor="jws" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {en("Credential JWS")}
          </label>
          <textarea
            id="jws"
            value={jws}
            onChange={(e) => setJws(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder={en("eyJhbGciOiJFUzI1NiIs...")}
            className="w-full rounded-xl border border-border bg-background p-3 font-mono text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <a href={`${API_BASE_URL}${CREDENTIAL_JWKS_PATH}`} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline flex items-center gap-1">
              <KeyRound className="w-3.5 h-3.5" />{en(" Public keys (JWKS)")}
            </a>
            <button
              type="button"
              onClick={verify}
              disabled={working || jws.trim().length === 0}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2"
            >
              {working && <Loader2 className="w-4 h-4 animate-spin" />}{en(" Verify")}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-500/10 text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {ob3 && (
          <div role="status" aria-live="polite" className={`glass-panel rounded-2xl p-5 border space-y-2 ${ob3.valid ? "border-border" : "border-red-500/40"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className={`text-sm font-semibold flex items-center gap-2 ${ob3.valid ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                {ob3.valid ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                {ob3.valid ? `Valid ${ob3.type === "ClrCredential" ? "learner record (CLR 2.0)" : "Open Badge 3.0"}` : ob3.error ? en("Signature not valid") : `Not valid: ${ob3.status}`}
              </p>
              <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${statusBadgeClass(ob3.status)}`}>{ob3.status}</span>
            </div>
            {ob3.error && <p className="text-sm text-muted-foreground">{ob3.error}</p>}
            {!ob3.error && <p className="text-xs text-muted-foreground">{browserCheck?.state === "verified" ? en("Signature confirmed by the server and independently in your browser.") : browserCheck?.detail}</p>}
            {ob3.name && <p className="text-sm"><span className="text-muted-foreground">{en("Name: ")}</span>{ob3.name}</p>}
            {ob3.issuer?.name && <p className="text-sm"><span className="text-muted-foreground">{en("Issuer: ")}</span>{ob3.issuer.name}</p>}
            {(ob3.validFrom || ob3.validUntil) && <p className="text-sm"><span className="text-muted-foreground">{en("Valid: ")}</span>{formatDate(ob3.validFrom)} – {formatDate(ob3.validUntil)}</p>}
            {ob3.revoked && <p className="text-sm text-red-700 dark:text-red-300">{en("This credential has been revoked. Don't rely on it.")}</p>}
            {ob3.problems && ob3.problems.length > 0 && (
              <ul className="text-xs text-red-700 dark:text-red-300 list-disc ps-4">{ob3.problems.map((p) => <li key={p}>{p}</li>)}</ul>
            )}
            {ob3.items && ob3.items.length > 0 && (
              <ul className="text-sm space-y-1">
                {ob3.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    <span>{it.name}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase border ${statusBadgeClass(it.status)}`}>{it.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {result && !result.valid && (
          <div className="glass-panel rounded-2xl p-5 border border-red-500/40 space-y-1">
            <p className="text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
              <XCircle className="w-5 h-5" />{en(" Not a valid Edulexa credential")}
            </p>
            <p className="text-sm text-muted-foreground">{result.error}</p>
          </div>
        )}

        {result?.valid && claims && (
          <div className="space-y-4">
            <div className="glass-panel rounded-2xl p-5 border border-border space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />{en(" Signature verified ✓ (ES256, key id ")}{result.keyId})
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {browserCheck?.state === "verified"
                      ? en("Confirmed by the server and independently in your browser.")
                      : browserCheck?.state === "failed"
                        ? en("The server accepted it, but your browser's own check did not. Treat this result with caution.")
                        : "Confirmed by the server. " + (browserCheck?.detail ?? "")}
                  </p>
                </div>
                {result.status && (
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${statusBadgeClass(result.status)}`}>
                    {result.status}
                  </span>
                )}
              </div>
              {result.revoked && <p className="text-sm text-red-700 dark:text-red-300">{en("The holder has revoked this credential. Don't rely on it.")}</p>}
              {result.expired && !result.revoked && <p className="text-sm text-muted-foreground">{en("This credential passed its validity date on {date}.", { date: formatDate(claims.exp) })}</p>}
            </div>

            <div className="glass-panel rounded-2xl p-5 border border-border grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">{en("Holder: ")}</span><span className="font-semibold">{claims.name}</span></div>
              <div><span className="text-muted-foreground">{en("Task: ")}</span>{claims.task.title}</div>
              <div><span className="text-muted-foreground">{en("Type / language: ")}</span>{claims.task.taskType ?? "—"} · {claims.task.language ?? "—"}</div>
              <div><span className="text-muted-foreground">{en("AI policy: ")}</span>{claims.task.aiPolicy ?? "—"}</div>
              <div>
                <span className="text-muted-foreground">{en("Tests passed: ")}</span>
                {claims.results.testsTotal ? `${claims.results.testsPassed ?? 0}/${claims.results.testsTotal}` : "—"}
              </div>
              <div><span className="text-muted-foreground">{en("Voice defense: ")}</span>{Math.round(claims.results.defenseScore)}/100</div>
              {claims.results.defectsTotal !== undefined && (
                <div><span className="text-muted-foreground">{en("Planted defects fixed: ")}</span>{claims.results.defectsFixed ?? 0}/{claims.results.defectsTotal}</div>
              )}
              <div><span className="text-muted-foreground">{en("Integrity: ")}</span>{claims.integrity}</div>
              {claims.humanDecision && <div><span className="text-muted-foreground">{en("Human reviewer: ")}</span>{claims.humanDecision}</div>}
              <div><span className="text-muted-foreground">{en("Issued / valid until: ")}</span>{formatDate(claims.iat)} · {formatDate(claims.exp)}</div>
              <div className="sm:col-span-2 text-xs text-muted-foreground break-all">
                {en("Issuer ")}<span className="font-mono">{claims.iss}</span>{en(" · credential id ")}<span className="font-mono">{claims.sub}</span>
                {claims.evidenceHash && (
                  <>
                    {" "}{en("· evidence hash ")}<span className="font-mono">{claims.evidenceHash}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <section className="glass-panel rounded-2xl p-5 border border-border grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <h2 className="text-sm font-bold mb-2">{en("What a valid credential shows")}</h2>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc ps-4">
              {CREDENTIAL_DISCLAIMER_POINTS.proves.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm font-bold mb-2">{en("What it doesn't show")}</h2>
            <ul className="space-y-1.5 text-xs text-muted-foreground list-disc ps-4">
              {CREDENTIAL_DISCLAIMER_POINTS.doesNotProve.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <p className="md:col-span-2 text-xs text-muted-foreground">
            {en("Offline checks: verify the signature with any JOSE library using the JWKS above, then call")}{" "}
            <span className="font-mono">{en("GET /api/verify/credential/<credential id>/status")}</span>{en(" to see whether it was revoked.")}
          </p>
        </section>
      </div>
    </div>
  );
}

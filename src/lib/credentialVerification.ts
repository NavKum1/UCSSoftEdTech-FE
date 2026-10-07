import { API_BASE_URL } from "@/lib/apiClient";

export const CREDENTIAL_JWKS_PATH = "/.well-known/edulexa-credential-keys.json";

export interface CredentialClaims {
  iss: string;
  sub: string;
  typ: string;
  name: string;
  task: { title: string; taskType?: string | null; aiPolicy?: string | null; language?: string | null };
  results: {
    testsPassed?: number | null;
    testsTotal?: number | null;
    defenseScore: number;
    defectsFixed?: number;
    defectsTotal?: number;
  };
  integrity: string;
  humanDecision?: string | null;
  evidenceHash?: string | null;
  iat: number;
  exp: number;
}

export type CredentialStatus = "Valid" | "Expired" | "Under review" | "Revoked";

export interface ClientSignatureCheck {
  state: "verified" | "failed" | "unsupported";
  keyId?: string;
  detail: string;
}

interface Jwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid: string;
  alg?: string;
}

function base64UrlToBytes(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment<T>(segment: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as T;
}

export function decodeJwsPayload(jws: string): CredentialClaims | null {
  try {
    const parts = jws.trim().split(".");
    if (parts.length !== 3) return null;
    return decodeJsonSegment<CredentialClaims>(parts[1]);
  } catch {
    return null;
  }
}

/**
 * Verifies an ES256 compact JWS in the browser against the published JWKS, independently of the server's own check.
 * JWS ES256 signatures are raw r||s (64 bytes), which is the format WebCrypto's ECDSA verify expects.
 */
export async function verifyJwsInBrowser(jws: string): Promise<ClientSignatureCheck> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return { state: "unsupported", detail: "This browser can't check signatures here (WebCrypto needs HTTPS)." };
  }
  try {
    const parts = jws.trim().split(".");
    if (parts.length !== 3) return { state: "failed", detail: "Not a compact JWS." };
    const header = decodeJsonSegment<{ alg?: string; kid?: string }>(parts[0]);
    if (header.alg !== "ES256") return { state: "failed", detail: "Unexpected signature algorithm." };

    const res = await fetch(`${API_BASE_URL}${CREDENTIAL_JWKS_PATH}`, { cache: "no-store" });
    if (!res.ok) return { state: "unsupported", detail: "The public signing keys could not be loaded." };
    const jwks = (await res.json()) as { keys: Jwk[] };
    const candidates = [...jwks.keys].sort((a, b) => (a.kid === header.kid ? -1 : b.kid === header.kid ? 1 : 0));

    const signature = base64UrlToBytes(parts[2]);
    const data = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    for (const jwk of candidates) {
      if (jwk.kty !== "EC" || jwk.crv !== "P-256") continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true },
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["verify"]
      );
      const ok = await crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, signature, data);
      if (ok) return { state: "verified", keyId: jwk.kid, detail: "Checked in your browser against the published keys." };
    }
    return { state: "failed", detail: "The signature does not match any published Edulexa key." };
  } catch {
    return { state: "unsupported", detail: "The signature could not be checked in this browser." };
  }
}

export function formatDate(value?: string | number | null): string {
  if (value === null || value === undefined) return "—";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "Valid":
      return "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40";
    case "Under review":
      return "bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40";
    case "Revoked":
      return "bg-red-100 dark:bg-red-500/15 text-red-800 dark:text-red-300 border-red-300 dark:border-red-500/40";
    default:
      return "bg-slate-100 dark:bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-500/40";
  }
}

export const CREDENTIAL_DISCLAIMER_POINTS = {
  proves: [
    "The holder completed the task shown here on Edulexa, and the listed test results came from running their submission.",
    "They then explained and defended their solution in a recorded voice conversation, scored by an AI evaluator.",
    "The details above were signed by Edulexa and have not been altered since.",
  ],
  doesNotProve: [
    "That no one else helped. Integrity checks raise the cost of cheating but cannot rule it out.",
    "Every skill a role needs. It covers one task in one language.",
    "Suitability for a particular job. It is not a hiring recommendation; people make hiring decisions.",
  ],
};

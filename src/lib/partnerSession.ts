/**
 * Partner sign-in session (F9). When a partner such as SeekJobs launches career services, the API redirects to
 * /partner/callback#token=... and the token is kept in sessionStorage for this tab only. useAppAuth prefers it
 * over the regular identity provider while it is valid. See docs/partner/seekjobs_sso_for_edulexa.md (backend).
 */

import { useSyncExternalStore } from "react";

const KEY = "career.partnerSession";
// Marker cookie (no token in it) so middleware lets partner users reach the sign-in-only career routes.
// The API still authorizes every call with the partner token itself.
export const PARTNER_MARKER_COOKIE = "career_partner";

function setMarkerCookie(expiresAt: number | null) {
  try {
    document.cookie = expiresAt
      ? `${PARTNER_MARKER_COOKIE}=1; path=/; SameSite=Lax; expires=${new Date(expiresAt).toUTCString()}`
      : `${PARTNER_MARKER_COOKIE}=; path=/; SameSite=Lax; max-age=0`;
  } catch {
    /* cookies unavailable */
  }
}

export interface PartnerSession {
  token: string;
  expiresAt: number; // epoch ms
  userId: string | null;
  role: string | null;
  instituteId: string | null;
}

function decodeClaims(token: string): Record<string, unknown> | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const claims = JSON.parse(json);
    return claims && typeof claims === "object" ? claims : null;
  } catch {
    return null;
  }
}

export function savePartnerSession(token: string): PartnerSession | null {
  const claims = decodeClaims(token);
  if (!claims || typeof claims.exp !== "number" || claims.aud !== "edulexa-partner-session") return null;
  const session: PartnerSession = {
    token,
    expiresAt: claims.exp * 1000,
    userId: typeof claims.sub === "string" ? claims.sub : null,
    role: typeof claims.role === "string" ? claims.role : null,
    instituteId: typeof claims.institute_id === "string" ? claims.institute_id : null,
  };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    return null;
  }
  setMarkerCookie(session.expiresAt);
  return session;
}

/** The stored partner session while it has at least 30 s left; expired sessions are removed. */
export function getPartnerSession(): PartnerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as PartnerSession;
    if (!session?.token || typeof session.expiresAt !== "number" || Date.now() > session.expiresAt - 30_000) {
      window.sessionStorage.removeItem(KEY);
      setMarkerCookie(null);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function clearPartnerSession() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  setMarkerCookie(null);
}

/** Only same-app paths such as /student/appointments; anything else falls back. */
export function safeReturnTo(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\s]/.test(value)) return fallback;
  return value;
}

const noopSubscribe = () => () => {};

/** The current partner token (null on the server and when there is none), safe for hydration. */
export function usePartnerToken(): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => getPartnerSession()?.token ?? null,
    () => null,
  );
}

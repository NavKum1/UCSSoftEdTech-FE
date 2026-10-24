/**
 * Local development only: a developer session started from the sign-in page's shortcuts. It holds one of the API's
 * development tokens (accepted only when the API runs in Development, see Program.cs), so the portals work without
 * Keycloak running. It is used only when DEMO_LOGIN_ENABLED (NODE_ENV development or NEXT_PUBLIC_ENABLE_DEMO_LOGIN), so
 * a production build ignores it. A candidate session keeps one user id (sent as X-User-Id) so their data stays theirs.
 */

import { useSyncExternalStore } from "react";

export const DEMO_LOGIN_ENABLED =
  process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === "true";

export interface DevSession {
  role: string;
  label: string;
  token: string;
  userId: string | null;
}

const KEY = "edulexa_dev_session";
const EVENT = "edulexa-dev-session";

export const DEV_PERSONAS: Record<string, { label: string; token: string; perUser: boolean }> = {
  Candidate: { label: "Candidate", token: "candidate-dev-token", perUser: true },
  Recruiter: { label: "Recruiter", token: "recruiter-dev-token", perUser: false },
  InstituteAdmin: { label: "Institute admin", token: "institute-admin-dev-token", perUser: false },
};

let cachedRaw: string | null = null;
let cached: DevSession | null = null;

export function getDevSession(): DevSession | null {
  if (!DEMO_LOGIN_ENABLED || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = raw ? (JSON.parse(raw) as DevSession) : null;
    }
    return cached?.token ? cached : null;
  } catch {
    return null;
  }
}

/** Starts (or switches) the developer session. A candidate keeps the same user id across sessions in this browser. */
export function startDevSession(role: string): DevSession | null {
  const persona = DEV_PERSONAS[role];
  if (!DEMO_LOGIN_ENABLED || !persona) return null;
  let userId: string | null = null;
  if (persona.perUser) {
    try {
      userId = window.localStorage.getItem(`${KEY}_candidate_id`) ?? crypto.randomUUID();
      window.localStorage.setItem(`${KEY}_candidate_id`, userId);
    } catch {
      userId = crypto.randomUUID();
    }
  }
  const session: DevSession = { role, label: persona.label, token: persona.token, userId };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    return null;
  }
  window.dispatchEvent(new Event(EVENT));
  return session;
}

export function endDevSession() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** The current developer session (null on the server, in production builds and when none is active). */
export function useDevSession(): DevSession | null {
  return useSyncExternalStore(subscribe, getDevSession, () => null);
}

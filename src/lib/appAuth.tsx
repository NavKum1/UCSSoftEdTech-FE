"use client";

/**
 * The app's sign-in: Keycloak through Auth.js (see src/auth.ts). Pages use these hooks, never the provider directly.
 * Clerk was removed on 1 Nov 2026 (plan item A6); production had already moved to Keycloak.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { SessionProvider, getSession, signIn, useSession } from "next-auth/react";
import { API_BASE_URL, REGION_ROUTING, authenticatedFetch, getApiRegion, setApiRegion } from "@/lib/apiClient";
import { getPartnerSession, usePartnerToken } from "@/lib/partnerSession";
import { getDevSession, useDevSession } from "@/lib/devSession";


export interface AppAuth {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  /** Platform roles (the Keycloak realm roles) */
  roles: string[];
  getToken: () => Promise<string | null>;
}

function useKeycloakAppAuth(): AppAuth {
  const { data: session, status } = useSession();
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // The cached access token while it is fresh; otherwise re-read the session, which refreshes it server-side
  const getToken = useCallback(async () => {
    const current = sessionRef.current;
    if (current?.accessToken && current.accessTokenExpires && Date.now() / 1000 < current.accessTokenExpires - 30) {
      return current.accessToken;
    }
    const fresh = await getSession();
    sessionRef.current = fresh;
    return fresh?.error ? null : (fresh?.accessToken ?? null);
  }, []);

  const signedIn = status === "authenticated" && !session?.error;
  return {
    isLoaded: status !== "loading",
    isSignedIn: signedIn,
    userId: signedIn ? (session?.user?.id ?? null) : null,
    roles: signedIn ? (session?.roles ?? []) : [],
    getToken,
  };
}


// F9 partner sign-in: a partner session token (sessionStorage, set by /partner/callback) takes precedence while valid
// Local development: a developer session from the sign-in page shortcuts (lib/devSession) signs in as that persona
export function useAppAuth(): AppAuth {
  const provider = useKeycloakAppAuth();
  const partnerToken = usePartnerToken();
  const dev = useDevSession();
  const providerGetToken = provider.getToken;
  const getToken = useCallback(async () => getDevSession()?.token ?? getPartnerSession()?.token ?? providerGetToken(), [providerGetToken]);
  if (dev) return { isLoaded: true, isSignedIn: true, userId: dev.userId, roles: [dev.role], getToken };
  if (!partnerToken) return { ...provider, getToken };
  return { isLoaded: true, isSignedIn: true, userId: getPartnerSession()?.userId ?? null, roles: [], getToken };
}

/** S4b: what Your account can ask the sign-in service to do: change the name, the password, or add an authenticator app or a passkey */
export type AccountAction = "UPDATE_PROFILE" | "UPDATE_PASSWORD" | "CONFIGURE_TOTP" | "webauthn-register";

/** Starts the Keycloak sign-in (PKCE). loginHint lets Keycloak route a university email to its identity provider. */
/**
 * Sends the browser to the Keycloak sign-in page (or, with `signUp`, its registration page: OIDC prompt=create).
 * location.replace keeps /login out of the history, so Back from Keycloak returns to the page the visitor came from.
 * Resolves to an error code when Auth.js refuses to start the flow.
 */
export async function keycloakSignIn(
  redirectTo: string,
  options: { loginHint?: string; signUp?: boolean; /** S4b: a change the person asked for on Your account (Keycloak required action) */ action?: AccountAction } = {},
): Promise<string | undefined> {
  const params: Record<string, string> = {};
  if (options.action) params.kc_action = options.action;
  if (options.loginHint) params.login_hint = options.loginHint;
  if (options.signUp) params.prompt = "create";
  const result = await signIn("keycloak", { redirectTo, redirect: false }, params);
  if (result?.url) {
    window.location.replace(result.url);
    return undefined;
  }
  return result?.error ?? "Configuration";
}

// G8 regional hosting: who is signed in, for routing this tab to the region that hosts their school
function useKeycloakIdentity(): { userId: string | null; email: string | null } {
  const { data: session, status } = useSession();
  const ok = status === "authenticated" && !session?.error;
  return { userId: ok ? (session?.user?.id ?? null) : null, email: ok ? (session?.user?.email ?? null) : null };
}


/**
 * G8: after sign-in, asks the default API (the region directory) which region hosts the user's email domain and points this
 * tab's API calls there (see apiClient.ts). Rendered only when NEXT_PUBLIC_API_REGIONS is set; renders nothing.
 * A wrong-region answer from any API call does the same, so this is only a head start that saves one refused request.
 */
function RegionRouting() {
  const { userId, email } = useKeycloakIdentity();
  useEffect(() => {
    if (!userId) return;
    const stored = getApiRegion();
    if (stored?.user && stored.user !== userId) {
      setApiRegion(null); // a different user signed in in this tab: start again from the default API
    } else if (stored) {
      if (!stored.user) setApiRegion(stored.region, userId); // switched by a wrong-region answer before we knew the user
      return;
    }
    const domain = email?.split("@")[1];
    if (!domain) return;
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/career/region-lookup?domain=${encodeURIComponent(domain)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((b: { region?: unknown } | null) => {
        if (!cancelled && typeof b?.region === "string") setApiRegion(b.region, userId);
      })
      .catch(() => {
        // Lookup unavailable: calls go to the default API, which answers wrong-region if needed
      });
    return () => {
      cancelled = true;
    };
  }, [userId, email]);
  return null;
}

/** Wraps the app in the session context the Keycloak hooks need */
export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const routing = REGION_ROUTING ? <RegionRouting /> : null;
  // Re-check the session every 4 minutes so the access token is refreshed before the 5-minute expiry
  return (
    <SessionProvider refetchInterval={240}>
      {routing}
      {children}
    </SessionProvider>
  );
}

const SCHOOL_KEY = "career.school";

export function getSelectedSchool(): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(SCHOOL_KEY);
  } catch {
    return null;
  }
}

export function setSelectedSchool(instituteId: string | null) {
  try {
    if (instituteId) window.localStorage.setItem(SCHOOL_KEY, instituteId);
    else window.localStorage.removeItem(SCHOOL_KEY);
  } catch {
    // Storage blocked: the API asks for a choice again when it's ambiguous
  }
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

/**
 * Returns a JSON API caller bound to the signed-in user. Throws ApiError with the server's message on non-2xx.
 * Pass a FormData body for uploads; pass `raw: true` to get the Response (downloads, CSV).
 */
export function useApi() {
  const { getToken } = useAppAuth();
  return useCallback(
    async <T = unknown,>(path: string, init: RequestInit & { json?: unknown; raw?: boolean } = {}): Promise<T> => {
      const { json, raw, ...rest } = init;
      const options: RequestInit = { ...rest };
      // Career-suite calls carry the school the user picked (validated by the API against their memberships)
      const school = getSelectedSchool();
      if (school && path.startsWith("/api/career")) {
        const headers = new Headers(options.headers || {});
        if (!headers.has("X-Career-Institute")) headers.set("X-Career-Institute", school);
        options.headers = headers;
      }
      if (json !== undefined) {
        options.body = JSON.stringify(json);
        options.method = options.method ?? "POST";
      }
      const res = await authenticatedFetch(path, options, getToken);
      if (raw) return res as unknown as T;
      const text = await res.text();
      let body: unknown = undefined;
      try {
        body = text ? JSON.parse(text) : undefined;
      } catch {
        body = text;
      }
      if (!res.ok) {
        const message =
          (body && typeof body === "object" && ("message" in body || "error" in body || "title" in body)
            ? String((body as Record<string, unknown>).message ?? (body as Record<string, unknown>).error ?? (body as Record<string, unknown>).title)
            : typeof body === "string" && body && body.length <= 300 && !body.trimStart().startsWith("<")
              ? body
              : res.status === 401
                ? "Your session has ended. Sign in again to continue."
                : res.status === 403
                  ? "You don't have access to this. Ask your administrator if you need it."
                  : res.status === 404
                    ? "We couldn't find what you were looking for. It may have been removed."
                    : "Something went wrong on our side. Please try again in a moment.");
        throw new ApiError(res.status, message, body);
      }
      return body as T;
    },
    [getToken],
  );
}

// The account menu is components/layout/AccountMenu (one for every header)

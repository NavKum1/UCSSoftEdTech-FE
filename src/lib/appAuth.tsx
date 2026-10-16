"use client";

/**
 * Provider-neutral auth for new pages. Career-suite pages use these hooks instead of importing Clerk directly,
 * so moving the platform to Keycloak changes this module only.
 *
 * NEXT_PUBLIC_AUTH_PROVIDER selects the identity provider at build time: "clerk" (default) or "keycloak"
 * (Auth.js + Keycloak, see src/auth.ts). The value is inlined by Next, so each build uses exactly one set of hooks.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAuth, useUser, UserButton } from "@clerk/nextjs";
import { SessionProvider, getSession, signIn, useSession } from "next-auth/react";
import { LogOut } from "lucide-react";
import { API_BASE_URL, REGION_ROUTING, authenticatedFetch, getApiRegion, setApiRegion } from "@/lib/apiClient";
import { getPartnerSession, usePartnerToken } from "@/lib/partnerSession";

export type AuthProviderName = "clerk" | "keycloak";
export const AUTH_PROVIDER: AuthProviderName = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "keycloak" ? "keycloak" : "clerk";

export interface AppAuth {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  /** Platform roles (Clerk public metadata role/roles, or the Keycloak realm roles) */
  roles: string[];
  getToken: () => Promise<string | null>;
}

function useClerkAppAuth(): AppAuth {
  const { isLoaded, isSignedIn, userId, getToken } = useAuth();
  const { user } = useUser();
  const token = useCallback(() => getToken(), [getToken]);
  const metadata = (user?.publicMetadata ?? {}) as { role?: unknown; roles?: unknown };
  const roles = [...(typeof metadata.role === "string" ? [metadata.role] : []), ...(Array.isArray(metadata.roles) ? metadata.roles : [])].filter(
    (r): r is string => typeof r === "string",
  );
  return { isLoaded, isSignedIn: !!isSignedIn, userId: userId ?? null, roles, getToken: token };
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

const useProviderAppAuth: () => AppAuth = AUTH_PROVIDER === "keycloak" ? useKeycloakAppAuth : useClerkAppAuth;

// F9 partner sign-in: a partner session token (sessionStorage, set by /partner/callback) takes precedence while valid
export function useAppAuth(): AppAuth {
  const provider = useProviderAppAuth();
  const partnerToken = usePartnerToken();
  const providerGetToken = provider.getToken;
  const getToken = useCallback(async () => getPartnerSession()?.token ?? providerGetToken(), [providerGetToken]);
  if (!partnerToken) return { ...provider, getToken };
  return { isLoaded: true, isSignedIn: true, userId: getPartnerSession()?.userId ?? null, roles: [], getToken };
}

/** Starts the Keycloak sign-in (PKCE). loginHint lets Keycloak route a university email to its identity provider. */
export function keycloakSignIn(redirectTo: string, loginHint?: string) {
  return signIn("keycloak", { redirectTo }, loginHint ? { login_hint: loginHint } : undefined);
}

// G8 regional hosting: who is signed in, for routing this tab to the region that hosts their school
function useClerkIdentity(): { userId: string | null; email: string | null } {
  const { userId } = useAuth();
  const { user } = useUser();
  return { userId: userId ?? null, email: user?.primaryEmailAddress?.emailAddress ?? null };
}

function useKeycloakIdentity(): { userId: string | null; email: string | null } {
  const { data: session, status } = useSession();
  const ok = status === "authenticated" && !session?.error;
  return { userId: ok ? (session?.user?.id ?? null) : null, email: ok ? (session?.user?.email ?? null) : null };
}

const useIdentity = AUTH_PROVIDER === "keycloak" ? useKeycloakIdentity : useClerkIdentity;

/**
 * G8: after sign-in, asks the default API (the region directory) which region hosts the user's email domain and points this
 * tab's API calls there (see apiClient.ts). Rendered only when NEXT_PUBLIC_API_REGIONS is set; renders nothing.
 * A wrong-region answer from any API call does the same, so this is only a head start that saves one refused request.
 */
function RegionRouting() {
  const { userId, email } = useIdentity();
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

/** Wraps the app in the session context the Keycloak hooks need; a no-op in Clerk mode (ClerkProvider is in the root layout). */
export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const routing = REGION_ROUTING ? <RegionRouting /> : null;
  if (AUTH_PROVIDER !== "keycloak")
    return (
      <>
        {routing}
        {children}
      </>
    );
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
            : typeof body === "string" && body
              ? body
              : `Request failed (${res.status})`);
        throw new ApiError(res.status, message, body);
      }
      return body as T;
    },
    [getToken],
  );
}

function KeycloakUserButton() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Escape closes the menu and returns focus to its button
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  const name = session?.user?.name ?? session?.user?.email ?? "Account";
  const initials = name
    .split(/[s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-md"
        title={name}
        aria-label={`Account menu for ${name}`}
        aria-expanded={open}
        aria-controls="account-menu"
      >
        {initials || "?"}
      </button>
      {open && (
        <div id="account-menu" className="absolute right-0 mt-2 w-60 rounded-2xl bg-card border border-border shadow-2xl p-2 z-[100]">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-xs font-bold text-foreground truncate">{session?.user?.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">{session?.user?.email}</div>
          </div>
          {/* Full-page GET (no client routing/prefetch): the route ends the Keycloak session as well */}
          <form method="get" action="/api/auth/federated-logout">
          <button
            type="submit"
            className="mt-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-foreground hover:bg-muted"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
          </form>
        </div>
      )}
    </div>
  );
}

export function AppUserButton() {
  return AUTH_PROVIDER === "keycloak" ? <KeycloakUserButton /> : <UserButton />;
}

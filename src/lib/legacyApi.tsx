"use client";

/**
 * H7: the API now requires a signed-in user for everything except a short public list (see the backend's
 * `// H7 public:` markers). The older, non-career pages used plain fetch() with no token; they call the API through
 * this hook instead, which sends the provider-neutral token from useAppAuth (Clerk, Keycloak or a partner session)
 * and remembers a 401/403 so the page can show a sign-in or not-allowed state instead of crashing on empty data.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/apiClient";
import { useAppAuth } from "@/lib/appAuth";
import SignInRequired, { type AccessProblem } from "@/components/SignInRequired";

export type { AccessProblem };

export interface LegacyApiOptions {
  /** Don't turn a 401/403 from this call into the page-level notice (optional extras, background polling). */
  quiet?: boolean;
}

export function useLegacyApi() {
  const auth = useAppAuth();
  const { getToken, isLoaded, isSignedIn } = auth;
  const [denied, setDenied] = useState<401 | 403 | null>(null);

  /**
   * fetch() for an API path such as "/api/passport", with the user's bearer token. Returns the Response.
   * A 401 (signed out / session ended) turns into the page-level notice; so does a 403 on a read (GET), since the page
   * can't show its data. A 403 on an action is left to the caller: the rest of the page still works.
   */
  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}, options: LegacyApiOptions = {}) => {
      const res = await authenticatedFetch(path, init, getToken);
      const read = (init.method ?? "GET").toUpperCase() === "GET";
      if (!options.quiet && (res.status === 401 || (res.status === 403 && read))) setDenied(res.status);
      return res;
    },
    [getToken],
  );

  const access: AccessProblem | null =
    (isLoaded && !isSignedIn) || denied === 401 ? "signin" : denied === 403 ? "forbidden" : null;

  return {
    ...auth,
    apiFetch,
    /** Auth has loaded and there is a user: start loading data. */
    ready: isLoaded && isSignedIn,
    /** Set when the visitor is signed out or the API refused this user; render <AccessNotice problem={access} />. */
    access,
  };
}

/**
 * A ref that always holds the latest `value` (updated after every render). A page effect calls its loader through it,
 * `loadRef.current()`, so the effect still runs only when its own deps change (e.g. `ready`) but always calls the
 * current closure. Same ref-based pattern as career useLoad; it keeps a loader that starts with setLoading(true) out of
 * the effect body (react-hooks/set-state-in-effect).
 */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Full-page state for a signed-out visitor (sign-in button back to this page) or a user whose role can't use it.
 * `title` and `message` replace the generic sign-in wording where the page can say more (e.g. "Sign in to take the quiz").
 * Same design as every other signed-in-required state (components/SignInRequired).
 */
export function AccessNotice({
  problem,
  feature,
  title,
  message,
}: {
  problem: AccessProblem;
  feature?: string;
  title?: string;
  message?: string;
}) {
  return <SignInRequired problem={problem} feature={feature} title={title} message={message} />;
}

/** Small inline variant for a panel inside a page that's otherwise usable (e.g. a widget on a public page). */
export function InlineAccessNotice({ problem, feature, title }: { problem: AccessProblem; feature: string; title?: string }) {
  return (
    <SignInRequired
      variant="inline"
      problem={problem}
      title={title ?? (problem === "signin" ? `Sign in to see ${feature}` : undefined)}
      message={problem === "signin" ? "It needs an account. Sign in and you'll come straight back here." : `Your account's role can't see ${feature}.`}
    />
  );
}

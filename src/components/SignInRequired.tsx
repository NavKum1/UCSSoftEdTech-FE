"use client";

/**
 * The one signed-in-required state for the app: a heading, a one-line explanation, a primary "Sign in" button that
 * brings the visitor back to this page (`/login?redirect_url=...`) and, with Clerk, a secondary "Create account".
 * The "not allowed" (403) variant uses the same layout. `variant="page"` fills a page; `variant="inline"` sits inside
 * a card on an otherwise usable page (e.g. the graded challenges list next to the public practice editor).
 *
 * The root carries data-access-notice="signin" | "forbidden" so tests can find it.
 */

import React, { useId, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";

export type AccessProblem = "signin" | "forbidden";

const noSubscribe = () => () => {};

/**
 * The current path plus its query string (e.g. /prep/counselling?partner=x). The server snapshot has no query, so the
 * server render and hydration match; the client then renders with the query. Used for the sign-in link, so the visitor
 * comes back to the same page and parameters.
 */
export function useReturnPath(): string {
  const pathname = usePathname() || "/";
  const search = useSyncExternalStore(noSubscribe, () => window.location.search, () => "");
  return pathname + search;
}

/** The sign-in page, returning to `returnPath` afterwards. */
export function signInHref(returnPath: string): string {
  return `/login?redirect_url=${encodeURIComponent(returnPath)}`;
}

/** Sign-up (Clerk's form, or Keycloak's registration page), returning to `returnPath` afterwards. */
export function signUpHref(returnPath: string): string {
  return `/login?mode=signup&redirect_url=${encodeURIComponent(returnPath)}`;
}

/**
 * Both providers allow self-registration: the TotalOffice realm takes sign-ups from any country (email, name, country;
 * infrastructure/identity/realms/totaloffice). Set NEXT_PUBLIC_DISABLE_SIGN_UP=true where accounts may only come from
 * an organization's identity provider.
 */
export const CAN_SIGN_UP = process.env.NEXT_PUBLIC_DISABLE_SIGN_UP !== "true";

// White text on indigo-600 is 6.3:1; the focus ring is drawn outside the button so it shows on any background
const primaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400";
const secondaryClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:focus-visible:outline-indigo-400";

type HeadingLevel = 1 | 2 | 3 | 4;

export interface SignInRequiredProps {
  problem?: AccessProblem;
  /** Heading. Defaults to "Sign in to continue" (or "You don't have access to this page"). */
  title?: string;
  /** One-line explanation under the heading. */
  message?: string;
  /** What needs the account, used in the default message (e.g. "Your dashboard"). */
  feature?: string;
  /** Where to come back to after signing in; defaults to the current page and query string. */
  returnTo?: string;
  variant?: "page" | "inline";
  /** Defaults to 1 for a page and 3 inline. */
  headingLevel?: HeadingLevel;
  /** Show "Create account" next to "Sign in" (Clerk only). Default true. */
  signUp?: boolean;
  className?: string;
}

export default function SignInRequired({
  problem = "signin",
  title,
  message,
  feature,
  returnTo,
  variant = "page",
  headingLevel,
  signUp = true,
  className = "",
}: SignInRequiredProps) {
  const currentPath = useReturnPath();
  const back = returnTo ?? currentPath;
  const headingId = useId();
  const signin = problem === "signin";
  const inline = variant === "inline";
  const Heading = `h${headingLevel ?? (inline ? 3 : 1)}` as "h1" | "h2" | "h3" | "h4";
  const Icon = signin ? Lock : ShieldAlert;

  const heading = signin ? (title ?? "Sign in to continue") : (title ?? "You don't have access to this page");
  const text = signin
    ? (message ?? `${feature ?? "This page"} needs an account. Sign in and you'll come straight back here.`)
    : (message ?? `Your account's role can't use ${feature ? feature.charAt(0).toLowerCase() + feature.slice(1) : "this page"}. If you think it should, ask your administrator for access.`);

  const size = inline ? "px-4 py-2 text-xs" : "px-5 py-2.5 text-sm";

  return (
    <section
      aria-labelledby={headingId}
      data-access-notice={problem}
      className={`${inline ? "py-4" : "max-w-xl mx-auto px-6 py-16"} w-full text-center ${className}`}
    >
      <div
        aria-hidden="true"
        className={`${inline ? "w-9 h-9 mb-2" : "w-12 h-12 mb-4"} mx-auto rounded-2xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300`}
      >
        <Icon className={inline ? "w-4 h-4" : "w-6 h-6"} />
      </div>
      <Heading id={headingId} className={`${inline ? "text-sm" : "text-xl"} font-bold text-foreground`}>
        {heading}
      </Heading>
      <p className={`${inline ? "text-xs mt-1" : "text-sm mt-2"} text-muted-foreground max-w-md mx-auto`}>{text}</p>
      <div className={`${inline ? "mt-3" : "mt-6"} flex flex-wrap items-center justify-center gap-2`}>
        {signin ? (
          <>
            <Link href={signInHref(back)} className={`${primaryClass} ${size}`}>
              Sign in
            </Link>
            {signUp && CAN_SIGN_UP && (
              <Link href={signUpHref(back)} className={`${secondaryClass} ${size}`}>
                Create account
              </Link>
            )}
          </>
        ) : (
          <Link href="/dashboard" className={`${primaryClass} ${size}`}>
            Go to your dashboard
          </Link>
        )}
      </div>
    </section>
  );
}

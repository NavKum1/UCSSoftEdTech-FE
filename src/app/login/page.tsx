"use client";

/**
 * Sign-in (/login) and sign-up (/login?mode=signup) for both identity providers (NEXT_PUBLIC_AUTH_PROVIDER):
 * - Clerk: <SignIn>/<SignUp> styled through its appearance API, in the brand-aware frame (components/auth).
 * - Keycloak: straight on to the one TotalOffice sign-in page (themed per product, identity-theme/), so visitors see a
 *   single sign-in screen. Sign-up opens Keycloak's registration page. The card below is shown only when the flow
 *   can't start, Auth.js reports an error (?error=...), or the visitor came back here with the Back button.
 * White-label hosts never see "Edulexa". The global navigation is hidden here (lib/careerNav.ts, AUTH_PAGES).
 */

import React, { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignIn, SignUp } from "@clerk/nextjs";
import { AlertCircle, ArrowRight, Building2, Loader2, Lock, ShieldCheck, UserPlus } from "lucide-react";
import { AUTH_PROVIDER, keycloakSignIn } from "@/lib/appAuth";
import AuthLayout from "@/components/auth/AuthLayout";
import DevShortcuts, { DEMO_LOGIN_ENABLED } from "@/components/auth/DevShortcuts";
import { brandName, useAuthBrand, type AuthBrandState } from "@/components/auth/authBrand";
import { clerkAppearance } from "@/components/auth/clerkAppearance";
import { CAN_SIGN_UP } from "@/components/SignInRequired";

// useSearchParams needs a Suspense boundary for static prerendering
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect_url") || "/dashboard";
  // ?mode=signup: Clerk's sign-up form, or Keycloak's registration page
  const signUp = CAN_SIGN_UP && searchParams.get("mode") === "signup";
  const signInUrl = `/login?redirect_url=${encodeURIComponent(redirectUrl)}`;
  const signUpUrl = `/login?mode=signup&redirect_url=${encodeURIComponent(redirectUrl)}`;

  const brand = useAuthBrand();
  const name = brandName(brand);

  // Page title per brand (the root metadata names Edulexa, which a white-label host must not show)
  useEffect(() => {
    if (brand.kind === "loading") return;
    const action = signUp ? "Create account" : "Sign in";
    document.title = name ? `${action} · ${name}` : action;
  }, [brand.kind, name, signUp]);

  if (AUTH_PROVIDER === "keycloak") {
    return (
      <KeycloakSignIn
        redirectUrl={redirectUrl}
        signUp={signUp}
        loginHint={searchParams.get("login_hint") ?? undefined}
        authError={searchParams.get("error")}
        brand={brand}
      />
    );
  }

  const heading = signUp ? "Create your account" : "Welcome back";
  const subtitle = signUp
    ? name
      ? `Get started with ${name}.`
      : "Get started."
    : name
      ? `Sign in to continue to ${name}.`
      : "Sign in to continue.";

  return (
    <AuthLayout state={brand}>
      <div className="mb-7 space-y-1.5">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">{heading}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {signUp ? (
        <SignUp key="signup" routing="hash" fallbackRedirectUrl={redirectUrl} signInUrl={signInUrl} appearance={clerkAppearance} />
      ) : (
        <SignIn key="signin" routing="hash" fallbackRedirectUrl={redirectUrl} signUpUrl={signUpUrl} appearance={clerkAppearance} />
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link
          href="/login/sso"
          className="group inline-flex items-center gap-1.5 rounded-md font-medium text-foreground/90 underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-ring)]"
        >
          <Building2 aria-hidden="true" className="h-4 w-4 text-[var(--auth-link)]" />
          Sign in with enterprise SSO
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </p>

      {DEMO_LOGIN_ENABLED && <DevShortcuts />}
    </AuthLayout>
  );
}

// Auth.js error codes (?error=...) in plain words; anything else gets the generic line
const AUTH_ERRORS: Record<string, string> = {
  AccessDenied: "Your account isn't allowed to sign in here. Ask your administrator for access.",
  Verification: "That sign-in link has expired or was already used. Please sign in again.",
  Configuration: "Sign-in isn't available right now. Please try again in a few minutes.",
};

const noSubscribe = () => () => {};

function cameBackWithBackButton(): boolean {
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === "back_forward";
  } catch {
    return false;
  }
}

interface KeycloakSignInProps {
  redirectUrl: string;
  signUp: boolean;
  loginHint?: string;
  authError: string | null;
  brand: AuthBrandState;
}

// Keycloak mode: one sign-in page for every TotalOffice app. University and employer users are sent on to their own
// identity provider by Keycloak (identity-first login, email-domain discovery), so nothing is asked here first.
function KeycloakSignIn({ redirectUrl, signUp, loginHint, authError, brand }: KeycloakSignInProps) {
  // The flow's own failure (Auth.js refused to start it); authError is one Auth.js reported on the way back
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Don't bounce straight back to Keycloak after an error, or when the visitor pressed Back to leave it
  const cameBack = useSyncExternalStore(noSubscribe, cameBackWithBackButton, () => false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current || authError || cameBackWithBackButton()) return;
    started.current = true;
    void keycloakSignIn(redirectUrl, { loginHint, signUp }).then((code) => code && setFailure(code));
  }, [authError, loginHint, redirectUrl, signUp]);

  const go = async (asSignUp: boolean) => {
    setFailure(null);
    setBusy(true);
    const code = await keycloakSignIn(redirectUrl, { loginHint, signUp: asSignUp });
    if (code) {
      setFailure(code);
      setBusy(false);
    }
  };

  const error = failure ?? authError;
  if (!error && !cameBack) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4" aria-busy="true">
        <p role="status" className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          {signUp ? "Opening sign-up…" : "Taking you to sign-in…"}
        </p>
      </main>
    );
  }

  const platform = brand.kind === "edulexa";
  return (
    <AuthLayout state={brand}>
      <div className="mb-7 space-y-1.5">
        <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-foreground">
          {signUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {signUp ? "Create your account, then come back here." : "Sign in to continue."}
        </p>
      </div>

      <div className="space-y-5 rounded-2xl border border-[var(--auth-card-border)] bg-[var(--auth-card-bg)] p-6 shadow-[var(--auth-card-shadow)] sm:p-7">
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            {AUTH_ERRORS[error] ?? "We couldn't sign you in. Please try again."}
          </p>
        )}
        <button
          type="button"
          onClick={() => void go(signUp)}
          disabled={busy}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--auth-primary)] bg-linear-to-b from-white/12 to-white/0 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(16_24_40/0.2),0_6px_16px_-6px_var(--auth-primary-glow)] transition-colors hover:bg-[var(--auth-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-ring)] disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          ) : signUp ? (
            <UserPlus aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Lock aria-hidden="true" className="h-4 w-4" />
          )}
          {busy ? "Redirecting…" : signUp ? "Create account" : "Sign in"}
        </button>
        {(signUp || CAN_SIGN_UP) && (
          <p className="text-center text-sm text-muted-foreground">
            {signUp ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => void go(!signUp)}
              className="rounded-md font-medium text-[var(--auth-link)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--auth-ring)]"
            >
              {signUp ? "Sign in" : "Create an account"}
            </button>
          </p>
        )}
        <p className="flex items-start justify-center gap-1.5 border-t border-[var(--auth-card-border)] pt-4 text-center text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0" />
          {platform
            ? "One account for Edulexa, Hire, Documents and AttendSpot. Your university or work login works here too."
            : "Your university or work login works here."}
        </p>
      </div>

      {DEMO_LOGIN_ENABLED && <DevShortcuts />}
    </AuthLayout>
  );
}

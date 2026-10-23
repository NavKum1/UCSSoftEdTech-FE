"use client";

/**
 * Split-screen frame for the sign-in and sign-up pages: a brand panel on the left (desktop) and the auth column on
 * the right; a single column with a compact brand header below the lg breakpoint.
 *
 * Brand-aware (see authBrand.ts): Edulexa copy only for the platform brand; a white-label host gets its own name,
 * logo and color and no Edulexa text; an unknown host gets no brand at all.
 * Proof points are product facts from the public site and the app (no metrics, logos or testimonials: see
 * docs/career_suite_claims_audit.md).
 */

import React from "react";
import { BadgeCheck, Mic, ScanSearch, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { brandTextColors, accessibleBrandColor } from "@/components/career/brandColor";
import type { AuthBrandState } from "@/components/auth/authBrand";

const PROOF_POINTS = [
  {
    icon: Mic,
    title: "AI voice interviews",
    text: "Candidates explain and defend their own code to an AI interviewer.",
  },
  {
    icon: ScanSearch,
    title: "Evidence reviewers can check",
    text: "Keystroke and paste replay sits next to the submitted code.",
  },
  {
    icon: BadgeCheck,
    title: "Verifiable credentials",
    text: "Anyone can check a credential at its public verification link.",
  },
];

/** Inline CSS variables that recolor the page for a white-label brand (empty for Edulexa) */
export function brandScopeStyle(state: AuthBrandState): React.CSSProperties {
  if (state.kind !== "white-label" || !state.brand.primaryColor) return {};
  const text = brandTextColors(state.brand.primaryColor);
  return {
    "--auth-brand-primary": accessibleBrandColor(state.brand.primaryColor),
    "--auth-brand-link-light": text.light,
    "--auth-brand-link-dark": text.dark,
  } as React.CSSProperties;
}

function EdulexaMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-indigo-500 via-violet-600 to-purple-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_20px_-8px_rgb(79_70_229/0.7)] ring-1 ring-white/15`}
    >
      <Shield className="h-[55%] w-[55%]" strokeWidth={2.25} />
    </span>
  );
}

/** Brand name and mark. `tone="light"` sits on the dark brand panel; `"auto"` follows the page theme. */
function Wordmark({ state, tone }: { state: AuthBrandState; tone: "light" | "auto" }) {
  const textClass = tone === "light" ? "text-white" : "text-foreground";
  if (state.kind === "edulexa") {
    return (
      <span className="inline-flex items-center gap-2.5">
        <EdulexaMark className={tone === "light" ? "h-9 w-9" : "h-8 w-8"} />
        <span className={`text-lg font-semibold tracking-tight ${textClass}`}>{state.brand.displayName}</span>
      </span>
    );
  }
  if (state.kind === "white-label") {
    const { brand } = state;
    return (
      <span className="inline-flex items-center gap-2.5">
        {brand.logoUrl ? (
          // Partner logos are arbitrary URLs from brand settings; next/image would need each host allow-listed
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt="" className="h-8 w-auto max-w-32 rounded-md object-contain" />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ background: "var(--auth-primary)" }}
          >
            {brand.displayName.charAt(0).toUpperCase()}
          </span>
        )}
        <span className={`text-lg font-semibold tracking-tight ${textClass}`}>{brand.displayName}</span>
      </span>
    );
  }
  // Unknown host: no brand at all. Loading: a placeholder that holds the space.
  if (state.kind === "neutral") return <span aria-hidden="true" className="block h-8" />;
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-2.5">
      <span className={`h-8 w-8 rounded-lg ${tone === "light" ? "bg-white/10" : "bg-muted"}`} />
      <span className={`h-4 w-24 rounded ${tone === "light" ? "bg-white/10" : "bg-muted"} animate-pulse motion-reduce:animate-none`} />
    </span>
  );
}

function BrandPanel({ state }: { state: AuthBrandState }) {
  const year = new Date().getFullYear();
  return (
    <div
      className="auth-panel relative hidden overflow-hidden text-white lg:flex lg:flex-col"
      data-brand={state.kind === "white-label" ? "white-label" : "platform"}
    >
      {/* Decorative layers */}
      <div aria-hidden="true" className="absolute inset-0">
        <div className="auth-orb auth-orb-a -left-24 -top-24 h-112 w-md bg-violet-500/40" />
        <div className="auth-orb auth-orb-b -bottom-32 -right-24 h-128 w-lg bg-indigo-500/35" />
        <div className="auth-gridlines" />
        <div className="auth-grain" />
        <div className="absolute inset-y-0 right-0 w-px bg-linear-to-b from-transparent via-white/15 to-transparent" />
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-between p-10 xl:p-14">
        <Wordmark state={state} tone="light" />

        {state.kind === "edulexa" && (
          <div className="auth-rise max-w-md space-y-8">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/7 px-3 py-1 text-xs font-medium text-indigo-100 backdrop-blur-sm">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgb(52_211_153/0.8)]" />
                AI career &amp; assessment platform
              </p>
              <p className="text-4xl font-semibold leading-[1.1] tracking-tight xl:text-[2.75rem]">
                <span className="block">Build it.</span>
                <span className="block bg-linear-to-r from-indigo-200 via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
                  Then defend it.
                </span>
              </p>
              <p className="text-pretty text-base leading-relaxed text-indigo-100/85">
                Real coding work and AI voice technical interviews, so skills are shown, not claimed.
              </p>
            </div>
            <ul className="space-y-5">
              {PROOF_POINTS.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/8 shadow-[inset_0_1px_0_rgb(255_255_255/0.12)]"
                  >
                    <Icon className="h-4 w-4 text-indigo-100" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{title}</span>
                    <span className="block text-sm leading-relaxed text-indigo-100/80">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.kind === "white-label" && (
          <div className="auth-rise max-w-md space-y-3">
            <p className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight">Welcome to {state.brand.displayName}</p>
            <p className="text-base leading-relaxed text-white/85">Sign in to continue to your account.</p>
          </div>
        )}

        {(state.kind === "loading" || state.kind === "neutral") && <div />}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/75">
          {(state.kind === "edulexa" || state.kind === "white-label") && (
            <span>
              &copy; {year} {state.brand.displayName}
            </span>
          )}
          {state.kind === "white-label" && state.brand.privacyUrl && (
            <a href={state.brand.privacyUrl} className="underline-offset-4 hover:text-white hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Privacy
            </a>
          )}
          {state.kind === "white-label" && state.brand.termsUrl && (
            <a href={state.brand.termsUrl} className="underline-offset-4 hover:text-white hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
              Terms
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AuthLayout({ state, children }: { state: AuthBrandState; children: React.ReactNode }) {
  return (
    <div className="auth-scope grid min-h-dvh w-full bg-background text-foreground lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]" style={brandScopeStyle(state)}>
      <BrandPanel state={state} />

      <div className="relative flex min-w-0 flex-col" style={{ backgroundImage: "var(--auth-page-tint)" }}>
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5 lg:justify-end lg:px-8 lg:pt-6">
          <span className="lg:hidden">
            <Wordmark state={state} tone="auto" />
          </span>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-start justify-center px-4 pb-10 pt-8 sm:px-6 sm:pt-12 lg:items-center lg:pb-16 lg:pt-6">
          <div className="auth-rise w-full max-w-100">{children}</div>
        </div>
      </div>
    </div>
  );
}

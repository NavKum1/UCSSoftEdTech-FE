"use client";

/**
 * Brand for the sign-in and sign-up pages. Like the career shell, it asks /api/career/brand which brand serves this
 * host, so a white-label host (e.g. a partner's domain) never shows "Edulexa" here.
 *
 * While the answer is pending the pages show no brand name. If the lookup fails, "Edulexa" is used only on hosts that
 * are known to be ours (localhost, NEXT_PUBLIC_APP_URL's host, *.edulexa.com); any other host stays brand-neutral.
 */

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/apiClient";

export interface AuthBrand {
  displayName: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  privacyUrl?: string | null;
  termsUrl?: string | null;
  isWhiteLabel: boolean;
}

/** "loading": not known yet; "edulexa": the platform brand; "white-label": a partner brand; "neutral": unknown host, no brand */
export type AuthBrandState =
  | { kind: "loading" }
  | { kind: "edulexa"; brand: AuthBrand }
  | { kind: "white-label"; brand: AuthBrand }
  | { kind: "neutral" };

export const PLATFORM_BRAND: AuthBrand = { displayName: "Edulexa", primaryColor: "#4f46e5", isWhiteLabel: false };

function isPlatformHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") return true;
  if (h === "edulexa.com" || h.endsWith(".edulexa.com")) return true;
  try {
    const app = process.env.NEXT_PUBLIC_APP_URL;
    if (app && new URL(app).hostname.toLowerCase() === h) return true;
  } catch {
    // Malformed NEXT_PUBLIC_APP_URL: not a match
  }
  return false;
}

export function useAuthBrand(): AuthBrandState {
  const [state, setState] = useState<AuthBrandState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    // A slow API must not leave the page unbranded for long: give up after a few seconds and use the fallback
    const timer = window.setTimeout(() => controller.abort(), 6000);
    const host = window.location.hostname;
    fetch(`${API_BASE_URL}/api/career/brand?host=${encodeURIComponent(host)}`, { cache: "no-store", signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<AuthBrand>) : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (!b || typeof b.displayName !== "string") throw new Error("Malformed brand");
        if (cancelled) return;
        setState(b.isWhiteLabel ? { kind: "white-label", brand: b } : { kind: "edulexa", brand: { ...PLATFORM_BRAND, ...b, isWhiteLabel: false } });
      })
      .catch(() => {
        if (cancelled) return;
        setState(isPlatformHost(host) ? { kind: "edulexa", brand: PLATFORM_BRAND } : { kind: "neutral" });
      })
      .finally(() => window.clearTimeout(timer));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);

  return state;
}

/** The brand's display name, or null while unknown or on an unknown host */
export function brandName(state: AuthBrandState): string | null {
  return state.kind === "edulexa" || state.kind === "white-label" ? state.brand.displayName : null;
}

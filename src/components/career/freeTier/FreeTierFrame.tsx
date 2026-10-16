"use client";

/**
 * G13 free student tier: minimal brand-aware frame (no CareerShell: a free user has no school membership).
 * The brand comes from /api/career/brand by host, so the pages stay white-label safe.
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/apiClient";
import { useCareerT } from "@/components/career/ui";

export interface FreeBrand {
  displayName: string;
  logoUrl?: string | null;
}

export interface FreeAvailability {
  available: boolean;
  code: "available" | "disabled" | "country_unknown" | "country_not_available";
  country?: string | null;
  minimumAge: number;
}

export interface FreeHome {
  account: { displayName: string; email: string; country: string; status: string; createdAt: string };
  usage: {
    plan: string;
    allocatedMinutes: number;
    usedMinutes: number;
    bonusMinutes: number;
    remainingMinutes: number;
    resetsAt?: string | null;
    exhausted: boolean;
    proMonthlyMinutes: number;
    proMonthlyPriceCents: number;
    topUpMinutes: number;
    topUpPriceCents: number;
    currency: string;
  };
  portfolio: { credentials: number; projects: number; interviews: number };
  tools: string[];
  schoolMatches: { instituteId: string; name: string; via: string }[];
  links: { id: string; instituteId: string; name: string; carryPortfolio: boolean; sharing: boolean; createdAt: string }[];
}

export async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(String(res.status));
  return (await res.json()) as T;
}

export function useFreeBrand(): FreeBrand | null {
  const [brand, setBrand] = useState<FreeBrand | null>(null);
  useEffect(() => {
    let cancelled = false;
    publicGet<FreeBrand>(`/api/career/brand?host=${encodeURIComponent(window.location.hostname)}`)
      .then((b) => !cancelled && setBrand(b))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return brand;
}

export default function FreeTierFrame({ children }: { children: React.ReactNode }) {
  const t = useCareerT("freeTier");
  const brand = useFreeBrand();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <a href="#free-main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
        {t("skip")}
      </a>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/free" className="flex items-center gap-2 font-semibold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {brand?.logoUrl && <img src={brand.logoUrl} alt="" className="h-7 w-auto" />}
            <span>{brand?.displayName ?? t("brandFallback")}</span>
          </Link>
          <nav aria-label={t("navLabel")} className="flex gap-4 text-sm">
            <Link href="/free" className="underline-offset-4 hover:underline">
              {t("navAbout")}
            </Link>
            <Link href="/free/home" className="underline-offset-4 hover:underline">
              {t("navHome")}
            </Link>
          </nav>
        </div>
      </header>
      <main id="free-main" className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {children}
      </main>
    </div>
  );
}

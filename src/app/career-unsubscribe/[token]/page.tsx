"use client";

/**
 * Public one-click unsubscribe page for career-center campaign emails (no sign-in). The signed token in the URL names the
 * school, address and category; tampered links are refused by the API. Brand-aware header from /api/career/brand.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { BRAND_TEXT_CLASS, brandCssVars } from "@/components/career/brandColor";
import { Button, ErrorBanner, Loading, SuccessBanner, useCareerT } from "@/components/career/ui";

interface Brand {
  displayName: string;
  logoUrl?: string | null;
  primaryColor: string;
  supportEmail?: string | null;
  privacyUrl?: string | null;
}

interface Info {
  school: { displayName: string; slug: string };
  category: string;
  email: string;
  unsubscribed: string[];
}

async function request<T>(path: string, body: unknown, failed: (status: number) => string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    referrerPolicy: "no-referrer",
  });
  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message = data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : failed(res.status);
    throw new Error(message);
  }
  return data as T;
}

/** The API helper with its fallback error in the page language (G1). */
function useCall() {
  const t = useCareerT("careerUnsubscribe");
  return useCallback(<T,>(path: string, body?: unknown) => request<T>(path, body, (status) => t("somethingWentWrongStatus", { status })), [t]);
}

export default function CareerUnsubscribePage() {
  const tr = useCareerT("careerUnsubscribe");
  const call = useCall();
  const { token } = useParams<{ token: string }>();
  const path = `/api/career/messaging/unsubscribe/${encodeURIComponent(token)}`;
  const [info, setInfo] = useState<Info | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    call<Info>(path)
      .then((v) => {
        if (cancelled) return;
        setInfo(v);
        call<Brand>(`/api/career/brand?school=${encodeURIComponent(v.school.slug)}`).then((b) => !cancelled && setBrand(b)).catch(() => {});
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        call<Brand>(`/api/career/brand?host=${encodeURIComponent(window.location.hostname)}`).then((b) => !cancelled && setBrand(b)).catch(() => {});
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, tick, call]);

  const act = async (suffix: string, scope: string | undefined, success: string) => {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await call(path + suffix, { scope });
      setMsg(success);
      setTick((t) => t + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const color = brand?.primaryColor ?? "#4f46e5";
  const offCategory = info ? info.unsubscribed.includes(info.category) : false;
  const offAll = info ? info.unsubscribed.includes("all") : false;

  return (
    <div className="min-h-screen bg-background text-foreground" style={brandCssVars(color) as React.CSSProperties}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.displayName} className="h-8 w-auto" />
          ) : (
            <span className={`font-semibold ${BRAND_TEXT_CLASS}`}>
              {brand?.displayName ?? ""}
            </span>
          )}
          {info && <span className="text-sm text-muted-foreground">{tr("forDisplayName", { displayName: info.school.displayName })}</span>}
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">{tr("emailPreferences")}</h1>
        <div aria-live="polite">
          <ErrorBanner error={error} />
          <SuccessBanner message={msg} />
        </div>
        {loading && !info ? (
          <Loading />
        ) : info ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <p className="text-sm">
              {tr.rich("addressEmail", { strong: (chunks) => <strong>{chunks}</strong>, email: info.email })}
            </p>
            <p className="text-sm">
              {offAll
                ? tr("youWontGetAnyCampaign", { displayName: info.school.displayName })
                : offCategory
                  ? tr("youreUnsubscribedFromCategoryEmails", { category: info.category, displayName: info.school.displayName })
                  : tr("youreGettingCategoryEmailsFrom", { category: info.category, displayName: info.school.displayName })}
            </p>
            <div className="flex flex-wrap gap-2">
              {!offCategory && !offAll && (
                <Button busy={busy} onClick={() => act("", undefined, tr("unsubscribedFromCategoryEmails", { category: info.category }))}>
                  {tr("unsubscribeFromCategoryEmails", { category: info.category })}
                </Button>
              )}
              {!offAll && (
                <Button variant="secondary" busy={busy} onClick={() => act("", "all", tr("unsubscribedFromAllCampaignEmails"))}>
                  {tr("unsubscribeFromAllCampaignEmails")}
                </Button>
              )}
              {offCategory && (
                <Button variant="secondary" busy={busy} onClick={() => act("/undo", undefined, tr("subscribedToCategoryEmailsAgain", { category: info.category }))}>
                  {tr("subscribeToCategoryAgain", { category: info.category })}
                </Button>
              )}
              {offAll && (
                <Button variant="secondary" busy={busy} onClick={() => act("/undo", "all", tr("campaignEmailsTurnedBackOn"))}>
                  {tr("turnCampaignEmailsBackOn")}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {tr("thisOnlyAffectsAnnouncementsSent")}
            </p>
          </div>
        ) : null}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          {brand?.supportEmail ? tr("questionsSupportEmail", { supportEmail: brand.supportEmail }) : ""}
          {brand?.privacyUrl && (
            <>
              {" "}
              <a href={brand.privacyUrl} className="underline">
                {tr("privacy")}
              </a>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

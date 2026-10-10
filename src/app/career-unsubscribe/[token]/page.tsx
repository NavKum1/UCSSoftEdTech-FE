"use client";

/**
 * Public one-click unsubscribe page for career-center campaign emails (no sign-in). The signed token in the URL names the
 * school, address and category; tampered links are refused by the API. Brand-aware header from /api/career/brand.
 */

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { Button, ErrorBanner, Loading, SuccessBanner } from "@/components/career/ui";

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

async function call<T>(path: string, body?: unknown): Promise<T> {
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
    const message = data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : `Something went wrong (${res.status}).`;
    throw new Error(message);
  }
  return data as T;
}

export default function CareerUnsubscribePage() {
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
  }, [path, tick]);

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
    <div className="min-h-screen bg-background text-foreground" style={{ ["--brand" as string]: color } as React.CSSProperties}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.displayName} className="h-8 w-auto" />
          ) : (
            <span className="font-semibold" style={{ color }}>
              {brand?.displayName ?? ""}
            </span>
          )}
          {info && <span className="text-sm text-muted-foreground">for {info.school.displayName}</span>}
        </div>
      </header>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">Email preferences</h1>
        <div aria-live="polite">
          <ErrorBanner error={error} />
          <SuccessBanner message={msg} />
        </div>
        {loading && !info ? (
          <Loading />
        ) : info ? (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <p className="text-sm">
              Address: <strong>{info.email}</strong>
            </p>
            <p className="text-sm">
              {offAll
                ? `You won't get any campaign emails from the ${info.school.displayName} career center.`
                : offCategory
                  ? `You're unsubscribed from "${info.category}" emails from the ${info.school.displayName} career center.`
                  : `You're getting "${info.category}" emails from the ${info.school.displayName} career center.`}
            </p>
            <div className="flex flex-wrap gap-2">
              {!offCategory && !offAll && (
                <Button busy={busy} onClick={() => act("", undefined, `Unsubscribed from "${info.category}" emails.`)}>
                  Unsubscribe from {info.category} emails
                </Button>
              )}
              {!offAll && (
                <Button variant="secondary" busy={busy} onClick={() => act("", "all", "Unsubscribed from all campaign emails.")}>
                  Unsubscribe from all campaign emails
                </Button>
              )}
              {offCategory && (
                <Button variant="secondary" busy={busy} onClick={() => act("/undo", undefined, `Subscribed to "${info.category}" emails again.`)}>
                  Subscribe to {info.category} again
                </Button>
              )}
              {offAll && (
                <Button variant="secondary" busy={busy} onClick={() => act("/undo", "all", "Campaign emails turned back on.")}>
                  Turn campaign emails back on
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This only affects announcements sent to groups. You&apos;ll still get emails about your own conversations, appointments and requests.
            </p>
          </div>
        ) : null}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          {brand?.supportEmail ? `Questions: ${brand.supportEmail}.` : ""}
          {brand?.privacyUrl && (
            <>
              {" "}
              <a href={brand.privacyUrl} className="underline">
                Privacy
              </a>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

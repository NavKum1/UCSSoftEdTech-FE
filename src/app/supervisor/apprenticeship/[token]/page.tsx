"use client";

/**
 * Public page for a registered-apprenticeship sponsor (no account). The signed link in the URL asks for one sign-off:
 * a progress review, a completed year, a wage increase or completion. Brand-aware header from /api/career/brand.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { BRAND_TEXT_CLASS, brandCssVars } from "@/components/career/brandColor";
import { Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useCareerFormat, useCareerT } from "@/components/career/ui";

interface Brand {
  displayName: string;
  logoUrl?: string | null;
  primaryColor: string;
  supportEmail?: string | null;
  privacyUrl?: string | null;
}

interface SponsorView {
  kind: "ProgressReview" | "YearCompleted" | "WageIncrease" | "Completion";
  expiresAt: string;
  statement: string;
  sha256: string;
  proposedRate?: number | null;
  proposedStep?: number | null;
  staffNote?: string | null;
  school: { displayName?: string | null; slug?: string | null };
  apprenticeship: {
    studentName: string;
    occupation: string;
    occupationCode?: string | null;
    registrationNumber?: string | null;
    sponsorName: string;
    sponsorContactName: string;
    startDate: string;
    expectedEndDate?: string | null;
    ojlHoursRequired: number;
    rtiHoursRequired: number;
    ojlHours: number;
    rtiHours: number;
    currentRate?: number | null;
  };
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
  if (!res.ok) throw new Error(data && typeof data === "object" && "message" in data ? String((data as { message: unknown }).message) : failed(res.status));
  return data as T;
}

export default function ApprenticeshipSponsorPage() {
  const t = useCareerT("sponsorSignoff");
  const fmt = useCareerFormat();
  const { token } = useParams<{ token: string }>();
  const path = `/api/career/workforce/sponsor/${encodeURIComponent(token)}`;
  const call = useCallback(<T,>(p: string, body?: unknown) => request<T>(p, body, (status) => t("failed", { status })), [t]);
  const [view, setView] = useState<SponsorView | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typedName, setTypedName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "decline" | null>(null);

  useEffect(() => {
    let cancelled = false;
    call<SponsorView>(path)
      .then((v) => {
        if (cancelled) return;
        setView(v);
        if (v.school.slug) call<Brand>(`/api/career/brand?school=${encodeURIComponent(v.school.slug)}`).then((b) => !cancelled && setBrand(b)).catch(() => {});
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
  }, [path, call]);

  const sign = async (approve: boolean) => {
    if (!view) return;
    setBusy(approve ? "approve" : "decline");
    setError(null);
    try {
      await call(`${path}/sign`, { approve, typedName, sha256: view.sha256, note: note || null });
      setDone(approve ? t("thanksApproved") : t("thanksDeclined"));
      setView(null);
    } catch (e) {
      setError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const a = view?.apprenticeship;
  const money = (v?: number | null) => (v === null || v === undefined ? "—" : fmt.currency(v, "USD"));
  return (
    <div className="min-h-screen bg-background text-foreground" style={brandCssVars(brand?.primaryColor ?? "#4f46e5") as React.CSSProperties}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.displayName} className="h-8 w-auto" />
          ) : (
            <span className={`font-semibold ${BRAND_TEXT_CLASS}`}>{brand?.displayName ?? ""}</span>
          )}
          {view?.school.displayName && <span className="text-sm text-muted-foreground">{t("forSchool", { school: view.school.displayName })}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">{view && a ? t(`title.${view.kind}`, { name: a.studentName }) : t("pageTitle")}</h1>
        <div aria-live="polite">
          <ErrorBanner error={error} />
          <SuccessBanner message={done} />
        </div>
        {loading && !view ? (
          <Loading />
        ) : (
          view &&
          a && (
            <>
              <Card title={t("apprenticeshipTitle")}>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div><dt className="font-medium">{t("apprentice")}</dt><dd><bdi>{a.studentName}</bdi></dd></div>
                  <div><dt className="font-medium">{t("occupation")}</dt><dd>{a.occupation}{a.occupationCode ? ` (${a.occupationCode})` : ""}</dd></div>
                  <div><dt className="font-medium">{t("sponsor")}</dt><dd>{a.sponsorName}</dd></div>
                  {a.registrationNumber && <div><dt className="font-medium">{t("registration")}</dt><dd dir="ltr" className="text-start">{a.registrationNumber}</dd></div>}
                  <div><dt className="font-medium">{t("dates")}</dt><dd>{t("dateRange", { start: fmt.date(a.startDate, { timeZone: "UTC" }), end: a.expectedEndDate ? fmt.date(a.expectedEndDate, { timeZone: "UTC" }) : "—" })}</dd></div>
                  <div><dt className="font-medium">{t("ojl")}</dt><dd>{t("hoursOf", { hours: fmt.number(a.ojlHours), required: fmt.number(a.ojlHoursRequired) })}</dd></div>
                  <div><dt className="font-medium">{t("rti")}</dt><dd>{t("hoursOf", { hours: fmt.number(a.rtiHours), required: fmt.number(a.rtiHoursRequired) })}</dd></div>
                  <div><dt className="font-medium">{t("currentWage")}</dt><dd>{money(a.currentRate)}</dd></div>
                  {view.kind === "WageIncrease" && <div><dt className="font-medium">{t("proposedWage")}</dt><dd>{money(view.proposedRate)}{view.proposedStep ? ` · ${t("step", { step: view.proposedStep })}` : ""}</dd></div>}
                </dl>
                {view.staffNote && <p className="mt-3 text-sm">{t("schoolNote", { note: view.staffNote })}</p>}
              </Card>
              <Card title={t("statementTitle")}>
                <p className="whitespace-pre-line text-sm">{view.statement}</p>
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void sign(true);
                  }}
                >
                  <Field label={t("typedName")} hint={t("typedNameHint")}>{(props) => <input {...props} required autoComplete="name" value={typedName} onChange={(e) => setTypedName(e.target.value)} />}</Field>
                  <Field label={t("note")} hint={t("noteHint")}>{(props) => <textarea {...props} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}</Field>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" busy={busy === "approve"} disabled={typedName.trim().length < 2}>{t("approve")}</Button>
                    <Button type="button" variant="secondary" busy={busy === "decline"} disabled={typedName.trim().length < 2} onClick={() => void sign(false)}>{t("decline")}</Button>
                  </div>
                </form>
              </Card>
            </>
          )
        )}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>
            {t("linkOnly")}
            {view ? ` ${t("expires", { date: formatDate(view.expiresAt) })}` : ""}
          </p>
          <p className="mt-1">
            {t("sharedWithConsent")}
            {brand?.supportEmail ? ` ${t("questions", { email: brand.supportEmail })}` : ""}
            {brand?.privacyUrl && (
              <>
                {" "}
                <a href={brand.privacyUrl} className="underline">{t("privacy")}</a>
              </>
            )}
          </p>
        </footer>
      </main>
    </div>
  );
}

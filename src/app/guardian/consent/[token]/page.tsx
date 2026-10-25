"use client";

/**
 * Public page for a parent or guardian (no account). The signed link in the URL lets them read the notice and choose
 * which uses of their child's career data to allow. Brand-aware header from /api/career/brand.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useCareerT } from "@/components/career/ui";

interface View {
  school?: string | null;
  studentFirstName?: string | null;
  guardianName: string;
  status: string;
  minorAge: number;
  law: string;
  noticeVersion: string;
  noticeUrl?: string | null;
  expiresAt: string;
  purposes: { key: string; title: string; description: string; granted: boolean }[];
}

async function request<T>(path: string, init: RequestInit | undefined, failed: (status: number) => string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message ?? failed(res.status));
  return body as T;
}

/** The API helper with its fallback error in the page language (G1). */
function useCall() {
  const t = useCareerT("guardianConsent");
  return useCallback(<T,>(path: string, init?: RequestInit) => request<T>(path, init, () => t("somethingWentWrong")), [t]);
}

export default function GuardianConsentPage() {
  const t = useCareerT("guardianConsent");
  const call = useCall();
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<View | null>(null);
  const [brand, setBrand] = useState<string>("");
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    call<{ displayName: string }>("/api/career/brand").then((b) => setBrand(b.displayName)).catch(() => {});
    call<View>(`/api/career/privacy/guardian/${encodeURIComponent(token)}`)
      .then((v) => {
        setView(v);
        setChosen(Object.fromEntries(v.purposes.map((p) => [p.key, p.granted])));
      })
      .catch((e) => setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message));
  }, [token, call]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const purposes = Object.entries(chosen).filter(([, v]) => v).map(([k]) => k);
      const r = await call<{ status: string }>(`/api/career/privacy/guardian/${encodeURIComponent(token)}`, {
        method: "POST",
        body: JSON.stringify({ attestedName: name, confirmGuardian: confirm, purposes, language: document.documentElement.lang || "en" }),
      });
      setDone(r.status === "Consented" ? t("thankYouYourChoicesAre") : t("savedNothingIsAllowedFor"));
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm text-muted-foreground">{brand}</p>
        <h1 className="text-2xl font-semibold">{t("parentOrGuardianConsent")}</h1>
      </header>
      <ErrorBanner error={err} />
      <SuccessBanner message={done} />
      {!view && !err ? (
        <Loading />
      ) : view ? (
        <Card>
          <form onSubmit={submit} className="space-y-4 text-sm">
            <p>
              {t("dearGuardianNameSchoolAsksFor", { guardianName: view.guardianName, school: view.school ?? t("theSchool"), studentFirstName: view.studentFirstName ?? t("yourChild"), minorAge: view.minorAge, law: view.law, noticeVersion: view.noticeVersion })}
              {view.noticeUrl ? (
                <>
                  {" "}(<a className="underline" href={view.noticeUrl} target="_blank" rel="noreferrer">{t("readTheFullNotice")}</a>)
                </>
              ) : null}
              {t("thisLinkWorksUntilExpiresAt", { expiresAt: formatDate(view.expiresAt) })}
            </p>
            <fieldset className="space-y-3">
              <legend className="font-medium">{t("whatMayTheSchoolDo")}</legend>
              {view.purposes.map((p) => (
                <label key={p.key} className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1" checked={!!chosen[p.key]} onChange={(e) => setChosen({ ...chosen, [p.key]: e.target.checked })} />
                  <span>
                    <span className="font-medium">{p.title}</span>
                    <span className="block text-muted-foreground">{p.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <Field label={t("yourFullNameYourSignature")}>{(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />}</Field>
            <label className="flex items-start gap-3">
              <input type="checkbox" className="mt-1" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} required />
              <span>{t("iAmThisStudentsParent")}</span>
            </label>
            <Button type="submit" busy={busy}>{t("saveMyChoices")}</Button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}

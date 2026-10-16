"use client";

/**
 * Public page for an internship site supervisor (no account): confirm whether the student did the work they described
 * in their internship defense. Shows only the student's work descriptions and a short defense summary, released under the
 * student's consent. Brand-aware header from /api/career/brand for the student's school.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/apiClient";
import { BRAND_TEXT_CLASS, brandCssVars } from "@/components/career/brandColor";
import { Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useCareerT } from "@/components/career/ui";
import { ArtifactList, type DefenseArtifact } from "@/components/career/experiences/InternshipDefense";

interface Brand {
  displayName: string;
  logoUrl?: string | null;
  primaryColor: string;
  supportEmail?: string | null;
  privacyUrl?: string | null;
}

interface DefenseView {
  expiresAt: string;
  school: { displayName: string; slug: string };
  experience: { studentName: string; employerName: string; roleTitle: string; startDate: string; endDate: string; supervisorName: string; supervisorTitle?: string | null };
  defense: { mode: string; defendedAt?: string | null; artifacts: DefenseArtifact[]; summary: string };
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
  const t = useCareerT("supervisorDefense");
  return useCallback(<T,>(path: string, body?: unknown) => request<T>(path, body, (status) => t("somethingWentWrongStatus", { status })), [t]);
}

export default function SupervisorDefensePage() {
  const t = useCareerT("supervisorDefense");
  const call = useCall();
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<DefenseView | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const path = `/api/career/internship-defense/supervisor/${encodeURIComponent(token)}`;

  useEffect(() => {
    let cancelled = false;
    call<DefenseView>(path)
      .then((v) => {
        if (cancelled) return;
        setView(v);
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
  }, [path, call]);

  const color = brand?.primaryColor ?? "#4f46e5";
  return (
    <div className="min-h-screen bg-background text-foreground" style={brandCssVars(color) as React.CSSProperties}>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          {brand?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logoUrl} alt={brand.displayName} className="h-8 w-auto" />
          ) : (
            <span className={`font-semibold ${BRAND_TEXT_CLASS}`}>
              {brand?.displayName ?? ""}
            </span>
          )}
          {view && <span className="text-sm text-muted-foreground">{t("forDisplayName", { displayName: view.school.displayName })}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold">{view ? t("confirmStudentNameSInternshipWork", { studentName: view.experience.studentName }) : t("confirmInternshipWork")}</h1>
        <div aria-live="polite">
          <ErrorBanner error={error} />
          <SuccessBanner message={msg} />
        </div>
        {loading && !view ? (
          <Loading />
        ) : view ? (
          <Body
            view={view}
            onSubmit={async (body) => {
              setError(null);
              try {
                await call(path, body);
                setMsg(t("thankYouYourAnswerWas"));
                setView(null);
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
        ) : null}
        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          <p>{t("thisSecureLinkIsOnly")}{view ? t("itExpiresOnExpiresAt", { expiresAt: formatDate(view.expiresAt) }) : ""}</p>
          <p className="mt-1">
            {t("theStudentAgreedToShare")}
            {brand?.supportEmail ? t("questionsSupportEmail", { supportEmail: brand.supportEmail }) : ""}
            {brand?.privacyUrl && (
              <>
                {" "}
                <a href={brand.privacyUrl} className="underline">
                  {t("privacy")}
                </a>
              </>
            )}
          </p>
        </footer>
      </main>
    </div>
  );
}

function Body({ view, onSubmit }: { view: DefenseView; onSubmit: (body: { answer: string; comment: string; name: string }) => Promise<void> }) {
  const t = useCareerT("supervisorDefense");
  const x = view.experience;
  const [answer, setAnswer] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState(x.supervisorName);
  const [busy, setBusy] = useState(false);
  const needsComment = answer === "Partly" || answer === "No";
  return (
    <>
      <Card title={t("internship")}>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted-foreground">{t("student")}</dt>
            <dd>{x.studentName}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("role")}</dt>
            <dd>
              {x.roleTitle}, {x.employerName}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("dates")}</dt>
            <dd>
              {t("startDateToEndDate", { startDate: formatDate(x.startDate), endDate: formatDate(x.endDate) })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("defended")}</dt>
            <dd>
              {formatDate(view.defense.defendedAt)} ({view.defense.mode.toLowerCase()})
            </dd>
          </div>
        </dl>
      </Card>
      <Card title={t("workTheStudentSaysThey")}>
        <ArtifactList artifacts={view.defense.artifacts} />
      </Card>
      <Card title={t("summaryOfTheirDefense")}>
        <p className="whitespace-pre-wrap text-sm">{view.defense.summary}</p>
      </Card>
      <Card title={t("yourConfirmation")}>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              await onSubmit({ answer, comment, name });
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset className="space-y-2 text-sm">
            <legend className="mb-1 font-medium">{t("didTheStudentDoThis")}</legend>
            {[
              { v: "Yes", l: t("answerYes") },
              { v: "Partly", l: t("answerPartly") },
              { v: "No", l: t("answerNo") },
            ].map((o) => (
              <label key={o.v} className="flex items-start gap-2">
                <input type="radio" name="answer" className="mt-1" value={o.v} checked={answer === o.v} onChange={() => setAnswer(o.v)} required />
                <span>{o.l}</span>
              </label>
            ))}
          </fieldset>
          <Field label={needsComment ? t("whatShouldTheSchoolKnow") : t("commentOptional")}>
            {(p) => <textarea {...p} rows={4} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} required={needsComment} />}
          </Field>
          <Field label={t("yourName")}>{(p) => <input {...p} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />}</Field>
          <Button type="submit" busy={busy} disabled={!answer || (needsComment && !comment.trim())}>
            {t("sendMyAnswer")}
          </Button>
        </form>
      </Card>
    </>
  );
}

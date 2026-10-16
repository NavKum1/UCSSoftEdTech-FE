"use client";

/**
 * G15 student view inside /student/experiences: registered apprenticeships (hours, wages, sponsor sign-offs, sharing
 * with the sponsor, logging related instruction) and short-term credentials downloadable as Open Badges 3.0.
 * Renders nothing when the student has neither.
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, ErrorBanner, Field, SuccessBanner, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { HoursProgress, type ApprenticeshipDto } from "./Apprenticeships";
import { checkboxClass, useDateOnly, useDownload } from "./shared";

interface MyCredentials {
  signingAvailable: boolean;
  awards: { id: string; name: string; achievementType: string; contactHours?: number | null; awardedOn: string; revoked: boolean; validUntil?: string | null }[];
}

function OneApprenticeship({ a, onChange }: { a: ApprenticeshipDto; onChange: (a: ApprenticeshipDto) => void }) {
  const api = useApi();
  const t = useCareerT("myWorkforce");
  const fmt = useCareerFormat();
  const dateOnly = useDateOnly();
  const [rti, setRti] = useState({ date: "", hours: "", description: "" });
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const p = a.progress;
  const money = (v?: number | null) => (v === null || v === undefined ? "—" : fmt.currency(v, "USD"));

  const run = async (fn: () => Promise<ApprenticeshipDto>, success: string) => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      onChange(await fn());
      setMsg(success);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby={`app-${a.id}`} className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={`app-${a.id}`} className="font-semibold">{t("apprenticeshipHeading", { occupation: a.occupation, sponsor: a.sponsorName })}</h3>
        <Badge tone={a.status === "Active" ? "good" : a.status === "Completed" ? "info" : "warn"}>{t(`statuses.${a.status}`)}</Badge>
      </div>
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <HoursProgress label={t("ojl")} value={p.ojlHours} required={a.ojlHoursRequired} />
      <HoursProgress label={t("rti")} value={p.rtiHours} required={a.rtiHoursRequired} pending={p.rtiPending} />
      <p className="text-sm">{t("wage", { rate: money(p.currentRate) })}</p>
      {a.signoffs.length > 0 && (
        <ul className="list-disc space-y-1 ps-5 text-sm">
          {a.signoffs.filter((s) => !s.revoked).slice(0, 5).map((s) => (
            <li key={s.id}>{t("signoffLine", { kind: t(`kinds.${s.kind}`), status: t(`signoffStatus.${s.status}`), date: s.signedAt ? fmt.date(s.signedAt) : fmt.date(s.issuedAt) })}</li>
          ))}
        </ul>
      )}
      <div className="flex items-start gap-2">
        <input
          id={`consent-${a.id}`}
          type="checkbox"
          className={`${checkboxClass} mt-0.5`}
          checked={a.sponsorConsent}
          disabled={busy}
          onChange={(e) => {
            const allow = e.target.checked;
            void run(() => api<ApprenticeshipDto>(`/api/career/workforce/apprenticeships/mine/${a.id}/sponsor-consent`, { method: "PUT", json: { allow } }), allow ? t("consentOn") : t("consentOff"));
          }}
        />
        <label htmlFor={`consent-${a.id}`} className="text-sm">
          {t("consentLabel", { sponsor: a.sponsorName })}
          <span className="block text-xs text-muted-foreground">{t("consentHint")}</span>
        </label>
      </div>
      {a.status === "Active" && (
        <form
          className="grid gap-3 sm:grid-cols-4 sm:items-end"
          aria-label={t("logRti")}
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const r = await api<ApprenticeshipDto>(`/api/career/workforce/apprenticeships/mine/${a.id}/rti`, { json: { date: rti.date || null, hours: rti.hours === "" ? null : Number(rti.hours), description: rti.description } });
              setRti({ date: "", hours: "", description: "" });
              return r;
            }, t("rtiLogged"));
          }}
        >
          <Field label={t("rtiDate")}>{(props) => <input {...props} type="date" required value={rti.date} onChange={(e) => setRti({ ...rti, date: e.target.value })} />}</Field>
          <Field label={t("rtiHours")}>{(props) => <input {...props} type="number" min={0} step="0.25" required value={rti.hours} onChange={(e) => setRti({ ...rti, hours: e.target.value })} />}</Field>
          <Field label={t("rtiCourse")}>{(props) => <input {...props} required value={rti.description} onChange={(e) => setRti({ ...rti, description: e.target.value })} />}</Field>
          <Button type="submit" busy={busy}>{t("logRti")}</Button>
        </form>
      )}
      {a.hours.some((h) => h.kind === "RTI" && h.status !== "Approved") && (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {a.hours.filter((h) => h.kind === "RTI" && h.status !== "Approved").map((h) => (
            <li key={h.id}>{t("rtiEntry", { date: dateOnly(h.date), hours: fmt.number(h.hours), status: t(`hourStatus.${h.status}`) })}{h.decisionNote ? ` (${h.decisionNote})` : ""}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{t("ojlHint")}</p>
    </section>
  );
}

export function ApprenticeshipCard() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const t = useCareerT("myWorkforce");
  const dateOnly = useDateOnly();
  const apps = useLoad(() => api<{ apprenticeships: ApprenticeshipDto[] }>("/api/career/workforce/apprenticeships/mine"), [api, schoolId]);
  const creds = useLoad(() => api<MyCredentials>("/api/career/workforce/credentials/mine"), [api, schoolId]);
  const { busy, error, download } = useDownload();
  const list = apps.data?.apprenticeships ?? [];
  const awards = creds.data?.awards ?? [];
  if (list.length === 0 && awards.length === 0) return null;

  return (
    <Card title={t("title")} className="mb-6">
      <div className="space-y-4">
        {list.map((a) => (
          <OneApprenticeship key={a.id} a={a} onChange={(updated) => apps.setData({ apprenticeships: list.map((x) => (x.id === updated.id ? updated : x)) })} />
        ))}
        {awards.length > 0 && (
          <section aria-labelledby="my-short-creds" className="space-y-2">
            <h3 id="my-short-creds" className="font-semibold">{t("credentialsHeading")}</h3>
            <ErrorBanner error={error} />
            {!creds.data?.signingAvailable && <p className="text-sm text-muted-foreground">{t("signingUnavailable")}</p>}
            <ul className="space-y-2 text-sm">
              {awards.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{t("awardedOn", { date: dateOnly(c.awardedOn) })}</span>
                  {c.validUntil && <span className="text-muted-foreground">{t("validUntil", { date: dateOnly(c.validUntil) })}</span>}
                  {c.revoked ? (
                    <Badge tone="bad">{t("revoked")}</Badge>
                  ) : (
                    creds.data?.signingAvailable && (
                      <>
                        <Button variant="secondary" busy={busy === `${c.id}-jwt`} onClick={() => download(`${c.id}-jwt`, `/api/career/workforce/credentials/mine/${c.id}/ob3`, "open-badge.json")} aria-label={t("downloadBadgeFor", { name: c.name })}>
                          {t("downloadBadge")}
                        </Button>
                        <Button variant="ghost" busy={busy === `${c.id}-json`} onClick={() => download(`${c.id}-json`, `/api/career/workforce/credentials/mine/${c.id}/ob3?format=json`, "open-badge.json")} aria-label={t("downloadJsonFor", { name: c.name })}>
                          {t("downloadJson")}
                        </Button>
                      </>
                    )
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">{t("badgeHint")}</p>
          </section>
        )}
      </div>
    </Card>
  );
}

"use client";

// G13 free-user home: minutes left (existing metering), the included tools, the portfolio, and joining a school later.
import React, { useState } from "react";
import Link from "next/link";
import { ApiError, useApi, useAppAuth } from "@/lib/appAuth";
import {
  Badge, Button, Card, EmptyState, ErrorBanner, Loading, PageHeader, SuccessBanner, useCareerFormat, useCareerT, useLoad,
} from "@/components/career/ui";
import type { FreeHome } from "@/components/career/freeTier/FreeTierFrame";

// Existing product pages for the included tools only (no resume, cover-letter, networking or job tools)
const TOOL_LINKS: Record<string, string> = {
  mockInterviews: "/interview",
  voiceDefenses: "/sprint",
  buildAndDefend: "/defend-repo",
  credentials: "/credentials",
};

export default function FreeHomePage() {
  const t = useCareerT("freeTier");
  const fmt = useCareerFormat();
  const api = useApi();
  const { isLoaded, isSignedIn } = useAppAuth();
  const { data, error, loading, reload } = useLoad(
    async () => {
      try {
        return await api<FreeHome>("/api/career/free/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    [isSignedIn],
  );
  const [consent, setConsent] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function act(key: string, path: string, json: unknown, message: string) {
    setBusy(key);
    setActionError(null);
    setDone(null);
    try {
      await api(path, { json });
      setDone(message);
      reload();
    } catch (e) {
      setActionError(e instanceof Error && !(e instanceof TypeError) ? e.message : t("genericError"));
    } finally {
      setBusy(null);
    }
  }

  if (!isLoaded) return <Loading />;
  if (!isSignedIn)
    return (
      <EmptyState title={t("homeSignedOut")}>
        <Link href={`/login?redirect_url=${encodeURIComponent("/free/home")}`} className="text-sm underline">
          {t("signInCta")}
        </Link>
      </EmptyState>
    );
  if (loading) return <Loading />;
  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!data)
    return (
      <EmptyState title={t("noAccount")}>
        <Link href="/free/signup" className="text-sm underline">
          {t("ctaSignup")}
        </Link>
      </EmptyState>
    );

  const u = data.usage;
  const price = (cents: number) => fmt.currency(cents / 100, u.currency.toUpperCase());

  return (
    <>
      <PageHeader title={t("homeTitle", { name: data.account.displayName })} description={t("homeIntro")} />
      <div role="status" aria-live="polite">
        <SuccessBanner message={done} />
        <ErrorBanner error={actionError} />
      </div>

      <Card title={t("minutesTitle")}>
        <p className="text-2xl font-semibold">{t("minutesLeft", { count: u.remainingMinutes })}</p>
        <p className="text-sm text-muted-foreground">
          {t("minutesDetail", { used: u.usedMinutes, allocated: u.allocatedMinutes, bonus: u.bonusMinutes })}
          {u.resetsAt && <> {t("resetsOn", { date: fmt.date(u.resetsAt) })}</>}
        </p>
        {u.exhausted && (
          <p className="mt-2 text-sm">
            <Badge tone="warn">{t("exhausted")}</Badge>
          </p>
        )}
        <p className="mt-3 text-sm">
          {t("upgradeLine", { pro: price(u.proMonthlyPriceCents), proMinutes: u.proMonthlyMinutes, topUp: price(u.topUpPriceCents), topUpMinutes: u.topUpMinutes })}{" "}
          <Link href="/pricing" className="underline">
            {t("seePlans")}
          </Link>
        </p>
      </Card>

      <Card title={t("toolsTitle")}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.tools.map((k) => (
            <li key={k}>
              <Link href={TOOL_LINKS[k] ?? "/free/home"} className="block rounded-md border border-border p-3 text-sm hover:bg-muted">
                <span className="font-medium">{t(`tool.${k}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>

      <Card title={t("portfolioTitle")}>
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted-foreground">{t("portfolioCredentials")}</dt>
            <dd className="text-lg font-semibold">{fmt.number(data.portfolio.credentials)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("portfolioProjects")}</dt>
            <dd className="text-lg font-semibold">{fmt.number(data.portfolio.projects)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t("portfolioInterviews")}</dt>
            <dd className="text-lg font-semibold">{fmt.number(data.portfolio.interviews)}</dd>
          </div>
        </dl>
      </Card>

      {data.schoolMatches.length > 0 && (
        <Card title={t("schoolTitle")}>
          <ul className="space-y-4">
            {data.schoolMatches.map((s) => (
              <li key={s.instituteId} className="space-y-2">
                <p className="text-sm">{t("schoolOffer", { school: s.name })}</p>
                <div className="flex items-start gap-2">
                  <input
                    id={`consent-${s.instituteId}`}
                    type="checkbox"
                    className="mt-1"
                    checked={!!consent[s.instituteId]}
                    onChange={(e) => setConsent({ ...consent, [s.instituteId]: e.target.checked })}
                  />
                  <label htmlFor={`consent-${s.instituteId}`} className="text-sm">
                    {t("consentLabel", { school: s.name })}
                  </label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    busy={busy === `link-${s.instituteId}`}
                    onClick={() =>
                      act(`link-${s.instituteId}`, "/api/career/free/link", { instituteId: s.instituteId, carryPortfolio: !!consent[s.instituteId], consent: !!consent[s.instituteId] }, t("linked", { school: s.name }))
                    }
                  >
                    {consent[s.instituteId] ? t("linkAndShare") : t("linkOnly")}
                  </Button>
                  <Button variant="secondary" busy={busy === `decline-${s.instituteId}`} onClick={() => act(`decline-${s.instituteId}`, "/api/career/free/link/decline", { instituteId: s.instituteId }, t("declined"))}>
                    {t("notNow")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {data.links.length > 0 && (
        <Card title={t("linkedTitle")}>
          <ul className="space-y-3">
            {data.links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <bdi>{l.name}</bdi> <Badge tone={l.sharing ? "good" : "neutral"}>{l.sharing ? t("sharing") : t("notSharing")}</Badge>
                </span>
                <span className="flex gap-2">
                  <Link href="/student" className="underline">
                    {t("openSchool")}
                  </Link>
                  {l.sharing && (
                    <Button variant="secondary" busy={busy === `revoke-${l.id}`} onClick={() => act(`revoke-${l.id}`, `/api/career/free/link/${l.id}/revoke`, {}, t("revoked"))}>
                      {t("stopSharing")}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

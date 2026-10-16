"use client";

// G13 landing: what the free student plan includes, and whether it is offered where the visitor is.
import React from "react";
import Link from "next/link";
import { Card, EmptyState, ErrorBanner, Loading, PageHeader, useCareerT, useLoad } from "@/components/career/ui";
import { publicGet, useFreeBrand, type FreeAvailability } from "@/components/career/freeTier/FreeTierFrame";

const INCLUDED = ["mockInterviews", "voiceDefenses", "buildAndDefend", "credentials"] as const;

export default function FreeLandingPage() {
  const t = useCareerT("freeTier");
  const brand = useFreeBrand();
  const { data, error, loading, reload } = useLoad(() => publicGet<FreeAvailability>("/api/career/free/availability"), []);

  return (
    <>
      <PageHeader title={t("landingTitle")} description={t("landingIntro", { brand: brand?.displayName ?? t("brandFallback") })} />
      <Card title={t("includedTitle")}>
        <ul className="list-disc space-y-1 ps-5 text-sm">
          {INCLUDED.map((k) => (
            <li key={k}>{t(`tool.${k}`)}</li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">{t("notIncluded")}</p>
      </Card>
      <section aria-live="polite">
        {loading && <Loading />}
        <ErrorBanner error={error} onRetry={reload} />
        {data?.available && (
          <Card>
            <p className="text-sm">{t("availableHere")}</p>
            <Link
              href="/free/signup"
              className="mt-3 inline-block rounded-md px-4 py-2 text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "var(--brand, #4f46e5)" }}
            >
              {t("ctaSignup")}
            </Link>
          </Card>
        )}
        {data && !data.available && (
          <EmptyState title={t("notAvailableTitle")}>
            <p className="text-sm">{t(`gate.${data.code}`)}</p>
          </EmptyState>
        )}
      </section>
    </>
  );
}

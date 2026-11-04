"use client";

// G13 landing: what the free student plan includes, and whether it is offered where the visitor is.
import React from "react";
import Link from "next/link";
import { Card, EmptyState, ErrorBanner, Loading, PageHeader, useCareerT, useLoad, brandFill, buttonClass } from "@/components/career/ui";
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
            <Link href="/free/signup" className={`mt-3 ${buttonClass("primary")}`} style={brandFill}>
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

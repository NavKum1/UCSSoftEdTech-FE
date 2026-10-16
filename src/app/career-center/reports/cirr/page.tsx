"use client";

/**
 * G16: bootcamp and online-program outcomes in a CIRR-style report (cohort, on-time graduation, placement within 90, 180
 * and 360 days, base-salary median and outcome and job-category breakdowns), with employer challenges (D7) linked to
 * cohorts. Labelled "CIRR-style": it is not a CIRR report. No job board, postings or applications.
 */

import React from "react";
import { useApi } from "@/lib/appAuth";
import { ErrorBanner, Loading, PageHeader, useCareerT, useLoad } from "@/components/career/ui";
import { CirrPanel, type CirrDefinitions } from "@/components/career/workforce/Cirr";

export default function CirrReportsPage() {
  const api = useApi();
  const t = useCareerT("cirr");
  const defs = useLoad(() => api<CirrDefinitions>("/api/career/workforce/cirr/definitions"), [api]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("intro")} />
      {defs.loading && !defs.data ? <Loading /> : !defs.data ? <ErrorBanner error={defs.error} onRetry={defs.reload} /> : <CirrPanel defs={defs.data} />}
    </div>
  );
}

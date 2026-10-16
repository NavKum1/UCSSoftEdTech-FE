"use client";

/**
 * G15: US community colleges and workforce programs. WIOA primary indicators (employment in the 2nd and 4th quarter
 * after exit, median earnings, credential attainment, measurable skill gains) from participant records, staff-entered or
 * imported wage data and Outcomes; participant records; short-term credentials issued as Open Badges 3.0.
 * Definitions cite TEGL 10-16, Change 3 and the Joint PIRL; exports say "verify against the current PIRL/ETA format".
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { ErrorBanner, Loading, PageHeader, useCareerT, useLoad } from "@/components/career/ui";
import { WioaReportPanel, type WioaDefinitions } from "@/components/career/workforce/WioaReport";
import { WioaParticipantsPanel } from "@/components/career/workforce/WioaParticipants";
import { ShortCredentialsPanel } from "@/components/career/workforce/ShortCredentials";
import { ViewSwitch, setLocationHash, useLocationHash } from "@/components/career/workforce/shared";

type View = "report" | "participants" | "credentials";

export default function WorkforceReportsPage() {
  const api = useApi();
  const t = useCareerT("workforce");
  const defs = useLoad(() => api<WioaDefinitions>("/api/career/workforce/wioa/definitions"), [api]);
  // Deep links: #participants, #participants/<id>, #credentials
  const [hashView, hashId] = useLocationHash().split("/");
  const [picked, setPicked] = useState<View | null>(null);
  const view: View = picked ?? (hashView === "participants" || hashView === "credentials" ? hashView : "report");
  const participant = hashView === "participants" ? (hashId ?? null) : null;
  const choose = (v: View) => {
    setPicked(v);
    setLocationHash(v === "report" ? null : v);
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("intro")} />
      <ViewSwitch<View>
        label={t("viewLabel")}
        value={view}
        onChange={choose}
        options={[
          { key: "report", label: t("viewReport") },
          { key: "participants", label: t("viewParticipants") },
          { key: "credentials", label: t("viewCredentials") },
        ]}
      />
      {defs.loading && !defs.data ? (
        <Loading />
      ) : !defs.data ? (
        <ErrorBanner error={defs.error} onRetry={defs.reload} />
      ) : view === "report" ? (
        <WioaReportPanel defs={defs.data} />
      ) : view === "participants" ? (
        <WioaParticipantsPanel defs={defs.data} initialSelected={participant} />
      ) : (
        <ShortCredentialsPanel />
      )}
    </div>
  );
}

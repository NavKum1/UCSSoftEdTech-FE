"use client";

/**
 * G15: registered apprenticeships. Related technical instruction and on-the-job learning hours (a linked internship's
 * supervisor-approved hour logs count as on-the-job learning), the wage schedule and wage progression, and sponsor
 * sign-off through signed links. Rules cite 29 CFR 29.5; anything not confirmed is marked.
 */

import React from "react";
import { useApi } from "@/lib/appAuth";
import { Card, PageHeader, useCareerT, useLoad } from "@/components/career/ui";
import { ApprenticeshipsStaff } from "@/components/career/workforce/Apprenticeships";
import { FactList, type Fact } from "@/components/career/workforce/shared";

export default function ApprenticeshipsPage() {
  const api = useApi();
  const t = useCareerT("apprenticeships");
  const defs = useLoad(() => api<{ apprenticeship: Fact[] }>("/api/career/workforce/wioa/definitions"), [api]);
  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} description={t("intro")} />
      <ApprenticeshipsStaff />
      {defs.data && (
        <Card title={t("rulesTitle")}>
          <FactList facts={defs.data.apprenticeship} />
          <p className="mt-3 text-xs text-muted-foreground">{t("rulesNote")}</p>
        </Card>
      )}
    </div>
  );
}

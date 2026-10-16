"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { EmptyState, ErrorBanner, Field, Loading, PageHeader, useLoad, useCareerT } from "@/components/career/ui";
import { AttainmentView, type Catalog } from "@/components/career/frameworks/AttainmentView";

export default function FacultyFrameworksPage() {
  const t = useCareerT("facultyFrameworks");
  const api = useApi();
  const cat = useLoad(() => api<Catalog>("/api/career/frameworks"), []);
  const [key, setKey] = useState<string | null>(null);

  if (cat.loading) return <Loading />;
  if (cat.error || !cat.data) return <ErrorBanner error={cat.error ?? t("frameworksAreUnavailable")} onRetry={cat.reload} />;
  const enabled = cat.data.frameworks.filter((f) => f.enabled);
  const current = enabled.find((f) => f.key === key) ?? enabled[0];

  return (
    <div className="space-y-6">
      <PageHeader title={t("outcomeAttainment")} description={t("aggregateEvidenceOfStudentOutcomes")} />
      {enabled.length === 0 ? (
        <EmptyState title={t("noFrameworksAreSwitchedOn")}>{t("yourCareerCenterChoosesWhich")}</EmptyState>
      ) : (
        <>
          <div className="max-w-md">
            <Field label={t("framework")}>
              {(p) => (
                <select {...p} value={current?.key ?? ""} onChange={(e) => setKey(e.target.value)}>
                  {enabled.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
                </select>
              )}
            </Field>
          </div>
          {current && <AttainmentView key={current.key} framework={current} />}
        </>
      )}
    </div>
  );
}

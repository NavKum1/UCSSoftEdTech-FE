"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { EmptyState, ErrorBanner, Field, Loading, PageHeader, useLoad } from "@/components/career/ui";
import { AttainmentView, type Catalog } from "@/components/career/frameworks/AttainmentView";

export default function FacultyFrameworksPage() {
  const api = useApi();
  const cat = useLoad(() => api<Catalog>("/api/career/frameworks"), []);
  const [key, setKey] = useState<string | null>(null);

  if (cat.loading) return <Loading />;
  if (cat.error || !cat.data) return <ErrorBanner error={cat.error ?? "Frameworks are unavailable."} onRetry={cat.reload} />;
  const enabled = cat.data.frameworks.filter((f) => f.enabled);
  const current = enabled.find((f) => f.key === key) ?? enabled[0];

  return (
    <div className="space-y-6">
      <PageHeader title="Outcome attainment" description="Aggregate evidence of student outcomes for your school's chosen frameworks. No student is identified." />
      {enabled.length === 0 ? (
        <EmptyState title="No frameworks are switched on">Your career center chooses which frameworks to measure against.</EmptyState>
      ) : (
        <>
          <div className="max-w-md">
            <Field label="Framework">
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

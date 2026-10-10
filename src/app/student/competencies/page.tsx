"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, formatDate, useLoad } from "@/components/career/ui";

interface EvidenceItem {
  activity: string;
  measure: string | null;
  direct: boolean;
  score: number | null;
  metTarget: boolean | null;
  at: string;
}

interface Competency {
  code: string;
  title: string;
  mapped: boolean;
  evidence: EvidenceItem[];
}

interface MyCompetencies {
  available: { key: string; name: string }[];
  framework: { key: string; name: string; note: string } | null;
  competencies: Competency[];
  note: string;
}

export default function StudentCompetenciesPage() {
  const api = useApi();
  const [key, setKey] = useState("");
  const data = useLoad(() => api<MyCompetencies>(`/api/career/frameworks/me/competencies${key ? `?framework=${encodeURIComponent(key)}` : ""}`), [key]);
  const d = data.data;

  return (
    <div className="space-y-6">
      <PageHeader title="My competencies" description="See which of your activities count as evidence for each competency, to help you reflect and plan." />
      {data.loading && <Loading />}
      {data.error && <ErrorBanner error={data.error} onRetry={data.reload} />}
      {d && !data.loading && (
        <>
          <p className="text-sm text-muted-foreground">{d.note}</p>
          {d.available.length > 1 && (
            <div className="max-w-md">
              <Field label="Framework">
                {(p) => (
                  <select {...p} value={d.framework?.key ?? ""} onChange={(e) => setKey(e.target.value)}>
                    {d.available.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
                  </select>
                )}
              </Field>
            </div>
          )}
          {!d.framework ? (
            <EmptyState title="Nothing to show yet">Your school hasn&apos;t set up competency tracking.</EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {d.competencies.map((c) => (
                <Card key={c.code} title={c.title}>
                  {!c.mapped ? (
                    <p className="text-sm text-muted-foreground">Your school doesn&apos;t track evidence for this competency here yet.</p>
                  ) : c.evidence.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No evidence yet. Activities your school counts for this competency will appear here.</p>
                  ) : (
                    <ul className="space-y-2">
                      {c.evidence.map((e, i) => (
                        <li key={i} className="rounded-md border border-border p-2 text-sm">
                          <p className="font-medium">{e.activity}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.measure} · {formatDate(e.at)}
                          </p>
                          <p className="mt-1 flex flex-wrap items-center gap-2">
                            {e.score !== null && <span>Score: {e.score}</span>}
                            {e.metTarget === true && <Badge tone="good">Met the target</Badge>}
                            {e.metTarget === false && <Badge tone="warn">Below the target</Badge>}
                            {!e.direct && <Badge>Participation</Badge>}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              ))}
            </div>
          )}
          {d.framework && <p className="text-xs text-muted-foreground">{d.framework.note}</p>}
        </>
      )}
    </div>
  );
}

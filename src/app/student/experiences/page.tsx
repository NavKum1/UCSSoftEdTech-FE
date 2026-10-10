"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, EmptyState, ErrorBanner, Loading, PageHeader, formatDate, useLoad } from "@/components/career/ui";
import { StatusBadge, type ExperienceDetail, type ExperienceSummary, type Program } from "@/components/career/experiences/shared";
import { RegistrationForm, toPayload, valuesFrom } from "@/components/career/experiences/RegistrationForm";

export default function StudentExperiencesPage() {
  const api = useApi();
  const router = useRouter();
  const { schoolId } = useCareerShell();
  const list = useLoad(() => api<ExperienceSummary[]>("/api/career/experiences/mine"), [api, schoolId]);
  const programs = useLoad(() => api<{ programs: Program[]; isF1: boolean; cptStatuses: string[] }>("/api/career/experiences/programs"), [api, schoolId]);
  const [registering, setRegistering] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Internships for credit"
        description="Register an internship or other work experience for academic credit, sign the learning agreement, log your hours and write reflections."
        actions={
          !registering && (programs.data?.programs.length ?? 0) > 0 ? (
            <Button onClick={() => setRegistering(true)}>Register an experience</Button>
          ) : undefined
        }
      />
      <ErrorBanner error={err ?? list.error ?? programs.error} onRetry={list.reload} />
      {registering && programs.data && (
        <Card title="Register an experience" className="mb-6">
          <RegistrationForm
            api={api}
            programs={programs.data.programs}
            isF1={programs.data.isF1}
            cptStatuses={programs.data.cptStatuses}
            initial={valuesFrom(null)}
            submitLabel="Save draft"
            onSubmit={async (v) => {
              setErr(null);
              try {
                const created = await api<ExperienceDetail>("/api/career/experiences/mine", { json: toPayload(v, programs.data!.isF1) });
                router.push(`/student/experiences/${created.id}`);
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          />
          <Button variant="ghost" className="mt-2" onClick={() => setRegistering(false)}>
            Cancel
          </Button>
        </Card>
      )}
      {list.loading ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState title="No experiences yet">
          {(programs.data?.programs.length ?? 0) > 0 ? "Register an internship to start the approval process." : "Your school hasn't set up a credit program yet."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {list.data.map((x) => (
            <li key={x.id}>
              <Link href={`/student/experiences/${x.id}`} className="block rounded-xl border border-border p-4 hover:bg-muted">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {x.roleTitle} at {x.employerName}
                  </span>
                  <StatusBadge status={x.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {x.program?.code} · {formatDate(x.startDate)} to {formatDate(x.endDate)}
                  {x.finalGrade ? ` · Grade ${x.finalGrade}` : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

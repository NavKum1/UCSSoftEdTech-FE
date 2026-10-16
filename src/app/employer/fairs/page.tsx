"use client";

import React from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { EmptyState, ErrorBanner, Loading, PageHeader, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { useEmployers } from "@/components/career/EmployerPicker";

interface Fair {
  id: string;
  name: string;
  startsAt?: string | null;
  venue?: string | null;
  locationType?: string | null;
  publicUrl?: string | null;
  exhibitUrl?: string | null;
}

interface SchoolFairs {
  instituteId: string;
  school?: string | null;
  error?: string;
  events: Fair[];
}

/** Upcoming career fairs at schools where the company is approved to recruit, with links to request a booth. */
export default function EmployerFairsPage() {
  const t = useCareerT("employerFairs");
  const api = useApi();
  const emp = useEmployers();
  const employerId = emp.current?.employer.id;
  const data = useLoad(
    () => (employerId ? api<{ schools: SchoolFairs[] }>(`/api/career/events/employer/${employerId}/fairs`) : Promise.resolve({ schools: [] as SchoolFairs[] })),
    [api, employerId],
  );

  if (emp.loading && !emp.data) return <Loading />;
  if (emp.error) return <ErrorBanner error={emp.error} onRetry={emp.reload} />;
  if (!emp.current)
    return (
      <EmptyState title={t("noCompanyYet")}>
        {t.rich("setUpYourCompanyFirst", { link: (chunks) => <Link href="/employer" className="underline">{chunks}</Link> })}
      </EmptyState>
    );

  const schools = data.data?.schools ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title={t("careerFairs")} description={t("upcomingFairsAtSchoolsWhere")} />
      {data.loading && !data.data ? (
        <Loading />
      ) : data.error ? (
        <ErrorBanner error={data.error} onRetry={data.reload} />
      ) : schools.every((s) => s.events.length === 0 && !s.error) ? (
        <EmptyState title={t("noUpcomingFairs")}>
          {t.rich("noneOfYourApprovedSchools", { link: (chunks) => <Link href="/employer/schools" className="underline">{chunks}</Link> })}
        </EmptyState>
      ) : (
        schools.map((s) => (
          <section key={s.instituteId} aria-labelledby={`school-${s.instituteId}`} className="space-y-3">
            <h2 id={`school-${s.instituteId}`} className="text-lg font-semibold">{s.school ?? t("school")}</h2>
            {s.error && <p role="status" className="text-sm text-muted-foreground">{s.error}</p>}
            <ul className="space-y-3">
              {s.events.map((f) => (
                <li key={f.id} className="rounded-lg border p-4">
                  <h3 className="font-medium">{f.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(f.startsAt, true)}
                    {f.venue ? ` · ${f.venue}` : f.locationType === "virtual" ? t("online") : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm">
                    {f.exhibitUrl && (
                      <a className="underline" href={f.exhibitUrl} target="_blank" rel="noopener noreferrer">
                        {t.rich("requestABoothAtName", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: f.name })}
                      </a>
                    )}
                    {f.publicUrl && (
                      <a className="underline" href={f.publicUrl} target="_blank" rel="noopener noreferrer">
                        {t.rich("eventPageForNameOpens", { span: (chunks) => <span className="sr-only">{chunks}</span>, name: f.name })}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

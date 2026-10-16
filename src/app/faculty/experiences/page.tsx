"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { EmptyState, ErrorBanner, Field, Loading, PageHeader, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { StatusBadge, useExperienceStatusLabels, type ExperienceSummary } from "@/components/career/experiences/shared";

export default function FacultyExperiencesPage() {
  const t = useCareerT("facultyExperiences");
  const STATUS_LABELS = useExperienceStatusLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [status, setStatus] = useState("");
  const list = useLoad(() => api<ExperienceSummary[]>(`/api/career/experiences/faculty/experiences?status=${encodeURIComponent(status)}`), [api, schoolId, status]);
  const rows = list.data ?? [];
  const needsMe = rows.filter((x) => (x.status === "Submitted" && !x.facultyApproved) || x.status === "Approved" || x.status === "Evaluations");

  return (
    <div>
      <PageHeader title={t("internshipApprovals")} description={t("approveInternshipRegistrationsForYour")} />
      <ErrorBanner error={list.error} onRetry={list.reload} />
      <div className="mb-4 max-w-xs">
        <Field label={t("show")}>
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("all")}</option>
              {Object.entries(STATUS_LABELS)
                .filter(([k]) => k !== "Draft")
                .map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
            </select>
          )}
        </Field>
      </div>
      {list.loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState title={t("noInternshipsToShow")}>{t("studentsRegistrationsForProgramsYou")}</EmptyState>
      ) : (
        <>
          {!status && <p className="mb-3 text-sm" role="status">{t("countNeedYourActionApprove", { count: needsMe.length })}</p>}
          <table className="w-full text-start text-sm [&_th]:text-start">
            <caption className="sr-only">{t("internships")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2">{t("student")}</th>
                <th scope="col">{t("organizationAndRole")}</th>
                <th scope="col">{t("dates")}</th>
                <th scope="col">{t("status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} className="border-b border-border/60 align-top">
                  <td className="py-2">
                    <Link href={`/faculty/experiences/${x.id}`} className="underline">
                      {x.studentName}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{x.program?.code}</span>
                  </td>
                  <td>
                    {x.employerName}
                    <span className="block text-xs">{x.roleTitle}</span>
                  </td>
                  <td>
                    {t("startDateToEndDate", { startDate: formatDate(x.startDate), endDate: formatDate(x.endDate) })}
                  </td>
                  <td>
                    <StatusBadge status={x.status} />
                    {x.status === "Submitted" && <span className="block text-xs">{x.facultyApproved ? t("youApprovedCareerCenterNext") : t("waitingForFaculty")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

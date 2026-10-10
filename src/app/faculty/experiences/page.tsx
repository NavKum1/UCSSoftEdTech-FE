"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { EmptyState, ErrorBanner, Field, Loading, PageHeader, formatDate, useLoad } from "@/components/career/ui";
import { STATUS_LABELS, StatusBadge, type ExperienceSummary } from "@/components/career/experiences/shared";

export default function FacultyExperiencesPage() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const [status, setStatus] = useState("");
  const list = useLoad(() => api<ExperienceSummary[]>(`/api/career/experiences/faculty/experiences?status=${encodeURIComponent(status)}`), [api, schoolId, status]);
  const rows = list.data ?? [];
  const needsMe = rows.filter((x) => (x.status === "Submitted" && !x.facultyApproved) || x.status === "Approved" || x.status === "Evaluations");

  return (
    <div>
      <PageHeader title="Internship approvals" description="Approve internship registrations for your programs, sign learning agreements, review reflections and evaluations, and record grade recommendations." />
      <ErrorBanner error={list.error} onRetry={list.reload} />
      <div className="mb-4 max-w-xs">
        <Field label="Show">
          {(p) => (
            <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All</option>
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
        <EmptyState title="No internships to show">Students&apos; registrations for programs you approve appear here.</EmptyState>
      ) : (
        <>
          {!status && <p className="mb-3 text-sm" role="status">{needsMe.length} need your action (approve, sign or grade).</p>}
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Internships</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2">Student</th>
                <th scope="col">Organization and role</th>
                <th scope="col">Dates</th>
                <th scope="col">Status</th>
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
                    {formatDate(x.startDate)} to {formatDate(x.endDate)}
                  </td>
                  <td>
                    <StatusBadge status={x.status} />
                    {x.status === "Submitted" && <span className="block text-xs">{x.facultyApproved ? "You approved; career center next" : "Waiting for faculty"}</span>}
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

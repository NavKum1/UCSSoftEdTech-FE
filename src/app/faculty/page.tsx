"use client";

import React from "react";
import Link from "next/link";
import { careerNav } from "@/lib/careerNav";
import { useCareerShell } from "@/components/career/CareerShell";
import { Card, EmptyState, ErrorBanner, Loading, PageHeader, useCareerT } from "@/components/career/ui";

export default function FacultyHome() {
  const t = useCareerT("facultyHome");
  const { me, meError, schoolId } = useCareerShell();
  const faculty = (me?.memberships ?? []).filter((m) => m.role === "Faculty" || m.role === "CareerAdmin");
  const school = faculty.find((m) => m.instituteId === schoolId) ?? faculty[0];
  const links = careerNav.faculty.filter((i) => i.ready && i.href !== "/faculty");

  if (meError) return <ErrorBanner error={meError} />;
  if (!me) return <Loading />;

  return (
    <div>
      <PageHeader title={me.name ? t("welcomeName", { name: me.name }) : t("welcome")} description={school?.school ? t("facultyAtSchool", { school: school.school }) : undefined} />
      {!school ? (
        <EmptyState title={t("youreNotLinkedToA")}>{t("askYourCareerCenterTo")}</EmptyState>
      ) : (
        <Card title={t("goTo")}>
          <ul className="grid gap-3 sm:grid-cols-2">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-lg border border-border p-4 font-medium hover:bg-muted">{l.label}</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

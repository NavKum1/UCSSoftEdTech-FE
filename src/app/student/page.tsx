"use client";

import React from "react";
import Link from "next/link";
import { ApiError, useApi } from "@/lib/appAuth";
import { careerNav } from "@/lib/careerNav";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Card, ErrorBanner, Loading, PageHeader, useLoad, useCareerT } from "@/components/career/ui";
import { useCareerNavLabels } from "@/components/career/i18n/nav";
import { useDataSaver } from "@/components/career/mobile/dataSaver";

interface StudentRecord {
  school: { instituteId: string; displayName: string; slug: string };
  role: string;
  ferpaHold: boolean;
  profile: { preferredName?: string | null };
}

type Result = { record: StudentRecord } | { notLinked: string };

export default function StudentHome() {
  const api = useApi();
  const { me, brand } = useCareerShell();
  const t = useCareerT("studentHome");
  const tRoles = useCareerT("roles");
  const nav = useCareerNavLabels("student");
  // G10 data saver: don't prefetch every quick link's page in the background
  const saver = useDataSaver().on;
  const { data, error, loading, reload } = useLoad<Result>(
    () =>
      api<StudentRecord>("/api/career/student/record")
        .then((record) => ({ record }))
        .catch((e) => {
          if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return { notLinked: e.message };
          throw e;
        }),
    [api],
  );

  const links = careerNav.student.filter((i) => i.ready && i.href !== "/student");
  const name = data && "record" in data ? data.record.profile?.preferredName || me?.name : me?.name;

  return (
    <div>
      <PageHeader title={name ? t("welcomeNamed", { name }) : t("welcome")} description={t("description")} />
      <ErrorBanner error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : data && "notLinked" in data ? (
        <Card title={t("connectTitle")}>
          <p className="text-sm">{data.notLinked}</p>
          <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
            <li>{t("connectEmail")}</li>
            <li>{t("connectInvite")}</li>
            {brand?.supportEmail && (
              <li>
                {t.rich("connectHelp", {
                  email: brand.supportEmail,
                  link: (chunks) => (
                    <a className="underline" href={`mailto:${brand.supportEmail}`}>
                      {chunks}
                    </a>
                  ),
                })}
              </li>
            )}
          </ul>
        </Card>
      ) : data && "record" in data ? (
        <div className="space-y-6">
          <Card title={t("yourSchool")}>
            <p className="text-lg font-medium">{data.record.school.displayName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="info">{tRoles.has(data.record.role) ? tRoles(data.record.role) : data.record.role}</Badge>
              {data.record.ferpaHold && <Badge tone="warn">{t("directoryHold")}</Badge>}
            </div>
          </Card>
          <Card title={t("quickLinks")}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} prefetch={saver ? false : undefined} className="block rounded-lg border border-border p-4 hover:bg-muted focus-visible:outline-2">
                    <span className="font-medium">{nav.label(l)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

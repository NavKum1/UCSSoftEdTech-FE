"use client";

import React from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { careerNav } from "@/lib/careerNav";
import { useCareerShell } from "@/components/career/CareerShell";
import { Card, ErrorBanner, Loading, PageHeader, useLoad, useCareerFormat, useCareerT } from "@/components/career/ui";
import { useCareerNavLabels } from "@/components/career/i18n/nav";
import { ROLES } from "@/components/career/coreLabels";

interface Summary {
  school: string;
  counts: Record<string, number>;
  pendingEmployers: number | null;
}

export default function CareerCenterHome() {
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  const t = useCareerT("careerCenterHome");
  const tRoles = useCareerT("roles");
  const fmt = useCareerFormat();
  const nav = useCareerNavLabels("career-center");
  const roleLabel = (r: string) => (tRoles.has(r) ? tRoles(r) : r);
  const { data, error, loading, reload } = useLoad<Summary>(async () => {
    const settings = await api<{ displayName: string }>("/api/career/admin/settings");
    const totals = await Promise.all(ROLES.map((r) => api<{ total: number }>(`/api/career/admin/members?role=${r}&pageSize=1`).then((x) => [r, x.total] as const)));
    // Counselors can't review employers; show the count only to those who can
    const pending = await api<unknown[]>("/api/career/admin/employers?status=Pending").then((x) => x.length).catch(() => null);
    return { school: settings.displayName, counts: Object.fromEntries(totals), pendingEmployers: pending };
  }, [api, schoolId]);

  const role = me?.memberships.find((m) => m.instituteId === schoolId)?.role;
  const links = careerNav["career-center"].filter((i) => i.ready && i.href !== "/career-center");

  return (
    <div>
      <PageHeader title={data?.school ?? t("title")} description={role ? t("signedInAs", { role: roleLabel(role) }) : t("glance")} />
      <ErrorBanner error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <div className="space-y-6">
          <section aria-labelledby="cc-people">
            <h2 id="cc-people" className="mb-3 text-base font-semibold">{t("people")}</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {ROLES.map((r) => (
                <li key={r} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-semibold tabular-nums">{fmt.number(data.counts[r] ?? 0)}</p>
                  <p className="text-sm text-muted-foreground">{roleLabel(r)}</p>
                </li>
              ))}
            </ul>
          </section>
          {data.pendingEmployers !== null && (
            <Card title={t("employerRequests")}>
              <p className="text-sm">
                {data.pendingEmployers === 0 ? t("noPendingEmployers") : t("pendingEmployers", { count: data.pendingEmployers })}{" "}
                <Link href="/career-center/employers" className="underline">{t("reviewRequests")}</Link>
              </p>
            </Card>
          )}
          <Card title={t("goTo")}>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block rounded-lg border border-border p-4 font-medium hover:bg-muted">{nav.label(l)}</Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

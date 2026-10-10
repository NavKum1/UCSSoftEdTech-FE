"use client";

import React from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { careerNav } from "@/lib/careerNav";
import { useCareerShell } from "@/components/career/CareerShell";
import { Card, ErrorBanner, Loading, PageHeader, useLoad } from "@/components/career/ui";
import { ROLES, ROLE_LABELS } from "@/components/career/coreLabels";

interface Summary {
  school: string;
  counts: Record<string, number>;
  pendingEmployers: number | null;
}

export default function CareerCenterHome() {
  const api = useApi();
  const { me, schoolId } = useCareerShell();
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
      <PageHeader title={data?.school ?? "Career center"} description={role ? `You're signed in as ${ROLE_LABELS[role] ?? role}.` : "Your school's career services at a glance."} />
      <ErrorBanner error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <div className="space-y-6">
          <section aria-labelledby="cc-people">
            <h2 id="cc-people" className="mb-3 text-base font-semibold">People</h2>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {ROLES.map((r) => (
                <li key={r} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-2xl font-semibold tabular-nums">{data.counts[r] ?? 0}</p>
                  <p className="text-sm text-muted-foreground">{ROLE_LABELS[r]}</p>
                </li>
              ))}
            </ul>
          </section>
          {data.pendingEmployers !== null && (
            <Card title="Employer requests">
              <p className="text-sm">
                {data.pendingEmployers === 0 ? "No employers are waiting for a decision." : `${data.pendingEmployers} employer${data.pendingEmployers === 1 ? " is" : "s are"} waiting for a decision.`}{" "}
                <Link href="/career-center/employers" className="underline">Review requests</Link>
              </p>
            </Card>
          )}
          <Card title="Go to">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block rounded-lg border border-border p-4 font-medium hover:bg-muted">{l.label}</Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

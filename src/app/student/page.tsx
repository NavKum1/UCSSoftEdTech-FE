"use client";

import React from "react";
import Link from "next/link";
import { ApiError, useApi } from "@/lib/appAuth";
import { careerNav } from "@/lib/careerNav";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Card, ErrorBanner, Loading, PageHeader, useLoad } from "@/components/career/ui";

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
      <PageHeader title={name ? `Welcome, ${name}` : "Welcome"} description="Your career home: your record, privacy choices and updates in one place." />
      <ErrorBanner error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : data && "notLinked" in data ? (
        <Card title="Connect to your school">
          <p className="text-sm">{data.notLinked}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Sign in with your school email address if your school lets students join on their own.</li>
            <li>Otherwise, ask your career center to invite you; you&apos;ll be linked the next time you sign in with that email.</li>
            {brand?.supportEmail && (
              <li>
                Need help? Contact <a className="underline" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
              </li>
            )}
          </ul>
        </Card>
      ) : data && "record" in data ? (
        <div className="space-y-6">
          <Card title="Your school">
            <p className="text-lg font-medium">{data.record.school.displayName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="info">{data.record.role}</Badge>
              {data.record.ferpaHold && <Badge tone="warn">Directory hold on</Badge>}
            </div>
          </Card>
          <Card title="Quick links">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="block rounded-lg border border-border p-4 hover:bg-muted focus-visible:outline-2">
                    <span className="font-medium">{l.label}</span>
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

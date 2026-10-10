"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Card, ErrorBanner, Loading, PageHeader, useLoad } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";
import CompanyForm, { companyPayload, emptyCompany } from "@/components/career/CompanyForm";
import { VERIFICATION } from "@/components/career/coreLabels";

interface Relationship {
  id: string;
  status: string;
}

export default function EmployerHome() {
  const api = useApi();
  const { me, reloadMe } = useCareerShell();
  const emp = useEmployers();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const employerId = emp.current?.employer.id;
  const rels = useLoad(() => (employerId ? api<Relationship[]>(`/api/career/employer/${employerId}/schools`) : Promise.resolve([] as Relationship[])), [api, employerId]);

  const signup = async (v: typeof emptyCompany) => {
    setBusy(true);
    setErr(null);
    try {
      await api("/api/career/employer/signup", { method: "POST", json: companyPayload(v) });
      emp.reload();
      reloadMe();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (emp.loading && !emp.data) return <Loading />;
  if (emp.error) return <ErrorBanner error={emp.error} onRetry={emp.reload} />;

  if (!emp.current) {
    return (
      <div>
        <PageHeader title="Set up your company" description="Create an employer account to request access to schools and connect with their students." />
        <ErrorBanner error={err} />
        <Card>
          <p className="mb-4 text-sm text-muted-foreground">
            Signed in as {me?.email ?? "you"}. If your email is on your company&apos;s own domain (not a free-mail address), we verify the company automatically.
            If a colleague already set up your company, ask them to invite you instead.
          </p>
          <CompanyForm initial={emptyCompany} submitLabel="Create company account" busy={busy} withTitle onSubmit={signup} />
        </Card>
      </div>
    );
  }

  const org = emp.current.employer;
  const v = VERIFICATION[org.verificationStatus] ?? { label: org.verificationStatus, tone: "neutral" as const, explain: "" };
  const counts = (rels.data ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});

  return (
    <div>
      <PageHeader title={org.name} description={`You're ${emp.current.role === "Owner" ? "the account owner" : "a team member"}.`} actions={<EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Verification">
          <Badge tone={v.tone}>{v.label}</Badge>
          <p className="mt-2 text-sm text-muted-foreground">{v.explain}</p>
          {org.flagReason && <p className="mt-2 text-sm">Reason: {org.flagReason}</p>}
        </Card>
        <Card title="Schools">
          <ErrorBanner error={rels.error} />
          <ul className="grid grid-cols-2 gap-3">
            {["Approved", "Pending", "Declined", "Blocked"].map((s) => (
              <li key={s} className="rounded-lg border border-border p-3">
                <p className="text-xl font-semibold tabular-nums">{counts[s] ?? 0}</p>
                <p className="text-sm text-muted-foreground">{s}</p>
              </li>
            ))}
          </ul>
          <Link href="/employer/schools" className="mt-3 inline-block text-sm underline">Find and request schools</Link>
        </Card>
        <Card title="Company" className="lg:col-span-2">
          <p className="text-sm text-muted-foreground">
            {[org.industry, org.sizeBand && `${org.sizeBand} employees`, [org.hqCity, org.hqState].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "Add details so schools know who you are."}
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <Link href="/employer/company" className="underline">Company profile</Link>
            <Link href="/employer/team" className="underline">Team</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

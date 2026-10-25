"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Card, ErrorBanner, Loading, PageHeader, useLoad, useCareerT } from "@/components/career/ui";
import { EmployerPicker, useEmployers } from "@/components/career/EmployerPicker";
import CompanyForm, { companyPayload, emptyCompany } from "@/components/career/CompanyForm";
import { useRelationshipLabels, useVerification } from "@/components/career/coreLabels";

interface Relationship {
  id: string;
  status: string;
}

export default function EmployerHome() {
  const t = useCareerT("employerHome");
  const VERIFICATION = useVerification();
  const STATUS = useRelationshipLabels();
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
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (emp.loading && !emp.data) return <Loading />;
  if (emp.error) return <ErrorBanner error={emp.error} onRetry={emp.reload} />;

  if (!emp.current) {
    return (
      <div>
        <PageHeader title={t("setUpYourCompany")} description={t("createAnEmployerAccountTo")} />
        <ErrorBanner error={err} />
        <Card>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("signedInAsEmailIf", { email: me?.email ?? t("you") })}
          </p>
          <CompanyForm initial={emptyCompany} submitLabel={t("createCompanyAccount")} busy={busy} withTitle onSubmit={signup} />
        </Card>
      </div>
    );
  }

  const org = emp.current.employer;
  const v = VERIFICATION[org.verificationStatus] ?? { label: org.verificationStatus, tone: "neutral" as const, explain: "" };
  const counts = (rels.data ?? []).reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});

  return (
    <div>
      <PageHeader title={org.name} description={t("youreValue", { value: emp.current.role === "Owner" ? t("theAccountOwner") : t("aTeamMember") })} actions={<EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={t("verification")}>
          <Badge tone={v.tone}>{v.label}</Badge>
          <p className="mt-2 text-sm text-muted-foreground">{v.explain}</p>
          {org.flagReason && <p className="mt-2 text-sm">{t("reasonFlagReason", { flagReason: org.flagReason })}</p>}
        </Card>
        <Card title={t("schools")}>
          <ErrorBanner error={rels.error} />
          <ul className="grid grid-cols-2 gap-3">
            {["Approved", "Pending", "Declined", "Blocked"].map((s) => (
              <li key={s} className="rounded-lg border border-border p-3">
                <p className="text-xl font-semibold tabular-nums">{counts[s] ?? 0}</p>
                <p className="text-sm text-muted-foreground">{STATUS[s]}</p>
              </li>
            ))}
          </ul>
          <Link href="/employer/schools" className="mt-3 inline-block text-sm underline">{t("findAndRequestSchools")}</Link>
        </Card>
        <Card title={t("company")} className="lg:col-span-2">
          <p className="text-sm text-muted-foreground">
            {[org.industry, org.sizeBand && t("sizeBandEmployees", { sizeBand: org.sizeBand }), [org.hqCity, org.hqState].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || t("addDetailsSoSchoolsKnow")}
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <Link href="/employer/company" className="underline">{t("companyProfile")}</Link>
            <Link href="/employer/team" className="underline">{t("team")}</Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

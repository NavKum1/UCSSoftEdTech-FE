"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { Badge, Card, EmptyState, ErrorBanner, Loading, PageHeader, SuccessBanner, useCareerT } from "@/components/career/ui";
import { EmployerPicker, useEmployers, type EmployerOrg } from "@/components/career/EmployerPicker";
import CompanyForm, { type CompanyValues } from "@/components/career/CompanyForm";
import { useVerification } from "@/components/career/coreLabels";

const toValues = (o: EmployerOrg): CompanyValues => ({
  name: o.name,
  website: o.website ?? "",
  industry: o.industry ?? "",
  sizeBand: o.sizeBand ?? "",
  description: o.description ?? "",
  logoUrl: o.logoUrl ?? "",
  hqCity: o.hqCity ?? "",
  hqState: o.hqState ?? "",
  hqCountry: o.hqCountry ?? "US",
});

export default function EmployerCompanyPage() {
  const t = useCareerT("employerCompany");
  const VERIFICATION = useVerification();
  const api = useApi();
  const emp = useEmployers();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (emp.loading && !emp.data) return <Loading />;
  if (emp.error) return <ErrorBanner error={emp.error} onRetry={emp.reload} />;
  if (!emp.current)
    return (
      <EmptyState title={t("noCompanyYet")}>
        {t.rich("setUpYourCompanyFirst", { link: (chunks) => <Link href="/employer" className="underline">{chunks}</Link> })}
      </EmptyState>
    );

  const org = emp.current.employer;
  const isOwner = emp.current.role === "Owner";
  const v = VERIFICATION[org.verificationStatus];

  const save = async (values: CompanyValues) => {
    if (values.website.trim() !== (org.website ?? "") && org.verificationStatus === "DomainVerified" && !window.confirm(t("changingTheWebsiteRemovesThe"))) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/career/employer/${org.id}`, {
        method: "PUT",
        json: {
          name: values.name.trim(),
          // The API can't clear the website; leave it unchanged when blank
          website: values.website.trim() || null,
          industry: values.industry.trim(),
          sizeBand: values.sizeBand,
          description: values.description.trim(),
          logoUrl: values.logoUrl.trim(),
          hqCity: values.hqCity.trim(),
          hqState: values.hqState.trim(),
          hqCountry: values.hqCountry.trim() || null,
        },
      });
      setMsg(t("companyProfileSaved"));
      emp.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("companyProfile")}
        description={isOwner ? t("schoolsSeeThisWhenYou") : t("onlyTheAccountOwnerCan")}
        actions={<EmployerPicker accounts={emp.accounts} current={emp.current} onSelect={emp.select} />}
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <Card title={org.name} actions={v && <Badge tone={v.tone}>{v.label}</Badge>}>
        <CompanyForm key={`${org.id}-${org.verificationStatus}-${org.name}`} initial={toValues(org)} submitLabel={t("saveChanges")} busy={busy} disabled={!isOwner} onSubmit={save} />
      </Card>
    </div>
  );
}

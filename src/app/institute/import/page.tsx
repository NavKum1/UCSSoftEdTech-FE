"use client";

/** Import (5 Nov 2026, moved out of the CRM page's tabs into the portal's Settings): leads from another system's CSV export. */
import React from "react";
import { useRouter } from "next/navigation";
import { useAppAuth } from "@/lib/appAuth";
import ImportView from "@/components/institute/crm/ImportView";
import { PageHeader } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";
import { InstituteAdminOnly } from "@/components/institute/InstituteAdminOnly";

export default function ImportLeadsPage() {
  const en = useEn();
  const router = useRouter();
  const { getToken } = useAppAuth();
  return (
    <InstituteAdminOnly>
      <div className="space-y-6">
        <PageHeader title={en("Import leads")} description={en("Bring in leads from another system's CSV export. They arrive in your admissions leads.")} />
        <ImportView getToken={getToken} onImported={() => router.push("/institute/dashboard")} />
      </div>
    </InstituteAdminOnly>
  );
}

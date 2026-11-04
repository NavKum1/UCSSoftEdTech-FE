"use client";

/** Staff access (5 Nov 2026, moved out of the CRM page's tabs into the portal's Settings): who can sign in to the school's area. */
import React from "react";
import { useAppAuth } from "@/lib/appAuth";
import StaffAccess from "@/components/institute/StaffAccess";
import { PageHeader } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";
import { InstituteAdminOnly } from "@/components/institute/InstituteAdminOnly";

export default function StaffAccessPage() {
  const en = useEn();
  const { getToken } = useAppAuth();
  return (
    <InstituteAdminOnly>
      <div className="space-y-6">
        <PageHeader title={en("Staff access")} description={en("Who on your staff can sign in, and what each person can do.")} />
        <StaffAccess getToken={getToken} />
      </div>
    </InstituteAdminOnly>
  );
}

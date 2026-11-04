"use client";

import React from "react";
import PortalShell from "@/components/portal/PortalShell";
import { SchoolPlanBanner } from "@/components/institute/SchoolPlan";
import { SetupChecklist } from "@/components/institute/SetupChecklist";
import { SchoolEnglishScope } from "@/components/institute/SchoolEnglish";
import { useAppAuth } from "@/lib/appAuth";

// en() where shown (PortalShell)
// Three tabs (5 Nov 2026): the leads; the forms and quiz that bring leads in; and settings, all in one place
const SECTIONS = [
  { href: "/institute/dashboard", label: "Admissions leads", group: "Leads" },
  { href: "/institute/guidance", label: "Guidance forms", group: "Forms" },
  { href: "/institute/counselling", label: "Counseling quiz", group: "Forms" },
  { href: "/institute/setup", label: "School setup", group: "Settings" },
  { href: "/institute/admissions-settings", label: "Admissions settings", group: "Settings" },
  { href: "/institute/staff", label: "Staff access", group: "Settings" },
  { href: "/institute/import", label: "Import leads", group: "Settings" },
  { href: "/institute/billing", label: "Billing", group: "Settings" },
];

export default function InstituteLayout({ children }: { children: React.ReactNode }) {
  const { roles } = useAppAuth();
  // Counselors work leads; the forms, quiz and settings are the institute admin's
  const admin = roles.includes("InstituteAdmin") || roles.includes("SuperAdmin");
  const sections = admin ? SECTIONS : SECTIONS.slice(0, 1);
  return (
    <SchoolEnglishScope>
    <PortalShell name="Institute" home="/institute/dashboard" sections={sections}>
      <SchoolPlanBanner />
      <SetupChecklist />
      {children}
    </PortalShell>
    </SchoolEnglishScope>
  );
}

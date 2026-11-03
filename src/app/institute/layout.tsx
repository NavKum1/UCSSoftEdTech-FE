"use client";

import React from "react";
import { Building2 } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";
import { SchoolPlanBanner } from "@/components/institute/SchoolPlan";
import { SetupChecklist } from "@/components/institute/SetupChecklist";
import { SchoolEnglishScope } from "@/components/institute/SchoolEnglish";
import { useAppAuth } from "@/lib/appAuth";

// en() where shown (PortalShell)
const SECTIONS = [
  { href: "/institute/dashboard", label: "Admissions CRM" },
  { href: "/institute/counselling", label: "Counselling quiz and courses" }, // en() where shown
  { href: "/institute/guidance", label: "Guidance forms" },
  { href: "/institute/setup", label: "Setup" },
  { href: "/institute/billing", label: "Billing" },
];

export default function InstituteLayout({ children }: { children: React.ReactNode }) {
  const { roles } = useAppAuth();
  // Counsellors work leads; the quiz, courses, guidance form, setup and the school's plan are the institute admin's
  const admin = roles.includes("InstituteAdmin") || roles.includes("SuperAdmin");
  const sections = admin ? SECTIONS : SECTIONS.slice(0, 1);
  return (
    <SchoolEnglishScope>
    <PortalShell name="Institute" icon={<Building2 aria-hidden="true" className="h-4 w-4" />} accent="bg-cyan-600" home="/institute/dashboard" sections={sections}>
      <SchoolPlanBanner />
      <SetupChecklist />
      {children}
    </PortalShell>
    </SchoolEnglishScope>
  );
}

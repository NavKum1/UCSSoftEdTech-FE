"use client";

import React from "react";
import { Building2 } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";
import { SchoolPlanBanner } from "@/components/institute/SchoolPlan";
import { useAppAuth } from "@/lib/appAuth";

const SECTIONS = [
  { href: "/institute/dashboard", label: "Admissions CRM" },
  { href: "/institute/counselling", label: "Counselling quiz and courses" },
  { href: "/institute/guidance", label: "Guidance forms" },
  { href: "/institute/billing", label: "Billing" },
];

export default function InstituteLayout({ children }: { children: React.ReactNode }) {
  const { roles } = useAppAuth();
  // Counsellors work leads; the quiz, courses, guidance form and the school's plan are the institute admin's
  const admin = roles.includes("InstituteAdmin") || roles.includes("SuperAdmin");
  const sections = admin ? SECTIONS : SECTIONS.slice(0, 1);
  return (
    <PortalShell name="Institute" icon={<Building2 aria-hidden="true" className="h-4 w-4" />} accent="bg-cyan-600" home="/institute/dashboard" sections={sections}>
      <SchoolPlanBanner />
      {children}
    </PortalShell>
  );
}

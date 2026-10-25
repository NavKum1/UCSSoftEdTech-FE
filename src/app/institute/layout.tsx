"use client";

import React from "react";
import { Building2 } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";
import { useAppAuth } from "@/lib/appAuth";

const SECTIONS = [
  { href: "/institute/dashboard", label: "Admissions CRM" },
  { href: "/institute/counselling", label: "Counselling quiz and courses" },
  { href: "/institute/guidance", label: "Guidance forms" },
];

export default function InstituteLayout({ children }: { children: React.ReactNode }) {
  const { roles } = useAppAuth();
  // Counsellors work leads; the quiz, courses and guidance form are set by the institute admin
  const admin = roles.includes("InstituteAdmin") || roles.includes("SuperAdmin");
  const sections = admin ? SECTIONS : SECTIONS.slice(0, 1);
  return (
    <PortalShell name="Institute" icon={<Building2 aria-hidden="true" className="h-4 w-4" />} accent="bg-cyan-600" home="/institute/dashboard" sections={sections}>
      {children}
    </PortalShell>
  );
}

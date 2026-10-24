"use client";

import React from "react";
import { Building2 } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";

const SECTIONS = [
  { href: "/institute/dashboard", label: "Leads and integration" },
  { href: "/institute/counselling", label: "Counselling quiz and courses" },
  { href: "/institute/guidance", label: "Career guidance form" },
];

export default function InstituteLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell name="Institute" icon={<Building2 aria-hidden="true" className="h-4 w-4" />} accent="bg-cyan-600" home="/institute/dashboard" sections={SECTIONS}>
      {children}
    </PortalShell>
  );
}

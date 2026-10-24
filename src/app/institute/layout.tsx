"use client";

import React from "react";
import { Building2 } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";

const SECTIONS = [
  { href: "/institute/dashboard", label: "Inquiries and integration" },
  { href: "/institute/counselling", label: "Counselling quiz and courses" },
];

export default function InstituteLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell name="Institute" icon={Building2} accent="bg-cyan-600" home="/institute/dashboard" sections={SECTIONS}>
      {children}
    </PortalShell>
  );
}

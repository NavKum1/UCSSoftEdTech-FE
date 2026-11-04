"use client";

import React from "react";
import PortalShell from "@/components/portal/PortalShell";

const SECTIONS = [
  { href: "/advisor/guidance", label: "Guidance requests" },
  { href: "/advisor/questions", label: "Edulexa's forms" },
];

export default function AdvisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell name="Advisors" home="/advisor/guidance" sections={SECTIONS}>
      {children}
    </PortalShell>
  );
}

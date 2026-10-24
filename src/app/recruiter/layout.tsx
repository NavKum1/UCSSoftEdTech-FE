"use client";

import React from "react";
import { Briefcase } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";

const SECTIONS = [
  { label: "Candidates", href: "/recruiter/dashboard" },
  { label: "Evidence packs", href: "/recruiter/evidence" },
  { label: "Work trials", href: "/recruiter/work-trials" },
  { label: "Challenge results", href: "/recruiter/benchmark" },
  { label: "Session recordings", href: "/recruiter/proctoring" },
  { label: "Appeals", href: "/recruiter/appeals" },
  { label: "Accommodations", href: "/recruiter/accommodations" },
  { label: "ATS integrations", href: "/recruiter/integrations" },
  { label: "Validity & bias audit", href: "/recruiter/validity" },
  { label: "Transparency", href: "/recruiter/transparency-settings" },
];

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell name="Recruiter" icon={Briefcase} accent="bg-indigo-600" home="/recruiter/dashboard" sections={SECTIONS}>
      {children}
    </PortalShell>
  );
}

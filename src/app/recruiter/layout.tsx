"use client";

import React from "react";
import PortalShell from "@/components/portal/PortalShell";

// en() where shown (PortalShell). Four tabs in the order of the work: candidates, reviewing their evidence, fairness, then settings (5 Nov 2026)
const SECTIONS = [
  { label: "Candidates", href: "/recruiter/dashboard", group: "Candidates" },
  { label: "Evidence packs", href: "/recruiter/evidence", group: "Review" },
  { label: "Work trials", href: "/recruiter/work-trials", group: "Review" },
  { label: "Session recordings", href: "/recruiter/proctoring", group: "Review" },
  { label: "Challenge results", href: "/recruiter/benchmark", group: "Review" },
  { label: "Appeals", href: "/recruiter/appeals", group: "Fairness" },
  { label: "Accommodations", href: "/recruiter/accommodations", group: "Fairness" },
  { label: "Validity & bias audit", href: "/recruiter/validity", group: "Fairness" },
  { label: "Transparency", href: "/recruiter/transparency-settings", group: "Fairness" },
  { label: "Team", href: "/recruiter/team", group: "Settings" },
  { label: "ATS connections", href: "/recruiter/integrations", group: "Settings" },
];

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell name="Recruiter" home="/recruiter/dashboard" sections={SECTIONS}>
      {children}
    </PortalShell>
  );
}

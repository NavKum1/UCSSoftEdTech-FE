"use client";

import React from "react";
import { MessageCircleQuestion } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";

const SECTIONS = [
  { href: "/advisor/guidance", label: "Guidance requests" },
  { href: "/advisor/questions", label: "Edulexa's questions" },
];

export default function AdvisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell name="Advisors" icon={<MessageCircleQuestion aria-hidden="true" className="h-4 w-4" />} accent="bg-emerald-600" home="/advisor/guidance" sections={SECTIONS}>
      {children}
    </PortalShell>
  );
}

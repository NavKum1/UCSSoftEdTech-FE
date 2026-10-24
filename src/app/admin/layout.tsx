import React from "react";
import { Shield } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";
import { AdminRoleBadge } from "@/components/admin/AdminRoleBadge";

export const metadata = {
  title: "Admin · Edulexa",
  description: "Platform administration: exams, career suite, transparency and system status.",
};

// The API decides what each user may do; institute admins and exam creators reach /admin/exams too (H12)
const SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/exams", label: "Exams" },
  { href: "/admin/career", label: "Career suite" },
  { href: "/admin/transparency", label: "Transparency" },
  { href: "/admin/system", label: "System" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell name="Admin" icon={Shield} accent="bg-slate-800 dark:bg-slate-700" home="/admin" sections={SECTIONS} badge={<AdminRoleBadge />}>
      {children}
    </PortalShell>
  );
}

"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ArrowLeft } from "lucide-react";
import { AppUserButton } from "@/lib/appAuth";

const SECTIONS = [
  { href: "/institute/dashboard", label: "Inquiries and integration" },
  { href: "/institute/counselling", label: "Counselling quiz and courses" },
];

export default function InstituteLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/institute/dashboard" className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-linear-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white">
              <Building2 aria-hidden="true" className="w-5 h-5" />
            </span>
            <span>
              <span className="block font-bold text-base tracking-wide">EDULEXA</span>
              <span className="block text-[11px] text-muted-foreground">Institute portal</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
              <ArrowLeft aria-hidden="true" className="w-3.5 h-3.5" />
              Back to the app
            </Link>
            <AppUserButton />
          </div>
        </div>
        <nav aria-label="Institute portal" className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {SECTIONS.map((s) => {
            const active = pathname?.startsWith(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm ${active ? "border-cyan-600 font-semibold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {s.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full">{children}</main>
    </div>
  );
}

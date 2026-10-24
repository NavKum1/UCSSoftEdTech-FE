"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppUserButton } from "@/lib/appAuth";
import { Briefcase, ShieldCheck, ArrowLeft } from "lucide-react";

const recruiterNav: { label: string; href: string; highlight?: boolean }[] = [
  { label: "Candidates & Sprints", href: "/recruiter/dashboard" },
  { label: "Evidence packs", href: "/recruiter/evidence" },
  { label: "Work trials", href: "/recruiter/work-trials" },
  { label: "Appeals", href: "/recruiter/appeals" },
  { label: "Accommodations", href: "/recruiter/accommodations" },
  { label: "ATS integrations", href: "/recruiter/integrations" },
  { label: "Validity & bias audit", href: "/recruiter/validity" },
  { label: "Transparency settings", href: "/recruiter/transparency-settings" },
  { label: "Session recordings", href: "/recruiter/proctoring" },
  { label: "Challenge results", href: "/recruiter/benchmark", highlight: true },
];

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-foreground tracking-wide">EDULEXA</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-600 dark:text-purple-300 font-semibold border border-purple-500/30 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 mr-0.5" />
                  <span>Corporate Recruiter Portal</span>
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Custom Sprints, Candidate Invites & Integrity Signals</p>
            </div>
          </div>

          {/* Sub Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 bg-card/80 p-1 rounded-xl border border-border overflow-x-auto max-w-[62vw] whitespace-nowrap">
            {recruiterNav.map((item) => (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={
                  item.highlight
                    ? "px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 dark:text-purple-400 bg-purple-950/40 border border-purple-800/40 hover:bg-purple-900/40 transition-colors shrink-0"
                    : "px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-white hover:bg-muted transition-colors shrink-0"
                }
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Marketplace</span>
            </button>
            <AppUserButton />
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">{children}</main>
    </div>
  );
}

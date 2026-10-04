"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Briefcase, ShieldCheck, ArrowLeft } from "lucide-react";

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-purple-500/20">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-white tracking-wide">BUILD & DEFEND</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 mr-0.5" />
                  <span>Corporate Recruiter Portal</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Custom Sprints, Candidate Invites & Anti-Cheat Audit</p>
            </div>
          </div>

          {/* Sub Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => router.push("/recruiter/dashboard")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Candidates & Sprints
            </button>
            <button
              onClick={() => router.push("/recruiter/proctoring")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Video Proctoring
            </button>
            <button
              onClick={() => router.push("/recruiter/benchmark")}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-400 bg-purple-950/40 border border-purple-800/40 hover:bg-purple-900/40 transition-colors"
            >
              AI Benchmarking
            </button>
          </nav>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push("/")}
              className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Marketplace</span>
            </button>
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">{children}</main>
    </div>
  );
}

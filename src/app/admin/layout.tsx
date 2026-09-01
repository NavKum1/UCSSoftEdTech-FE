import React from "react";
import Link from "next/link";
import { Shield, Sparkles, ArrowLeft, Users, Building2, FileSpreadsheet, BarChart3, Lock } from "lucide-react";
import { UserButton } from "@clerk/nextjs";

export const metadata = {
  title: "Super Admin Back-office — Build & Defend",
  description: "Enterprise administration portal for partner institutes, course mapping, lead routing, and platform analytics.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-indigo-600/15 blur-[120px] pointer-events-none rounded-full" />
      <div className="fixed top-20 right-1/4 w-96 h-96 bg-purple-600/15 blur-[120px] pointer-events-none rounded-full" />

      {/* Super Admin Topbar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800/80 px-6 py-3.5 flex items-center justify-between backdrop-blur-xl">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/25">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-extrabold tracking-tight text-white">
                  BUILD &amp; DEFEND
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping inline-block mr-1"></span>
                  SUPER ADMIN
                </span>
              </div>
              <p className="text-xs text-slate-400">Back-office B2B Marketplace &amp; Operations Control</p>
            </div>
          </div>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            id="admin-nav-return-portal"
            className="text-xs font-medium text-slate-300 hover:text-white px-3.5 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/60 transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Student Portal</span>
          </Link>

          <div className="h-5 w-[1px] bg-slate-800" />

          {/* Clerk Auth Avatar */}
          <div className="flex items-center space-x-2">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      {/* Main Back-office Body */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="glass-panel border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Build &amp; Defend Inc. Secure Back-office Gateway.</span>
          <span className="text-slate-400 flex items-center space-x-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>End-to-end Clerk RBAC + .NET Claims Verified</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

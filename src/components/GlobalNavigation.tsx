"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  Flame,
  Mic,
  Compass,
  Briefcase,
  Building2,
  DollarSign,
  Award,
  ChevronDown,
  Layers,
  Swords,
  CalendarCheck,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { ProductRegionSwitcher } from "@/context/GeoContext";

export default function GlobalNavigation() {
  const pathname = usePathname();
  const [portalsOpen, setPortalsOpen] = useState(false);

  // If in pure embedding / canvas iframe or fullscreen sprint mode, keep it visible or sleek
  const navLinks = [
    { name: "Member 360", href: "/dashboard", icon: Compass },
    { name: "Simulations", href: "/sprint/distributed-database", icon: Layers },
    { name: "AI Voice Defense", href: "/sprint/1", icon: Mic },
    { name: "Daily Incident", href: "/daily/incident", icon: Flame },
    { name: "1v1 Duels", href: "/duels/arena", icon: Swords },
    { name: "Book Mentor", href: "/mentors/book", icon: CalendarCheck },
    { name: "Skill Passport", href: "/passport", icon: Award },
  ];

  const portals = [
    { name: "Candidate 360° Center", href: "/dashboard", desc: "Streaks, Radar, Katas & Voice", icon: Compass },
    { name: "Creator & Partner Studio", href: "/edulexa/dashboard", desc: "Voice Recovery, Content Shield & Payouts", icon: DollarSign },
    { name: "Enterprise Partner Studio", href: "/partner/dashboard", desc: "B2B Sandboxes, Cohorts & Metrics", icon: Building2 },
    { name: "Recruiter Talent Hub", href: "/recruiter/dashboard", desc: "Verified Talent Pipeline & Offers", icon: Briefcase },
    { name: "Campus Governance", href: "/institute/dashboard", desc: "University LTI & Department Analytics", icon: GraduationCap },
    { name: "Executive Leadership", href: "/executive/dashboard", desc: "Staff+ War-Rooms & Promotions", icon: Sparkles },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 flex items-center justify-center font-black text-white shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  EDULEXA
                </span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight -mt-0.5">
                AI CAREER & ASSESSMENT PLATFORM
              </p>
            </div>
          </Link>

          {/* Primary Nav Links */}
          <nav className="hidden lg:flex items-center space-x-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname?.startsWith(link.href));
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm shadow-indigo-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Status Pills & Portals Dropdown */}
        <div className="flex items-center gap-3">
          {/* Daily Streak Pill */}
          <Link
            href="/daily"
            title="Active 14-Day Streak — Practice daily kata to maintain Gold status"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
          >
            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400/30 animate-pulse" />
            <span>14d</span>
          </Link>

          {/* Voice Interview Minutes Pill */}
          <Link
            href="/sprint/1"
            title="48 minutes remaining of monthly AI Voice defense quota"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium hover:bg-indigo-500/20 transition-colors"
          >
            <Mic className="w-3.5 h-3.5 text-indigo-400" />
            <span>48m left</span>
          </Link>

          {/* Country / Currency & Compliance Switcher */}
          <ProductRegionSwitcher />

          {/* Portals Switcher */}
          <div className="relative">
            <button
              onClick={() => setPortalsOpen(!portalsOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-400 hover:text-white hover:border-slate-800 transition-colors"
            >
              <span>Portals</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${portalsOpen ? "rotate-180" : ""}`} />
            </button>

            {portalsOpen && (
              <div
                className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900/95 border border-slate-800/90 shadow-2xl backdrop-blur-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setPortalsOpen(false)}
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Platform Studios &amp; Portals
                </div>
                <div className="space-y-1">
                  {portals.map((p) => {
                    const Icon = p.icon;
                    return (
                      <Link
                        key={p.name}
                        href={p.href}
                        className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-slate-800/70 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-slate-800 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-slate-200 group-hover:text-white">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-slate-400 line-clamp-1">
                            {p.desc}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Book Mentor CTA button */}
          <Link
            href="/mentors/book"
            className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/25 transition-all hover:scale-[1.02]"
          >
            <CalendarCheck className="w-3.5 h-3.5" />
            <span>Book Mentor</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

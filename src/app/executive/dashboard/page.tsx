"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Sparkles, ShieldCheck, Building2,
  ArrowRight, Brain, Lock,
  CheckCircle2,
  ChevronRight, Activity
} from "lucide-react";

interface ExecutiveMetric {
  title: string;
  value: string;
  delta: string;
  status: "positive" | "neutral" | "warning";
  subtext: string;
}

export default function ExecutiveDashboardPage() {
  const [ledgerStatus, setLedgerStatus] = useState<{
    tamperFree: boolean;
    totalBlocks: number;
    lastVerified: string;
  }>({
    tamperFree: true,
    totalBlocks: 1420,
    lastVerified: "Live (Sub-second sync)"
  });

  const [recentAudits, setRecentAudits] = useState([
    {
      id: "AUD-8821",
      campus: "North America Campus (MIT/Harvard Consortium)",
      event: "Staff+ System Architecture Defense Approved",
      actor: "Dr. Evelyn Reed (Dean of Engineering)",
      timestamp: "12 mins ago",
      hash: "7f8b9a01...3c4d",
      status: "VERIFIED"
    },
    {
      id: "AUD-8820",
      campus: "European Polytechnic (ETH Zurich Node)",
      event: "Accreditation Readiness Clearance Tier-1",
      actor: "Prof. Markus Vogel (Academic Director)",
      timestamp: "45 mins ago",
      hash: "4e5f6a7b...8c9d",
      status: "VERIFIED"
    },
    {
      id: "AUD-8819",
      campus: "Asia-Pacific Institute (NUS/NTU Campus)",
      event: "Executive Crisis Simulation: Multi-Region Split Brain",
      actor: "Senior VP Engineering Committee",
      timestamp: "2 hours ago",
      hash: "1a2b3c4d...5e6f",
      status: "VERIFIED"
    }
  ]);

  const metrics: ExecutiveMetric[] = [
    {
      title: "Staff+ Leadership Conviction",
      value: "94.2%",
      delta: "+3.8% MoM",
      status: "positive",
      subtext: "Evaluated across 42 Executive Board Sim Defenses"
    },
    {
      title: "Multi-Campus Compliance Readiness",
      value: "98.7%",
      delta: "Tier-1 Ready",
      status: "positive",
      subtext: "ABETS / Higher Education ISO-27001 Audit Ready"
    },
    {
      title: "Consortium Campuses",
      value: "6 Nodes",
      delta: "14,800+ Students",
      status: "neutral",
      subtext: "Cross-campus accredited distributed ledger"
    },
    {
      title: "Tamper-Evident Ledger Integrity",
      value: "1,420 Blocks",
      delta: "100% Tamper-Free",
      status: "positive",
      subtext: "Continuous SHA-256 Merkle Hash Verification"
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Top Banner Navigation Header */}
      <div className="border-b border-border/80 bg-card/80 backdrop-blur-md sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-base text-foreground tracking-tight">
                  EXECUTIVE LEADERSHIP & GOVERNANCE
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Consortium Board
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Staff+ Engineering War-Rooms, Promotion Defenses & Multi-Campus Cryptographic Governance
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link
              href="/leadership/simulator"
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition-all"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Launch Simulator</span>
            </Link>
            <Link
              href="/executive/governance"
              className="px-3.5 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold flex items-center space-x-1.5 border border-border transition-all"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Audit Ledger</span>
            </Link>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Executive Welcome & Status Pill */}
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-card via-card/90 to-purple-950/20 border border-border/80 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Executive Command Protocol Active • Tamper-Free Consensus</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Enterprise Leadership & Strategic Oversight
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Equip Director, VP, and Staff+ engineering leaders with realistic stakeholder crisis simulations, 
              while providing University Deans and Corporate Accreditation Boards with immutable, cryptographic proof 
              of learning authenticity and institutional compliance.
            </p>
          </div>
        </div>

        {/* 4-Card Executive KPI Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, idx) => (
            <div
              key={idx}
              className="p-5 rounded-2xl bg-card border border-border/80 hover:border-purple-500/40 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1.5">
                  <span>{m.title}</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    m.status === "positive" 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {m.delta}
                  </span>
                </div>
                <div className="text-3xl font-black text-foreground tracking-tight mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  {m.value}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 pt-3 border-t border-border/60">
                {m.subtext}
              </p>
            </div>
          ))}
        </div>

        {/* Two Flagship Executive Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Module 1: Staff+ Leadership Simulator */}
          <div className="p-6 md:p-8 rounded-3xl bg-card border border-border/80 flex flex-col justify-between hover:border-purple-500/30 transition-all group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                <Brain className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
                  Module 01 • Staff+ Engineering
                </span>
                <h3 className="text-xl font-bold text-foreground mt-1 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  Executive Leadership Simulator
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Cross-examine candidates and engineering managers in high-stakes war-rooms. 
                  Simulate live pushback from skeptical CFOs, VP of Product, and Principal Security Architects 
                  with real speech synthesis and turn-based architectural consensus.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>SEV-0 Split-Brain & Ransomware Incident War-Room</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Cloud Multi-Region Re-Architecture ($12M Annual Spend)</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Engineering Restructuring & Tech-Debt Repayment Defense</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border/80 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Turn-based AI Committee</span>
              <Link
                href="/leadership/simulator"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <span>Enter War-Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {/* Module 2: Multi-Campus Governance & Cryptographic Ledger */}
          <div className="p-6 md:p-8 rounded-3xl bg-card border border-border/80 flex flex-col justify-between hover:border-emerald-500/30 transition-all group">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Module 02 • Institutional Accreditation
                </span>
                <h3 className="text-xl font-bold text-foreground mt-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Multi-Campus Cryptographic Governance
                </h3>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                  Institutional transparency powered by an append-only cryptographic audit chain. 
                  Every student assessment, proctoring override, faculty accreditation, and degree credential 
                  is permanently stamped with SHA-256 Merkle hashes.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Real-time Merkle Hash-Chain Tamper Detection</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Multi-Campus Aggregate Performance & Compliance Rollup</span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>Dean & Accreditation Board Clearance Verification</span>
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-border/80 flex items-center justify-between">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5" />
                <span>SHA-256 Verified Clean</span>
              </span>
              <Link
                href="/executive/governance"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center space-x-1.5 transition-colors shadow-sm"
              >
                <span>View Audit Ledger</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Live Immutable Audit Stream */}
        <div className="p-6 md:p-8 rounded-3xl bg-card border border-border/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Recent Executive Actions & Consortium Ledger Events</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time cryptographic audit trail across global campuses and corporate partners.
              </p>
            </div>
            <Link
              href="/executive/governance"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
            >
              <span>View All 1,420 Blocks</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border/60">
            {recentAudits.map((item) => (
              <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {item.id}
                    </span>
                    <span className="font-semibold text-foreground">{item.event}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                      {item.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground">{item.campus}</span> • Initiated by {item.actor}
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-right">
                  <div className="text-muted-foreground font-mono text-[10px]">
                    Hash: {item.hash}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                    {item.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

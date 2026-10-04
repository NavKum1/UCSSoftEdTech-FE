"use client";

import React, { useState, useEffect } from "react";
import { 
  TrendingUp, DollarSign, Award, Target, Sparkles, 
  ArrowRight, Compass, ShieldCheck, Zap, Layers, 
  Calendar, CheckCircle2, ChevronRight, RefreshCw,
  Globe2, Building2, Briefcase, Sliders, ArrowUpRight, AlertTriangle
} from "lucide-react";
import Link from "next/link";
import { useGeo } from "@/context/GeoContext";

interface CompensationBandData {
  userId: string;
  region: string;
  regionName: string;
  currencyCode: string;
  currencySymbol: string;
  baseMultiplier: number;
  seniorityLevels: {
    current: string;
    oneYear: string;
    threeYear: string;
    fiveYear: string;
  };
  compensationBands: {
    current: number;
    oneYear: number;
    threeYear: number;
    fiveYear: number;
    currentFormatted: string;
    oneYearFormatted: string;
    threeYearFormatted: string;
    fiveYearFormatted: string;
  };
  scores: {
    skillVelocity: number;
    leadershipReadiness: number;
  };
  targetRole: string;
  simulatedAt: string;
}

const REGIONS = [
  { code: "US_Tier1", name: "US Tier 1 (SF / NYC / Seattle)", flag: "🇺🇸", symbol: "$", currency: "USD", multiplier: "1.0x" },
  { code: "US_Remote", name: "US National Remote", flag: "🇺🇸", symbol: "$", currency: "USD", multiplier: "0.88x" },
  { code: "EU_UK", name: "Europe & UK (London / Berlin)", flag: "🇪🇺", symbol: "€", currency: "EUR", multiplier: "0.78x" },
  { code: "India_APAC", name: "India & APAC (Bengaluru / Singapore)", flag: "🇮🇳", symbol: "₹", currency: "INR", multiplier: "0.42x" },
  { code: "LatAm", name: "Latin America (São Paulo / Mexico City)", flag: "🇧🇷", symbol: "$", currency: "USD", multiplier: "0.38x" }
];

const TRACK_PRESETS = [
  "Distributed Cloud Systems Architect",
  "High-Throughput Concurrency & Storage Engineer",
  "AI/ML Platform & Low-Latency Inference Engineer",
  "Zero-Trust Security & Cryptographic Protocol Architect"
];

export default function CareerTrajectoryStudioPage() {
  const { region: geoRegion } = useGeo();
  const initialRegion = geoRegion === "IN" ? "India_APAC" : geoRegion === "EU" ? "EU_UK" : "US_Tier1";
  const [selectedRegion, setSelectedRegion] = useState<string>(initialRegion);
  const [data, setData] = useState<CompensationBandData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [targetRole, setTargetRole] = useState<string>(TRACK_PRESETS[0]);

  useEffect(() => {
    const matchedRegion = geoRegion === "IN" ? "India_APAC" : geoRegion === "EU" ? "EU_UK" : "US_Tier1";
    setSelectedRegion(matchedRegion);
  }, [geoRegion]);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  const fetchCompensation = async (region: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const testUserId = "44444444-5555-6666-7777-888888888888";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/career/compensation/${testUserId}?region=${region}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.compensation);
      } else {
        setFetchError(`Career compensation service returned HTTP ${res.status}.`);
        setData(null);
      }
    } catch (e: any) {
      console.warn("[CAREER COMPENSATION FETCH NOTICE]:", e);
      setFetchError(e.message || "Failed to connect to career compensation service.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompensation(selectedRegion);
  }, [selectedRegion]);

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const testUserId = "44444444-5555-6666-7777-888888888888";
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/career/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: testUserId,
          targetRole,
          region: selectedRegion
        })
      });
      if (res.ok) {
        setShowSimulateModal(false);
        fetchCompensation(selectedRegion);
      }
    } catch (e) {
      console.warn("Simulation notice:", e);
      setShowSimulateModal(false);
    } finally {
      setIsSimulating(false);
    }
  };

  const getLevelLabel = (lvl: string) => {
    return lvl.replace("_", " ");
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans pb-16">
      {/* Top Banner */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link
              href="/prep/matcher"
              className="p-2 rounded-xl bg-muted hover:bg-slate-700 text-muted-foreground transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
            </Link>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 flex items-center justify-center font-bold text-white shadow-lg shadow-emerald-500/20">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-base text-white tracking-wide">
                    AI CAREER PATH & SALARY INSIGHTS
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                    Career Insights
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Seniority milestone projections, regional salary ranges, and personalized growth paths.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSimulateModal(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Explore Career Track</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8 animate-fadeIn">
        {fetchError && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{fetchError}</span>
          </div>
        )}

        {/* Geographic Compensation Market Ribbon */}
        <div className="p-4 rounded-2xl bg-card/60 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground flex items-center space-x-2">
              <Globe2 className="w-4 h-4 text-emerald-400" />
              <span>Select Location for Local Salary Ranges</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Active: <strong className="text-emerald-400">{REGIONS.find(r => r.code === selectedRegion)?.name}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {REGIONS.map((reg) => {
              const isActive = selectedRegion === reg.code;
              return (
                <button
                  key={reg.code}
                  onClick={() => setSelectedRegion(reg.code)}
                  className={`p-3 rounded-xl border flex flex-col items-start space-y-1 transition-all cursor-pointer ${
                    isActive
                      ? "bg-emerald-950/40 border-emerald-500/70 shadow-md shadow-emerald-900/30"
                      : "bg-background/40 border-border hover:border-border hover:bg-card/60"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-lg">{reg.flag}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-emerald-300 font-mono font-bold">
                      {reg.multiplier}
                    </span>
                  </div>
                  <div className={`text-xs font-bold ${isActive ? "text-emerald-300" : "text-foreground"}`}>
                    {reg.currency} ({reg.symbol})
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate w-full">
                    {reg.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top Summary Banner */}
        <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/20 to-slate-900 border border-emerald-900/30 shadow-2xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                Projected Career Growth
              </span>
              <h2 className="text-2xl font-bold text-white mt-1">
                Target Role: {data?.targetRole || "Distributed Cloud Systems Architect"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Estimated based on project challenge performance, problem-solving skills, and code quality.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="p-3.5 rounded-xl bg-background/80 border border-border text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Skill Growth</span>
                <span className="text-xl font-black text-emerald-400">{data?.scores?.skillVelocity || 88.5}%</span>
              </div>
              <div className="p-3.5 rounded-xl bg-background/80 border border-border text-center">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Leadership Readiness</span>
                <span className="text-xl font-black text-teal-400">{data?.scores?.leadershipReadiness || 84.0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4-Stage Seniority Milestone Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Current Level */}
          <div className="p-5 rounded-2xl bg-card/50 border border-border space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Baseline Level
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold">
                Today
              </span>
            </div>
            <div className="text-lg font-bold text-white">
              {getLevelLabel(data?.seniorityLevels?.current || "L4 MidLevel")}
            </div>
            <div className="text-2xl font-extrabold text-emerald-400">
              {data?.compensationBands?.currentFormatted || (geoRegion === "IN" ? "₹35,00,000" : geoRegion === "EU" ? "€130,000" : "$165,000")}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Standard autonomous execution, modular component delivery, and structured API integrations.
            </p>
          </div>

          {/* 1-Year Milestone */}
          <div className="p-5 rounded-2xl bg-card/50 border border-border space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-teal-400">
                1-Year Milestone
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/30">
                +12 Months
              </span>
            </div>
            <div className="text-lg font-bold text-white">
              {getLevelLabel(data?.seniorityLevels?.oneYear || "L5 Senior")}
            </div>
            <div className="text-2xl font-extrabold text-teal-400">
              {data?.compensationBands?.oneYearFormatted || (geoRegion === "IN" ? "₹45,00,000" : geoRegion === "EU" ? "€165,000" : "$210,000")}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              System resilience governance, multi-threaded optimization, and cross-team interface ownership.
            </p>
          </div>

          {/* 3-Year Milestone */}
          <div className="p-5 rounded-2xl bg-card/50 border border-emerald-500/30 bg-emerald-950/10 space-y-3 relative shadow-lg shadow-emerald-950/20">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">
                3-Year Milestone
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                +36 Months
              </span>
            </div>
            <div className="text-lg font-bold text-white">
              {getLevelLabel(data?.seniorityLevels?.threeYear || "L6 Staff")}
            </div>
            <div className="text-2xl font-extrabold text-emerald-300">
              {data?.compensationBands?.threeYearFormatted || (geoRegion === "IN" ? "₹65,00,000" : geoRegion === "EU" ? "€220,000" : "$285,000")}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Enterprise architectural direction, distributed consensus patterns, and organizational technical leverage.
            </p>
          </div>

          {/* 5-Year Milestone */}
          <div className="p-5 rounded-2xl bg-card/50 border border-border space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                5-Year Milestone
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                +60 Months
              </span>
            </div>
            <div className="text-lg font-bold text-white">
              {getLevelLabel(data?.seniorityLevels?.fiveYear || "L7 Principal")}
            </div>
            <div className="text-2xl font-extrabold text-amber-400">
              {data?.compensationBands?.fiveYearFormatted || (geoRegion === "IN" ? "₹95,00,000" : geoRegion === "EU" ? "€295,000" : "$380,000")}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Company-wide systems vision, multi-datacenter fault-tolerance, and executive technology roadmap stewardship.
            </p>
          </div>
        </div>

        {/* Visual Compensation Growth Comparison Bar */}
        <div className="p-6 rounded-2xl bg-card/60 border border-border space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-white flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span>Expected Salary Growth Over Time</span>
            </h3>
            <span className="text-xs text-muted-foreground">Base Salary + Equity + Bonus Estimates</span>
          </div>

          <div className="space-y-4">
            {/* Current */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground font-medium">Baseline ({getLevelLabel(data?.seniorityLevels?.current || "L4")})</span>
                <span className="font-bold text-muted-foreground">{data?.compensationBands?.currentFormatted}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-background overflow-hidden">
                <div 
                  style={{ width: "42%" }}
                  className="h-full bg-slate-600 rounded-full"
                />
              </div>
            </div>

            {/* 1-Year */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground font-medium">1-Year Horizon ({getLevelLabel(data?.seniorityLevels?.oneYear || "L5")})</span>
                <span className="font-bold text-teal-400">{data?.compensationBands?.oneYearFormatted}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-background overflow-hidden">
                <div 
                  style={{ width: "55%" }}
                  className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full"
                />
              </div>
            </div>

            {/* 3-Year */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground font-medium">3-Year Horizon ({getLevelLabel(data?.seniorityLevels?.threeYear || "L6")})</span>
                <span className="font-bold text-emerald-400">{data?.compensationBands?.threeYearFormatted}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-background overflow-hidden">
                <div 
                  style={{ width: "74%" }}
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                />
              </div>
            </div>

            {/* 5-Year */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground font-medium">5-Year Horizon ({getLevelLabel(data?.seniorityLevels?.fiveYear || "L7")})</span>
                <span className="font-bold text-amber-400">{data?.compensationBands?.fiveYearFormatted}</span>
              </div>
              <div className="h-3 w-full rounded-full bg-background overflow-hidden">
                <div 
                  style={{ width: "100%" }}
                  className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* High-Leverage Competency Gap Roadmap */}
        <div className="p-6 rounded-2xl bg-card/60 border border-border space-y-4">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Recommended Skills to Accelerate Your Career</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Building strengths in these key areas helps accelerate your path to the next level.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {[
              {
                title: "Distributed Consensus & Raft Invariants",
                impact: geoRegion === "IN" ? "+₹28 Lakhs / yr" : geoRegion === "EU" ? "+€32k / yr" : "+$35k / yr",
                desc: "Master leader election, log replication, and split-brain recovery in partition-tolerant clusters."
              },
              {
                title: "Zero-Copy Ring Buffers & Memory Safety",
                impact: geoRegion === "IN" ? "+₹20 Lakhs / yr" : geoRegion === "EU" ? "+€23k / yr" : "+$25k / yr",
                desc: "Build sub-millisecond execution engines eliminating GC pause latency and lock contention."
              },
              {
                title: "Event Sourcing & Cross-Service Saga Choreography",
                impact: geoRegion === "IN" ? "+₹24 Lakhs / yr" : geoRegion === "EU" ? "+€28k / yr" : "+$30k / yr",
                desc: "Implement durable compensating transactions without distributed 2PC locks."
              },
              {
                title: "SLO Error Budget Governance & Tail Latency Trimming",
                impact: geoRegion === "IN" ? "+₹16 Lakhs / yr" : geoRegion === "EU" ? "+€18k / yr" : "+$20k / yr",
                desc: "Design adaptive client-side throttling, hedged requests, and circuit-breaker backoffs."
              }
            ].map((gap, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-background/60 border border-border space-y-2 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{gap.title}</span>
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                      {gap.impact}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {gap.desc}
                  </p>
                </div>
                <div className="pt-2">
                  <Link
                    href="/"
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center space-x-1"
                  >
                    <span>Practice Real-World Challenge</span>
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Simulation Modal */}
      {showSimulateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-card border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Explore Career Paths</h3>
              </div>
              <button
                onClick={() => setShowSimulateModal(false)}
                className="text-muted-foreground hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Select your target specialization to preview career milestones and salary expectations.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground block">Engineering Track</label>
              {TRACK_PRESETS.map((trk) => (
                <div
                  key={trk}
                  onClick={() => setTargetRole(trk)}
                  className={`p-3 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    targetRole === trk
                      ? "bg-emerald-950/40 border-emerald-500 text-white"
                      : "bg-background/60 border-border text-muted-foreground hover:border-border"
                  }`}
                >
                  {trk}
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setShowSimulateModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-muted hover:bg-slate-700 text-muted-foreground text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSimulate}
                disabled={isSimulating}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
              >
                {isSimulating ? "Projecting..." : "Explore Growth Path"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

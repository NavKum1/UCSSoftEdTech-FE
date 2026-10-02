"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  Flame,
  Mic,
  Award,
  Swords,
  Layers,
  CalendarCheck,
  Briefcase,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Sparkles,
  Zap,
  Clock,
  Compass,
  DollarSign,
  Activity,
  Share2,
  RefreshCw,
} from "lucide-react";

interface CompetencyDimension {
  dimension: string;
  score: number;
  benchmark: number;
  level: string;
  status: string;
}

interface VerifiedBadge {
  id: string;
  skillCategory: string;
  baselineScore: number;
  currentDecayedScore: number;
  decayPercentage: number;
  daysSinceLastPractice: number;
  status: string;
  lastPracticedAt: string;
  practiceKatasCompleted: number;
  verificationSignatureSha256: string;
  antiDecayWarning: string;
}

interface HeadhunterInquiry {
  id: string;
  companyTier: string;
  roleTitle: string;
  offeredCompensationUsd: number;
  fastTrackInterviewType: string;
  inquiryStatus: string;
  receivedAt: string;
}

interface Member360Data {
  memberId: string;
  fullName: string;
  targetRole: string;
  globalEloRank: number;
  eloTier: string;
  activeStreakDays: number;
  voiceMinutesUsed: number;
  voiceMinutesTotal: number;
  voiceMinutesRemaining: number;
  overallVigilanceIndex: number;
  publicShareToken: string;
  badges: VerifiedBadge[];
  radarCompetencies: CompetencyDimension[];
  inboundOpportunities: HeadhunterInquiry[];
  dailyRituals: {
    morningOutageCompleted: boolean;
    morningOutageTitle: string;
    cveReviewCompleted: boolean;
    cveReviewTitle: string;
    duelQueueActive: boolean;
    voiceDefenseValidUntil: string;
  };
}

const DEFAULT_MEMBER_360: Member360Data = {
  memberId: "5a6f76a1-9aef-4cc0-b19c-e3592f87a33a",
  fullName: "Alex Morgan",
  targetRole: "Staff Distributed Systems Architect",
  globalEloRank: 1840,
  eloTier: "Grandmaster (Top 1.8%)",
  activeStreakDays: 14,
  voiceMinutesUsed: 12,
  voiceMinutesTotal: 60,
  voiceMinutesRemaining: 48,
  overallVigilanceIndex: 96.4,
  publicShareToken: "pub_token_d9f8a42b_2026",
  badges: [
    {
      id: "b1",
      skillCategory: "Distributed Systems Resilience",
      baselineScore: 98,
      currentDecayedScore: 98,
      decayPercentage: 0,
      daysSinceLastPractice: 0,
      status: "Active Gold",
      lastPracticedAt: new Date().toISOString(),
      practiceKatasCompleted: 24,
      verificationSignatureSha256: "3bd1aa2ddb0514b79aae8581d878705a33ba0b093c6c451ad71f8dbcd8b29172",
      antiDecayWarning: "Active Gold verified. Will start decaying in 14 days without practice.",
    },
    {
      id: "b2",
      skillCategory: "Database Contention & Lock Triage",
      baselineScore: 96,
      currentDecayedScore: 95.8,
      decayPercentage: 0.2,
      daysSinceLastPractice: 1,
      status: "Active Gold",
      lastPracticedAt: new Date(Date.now() - 86400000).toISOString(),
      practiceKatasCompleted: 19,
      verificationSignatureSha256: "790ae992bc66bd03220edf8f51390f74e1d855d9e4210c7a63d85d4aa2291d78",
      antiDecayWarning: "Active Gold verified. Will start decaying in 13 days without practice.",
    },
    {
      id: "b3",
      skillCategory: "Zero-Trust Security & CVE Review",
      baselineScore: 94,
      currentDecayedScore: 93.5,
      decayPercentage: 0.5,
      daysSinceLastPractice: 2,
      status: "Active Gold",
      lastPracticedAt: new Date(Date.now() - 172800000).toISOString(),
      practiceKatasCompleted: 15,
      verificationSignatureSha256: "dd5b82c6f116b115b0e11192235d11ec34650b451519497eeb2d799b2947da18",
      antiDecayWarning: "Active Gold verified. Will start decaying in 11 days without practice.",
    },
    {
      id: "b4",
      skillCategory: "High-Concurrency Low-Latency",
      baselineScore: 92,
      currentDecayedScore: 91.2,
      decayPercentage: 0.8,
      daysSinceLastPractice: 3,
      status: "Active Gold",
      lastPracticedAt: new Date(Date.now() - 259200000).toISOString(),
      practiceKatasCompleted: 11,
      verificationSignatureSha256: "2e78e60397d01b76403f0e72f3143fbc033ad0103edc3f7ba77fa8f0bf3eba06",
      antiDecayWarning: "Active Gold verified. Will start decaying in 9 days without practice.",
    },
  ],
  radarCompetencies: [
    { dimension: "Distributed Architecture", score: 94, benchmark: 78, level: "Mastery", status: "Active Gold" },
    { dimension: "Speed-Architecting", score: 88, benchmark: 72, level: "Advanced", status: "Active Gold" },
    { dimension: "Code Review Vigilance", score: 92, benchmark: 70, level: "Mastery", status: "Active Gold" },
    { dimension: "Incident MTTR & Chaos", score: 96, benchmark: 68, level: "Staff Commander", status: "Active Gold" },
    { dimension: "AI Voice Prosody", score: 90, benchmark: 74, level: "High Confidence", status: "Active Gold" },
    { dimension: "Knowledge Anti-Decay", score: 95, benchmark: 65, level: "Zero Decay", status: "Active Gold" },
  ],
  inboundOpportunities: [
    {
      id: "opp1",
      companyTier: "Tier-1 Cloud Provider (Stripe Core)",
      roleTitle: "Staff Infrastructure Engineer",
      offeredCompensationUsd: 325000,
      fastTrackInterviewType: "Direct Architect Onsite (Phone screen bypassed)",
      inquiryStatus: "Active Inquiry",
      receivedAt: "Yesterday",
    },
    {
      id: "opp2",
      companyTier: "Enterprise Observability (Datadog)",
      roleTitle: "Principal Distributed Systems Architect",
      offeredCompensationUsd: 295000,
      fastTrackInterviewType: "CTO Final Round Fast-Track",
      inquiryStatus: "Active Inquiry",
      receivedAt: "3 days ago",
    },
    {
      id: "opp3",
      companyTier: "Cloud Data Cloud (Snowflake)",
      roleTitle: "Staff Database Core Architect",
      offeredCompensationUsd: 310000,
      fastTrackInterviewType: "VIP Technical Deep Dive",
      inquiryStatus: "Active Inquiry",
      receivedAt: "4 days ago",
    },
  ],
  dailyRituals: {
    morningOutageCompleted: false,
    morningOutageTitle: "Kafka Partition Rebalance Storm (08:00 AM)",
    cveReviewCompleted: true,
    cveReviewTitle: "Ledger Double-Spend Concurrency Fix",
    duelQueueActive: true,
    voiceDefenseValidUntil: new Date(Date.now() + 28 * 86400000).toISOString(),
  },
};

export default function Member360CommandCenterPage() {
  const [data, setData] = useState<Member360Data>(DEFAULT_MEMBER_360);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedShareLink, setCopiedShareLink] = useState<boolean>(false);

  useEffect(() => {
    const fetchMemberData = async () => {
      try {
        setLoading(true);
        const res = await fetch("http://localhost:5000/api/passport/member-360");
        if (res.ok) {
          const result = await res.json();
          setData(result);
        }
      } catch (err) {
        console.warn("Using offline fallback data for Member 360", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMemberData();
  }, []);

  const copyPublicShare = () => {
    const shareUrl = `${window.location.origin}/passport?token=${data.publicShareToken}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedShareLink(true);
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  // Helper for generating SVG radar points
  const size = 320;
  const center = size / 2;
  const radius = center - 40;
  const numSides = data.radarCompetencies.length || 6;

  const getCoordinates = (value: number, index: number, maxVal = 100) => {
    const angle = (Math.PI * 2 / numSides) * index - Math.PI / 2;
    const r = (value / maxVal) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const userPolygonPoints = data.radarCompetencies
    .map((c, i) => {
      const { x, y } = getCoordinates(c.score, i);
      return `${x},${y}`;
    })
    .join(" ");

  const benchmarkPolygonPoints = data.radarCompetencies
    .map((c, i) => {
      const { x, y } = getCoordinates(c.benchmark, i);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24">
      {/* 1. Member Profile & Quick Metric Hero Bar */}
      <section className="border-b border-slate-800/80 bg-gradient-to-b from-indigo-950/40 via-slate-900/60 to-slate-950 px-6 py-8">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Candidate Identity */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-amber-500 p-0.5 shadow-xl shadow-indigo-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center font-black text-white text-xl">
                {data.fullName.split(" ").map((n) => n[0]).join("")}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                  {data.fullName}
                </h1>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold uppercase tracking-wider">
                  Pro Fellow
                </span>
              </div>
              <p className="text-xs sm:text-sm text-indigo-300 font-medium mt-0.5">
                {data.targetRole}
              </p>
              <div className="flex items-center gap-4 text-xs text-slate-400 font-mono mt-2">
                <span className="flex items-center gap-1.5 text-amber-300 font-semibold">
                  <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                  {data.activeStreakDays} Days Streak
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-slate-300">
                  Global Elo: <strong className="text-white font-bold">{data.globalEloRank}</strong> ({data.eloTier})
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Stat Pills */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Voice Interview Balance */}
            <div className="px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <Mic className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-mono uppercase">AI Voice Defense</div>
                <div className="text-sm font-bold text-white font-mono">
                  {data.voiceMinutesRemaining}m <span className="text-xs text-slate-500 font-normal">/ {data.voiceMinutesTotal}m quota</span>
                </div>
              </div>
            </div>

            {/* Anti-Decay Vigilance Index */}
            <div className="px-4 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] text-slate-400 font-mono uppercase">Vigilance Index</div>
                <div className="text-sm font-bold text-emerald-400 font-mono">
                  {data.overallVigilanceIndex}% <span className="text-xs text-slate-500 font-normal">(Active Gold)</span>
                </div>
              </div>
            </div>

            {/* Share Public Passport */}
            <button
              onClick={copyPublicShare}
              className="px-4 py-3 rounded-2xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-all"
            >
              <Share2 className="w-4 h-4" />
              <span>{copiedShareLink ? "Link Copied!" : "Public Passport"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* 2. Top Banner: Actionable Daily Habit Rituals Matrix */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-bold text-white">Daily High-Stakes Rituals &amp; Katas</h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete daily engineering habits to prevent knowledge decay and keep all 6 competency badges in Active Gold.
              </p>
            </div>
            <span className="text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full self-start sm:self-auto">
              🔥 14-Day Consecutive Streak
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Morning Incident */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                    08:00 AM Outage
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">10m MTTR</span>
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                  {data.dailyRituals.morningOutageTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Zookeeper session expiration triggered consumer rebalances cascading through 18 partitions.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs text-amber-400 font-medium">Pending Triage</span>
                <Link
                  href="/daily"
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <span>Resolve Outage</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* CVE Review Dojo */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Completed
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">+50 XP</span>
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                  {data.dailyRituals.cveReviewTitle}
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Race condition spotted in distributed PostgreSQL ledger lock. Review approved.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs text-emerald-400 font-medium">Score: 98/100</span>
                <Link
                  href="/daily"
                  className="text-xs text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1"
                >
                  <span>View Diff</span>
                  <ChevronRightIcon className="w-3 h-3" />
                </Link>
              </div>
            </div>

            {/* 1v1 Speed Duel */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col justify-between hover:border-slate-700 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Live Arena
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">5m Flash-War</span>
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                  1v1 Speed Architecting Duel
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Instant matchmaker against senior engineers. Design high-throughput graph under chaos constraints.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs text-purple-400 font-medium">Rank #14 Global</span>
                <Link
                  href="/duels"
                  className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1 transition-colors"
                >
                  <Swords className="w-3 h-3" />
                  <span>Enter Duel</span>
                </Link>
              </div>
            </div>

            {/* 1-on-1 Mentor Office Hours */}
            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-500/30 flex flex-col justify-between hover:border-indigo-500/60 transition-all group">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Staff+ Mentorship
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono">45m 1-on-1</span>
                </div>
                <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                  Book 1-on-1 Staff Mentor
                </h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  Practice high-stakes mock defense with vetted leaders from AWS, Stripe, and Cloudflare.
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between">
                <span className="text-xs text-indigo-300 font-medium">Sec 194J Verified</span>
                <Link
                  href="/mentors/book"
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold flex items-center gap-1 shadow-md shadow-indigo-500/20 transition-all"
                >
                  <CalendarCheck className="w-3 h-3" />
                  <span>Book Slot</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 3. The 360° Competency Radar & Dimension Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Radar Visual Hexagon SVG (5 cols) */}
          <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl flex flex-col items-center justify-between">
            <div className="w-full flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Compass className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">6-Spoke Competency Radar</h2>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                Zero Decay
              </span>
            </div>

            {/* SVG Visual Radar */}
            <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center my-2">
              <svg width={size} height={size} className="overflow-visible">
                {/* Background concentric rings */}
                {[0.25, 0.5, 0.75, 1.0].map((level, idx) => (
                  <circle
                    key={idx}
                    cx={center}
                    cy={center}
                    r={radius * level}
                    fill="none"
                    stroke="#334155"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                ))}

                {/* Axis lines */}
                {data.radarCompetencies.map((_, i) => {
                  const { x, y } = getCoordinates(100, i);
                  return (
                    <line
                      key={i}
                      x1={center}
                      y1={center}
                      x2={x}
                      y2={y}
                      stroke="#1e293b"
                      strokeWidth="1.5"
                    />
                  );
                })}

                {/* Benchmark baseline polygon (dashed grey) */}
                <polygon
                  points={benchmarkPolygonPoints}
                  fill="rgba(100, 116, 139, 0.12)"
                  stroke="#64748b"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Candidate Mastery polygon (glowing indigo/purple) */}
                <polygon
                  points={userPolygonPoints}
                  fill="rgba(99, 102, 241, 0.35)"
                  stroke="#818cf8"
                  strokeWidth="2.5"
                />

                {/* Data Points */}
                {data.radarCompetencies.map((c, i) => {
                  const { x, y } = getCoordinates(c.score, i);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-indigo-400 stroke-slate-950 stroke-2"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Legend */}
            <div className="w-full pt-4 border-t border-slate-800/80 flex items-center justify-around text-xs font-mono">
              <span className="flex items-center gap-2 text-indigo-300">
                <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500" />
                Alex Morgan (Candidate)
              </span>
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-3 h-0.5 bg-slate-500 stroke-dashed" />
                Industry Staff+ Benchmark
              </span>
            </div>
          </div>

          {/* Dimension Cards (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Competency Telemetry &amp; Proof of Work
              </h3>
              <span className="text-xs text-slate-400 font-mono">6 Dimensions Calibrated</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.radarCompetencies.map((comp) => {
                const delta = comp.score - comp.benchmark;
                return (
                  <div
                    key={comp.dimension}
                    className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">{comp.dimension}</div>
                        <div className="text-[11px] text-indigo-300 font-mono mt-0.5">{comp.level}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-white font-mono">{comp.score}/100</div>
                        <div className="text-[10px] text-emerald-400 font-mono">+{delta}% vs benchmark</div>
                      </div>
                    </div>

                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${comp.score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Practice CTA */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 border border-indigo-500/20 flex items-center justify-between mt-2">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <div>
                  <div className="text-xs font-bold text-white">Continuous Anti-Decay Half-Life Engine</div>
                  <div className="text-[11px] text-slate-400">Scores reflect real-time production practice decay.</div>
                </div>
              </div>
              <Link
                href="/passport"
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors"
              >
                Inspect Badges
              </Link>
            </div>
          </div>
        </div>

        {/* 4. Inbound Recruiter & Headhunter Radar */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Inbound Recruiter &amp; Headhunter Radar</h2>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              Automated Fast-Tracks Unlocked
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {data.inboundOpportunities.map((opp) => (
              <div
                key={opp.id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-mono text-indigo-400 font-semibold">{opp.companyTier}</span>
                    <span className="text-[10px] text-slate-500">{opp.receivedAt}</span>
                  </div>
                  <h4 className="font-bold text-sm text-white">{opp.roleTitle}</h4>
                  <div className="text-base font-black text-emerald-400 font-mono mt-2">
                    ${opp.offeredCompensationUsd.toLocaleString()} USD
                  </div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                    {opp.fastTrackInterviewType}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">Bypasses Recruiter Screen</span>
                  <Link
                    href="/career"
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                  >
                    <span>View Terms</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. Edulexa Revenue & Compliance Footprint */}
        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Edulexa RevEngine &amp; Compliance Integration</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Active Member subscription, verified DRM forensic watermarking tokens, and Indian Section 194J TDS certificates (Form 16A) automatically synchronized with government TAN BLRE12345T.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/edulexa/dashboard"
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              Edulexa Studio
            </Link>
            <Link
              href="/mentors/book"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
            >
              Book Office Hours
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      viewBox="0 0 24 24"
      {...props}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

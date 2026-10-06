"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface VerifiedSkillBadge {
  id: string;
  skillCategory: string;
  baselineScore: number;
  currentDecayedScore: number;
  decayPercentage: number;
  daysSinceLastPractice: number;
  status: string; // "Active Gold", "Silver Warning", "Decayed Bronze"
  lastPracticedAt: string;
  practiceKatasCompleted: number;
  verificationSignatureSha256: string;
  antiDecayWarning: string;
}

interface SkillPassport {
  id: string;
  userId: string;
  fullName: string;
  targetRole: string;
  activeStreakDays: number;
  isActiveSubscriber: number;
  overallVigilanceIndex: number;
  publicShareToken: string;
  updatedAt: string;
  badges: VerifiedSkillBadge[];
  warningBadgeCount: number;
  goldBadgeCount: number;
}

interface PassiveHeadhunterInquiry {
  id: string;
  companyTier: string;
  roleTitle: string;
  offeredCompensationUsd: number;
  fastTrackInterviewType: string;
  inquiryStatus: string;
  receivedAt: string;
}

export default function SkillPassportPage() {
  const [passport, setPassport] = useState<SkillPassport | null>(null);
  const [radarInquiries, setRadarInquiries] = useState<PassiveHeadhunterInquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [practicingCategory, setPracticingCategory] = useState<string | null>(null);
  const [practiceSuccessMessage, setPracticeSuccessMessage] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchPassportData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/passport`);
      if (res.ok) {
        const data = await res.json();
        setPassport(data);
      }

      const radarRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/passport/radar`);
      if (radarRes.ok) {
        const inquiries = await radarRes.json();
        setRadarInquiries(inquiries);
      }
    } catch (err) {
      console.error("Failed to load skill passport", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPassportData();
  }, []);

  const handlePracticeKata = async (category: string) => {
    try {
      setPracticingCategory(category);
      setPracticeSuccessMessage(null);

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/passport/practice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: passport?.userId || "5a6f76a1-9aef-4cc0-b19c-e3592f87a33a",
          skillCategory: category,
          kataScore: 98,
          kataType: "Incident_WarRoom"
        })
      });

      if (res.ok) {
        const result = await res.json();
        setPracticeSuccessMessage(result.message);
        // Refresh passport state
        await fetchPassportData();
      }
    } catch (err) {
      console.error("Practice kata failed", err);
    } finally {
      setPracticingCategory(null);
    }
  };

  const handleCopyShareLink = () => {
    if (!passport) return;
    const url = `${window.location.origin}/passport/public/${passport.publicShareToken}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-amber-500/30">
      {/* Top Navigation */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-16 z-20 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 flex items-center justify-center font-bold text-slate-950 shadow-lg shadow-amber-500/20">
              ⚡
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
                Build &amp; Defend
              </span>
              <span className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 font-mono ml-2 uppercase tracking-widest border px-2 py-0.5 rounded-full font-semibold">
                Career OS
              </span>
            </div>
          </div>

          <nav className="flex items-center space-x-6 text-sm font-medium text-muted-foreground">
            <Link href="/passport" className="text-amber-700 dark:text-amber-400 font-semibold flex items-center space-x-1.5">
              <span>🪪</span>
              <span>Skill Passport</span>
            </Link>
            <Link href="/daily/incident" className="hover:text-foreground transition-colors flex items-center space-x-1.5">
              <span>🚨</span>
              <span>War-Room</span>
            </Link>
            <Link href="/daily/review" className="hover:text-foreground transition-colors flex items-center space-x-1.5">
              <span>🔍</span>
              <span>PR Dojo</span>
            </Link>
            <Link href="/guilds/battles" className="hover:text-foreground transition-colors flex items-center space-x-1.5">
              <span>⚔️</span>
              <span>Guild Battles</span>
            </Link>
            <Link href="/leaderboard" className="hover:text-foreground transition-colors flex items-center space-x-1.5">
              <span>🏆</span>
              <span>Leaderboard</span>
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowShareModal(true)}
              className="px-3.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <span>🔗</span>
              <span>Share Passport</span>
            </button>
            <div className="h-8 w-8 rounded-full bg-muted border border-border flex items-center justify-center text-xs font-bold text-muted-foreground">
              AC
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 space-y-8">
        {/* Loading Spinner */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
            <p className="text-sm font-mono text-muted-foreground">Loading dynamic verified skill passport...</p>
          </div>
        )}

        {!loading && passport && (
          <>
            {/* Engineer Profile & Streak HUD Banner */}
            <div className="relative overflow-hidden rounded-2xl bg-card/90 backdrop-blur-xl border border-border p-8 shadow-2xl dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-900/90 dark:to-amber-950/20">
              <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-3xl font-extrabold text-foreground tracking-tight">{passport.fullName}</h1>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Active Gold Verified
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                      Subscriber Active
                    </span>
                  </div>
                  <p className="text-indigo-700 dark:text-indigo-300 text-sm font-semibold">{passport.targetRole}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-2">
                    Public Verification Token:{" "}
                    <span className="text-foreground/80 dark:text-muted-foreground select-all font-semibold">{passport.publicShareToken}</span>
                  </p>
                </div>

                {/* Live Metrics Quad */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Streak Card */}
                  <div className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center space-x-3 shadow-md">
                    <span className="text-3xl">🔥</span>
                    <div>
                      <div className="text-2xl font-black text-amber-700 dark:text-amber-400">{passport.activeStreakDays} Days</div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Active Streak</div>
                    </div>
                  </div>

                  {/* Vigilance Index Card */}
                  <div className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center space-x-3 shadow-md">
                    <span className="text-3xl">🛡️</span>
                    <div>
                      <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{passport.overallVigilanceIndex}%</div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Overall Vigilance</div>
                    </div>
                  </div>

                  {/* Badges Status Card */}
                  <div className="bg-card border border-border rounded-xl px-5 py-3.5 flex items-center space-x-3 shadow-md">
                    <span className="text-3xl">🏅</span>
                    <div>
                      <div className="text-2xl font-black text-amber-600 dark:text-yellow-300">
                        {passport.goldBadgeCount} <span className="text-xs font-normal text-muted-foreground">Gold</span>
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {passport.warningBadgeCount > 0 ? (
                          <span className="text-amber-700 dark:text-amber-400">{passport.warningBadgeCount} Decaying</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">All Pristine</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Anti-Decay Alert Banner (If Any Skill Is Decaying) */}
            {passport.warningBadgeCount > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 dark:bg-gradient-to-r dark:from-amber-950/40 dark:via-amber-900/30 dark:to-amber-950/40 dark:border-amber-600/40 rounded-xl p-4 flex items-center justify-between shadow-lg">
                <div className="flex items-center space-x-3">
                  <div className="h-10 w-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-xl text-amber-700 dark:text-amber-400 shrink-0">
                    ⚠️
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                      Anti-Decay Warning: {passport.warningBadgeCount} Verified Skill Needs Practice
                    </h4>
                    <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-0.5">
                      Without active practice, skill half-life decay reduces your verified score by 5% monthly, threatening your Fortune 500 recruiter fast-track visibility.
                    </p>
                  </div>
                </div>
                <Link
                  href="/daily/incident"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md shrink-0"
                >
                  Start 10-Min Incident Kata
                </Link>
              </div>
            )}

            {/* Practice Success Notification Banner */}
            {practiceSuccessMessage && (
              <div className="bg-emerald-950/60 border border-emerald-600/50 rounded-xl p-4 flex items-center justify-between animate-fadeIn shadow-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">✅</span>
                  <p className="text-sm font-medium text-emerald-200">{practiceSuccessMessage}</p>
                </div>
                <button
                  onClick={() => setPracticeSuccessMessage(null)}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-200 font-semibold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Two-Column Layout: Skill Badges Grid (Left) & Headhunter Radar (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column: Verified Badges with Decay Meters */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-foreground flex items-center space-x-2">
                      <span>Verified Skill Half-Life Badges</span>
                      <span className="text-xs text-muted-foreground font-normal">({passport.badges.length} categories)</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Dynamic credentials decay 5% monthly without active katas. Practice freezes decay for 14 days.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-md">
                    Half-Life: 30 Days
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {passport.badges.map((badge) => {
                    const isGold = badge.status === "Active Gold";
                    const isWarning = badge.status === "Silver Warning";
                    const isDecayed = badge.status === "Decayed Bronze";

                    return (
                      <div
                        key={badge.id}
                        className={`rounded-xl border p-5 transition-all duration-200 flex flex-col justify-between ${
                          isGold
                            ? "bg-card/70 border-border hover:border-amber-500/30 shadow-sm"
                            : isWarning
                            ? "bg-amber-500/5 dark:bg-amber-950/20 border-amber-500/30 dark:border-amber-700/50 hover:border-amber-500/50"
                            : "bg-rose-500/5 dark:bg-rose-950/20 border-rose-500/30 dark:border-rose-800/40 hover:border-rose-600/50"
                        }`}
                      >
                        <div>
                          {/* Badge Header */}
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <h3 className="font-bold text-sm text-foreground leading-snug">{badge.skillCategory}</h3>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                isGold
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                  : isWarning
                                  ? "bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/40"
                                  : "bg-rose-500/20 text-rose-800 dark:text-rose-300 border border-rose-500/40"
                              }`}
                            >
                              {badge.status}
                            </span>
                          </div>

                          {/* Score and Decay Visualizer */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="text-muted-foreground">Current Decayed Score:</span>
                              <div className="flex items-baseline space-x-1.5 font-mono">
                                <span
                                  className={`text-lg font-extrabold ${
                                    isGold ? "text-amber-700 dark:text-amber-400" : isWarning ? "text-amber-600 dark:text-amber-300" : "text-rose-400"
                                  }`}
                                >
                                  {badge.currentDecayedScore.toFixed(1)}%
                                </span>
                                {badge.decayPercentage > 0 && (
                                  <span className="text-[11px] text-rose-400 font-semibold">
                                    (-{badge.decayPercentage.toFixed(1)}%)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-background rounded-full h-2 overflow-hidden border border-border">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isGold
                                    ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                                    : isWarning
                                    ? "bg-gradient-to-r from-amber-600 to-amber-400"
                                    : "bg-gradient-to-r from-rose-600 to-rose-400"
                                }`}
                                style={{ width: `${Math.min(100, badge.currentDecayedScore)}%` }}
                              ></div>
                            </div>

                            {/* Warning or Status Text */}
                            <p className="text-[11px] text-muted-foreground italic leading-relaxed pt-1">
                              {badge.antiDecayWarning}
                            </p>
                          </div>
                        </div>

                        {/* Card Footer: Metadata & Practice Action */}
                        <div className="pt-3 border-t border-border/80 space-y-3">
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                            <span>Practiced: {badge.daysSinceLastPractice}d ago</span>
                            <span>{badge.practiceKatasCompleted} katas completed</span>
                          </div>

                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handlePracticeKata(badge.skillCategory)}
                              disabled={practicingCategory === badge.skillCategory}
                              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center space-x-1.5 shadow-sm ${
                                isGold
                                  ? "bg-muted hover:bg-muted/80 text-foreground border border-border"
                                  : "bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
                              }`}
                            >
                              <span>⚡</span>
                              <span>
                                {practicingCategory === badge.skillCategory
                                  ? "Evaluating..."
                                  : isGold
                                  ? "Practice Kata (Freeze)"
                                  : "Restore to 100% Gold"}
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Passive Headhunter Radar & Opportunities */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-foreground flex items-center space-x-2">
                    <span>📡 Passive Recruiter Radar</span>
                  </h2>
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                </div>

                <div className="bg-card/60 border border-border rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between text-xs pb-3 border-b border-border">
                    <span className="text-muted-foreground">Radar Status:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center space-x-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                      <span>Active Fortune 500 Broadcast</span>
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Recruiters pay continuous subscription access to view candidates maintaining an Active Gold streak. Inquiries skip standard HR screens.
                  </p>

                  <div className="space-y-3 pt-2">
                    {radarInquiries.map((inquiry) => (
                      <div
                        key={inquiry.id}
                        className="bg-background/80 border border-border/90 rounded-lg p-3.5 space-y-2 hover:border-border transition-all shadow-inner"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                              {inquiry.companyTier}
                            </span>
                            <h4 className="text-xs font-bold text-foreground mt-1">{inquiry.roleTitle}</h4>
                          </div>
                          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-mono shrink-0">
                            ${(inquiry.offeredCompensationUsd / 1000).toFixed(0)}k/yr
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground flex items-center space-x-1">
                          <span>🚀</span>
                          <span className="truncate">{inquiry.fastTrackInterviewType}</span>
                        </p>

                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                          <span>Status: {inquiry.inquiryStatus}</span>
                          <span>{new Date(inquiry.receivedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-center">
                    <Link
                      href="/prep/career"
                      className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-600 dark:text-amber-300 font-semibold underline underline-offset-4"
                    >
                      View Full Career Trajectory & Salary Appraisal →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Share Passport Modal */}
      {showShareModal && passport && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center space-x-2">
                <span>🪪</span>
                <span>Share Verified Skill Passport</span>
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-muted-foreground hover:text-foreground text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Anyone with this verified link can view your live skill achievements, verified badges, and proficiency scores.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Public Verification URL</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/passport/public/${passport.publicShareToken}` : ""}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-amber-600 dark:text-amber-300 select-all focus:outline-none"
                />
                <button
                  onClick={handleCopyShareLink}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-all"
                >
                  {copiedLink ? "Copied!" : "Copy Link"}
                </button>
              </div>
            </div>

            <div className="p-3.5 bg-background/60 border border-border/80 rounded-xl space-y-2">
              <div className="text-[11px] font-bold text-muted-foreground flex items-center space-x-1.5">
                <span>🔒</span>
                <span>Official Verification Guarantee</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono truncate">
                Verification ID: {passport.badges[0]?.verificationSignatureSha256 || "verified-audit-block"}
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold rounded-lg border border-border"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

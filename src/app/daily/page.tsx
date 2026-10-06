"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Flame, ShieldCheck, Swords, GitPullRequest, Terminal, 
  Trophy, ArrowRight, CheckCircle2, Clock, Sparkles, 
  AlertTriangle, ChevronRight, Play, Zap, Award
} from "lucide-react";

interface UserStreak {
  currentStreak: number;
  highestStreak: number;
  streakFreezeShields: number;
  totalXp: number;
  weeklyXp: number;
  currentLeague: string;
  totalIncidentsResolved: number;
  completedToday: boolean;
}

export default function DailyRitualsHubPage() {
  const [streak, setStreak] = useState<UserStreak>({
    currentStreak: 14,
    highestStreak: 21,
    streakFreezeShields: 2,
    totalXp: 3450,
    weeklyXp: 480,
    currentLeague: "Diamond League",
    totalIncidentsResolved: 42,
    completedToday: false,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Attempt to fetch user's live streak from backend
    async function loadStreak() {
      try {
        const userId = typeof window !== "undefined" 
          ? localStorage.getItem("daily_incident_user_id") || "a8f3b201-1122-3344-5566-778899aabbcc"
          : "a8f3b201-1122-3344-5566-778899aabbcc";

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/incidents/streak/${userId}`);
        if (res.ok) {
          const data = await res.json();
          setStreak(prev => ({
            ...prev,
            currentStreak: data.currentStreak ?? prev.currentStreak,
            highestStreak: data.highestStreak ?? prev.highestStreak,
            streakFreezeShields: data.streakFreezeShields ?? prev.streakFreezeShields,
            totalXp: data.totalXp ?? prev.totalXp,
            weeklyXp: data.weeklyXp ?? prev.weeklyXp,
            currentLeague: data.currentLeague || prev.currentLeague,
            totalIncidentsResolved: data.totalIncidentsResolved ?? prev.totalIncidentsResolved,
            completedToday: data.completedToday ?? prev.completedToday,
          }));
        }
      } catch {
        // Fallback to initial state
      }
    }
    loadStreak();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Top Bar Header */}
      <div className="border-b border-border/80 bg-card/80 backdrop-blur-md sticky top-16 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center font-bold text-white shadow-lg shadow-orange-500/20">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="font-extrabold text-base text-foreground tracking-tight">
                  DAILY ENGINEERING DOJO & KATA ARENA
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                  Day 14 Active
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Morning Outage War-Rooms, CVE Code Reviews, and Competitive 1v1 Engineering Katas
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-bold">
              <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-pulse" />
              <span>{streak.currentStreak} Days</span>
            </div>
            <div className="hidden sm:flex items-center space-x-1 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
              <Trophy className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{streak.currentLeague}</span>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Hero Section */}
        <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-card via-card/90 to-amber-950/20 border border-border/80 shadow-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-800 dark:text-orange-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
              <span>Daily Engineering Habit Loop • 10-Minute Maximum Commitment</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Sharpen Systems Intuition Every Morning
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Top engineers at Uber, Stripe, and Google practice real production incidents before their workday starts. 
              Triage distributed systems SEV-1 outages, spot CVE vulnerabilities in open pull requests, and maintain your streak.
            </p>
          </div>
        </div>

        {/* Streak & Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-card border border-border flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Flame className="w-5 h-5 fill-amber-500/30 text-amber-500" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Current Streak</span>
              <span className="text-xl font-black text-foreground">{streak.currentStreak} Days</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Freeze Shields</span>
              <span className="text-xl font-black text-foreground">{streak.streakFreezeShields} Equipped</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Weekly League XP</span>
              <span className="text-xl font-black text-foreground">+{streak.weeklyXp} XP</span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-card border border-border flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Total Resolved</span>
              <span className="text-xl font-black text-foreground">{streak.totalIncidentsResolved} Katas</span>
            </div>
          </div>
        </div>

        {/* Three Core Daily Rituals Cards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">
              Today's Daily Engineering Challenges
            </h3>
            <span className="text-xs text-muted-foreground">Resets daily at 00:00 UTC</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Ritual 1: Outage Triage */}
            <div className="p-6 rounded-3xl bg-card border border-border hover:border-amber-500/40 transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                    SEV-1 OUTAGE • +150 XP
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-base text-foreground group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors">
                    Morning Incident War-Room
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    A real production outage strikes. Inspect live Prometheus latency metrics, read Kubernetes error logs, formulate your hypothesis, and execute remediation within 10 minutes.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>Average MTTR: 4m 12s</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                    <span>9 Tracks: DevOps, Backend, Cyber, Database</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Triage Live Outage</span>
                <Link
                  href="/daily/incident"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors"
                >
                  <span>Enter War-Room</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Ritual 2: CVE PR Code Review */}
            <div className="p-6 rounded-3xl bg-card border border-border hover:border-indigo-500/40 transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                    <GitPullRequest className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                    PR REVIEW • +100 XP
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-base text-foreground group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                    CVE Code Review Dojo
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Review a realistic pull request containing subtle concurrency race conditions, SQL injection, memory leaks, or auth bypasses. Flag the exact line number and request changes.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
                    <span>Timed: 3 Minutes Speed Challenge</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400 shrink-0" />
                    <span>Zero-Day Vigilance Rating</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Inspect PR Diff</span>
                <Link
                  href="/daily/review"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors"
                >
                  <span>Open PR Diff</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Ritual 3: 1v1 Speed Duel Arena */}
            <div className="p-6 rounded-3xl bg-card border border-border hover:border-purple-500/40 transition-all flex flex-col justify-between group">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <Swords className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                    MULTIPLAYER • +200 XP
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-base text-foreground group-hover:text-purple-700 dark:group-hover:text-purple-400 transition-colors">
                    1v1 Architectural Speed Duel
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    Match with other engineers globally. Race head-to-head to diagnose a cascading Kafka partition failure or deadlock before your opponent. Win rank points and claim league badges.
                  </p>
                </div>

                <div className="space-y-1.5 pt-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400 shrink-0" />
                    <span>Real-time WebSocket Matchmaking</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <Award className="w-3.5 h-3.5 text-purple-700 dark:text-purple-400 shrink-0" />
                    <span>Elo Rating: 1,840 (Diamond Tier)</span>
                  </div>
                </div>
              </div>

              <div className="pt-6 mt-6 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold">Match Against Peers</span>
                <Link
                  href="/duels/arena"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-colors"
                >
                  <span>Enter Duel Arena</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Weekly League Standings Preview */}
        <div className="p-6 md:p-8 rounded-3xl bg-card border border-border shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Diamond League Standings — Week 41</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Top 3 promoted to Master League at Sunday 23:59 UTC. Bottom 3 demoted to Platinum.
              </p>
            </div>
            <Link
              href="/leaderboard"
              className="text-xs font-semibold text-purple-700 dark:text-purple-400 hover:underline flex items-center space-x-1"
            >
              <span>View Full Leaderboard</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-border/60 text-xs">
            {[
              { rank: 1, name: "Siddharth N. (Uber)", xp: 1420, streak: "28d", tier: "PROMOTION ZONE", isMe: false },
              { rank: 2, name: "Claire Delacroix (Stripe)", xp: 1380, streak: "24d", tier: "PROMOTION ZONE", isMe: false },
              { rank: 3, name: "You (Alex Morgan)", xp: 1250, streak: "14d", tier: "PROMOTION ZONE", isMe: true },
              { rank: 4, name: "Kenji Sato (Google)", xp: 1190, streak: "19d", tier: "SAFE", isMe: false },
              { rank: 5, name: "Priya Sharma (Netflix)", xp: 1120, streak: "11d", tier: "SAFE", isMe: false }
            ].map(user => (
              <div 
                key={user.rank} 
                className={`py-3 flex items-center justify-between ${
                  user.isMe ? "bg-purple-500/5 px-3 rounded-xl border border-purple-500/20 font-semibold" : ""
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className={`w-6 text-center font-bold font-mono ${
                    user.rank === 1 ? "text-amber-500" : user.rank === 2 ? "text-neutral-400" : user.rank === 3 ? "text-amber-700" : "text-muted-foreground"
                  }`}>
                    #{user.rank}
                  </span>
                  <span className="text-foreground">{user.name}</span>
                </div>
                <div className="flex items-center space-x-4">
                  <span className="font-mono text-muted-foreground">{user.streak}</span>
                  <span className="font-mono font-bold text-foreground">+{user.xp} XP</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    user.tier === "PROMOTION ZONE" 
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20" 
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {user.tier}
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

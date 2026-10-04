"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Medal,
  Award,
  Crown,
  Search,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Sparkles,
  Zap,
} from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  credentialId: string;
  candidateName: string;
  finalScore: number;
  badgeTitle: string;
  publicUrlSlug: string;
  completionTimeSeconds: number;
  completionTimeFormatted: string;
  verificationFlagged: boolean;
  verifiedAt: string;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setFetchError(null);
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/leaderboard`);
        if (res.ok) {
          const data = await res.json();
          setEntries(data.leaderboard || []);
        } else {
          setFetchError(`Server returned status ${res.status}: Unable to load verified leaderboard.`);
          setEntries([]);
        }
      } catch (err: any) {
        console.error("Failed to load leaderboard:", err);
        setFetchError(err.message || "Failed to connect to leaderboard service.");
        setEntries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const filtered = entries.filter((item) =>
    item.candidateName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const top3 = entries.slice(0, 3);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans pb-16">
      {/* Top Navbar */}
      <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => router.push("/")}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-600 flex items-center justify-center font-bold text-white shadow-lg shadow-amber-500/20">
              <Trophy className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base text-white tracking-wide">BUILD & DEFEND</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  Global Hall of Fame
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Public Engineering Leaderboard & Verified Credentials</p>
            </div>
          </div>

          <button
            onClick={() => router.push("/")}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Marketplace</span>
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-10 flex-1 w-full space-y-10">
        {/* Banner Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Top 50 Verified Engineers</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Global Community Leaderboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
            Engineers ranked by AI Voice Defense score and sprint completion speed. Only public opt-in credentials are shown.
          </p>
        </div>

        {fetchError && (
          <div className="max-w-2xl mx-auto p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center space-x-3 text-amber-300 text-xs">
            <span className="font-bold">Notice:</span>
            <span>{fetchError}</span>
          </div>
        )}

        {/* Top 3 Podium Cards */}
        {top3.length >= 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 max-w-4xl mx-auto items-end">
            {/* 2nd Place (Silver) */}
            <div className="glass-panel rounded-3xl p-6 border border-border/80 bg-card/40 flex flex-col items-center text-center space-y-3 order-2 md:order-1 relative shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-slate-400 to-slate-200 flex items-center justify-center font-extrabold text-slate-900 text-lg shadow-lg">
                2
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Silver Medal</p>
                <h3 className="text-lg font-bold text-white mt-0.5">{top3[1].candidateName}</h3>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-sm font-extrabold">
                {top3[1].finalScore.toFixed(1)}% Score
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Speed: {top3[1].completionTimeFormatted}</span>
              </span>
              <button
                onClick={() => router.push(`/credential/${top3[1].publicUrlSlug}`)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 pt-1"
              >
                <span>View Badge</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 1st Place (Gold Champion) */}
            <div className="glass-panel rounded-3xl p-8 border border-amber-500/50 bg-gradient-to-b from-amber-500/10 to-slate-900/60 flex flex-col items-center text-center space-y-4 order-1 md:order-2 relative shadow-2xl scale-105">
              <div className="absolute -top-4 px-3 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-extrabold text-[10px] tracking-wider uppercase shadow-md flex items-center space-x-1">
                <Crown className="w-3 h-3 text-slate-950" />
                <span>Champion</span>
              </div>
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 to-yellow-500 flex items-center justify-center font-extrabold text-slate-950 text-2xl shadow-xl shadow-amber-500/20">
                1
              </div>
              <div>
                <p className="text-xs text-amber-400 font-semibold uppercase tracking-wider">Gold Grandmaster</p>
                <h3 className="text-xl font-extrabold text-white mt-0.5">{top3[0].candidateName}</h3>
              </div>
              <div className="px-5 py-2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-base font-black">
                {top3[0].finalScore.toFixed(1)}% Score
              </div>
              <span className="text-xs text-muted-foreground flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Speed: {top3[0].completionTimeFormatted}</span>
              </span>
              <button
                onClick={() => router.push(`/credential/${top3[0].publicUrlSlug}`)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center space-x-1.5 transition-all cursor-pointer"
              >
                <span>View Public Credential</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 3rd Place (Bronze) */}
            <div className="glass-panel rounded-3xl p-6 border border-border/80 bg-card/40 flex flex-col items-center text-center space-y-3 order-3 relative shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-700 to-yellow-800 flex items-center justify-center font-extrabold text-white text-lg shadow-lg">
                3
              </div>
              <div>
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider">Bronze Medal</p>
                <h3 className="text-lg font-bold text-white mt-0.5">{top3[2].candidateName}</h3>
              </div>
              <div className="px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-sm font-extrabold">
                {top3[2].finalScore.toFixed(1)}% Score
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Speed: {top3[2].completionTimeFormatted}</span>
              </span>
              <button
                onClick={() => router.push(`/credential/${top3[2].publicUrlSlug}`)}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center space-x-1 pt-1"
              >
                <span>View Badge</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Search & Data Table */}
        <div className="space-y-4 max-w-5xl mx-auto pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white">Full Standings ({entries.length})</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search candidate name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-muted-foreground">
                <thead className="bg-card/80 border-b border-border text-muted-foreground font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-6 py-3 w-16 text-center">Rank</th>
                    <th className="px-6 py-3">Candidate</th>
                    <th className="px-6 py-3">Technical Score</th>
                    <th className="px-6 py-3">Speed</th>
                    <th className="px-6 py-3">Verification</th>
                    <th className="px-6 py-3 text-right">Credential</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        Loading community leaderboard...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                        No candidates found. Complete an interview and sprint defense to join the Hall of Fame!
                      </td>
                    </tr>
                  ) : (
                    filtered.map((entry) => (
                      <tr key={entry.credentialId} className="hover:bg-card/40 transition-colors">
                        <td className="px-6 py-4 font-bold text-center">
                          {entry.rank === 1 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 inline-flex items-center justify-center text-xs font-black">
                              1
                            </span>
                          ) : entry.rank === 2 ? (
                            <span className="w-6 h-6 rounded-full bg-slate-300 text-slate-950 inline-flex items-center justify-center text-xs font-black">
                              2
                            </span>
                          ) : entry.rank === 3 ? (
                            <span className="w-6 h-6 rounded-full bg-amber-700 text-white inline-flex items-center justify-center text-xs font-black">
                              3
                            </span>
                          ) : (
                            <span className="text-muted-foreground">#{entry.rank}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-white">{entry.candidateName}</td>
                        <td className="px-6 py-4 font-mono font-bold text-amber-300 text-sm">
                          {entry.finalScore.toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 text-muted-foreground font-mono text-[11px]">
                          {entry.completionTimeFormatted}
                        </td>
                        <td className="px-6 py-4">
                          {entry.verificationFlagged ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1 w-fit">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>Flagged</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1 w-fit">
                              <ShieldCheck className="w-3 h-3 text-emerald-400" />
                              <span>Verified</span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => router.push(`/credential/${entry.publicUrlSlug}`)}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <span>View</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

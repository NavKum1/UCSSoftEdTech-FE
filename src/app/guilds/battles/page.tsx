"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Guild {
  id: string;
  tenantOrInstituteId: string;
  guildName: string;
  slug: string;
  department: string;
  totalMembers: number;
  guildRatingElo: number;
  totalTrophies: number;
  createdAt: string;
}

interface HackathonEvent {
  id: string;
  title: string;
  eventType: string;
  status: string;
  startTime: string;
  endTime: string;
  challengePayload_JSON: string;
  prizePool: string;
}

interface Participant {
  rank: number;
  guildId: string;
  squadName: string;
  score: number;
  attacksMitigated: number;
  speedMs: number;
  status: string;
}

interface HackathonLeaderboard {
  hackathonId: string;
  title: string;
  status: string;
  totalParticipants: number;
  prizePool: string;
  participants: Participant[];
}

export default function EnterpriseGuildBattlesPage() {
  const [guilds, setGuilds] = useState<Guild[]>([]);
  const [hackathons, setHackathons] = useState<HackathonEvent[]>([]);
  const [activeHackathon, setActiveHackathon] = useState<HackathonEvent | null>(null);
  const [leaderboard, setLeaderboard] = useState<HackathonLeaderboard | null>(null);

  const [activeTab, setActiveTab] = useState<"arena" | "guilds" | "tournaments">("arena");
  const [loading, setLoading] = useState<boolean>(true);
  const [submittingScore, setSubmittingScore] = useState<boolean>(false);

  // Form states for submitting squad battle performance
  const [selectedGuildId, setSelectedGuildId] = useState<string>("");
  const [attacksMitigated, setAttacksMitigated] = useState<number>(3);
  const [scorePoints, setScorePoints] = useState<number>(120);

  // New Guild creation form
  const [showCreateGuild, setShowCreateGuild] = useState<boolean>(false);
  const [newGuildName, setNewGuildName] = useState<string>("");
  const [newGuildDept, setNewGuildDept] = useState<string>("Platform");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Guilds
      const guildsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/guilds`);
      let guildsData: Guild[] = [];
      if (guildsRes.ok) {
        guildsData = await guildsRes.json();
        setGuilds(guildsData);
        if (guildsData.length > 0) setSelectedGuildId(guildsData[0].id);
      }

      // 2. Fetch Hackathons
      const eventsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/guilds/hackathons`);
      if (eventsRes.ok) {
        const eventsData: HackathonEvent[] = await eventsRes.json();
        setHackathons(eventsData);
        const liveEvent = eventsData.find((e) => e.status === "Live") || eventsData[0];
        if (liveEvent) {
          setActiveHackathon(liveEvent);
          fetchLeaderboard(liveEvent.id);
        }
      }
    } catch (err) {
      console.error("Failed to load guild battles data", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (hackathonId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/guilds/hackathons/${hackathonId}/leaderboard`);
      if (res.ok) {
        setLeaderboard(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard", err);
    }
  };

  const handleSubmitScore = async () => {
    if (!activeHackathon || !selectedGuildId) return;

    setSubmittingScore(true);
    const selectedGuild = guilds.find((g) => g.id === selectedGuildId);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/guilds/hackathons/score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hackathonId: activeHackathon.id,
          guildId: selectedGuildId,
          squadName: selectedGuild?.guildName || "Squad Contributor",
          userId: "11223344-5566-7788-99aa-bbccddeeff00",
          userName: "Lead Battle Architect",
          scorePoints,
          attacksMitigated,
          speedMs: 380.0,
        }),
      });

      if (res.ok) {
        // Refresh leaderboard and guilds
        await fetchLeaderboard(activeHackathon.id);
        const guildsRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/guilds`);
        if (guildsRes.ok) setGuilds(await guildsRes.json());
        alert("Battle performance registered! Squad Elo rating updated.");
      }
    } catch (err) {
      console.error("Score submission failed", err);
    } finally {
      setSubmittingScore(false);
    }
  };

  const handleCreateGuild = async () => {
    if (!newGuildName) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/guilds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guildName: newGuildName,
          department: newGuildDept,
          creatorUserId: "11223344-5566-7788-99aa-bbccddeeff00",
          creatorUserName: "Guild Founder",
        }),
      });

      if (res.ok) {
        const created: Guild = await res.json();
        setGuilds((prev) => [created, ...prev]);
        setShowCreateGuild(false);
        setNewGuildName("");
        alert(`Guild "${created.guildName}" established with 1200 base Elo!`);
      }
    } catch (err) {
      console.error("Failed to create guild", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-mono text-sm tracking-wide">
            Connecting to Live Enterprise Guild Battle Arena & Matchmaking Engine...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-mono uppercase tracking-widest text-slate-400 hover:text-white transition"
            >
              ← System Dashboard
            </Link>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚔️</span>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Enterprise Guild Battles
              </h1>
              <span className="px-2 py-0.5 text-xs font-mono bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded">
                B2B Team Hackathons
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-2 bg-slate-800/80 border border-purple-500/30 px-3 py-1.5 rounded-lg shadow-sm">
              <span className="text-base">🏆</span>
              <div>
                <span className="text-purple-300 font-bold text-sm">
                  {guilds.reduce((acc, g) => acc + g.totalTrophies, 0)} Total Trophies
                </span>
                <span className="text-slate-400 text-[10px] block">{guilds.length} Active Guilds</span>
              </div>
            </div>

            <button
              onClick={() => setShowCreateGuild(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-lg shadow transition"
            >
              + Create Squad Guild
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Live Hackathon Banner */}
        {activeHackathon && (
          <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 border border-indigo-800/50 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs uppercase font-mono font-bold text-emerald-400 tracking-wider">
                    {activeHackathon.status} Tournament Battle
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs font-mono text-slate-400">
                    Mode: {activeHackathon.eventType}
                  </span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">{activeHackathon.title}</h2>
              </div>

              <div className="bg-purple-950/80 border border-purple-500/40 text-purple-300 px-4 py-3 rounded-xl text-center shrink-0">
                <span className="text-xs font-mono uppercase tracking-wider block text-purple-400">
                  Prize Pool Allocation
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {activeHackathon.prizePool}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800">
          <button
            onClick={() => setActiveTab("arena")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "arena"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            ⚔️ Live Battle Arena & Leaderboard
          </button>
          <button
            onClick={() => setActiveTab("guilds")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "guilds"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            🛡️ Enterprise Guilds & Elo Ratings
          </button>
          <button
            onClick={() => setActiveTab("tournaments")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === "tournaments"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            📅 Scheduled Hackathon Tournaments
          </button>
        </div>

        {/* Tab 1: Live Battle Arena */}
        {activeTab === "arena" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Live Battle Leaderboard */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <span>📊</span> Real-Time Tournament Leaderboard
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    Live Score Refresh Enabled
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="text-slate-400 bg-slate-950/60 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Squad Name</th>
                        <th className="py-3 px-4">Attacks Mitigated</th>
                        <th className="py-3 px-4">Speed</th>
                        <th className="py-3 px-4">Total Score</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {leaderboard?.participants.map((p) => (
                        <tr key={p.guildId} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4 font-bold">
                            {p.rank === 1 && "🥇 "}
                            {p.rank === 2 && "🥈 "}
                            {p.rank === 3 && "🥉 "}#{p.rank}
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-200">{p.squadName}</td>
                          <td className="py-3 px-4 text-emerald-400">🛡️ {p.attacksMitigated} Mitigated</td>
                          <td className="py-3 px-4 text-cyan-400">{p.speedMs}ms</td>
                          <td className="py-3 px-4 font-bold text-amber-400 text-sm">
                            {p.score} pts
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right Col: Squad Battle Submission Console */}
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-lg">
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <span>🕹️</span> Squad Battle Command Console
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Log real-time mitigation rounds during live hackathons. Points advance squad rank
                  and increase your team&apos;s global Elo rating.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-mono text-slate-400 block mb-1">
                      Participating Guild
                    </label>
                    <select
                      value={selectedGuildId}
                      onChange={(e) => setSelectedGuildId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                    >
                      {guilds.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.guildName} ({g.guildRatingElo} Elo)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-mono text-slate-400 block mb-1">
                      Attacks Mitigated (Chaos Faults)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={attacksMitigated}
                      onChange={(e) => setAttacksMitigated(parseInt(e.target.value) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-mono text-slate-400 block mb-1">
                      Round Points Earned
                    </label>
                    <input
                      type="number"
                      min={10}
                      step={10}
                      value={scorePoints}
                      onChange={(e) => setScorePoints(parseInt(e.target.value) || 10)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleSubmitScore}
                    disabled={submittingScore}
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition"
                  >
                    {submittingScore ? "Submitting Performance..." : "Submit Battle Performance"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Enterprise Guilds & Elo Ratings */}
        {activeTab === "guilds" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {guilds.map((g) => (
              <div
                key={g.id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-2xl">🛡️</span>
                  <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-800 rounded">
                    {g.department}
                  </span>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-100 text-base">{g.guildName}</h4>
                  <p className="text-xs text-slate-400 font-mono">{g.totalMembers} Engineers</p>
                </div>

                <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Guild Elo</span>
                    <span className="text-lg font-bold text-amber-400">{g.guildRatingElo}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Trophies</span>
                    <span className="text-lg font-bold text-purple-400">🏆 {g.totalTrophies}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Tournaments */}
        {activeTab === "tournaments" && (
          <div className="space-y-4">
            {hackathons.map((h) => (
              <div
                key={h.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-mono rounded ${
                        h.status === "Live"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {h.status}
                    </span>
                    <span className="text-xs font-mono text-slate-400">{h.eventType}</span>
                  </div>
                  <h4 className="text-lg font-bold text-slate-100">{h.title}</h4>
                </div>

                <div className="text-right font-mono text-xs text-purple-300">
                  <span className="block font-bold">{h.prizePool}</span>
                  <span className="text-[11px] text-slate-500 block">
                    Starts: {new Date(h.startTime).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Guild Modal */}
        {showCreateGuild && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-lg text-slate-100">Establish Squad Guild</h3>
                <button
                  onClick={() => setShowCreateGuild(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">
                    Guild Name (e.g. SRE Platform Tigers)
                  </label>
                  <input
                    type="text"
                    value={newGuildName}
                    onChange={(e) => setNewGuildName(e.target.value)}
                    placeholder="Enter squad guild name..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-mono text-slate-400 block mb-1">Department</label>
                  <select
                    value={newGuildDept}
                    onChange={(e) => setNewGuildDept(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Platform">Platform Engineering</option>
                    <option value="Fintech">Fintech & Payments</option>
                    <option value="Security">Security & Red-Team</option>
                    <option value="Infrastructure">Cloud Infrastructure</option>
                    <option value="Core_API">Core API & Microservices</option>
                  </select>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={handleCreateGuild}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition"
                  >
                    Confirm Creation
                  </button>
                  <button
                    onClick={() => setShowCreateGuild(false)}
                    className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

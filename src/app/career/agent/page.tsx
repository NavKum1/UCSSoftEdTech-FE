"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useGeo } from "@/context/GeoContext";

interface CareerAgentConfig {
  id: string;
  userId: string;
  candidateName: string;
  currentTitle: string;
  isAgentActive: boolean;
  autonomyLevel: string;
  minBaseSalary: number;
  minTotalComp: number;
  minEquityGrant: number;
  requireFastTrackScreeningSkip: boolean;
  targetRoles_JSON: string;
  targetDomains_JSON: string;
  preferredLocations_JSON: string;
  passportVerificationToken: string;
  autoDeclineBelowFloor: boolean;
}

interface InboundNegotiation {
  id: string;
  candidateUserId: string;
  recruiterName: string;
  recruiterEmail: string;
  recruiterCompany: string;
  roleTitle: string;
  initialBaseSalary: number;
  initialEquity: number;
  initialTotalComp: number;
  currentBaseSalary: number;
  currentEquity: number;
  currentTotalComp: number;
  roleSeniorityTier: string;
  domainCategory: string;
  screeningBypassAgreed: boolean;
  fastTrackTier: string;
  status: string;
  candidateAlignmentScore: number;
  scheduledOnsiteDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MessageLog {
  id: string;
  negotiationId: string;
  sender: string;
  senderName: string;
  messageBody: string;
  proposedBase: number;
  proposedEquity: number;
  proposedTotalComp: number;
  fastTrackDemanded: boolean;
  passportProofAttached: boolean;
  timestamp: string;
}

interface NegotiationDetail {
  negotiation: InboundNegotiation;
  messageLogs: MessageLog[];
}

export default function AutonomousCareerAgentPage() {
  const { config: geo } = useGeo();
  const candidateUserId = "6d940ce2-2fc7-4525-9aff-af62f1956550";
  const [config, setConfig] = useState<CareerAgentConfig | null>(null);
  const [negotiations, setNegotiations] = useState<InboundNegotiation[]>([]);
  const [selectedNegId, setSelectedNegId] = useState<string | null>(null);
  const [activeDetail, setActiveDetail] = useState<NegotiationDetail | null>(null);
  const [filterTab, setFilterTab] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Counter turn form state
  const [counterText, setCounterText] = useState<string>("");
  const [counterBase, setCounterBase] = useState<number>(315000);
  const [counterEquity, setCounterEquity] = useState<number>(170000);
  const [concedeBypass, setConcedeBypass] = useState<boolean>(true);
  const [isSubmittingTurn, setIsSubmittingTurn] = useState<boolean>(false);

  // Inbound simulation modal state
  const [showSimModal, setShowSimModal] = useState<boolean>(false);
  const [simCompany, setSimCompany] = useState<string>("Anthropic AI Systems");
  const [simRole, setSimRole] = useState<string>("Staff Infrastructure Core Architect");
  const [simRecruiter, setSimRecruiter] = useState<string>("Jordan Hayes");
  const [simEmail, setSimEmail] = useState<string>("jordan.hayes@anthropic-ai.example.com");
  const [simBase, setSimBase] = useState<number>(300000);
  const [simEquity, setSimEquity] = useState<number>(180000);
  const [simSeniority, setSimSeniority] = useState<string>("L6_Staff");
  const [simMessage, setSimMessage] = useState<string>(
    "Hi Alex, our frontier inference cluster needs a Staff Architect to scale our multi-region distributed model weights and Raft-based metadata layer. Let's chat."
  );

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/agent/config/${candidateUserId}`);
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (err) {
      console.error("Failed to load career agent config", err);
    }
  };

  const fetchNegotiations = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/agent/inquiries/${candidateUserId}`);
      if (res.ok) {
        const data: InboundNegotiation[] = await res.json();
        setNegotiations(data);
        if (data.length > 0 && !selectedNegId) {
          setSelectedNegId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load negotiations", err);
    }
  };

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/agent/inquiries/detail/${id}`);
      if (res.ok) {
        const data: NegotiationDetail = await res.json();
        setActiveDetail(data);
        setCounterBase(Number(data.negotiation.currentBaseSalary) || 300000);
        setCounterEquity(Number(data.negotiation.currentEquity) || 150000);
      }
    } catch (err) {
      console.error("Failed to load inquiry detail", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/agent/seed`, { method: "POST" });
      await fetchConfig();
      await fetchNegotiations();
      setIsLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedNegId) {
      fetchDetail(selectedNegId);
    }
  }, [selectedNegId]);

  const handleSaveConfig = async () => {
    if (!config) return;
    setIsSavingConfig(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/agent/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const updated = await res.json();
        setConfig(updated);
        setSaveSuccessMsg("Autonomous Agent Policy rules successfully updated!");
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      }
    } catch (err) {
      console.error("Failed to save config", err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSubmitCounterTurn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNegId) return;
    setIsSubmittingTurn(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/agent/negotiate/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negotiationId: selectedNegId,
          recruiterResponseText:
            counterText ||
            "We have aligned with executive leadership to approve your requested compensation band and waive initial screening calls.",
          updatedBaseSalary: counterBase,
          updatedEquity: counterEquity,
          concedeScreeningBypass: concedeBypass,
        }),
      });
      if (res.ok) {
        setCounterText("");
        await fetchDetail(selectedNegId);
        await fetchNegotiations();
      }
    } catch (err) {
      console.error("Failed to submit counter turn", err);
    } finally {
      setIsSubmittingTurn(false);
    }
  };

  const handleSimulateInbound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/agent/inbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateUserId,
          recruiterName: simRecruiter,
          recruiterEmail: simEmail,
          recruiterCompany: simCompany,
          roleTitle: simRole,
          offeredBaseSalary: simBase,
          offeredEquity: simEquity,
          roleSeniorityTier: simSeniority,
          domainCategory: "Distributed_Systems",
          initialMessage: simMessage,
        }),
      });
      if (res.ok) {
        const created: InboundNegotiation = await res.json();
        setShowSimModal(false);
        await fetchNegotiations();
        setSelectedNegId(created.id);
      }
    } catch (err) {
      console.error("Failed to simulate inbound inquiry", err);
    }
  };

  const filteredNegotiations = negotiations.filter((neg) => {
    if (filterTab === "ALL") return true;
    if (filterTab === "APPROVED") return neg.status === "FastTrack_Approved";
    if (filterTab === "NEGOTIATING") return neg.status === "In_Negotiation";
    if (filterTab === "DECLINED") return neg.status === "Screening_Declined";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Cyber Navigation Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/passport"
              className="text-xs uppercase tracking-wider text-emerald-400 hover:text-emerald-300 font-mono font-semibold flex items-center gap-1.5"
            >
              <span>&larr;</span> Skill Passport
            </Link>
            <div className="h-4 w-px bg-slate-800" />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <span>Autonomous Career Agent</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                  24/7 Live Radar
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Personal AI Inbound Screener & Multi-Turn Executive Recruiter Negotiator
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowSimModal(true)}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Simulate Recruiter Inbound</span>
            </button>
            <Link
              href="/passport"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              View Verified Credentials
            </Link>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 flex-1 w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Autonomous Policy & Compensation Floor (3 cols) */}
        <section className="lg:col-span-4 space-y-5">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                Agent Autonomy Policy
              </h2>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                {config?.autonomyLevel.replace(/_/g, " ")}
              </span>
            </div>

            {/* Candidate Identity */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3.5 space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
                Represented Candidate
              </div>
              <div className="text-sm font-bold text-white flex items-center justify-between">
                <span>{config?.candidateName || "Alex Chen"}</span>
                <span className="text-xs font-mono text-amber-300 font-normal">Active Gold</span>
              </div>
              <div className="text-xs text-slate-300">{config?.currentTitle}</div>
              <div className="pt-2 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                <span>Passport Token:</span>
                <span className="text-emerald-400 underline cursor-pointer">
                  {config?.passportVerificationToken}
                </span>
              </div>
            </div>

            {/* Compensation Minimum Floor Form */}
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Reservation Price & Floors
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between mb-1">
                  <span>Minimum Base Salary (USD / Global)</span>
                  <span className="text-white font-mono font-bold">
                    ${Number(config?.minBaseSalary || 280000).toLocaleString()}{" "}
                    {geo.currency === "INR" ? (
                      <span className="text-emerald-400 text-[11px] font-normal">
                        (~₹{Math.round((config?.minBaseSalary || 280000) * 0.22)}L CTC eq.)
                      </span>
                    ) : geo.currency === "EUR" ? (
                      <span className="text-emerald-400 text-[11px] font-normal">
                        (~€{Math.round(((config?.minBaseSalary || 280000) * 0.92) / 1000)}k eq.)
                      </span>
                    ) : null}
                  </span>
                </label>
                <input
                  type="range"
                  min="180000"
                  max="450000"
                  step="5000"
                  value={config?.minBaseSalary || 280000}
                  onChange={(e) =>
                    setConfig(
                      config
                        ? {
                            ...config,
                            minBaseSalary: Number(e.target.value),
                            minTotalComp: Number(e.target.value) + Number(config.minEquityGrant),
                          }
                        : null
                    )
                  }
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between mb-1">
                  <span>Minimum Annual Equity Grant</span>
                  <span className="text-white font-mono font-bold">
                    ${Number(config?.minEquityGrant || 140000).toLocaleString()}{" "}
                    {geo.currency === "INR" ? (
                      <span className="text-emerald-400 text-[11px] font-normal">
                        (~₹{Math.round((config?.minEquityGrant || 140000) * 0.22)}L eq.)
                      </span>
                    ) : geo.currency === "EUR" ? (
                      <span className="text-emerald-400 text-[11px] font-normal">
                        (~€{Math.round(((config?.minEquityGrant || 140000) * 0.92) / 1000)}k eq.)
                      </span>
                    ) : null}
                  </span>
                </label>
                <input
                  type="range"
                  min="50000"
                  max="350000"
                  step="5000"
                  value={config?.minEquityGrant || 140000}
                  onChange={(e) =>
                    setConfig(
                      config
                        ? {
                            ...config,
                            minEquityGrant: Number(e.target.value),
                            minTotalComp: Number(config.minBaseSalary) + Number(e.target.value),
                          }
                        : null
                    )
                  }
                  className="w-full accent-emerald-500 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              {/* Total Comp Highlight */}
              <div className="p-3 bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-800/40 rounded-lg flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono text-emerald-400 uppercase">
                    Minimum Total Comp Floor
                  </div>
                  <div className="text-xs text-slate-400">Enforced by Auto-Decline</div>
                </div>
                <div className="text-lg font-bold font-mono text-emerald-300">
                  ${Number(config?.minTotalComp || 420000).toLocaleString()}{" "}
                  {geo.currency === "INR" ? (
                    <span className="text-xs font-normal text-emerald-400">
                      (~₹{Math.round((config?.minTotalComp || 420000) * 0.22)}L CTC)
                    </span>
                  ) : geo.currency === "EUR" ? (
                    <span className="text-xs font-normal text-emerald-400">
                      (~€{Math.round(((config?.minTotalComp || 420000) * 0.92) / 1000)}k)
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Fast-Track & Screening Skip Policies */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.requireFastTrackScreeningSkip || false}
                  onChange={(e) =>
                    setConfig(
                      config ? { ...config, requireFastTrackScreeningSkip: e.target.checked } : null
                    )
                  }
                  className="mt-1 rounded accent-emerald-500 bg-slate-800 border-slate-700"
                />
                <span className="text-xs text-slate-300">
                  <strong>Enforce Screening Bypass:</strong> Demand skipping HR and initial coding calls directly to Staff Onsite
                </span>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config?.autoDeclineBelowFloor || false}
                  onChange={(e) =>
                    setConfig(config ? { ...config, autoDeclineBelowFloor: e.target.checked } : null)
                  }
                  className="mt-1 rounded accent-emerald-500 bg-slate-800 border-slate-700"
                />
                <span className="text-xs text-slate-300">
                  <strong>Auto-Decline Under Floor:</strong> Send courteous automated decline to offers &lt; 65% of compensation floor
                </span>
              </label>
            </div>

            {saveSuccessMsg && (
              <div className="p-2.5 bg-emerald-950/80 border border-emerald-600 rounded text-xs text-emerald-300 font-mono text-center">
                {saveSuccessMsg}
              </div>
            )}

            <button
              onClick={handleSaveConfig}
              disabled={isSavingConfig}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold tracking-wide transition shadow"
            >
              {isSavingConfig ? "Updating Policies..." : "Save Agent Policy Parameters"}
            </button>
          </div>
        </section>

        {/* Middle & Right: Inbound Triage Feed + Live Multi-Turn Transcript (8 cols) */}
        <section className="lg:col-span-8 flex flex-col space-y-6">
          {/* Top Inbound Radar Feed */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-3">
                <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
                  Inbound Recruiter Inquiries
                </h2>
                <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  {negotiations.length} total
                </span>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-1.5 text-xs font-medium">
                {(["ALL", "APPROVED", "NEGOTIATING", "DECLINED"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterTab(tab)}
                    className={`px-2.5 py-1 rounded-md transition ${
                      filterTab === tab
                        ? "bg-slate-700 text-white font-semibold"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Inquiries Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredNegotiations.map((neg) => {
                const isSelected = selectedNegId === neg.id;
                const isApproved = neg.status === "FastTrack_Approved";
                const isDeclined = neg.status === "Screening_Declined";

                return (
                  <div
                    key={neg.id}
                    onClick={() => setSelectedNegId(neg.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? "bg-slate-800/90 border-emerald-500 shadow-md shadow-emerald-950/40"
                        : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-bl" />
                    )}

                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                          {neg.recruiterCompany}
                        </span>
                        <h3 className="text-sm font-bold text-white leading-tight">
                          {neg.roleTitle}
                        </h3>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                          isApproved
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-700 font-semibold"
                            : isDeclined
                            ? "bg-rose-950/80 text-rose-300 border-rose-800"
                            : "bg-amber-950/80 text-amber-300 border-amber-800"
                        }`}
                      >
                        {neg.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    <div className="text-xs text-slate-300 mb-3 flex items-center justify-between">
                      <span>Recruiter: {neg.recruiterName}</span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        Alignment: {neg.candidateAlignmentScore}%
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">Current Offer:</span>
                      <span className="text-white font-bold">
                        {geo.currency === "INR" ? (
                          <>
                            ₹{Math.round(Number(neg.currentTotalComp) * 0.22)}L CTC{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              (${Number(neg.currentTotalComp).toLocaleString()} USD)
                            </span>
                          </>
                        ) : geo.currency === "EUR" ? (
                          <>
                            €{Math.round((Number(neg.currentTotalComp) * 0.92) / 1000)}k EUR{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              (${Number(neg.currentTotalComp).toLocaleString()} USD)
                            </span>
                          </>
                        ) : (
                          <>
                            ${Number(neg.currentTotalComp).toLocaleString()}{" "}
                            <span className="text-[10px] text-slate-400 font-normal">
                              (${Number(neg.currentBaseSalary).toLocaleString()}b + $
                              {Number(neg.currentEquity).toLocaleString()}e)
                            </span>
                          </>
                        )}
                      </span>
                    </div>

                    {neg.screeningBypassAgreed && (
                      <div className="mt-2 text-[11px] font-mono text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/60 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        <span>Direct Onsite Bypass Granted</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Live Negotiation Transcript */}
          {activeDetail && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5 flex-1">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div>
                  <div className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider">
                    Multi-Turn Negotiation Thread
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {activeDetail.negotiation.roleTitle} &bull;{" "}
                    <span className="text-slate-400 font-normal">
                      {activeDetail.negotiation.recruiterCompany}
                    </span>
                  </h3>
                </div>

                {activeDetail.negotiation.status === "FastTrack_Approved" && (
                  <div className="bg-gradient-to-r from-emerald-900/60 to-teal-900/60 border border-emerald-600/80 px-3 py-1.5 rounded-lg text-right">
                    <div className="text-[10px] font-mono text-emerald-300 uppercase tracking-wider font-semibold">
                      Fast-Track Onsite Confirmed
                    </div>
                    <div className="text-xs text-white font-mono">
                      {activeDetail.negotiation.scheduledOnsiteDate
                        ? new Date(activeDetail.negotiation.scheduledOnsiteDate).toUTCString()
                        : "Scheduled"}
                    </div>
                  </div>
                )}
              </div>

              {/* Message Transcript Bubbles */}
              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                {activeDetail.messageLogs.map((msg) => {
                  const isAgent = msg.sender === "CareerAgent";
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        isAgent ? "items-end" : "items-start"
                      } space-y-1`}
                    >
                      <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                        <span
                          className={`font-semibold ${
                            isAgent ? "text-emerald-400" : "text-amber-300"
                          }`}
                        >
                          {isAgent ? "AI Career Agent" : msg.senderName}
                        </span>
                        <span>&bull;</span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>

                      <div
                        className={`p-4 rounded-2xl max-w-xl text-xs leading-relaxed ${
                          isAgent
                            ? "bg-emerald-950/40 border border-emerald-800/60 text-slate-100 rounded-tr-none"
                            : "bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-none"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.messageBody}</p>

                        {(msg.proposedTotalComp > 0 || msg.passportProofAttached) && (
                          <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] font-mono">
                            {msg.proposedTotalComp > 0 && (
                              <span className="text-white font-semibold">
                                Proposed: ${Number(msg.proposedTotalComp).toLocaleString()}{" "}
                                <span className="text-slate-400 font-normal">
                                  (${Number(msg.proposedBase).toLocaleString()}b + $
                                  {Number(msg.proposedEquity).toLocaleString()}e)
                                </span>
                              </span>
                            )}
                            {msg.passportProofAttached && (
                              <span className="text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                                Proof Attached (SHA-256)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Interactive Multi-Turn Simulator Box */}
              <div className="pt-4 border-t border-slate-800/80">
                <form onSubmit={handleSubmitCounterTurn} className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white uppercase tracking-wider">
                      Simulate Recruiter Response / Counter-Turn
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      Tests AI Agent counter-evaluation
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-mono text-slate-400">
                        Adjusted Base Salary ($)
                      </label>
                      <input
                        type="number"
                        value={counterBase}
                        onChange={(e) => setCounterBase(Number(e.target.value))}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-mono text-slate-400">
                        Adjusted Equity Grant ($)
                      </label>
                      <input
                        type="number"
                        value={counterEquity}
                        onChange={(e) => setCounterEquity(Number(e.target.value))}
                        className="w-full mt-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={counterText}
                    onChange={(e) => setCounterText(e.target.value)}
                    placeholder="Enter recruiter message (e.g. 'We reviewed candidate\'s passport and agree to the full compensation package and fast-track onsite...')"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={concedeBypass}
                        onChange={(e) => setConcedeBypass(e.target.checked)}
                        className="rounded accent-emerald-500 bg-slate-800 border-slate-700"
                      />
                      <span>Concede Screening Bypass to Direct Onsite</span>
                    </label>

                    <button
                      type="submit"
                      disabled={isSubmittingTurn}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-semibold transition"
                    >
                      {isSubmittingTurn ? "Negotiating..." : "Submit Recruiter Counter-Turn"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Inbound Recruiter Simulator Modal */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Simulate Inbound Recruiter Inquiry</span>
              </h3>
              <button
                onClick={() => setShowSimModal(false)}
                className="text-slate-400 hover:text-white"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSimulateInbound} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-mono">Company Name</label>
                  <input
                    type="text"
                    value={simCompany}
                    onChange={(e) => setSimCompany(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-mono">Role Title</label>
                  <input
                    type="text"
                    value={simRole}
                    onChange={(e) => setSimRole(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-mono">Recruiter Name</label>
                  <input
                    type="text"
                    value={simRecruiter}
                    onChange={(e) => setSimRecruiter(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-mono">Recruiter Email</label>
                  <input
                    type="email"
                    value={simEmail}
                    onChange={(e) => setSimEmail(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-400 font-mono">Base Salary ($)</label>
                  <input
                    type="number"
                    value={simBase}
                    onChange={(e) => setSimBase(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-mono">Equity Grant ($)</label>
                  <input
                    type="number"
                    value={simEquity}
                    onChange={(e) => setSimEquity(Number(e.target.value))}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-mono">Seniority Level</label>
                  <select
                    value={simSeniority}
                    onChange={(e) => setSimSeniority(e.target.value)}
                    className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white"
                  >
                    <option value="L5_Senior">L5 Senior</option>
                    <option value="L6_Staff">L6 Staff</option>
                    <option value="L7_Principal">L7 Principal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-mono">Inbound Message Pitch</label>
                <textarea
                  rows={3}
                  value={simMessage}
                  onChange={(e) => setSimMessage(e.target.value)}
                  className="w-full mt-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSimModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow"
                >
                  Dispatch Inbound Inquiry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

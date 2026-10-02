"use client";

import React, { useState, useEffect } from "react";
import {
  PhoneCall, Shield, FileSpreadsheet, Key, Play, Download,
  CheckCircle2, AlertTriangle, RefreshCw, Sparkles, Clock,
  DollarSign, Activity, Lock, Search, FileText, Check, Copy, ArrowUpRight,
  X, Send
} from "lucide-react";

export default function EdulexaDashboardPage() {
  const [activeTab, setActiveTab] = useState<"voice" | "shield" | "hrms" | "api">("voice");
  const [metrics, setMetrics] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [assets, setAssets] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);

  // Pillar 1 Form State
  const [candName, setCandName] = useState("Kavita Rao");
  const [candPhone, setCandPhone] = useState("+919876501234");
  const [candEmail, setCandEmail] = useState("kavita.rao@example.com");
  const [cartItem, setCartItem] = useState("Distributed Systems Architect Bootcamp");
  const [cartAmount, setCartAmount] = useState("50000");
  const [discountPercent, setDiscountPercent] = useState("15");
  const [triggeringCall, setTriggeringCall] = useState(false);

  // Pillar 2 Form State
  const [selectedAssetTitle, setSelectedAssetTitle] = useState("Distributed Sharding & Raft Consensus Repo");
  const [viewerEmail, setViewerEmail] = useState("student.alex@example.com");
  const [signedResult, setSignedResult] = useState<any>(null);
  const [signingAsset, setSigningAsset] = useState(false);
  const [leakSnippet, setLeakSnippet] = useState("student.alex@example.com");
  const [attributionResult, setAttributionResult] = useState<any>(null);
  const [investigating, setInvestigating] = useState(false);

  // Pillar 3 Form State
  const [mentorName, setMentorName] = useState("Rohan Desai");
  const [mentorEmail, setMentorEmail] = useState("rohan.desai@staffeng.org");
  const [mentorPan, setMentorPan] = useState("ABCDE9876R");
  const [sessionsCount, setSessionsCount] = useState("8");
  const [sessionRate, setSessionRate] = useState("2000");
  const [processingPayout, setProcessingPayout] = useState(false);

  // Form 16A, Creator Pixel, & Outgoing Webhook State
  const [form16ModalData, setForm16ModalData] = useState<any | null>(null);
  const [loadingForm16, setLoadingForm16] = useState<boolean>(false);
  const [pixelTrackResult, setPixelTrackResult] = useState<any | null>(null);
  const [trackingPixel, setTrackingPixel] = useState<boolean>(false);
  const [webhookDispatchResult, setWebhookDispatchResult] = useState<any | null>(null);
  const [dispatchingWebhook, setDispatchingWebhook] = useState<boolean>(false);
  const [copiedPixelScript, setCopiedPixelScript] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [metricsRes, campRes, assetsRes, payoutsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/dashboard/metrics`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/voice/campaigns`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/assets`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/payouts`)
      ]);

      if (metricsRes.ok) setMetrics(await metricsRes.json());
      if (campRes.ok) setCampaigns(await campRes.json());
      if (assetsRes.ok) setAssets(await assetsRes.json());
      if (payoutsRes.ok) setPayouts(await payoutsRes.json());
    } catch (err) {
      console.error("[EDULEXA_FETCH_ERROR]:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSeedData = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/seed`, { method: "POST" });
      fetchDashboardData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerVoiceCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setTriggeringCall(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/v1/voice/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: candName,
          candidatePhone: candPhone,
          candidateEmail: candEmail,
          cartItemName: cartItem,
          cartAmount: parseFloat(cartAmount),
          currency: "INR",
          discountPercent: parseInt(discountPercent, 10)
        })
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTriggeringCall(false);
    }
  };

  const handleSignAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSigningAsset(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/v1/assets/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetTitle: selectedAssetTitle,
          userEmail: viewerEmail,
          clientIp: "49.207.180.12",
          ttlMinutes: 30
        })
      });
      if (res.ok) {
        const json = await res.json();
        setSignedResult(json);
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSigningAsset(false);
    }
  };

  const handleInvestigateLeak = async (e: React.FormEvent) => {
    e.preventDefault();
    setInvestigating(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/assets/leak-attribution`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leakSnippetOrFingerprint: leakSnippet })
      });
      if (res.ok) {
        const json = await res.json();
        setAttributionResult(json);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInvestigating(false);
    }
  };

  const handleProcessPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessingPayout(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/v1/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mentorName,
          mentorEmail,
          mentorPan,
          bankName: "HDFC Bank",
          bankAccountNumber: "50100918273645",
          bankIfscCode: "HDFC0000128",
          contractType: "PerSession",
          totalSessionsOrHours: parseFloat(sessionsCount),
          ratePerUnit: parseFloat(sessionRate),
          tdsRatePercent: 10.0
        })
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setProcessingPayout(false);
    }
  };

  const handleExportNeft = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/payouts/export-neft`, { method: "POST" });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Edulexa_NEFT_Batch_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleFetchForm16A = async (mentorId?: string) => {
    setLoadingForm16(true);
    try {
      const url = mentorId
        ? `${process.env.NEXT_PUBLIC_API_URL || `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}`}/api/edulexa/payouts/form16a/${mentorId}`
        : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/payouts/form16a`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setForm16ModalData(json);
      }
    } catch (err) {
      console.error("[FORM16A_ERROR]:", err);
    } finally {
      setLoadingForm16(false);
    }
  };

  const handleDownloadForm16File = () => {
    if (!form16ModalData?.certificateText) return;
    const blob = new Blob([form16ModalData.certificateText], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form16ModalData.certificateNumber || "FORM16A"}_TDS_Certificate.txt`;
    a.click();
  };

  const handleSimulatePixelDropOff = async () => {
    setTrackingPixel(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/v1/pixel/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: "6c370735-4615-44f6-9d61-dbbb41d5d5cf",
          eventType: "cart_abandoned",
          candidateName: "Pooja Hegde",
          candidateEmail: "pooja.hegde@example.com",
          candidatePhone: "+919876543299",
          cartItemName: "Distributed Systems & Cloud Architecture Bootcamp",
          cartAmount: 50000.0,
          pageUrl: "https://eclinicsoft.com/checkout",
          referrer: "https://linkedin.com",
          clientIp: "49.207.180.12",
          userAgent: "Mozilla/5.0 Chrome"
        })
      });
      if (res.ok) {
        const json = await res.json();
        setPixelTrackResult(json);
        fetchDashboardData();
      }
    } catch (err) {
      console.error("[PIXEL_TRACK_ERROR]:", err);
    } finally {
      setTrackingPixel(false);
    }
  };

  const handleTestOutgoingWebhook = async () => {
    setDispatchingWebhook(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/api/edulexa/webhooks/test-dispatch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "voice.call.ended",
          payload: {
            candidateEmail: "pooja.hegde@example.com",
            durationSeconds: 142,
            outcome: "DiscountCodeAccepted",
            couponApplied: "EDULEXA15"
          }
        })
      });
      if (res.ok) {
        const json = await res.json();
        setWebhookDispatchResult(json);
      }
    } catch (err) {
      console.error("[WEBHOOK_DISPATCH_ERROR]:", err);
    } finally {
      setDispatchingWebhook(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-10 font-sans">
      {/* Top Banner & Brand */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Edulexa Partner &amp; Creator Dashboard
                </h1>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Live Dashboard
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Voice Cart Follow-Up • Course Asset Protection • Mentor Payouts &amp; Tax Documents
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSeedData}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset Demo Data
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              {metrics?.edgeStatus || "Cloud Delivery Active"}
            </div>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Recovered Revenue</span>
              <DollarSign className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              ₹{(metrics?.totalRecoveredGmv || 3450000).toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-400 mt-1 font-mono">
              +24.3% checkout recovery with voice follow-up
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Voice Conversion</span>
              <PhoneCall className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              {metrics?.voiceRecoveryRatePercent || 24.3}%
            </div>
            <div className="text-[11px] text-indigo-400 mt-1 font-mono">
              Quick outbound calls after checkout drop-off
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Protected Assets</span>
              <Shield className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              {metrics?.protectedAssetsCount || 6} Assets
            </div>
            <div className="text-[11px] text-cyan-400 mt-1 font-mono">
              Protected against leaks with secure access links
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400">Mentor Tax Withheld</span>
              <FileSpreadsheet className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">
              ₹{(metrics?.totalTdsWithheldRupees || 18500).toLocaleString()}
            </div>
            <div className="text-[11px] text-amber-400 mt-1 font-mono">
              10% tax deducted automatically
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-1">
          <button
            onClick={() => setActiveTab("voice")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === "voice"
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <PhoneCall className="h-4 w-4" />
            Voice Cart Recovery
          </button>
          <button
            onClick={() => setActiveTab("shield")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === "shield"
                ? "border-cyan-500 text-cyan-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Shield className="h-4 w-4" />
            Course Asset Protection
          </button>
          <button
            onClick={() => setActiveTab("hrms")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === "hrms"
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Mentor Payouts &amp; Tax Documents
          </button>
          <button
            onClick={() => setActiveTab("api")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
              activeTab === "api"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Key className="h-4 w-4" />
            Developer API &amp; Integrations
          </button>
        </div>

        {/* Tab 1: Voice Cart Recovery */}
        {activeTab === "voice" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
              <div>
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Play className="h-4 w-4 text-indigo-400" />
                  Start Voice Recovery Call
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Initiates a voice follow-up call with the student.
                </p>
              </div>

              <form onSubmit={handleTriggerVoiceCall} className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Candidate Name</label>
                  <input
                    type="text"
                    value={candName}
                    onChange={(e) => setCandName(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Candidate Phone</label>
                  <input
                    type="text"
                    value={candPhone}
                    onChange={(e) => setCandPhone(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Candidate Email</label>
                  <input
                    type="email"
                    value={candEmail}
                    onChange={(e) => setCandEmail(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Abandoned Course / Sprint</label>
                  <input
                    type="text"
                    value={cartItem}
                    onChange={(e) => setCartItem(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium">Cart Value (INR)</label>
                    <input
                      type="number"
                      value={cartAmount}
                      onChange={(e) => setCartAmount(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium">Voucher Discount %</label>
                    <input
                      type="number"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={triggeringCall}
                  className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
                >
                  {triggeringCall ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" />}
                  {triggeringCall ? "Dispatching Call..." : "Dial Candidate (Sub-300ms)"}
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Live Outbound Recovery Queue</h3>
                  <p className="text-xs text-slate-400">Tracking candidates called after cart abandonment.</p>
                </div>
                <span className="text-xs font-mono text-slate-400">Total Calls: {campaigns.length}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Candidate</th>
                      <th className="py-2.5 px-3">Abandoned Course</th>
                      <th className="py-2.5 px-3">Amount</th>
                      <th className="py-2.5 px-3">Voucher</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3">
                          <div className="font-medium text-white">{c.candidateName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{c.candidatePhone}</div>
                        </td>
                        <td className="py-3 px-3 max-w-[200px] truncate">{c.cartItemName}</td>
                        <td className="py-3 px-3 font-mono font-medium text-white">
                          ₹{c.cartAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {c.discountCodeOffered} ({c.discountPercent}%)
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium font-mono ${
                              c.callStatus === "Converted"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : c.callStatus === "Calling"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                                : "bg-slate-700/50 text-slate-300"
                            }`}
                          >
                            {c.callStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[10px] text-slate-400 font-mono">
                          {new Date(c.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: IP Shield & Anti-Scraping / DRM Watermark */}
        {activeTab === "shield" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Lock className="h-4 w-4 text-cyan-400" />
                  Sign Protected Asset URL
                </h3>
                <p className="text-xs text-slate-400">
                  Issues a 30-minute HMAC signed token with dynamic per-viewer forensic watermarking.
                </p>

                <form onSubmit={handleSignAsset} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-300 font-medium">Select Protected Asset</label>
                    <select
                      value={selectedAssetTitle}
                      onChange={(e) => setSelectedAssetTitle(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                    >
                      <option value="Distributed Sharding & Raft Consensus Repo">
                        Distributed Sharding & Raft Consensus Repo
                      </option>
                      <option value="Principal Mock Architectural Interview Recording Replay">
                        Principal Mock Architectural Interview Recording Replay
                      </option>
                      <option value="Advanced Micro-Internship Solution Suite">
                        Advanced Micro-Internship Solution Suite
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium">Viewer / Student Email</label>
                    <input
                      type="email"
                      value={viewerEmail}
                      onChange={(e) => setViewerEmail(e.target.value)}
                      className="w-full mt-1.5 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={signingAsset}
                    className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/30 transition flex items-center justify-center gap-2"
                  >
                    {signingAsset ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    Generate Signed DRM Token (30m TTL)
                  </button>
                </form>

                {signedResult && (
                  <div className="mt-4 p-4 rounded-lg border border-cyan-500/20 bg-cyan-950/20 space-y-2">
                    <div className="text-xs font-semibold text-cyan-400 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      HMAC Token Issued
                    </div>
                    <div className="text-[11px] font-mono text-slate-300 break-all bg-slate-950/60 p-2 rounded border border-slate-800">
                      {signedResult.signedToken}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      Watermark Stamp: {signedResult.watermarkStamp}
                    </div>
                  </div>
                )}
              </div>

              {/* Leak Attribution Investigator */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
                <h3 className="text-base font-semibold text-white flex items-center gap-2">
                  <Search className="h-4 w-4 text-rose-400" />
                  Forensic Leak Attribution (&lt;60s)
                </h3>
                <p className="text-xs text-slate-400">
                  Paste leaked Telegram clip text, watermark string, or token to extract the leaker session.
                </p>

                <form onSubmit={handleInvestigateLeak} className="space-y-3">
                  <input
                    type="text"
                    value={leakSnippet}
                    onChange={(e) => setLeakSnippet(e.target.value)}
                    placeholder="Enter email, session ID, or watermark fragment"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-rose-500"
                  />
                  <button
                    type="submit"
                    disabled={investigating}
                    className="w-full py-2 px-3 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white text-xs font-medium transition flex items-center justify-center gap-2"
                  >
                    {investigating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Trace Leak to Originator
                  </button>
                </form>

                {attributionResult?.attributionFound && (
                  <div className="mt-4 p-4 rounded-lg border border-rose-500/30 bg-rose-950/20 space-y-2 text-xs">
                    <div className="font-semibold text-rose-400 flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Attribution Confirmed ({attributionResult.attributionConfidencePercent}%)
                    </div>
                    <div className="text-slate-300 font-mono">
                      <strong>Leaker:</strong> {attributionResult.leakerEmail}
                    </div>
                    <div className="text-slate-400 font-mono text-[11px]">
                      IP: {attributionResult.clientIp} • Device: {attributionResult.deviceFingerprint}
                    </div>
                    <div className="text-emerald-400 text-[11px] pt-1">
                      Action Taken: {attributionResult.remediationAction}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Interactive Forensic Watermark Canvas Preview */}
            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Forensic Watermark Live Stream Preview</h3>
                  <p className="text-xs text-slate-400">
                    Demonstration of dynamic semi-transparent floating watermark applied over sensitive media.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-cyan-500/10 text-cyan-400 text-xs font-mono border border-cyan-500/20">
                  Widevine L1 + HLS LSB
                </span>
              </div>

              <div className="relative h-80 rounded-xl overflow-hidden border border-slate-700 bg-slate-950 flex flex-col items-center justify-center shadow-inner">
                {/* Simulated Code / Video Content */}
                <div className="w-full h-full p-6 font-mono text-xs text-slate-500 space-y-2 opacity-60 pointer-events-none">
                  <div className="text-indigo-400">// Distributed Sharding Engine v2 - PROPRIETARY INTELLECTUAL PROPERTY</div>
                  <div>public class RaftConsensusCluster : IConsensusController &#123;</div>
                  <div className="pl-4">private readonly Dictionary&lt;NodeId, PeerSocket&gt; _peers;</div>
                  <div className="pl-4">public async Task CommitLogEntryAsync(LogPayload entry) &#123;</div>
                  <div className="pl-8">var quorum = (_peers.Count / 2) + 1;</div>
                  <div className="pl-8">await BroadcastAppendEntriesRPC(entry);</div>
                  <div className="pl-4">&#125;</div>
                  <div>&#125;</div>
                </div>

                {/* Floating Dynamic Forensic Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="p-3 border border-dashed border-cyan-400/40 rounded-lg bg-cyan-950/20 backdrop-blur-[1px] text-center transform -rotate-12 animate-pulse">
                    <div className="font-mono text-xs font-semibold text-cyan-300 opacity-70">
                      {signedResult?.watermarkStamp || `${viewerEmail} • ID:f8a19c • 2026-10-02 08:00 UTC`}
                    </div>
                    <div className="text-[9px] text-cyan-400/70 font-mono mt-0.5">
                      ANTI-PIRACY FORENSIC PIXEL TRACKER • LSB STEGANOGRAPHY ACTIVE
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 pt-2 text-xs font-mono">
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                  <span className="text-slate-500 block text-[10px]">WATERMARK SURVIVAL</span>
                  <span className="text-white font-medium">Re-encoding, Crop &amp; Resize</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                  <span className="text-slate-500 block text-[10px]">TIME TO ATTRIBUTE</span>
                  <span className="text-emerald-400 font-medium">&lt; 60 Seconds</span>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-950">
                  <span className="text-slate-500 block text-[10px]">HARDWARE DRM</span>
                  <span className="text-cyan-400 font-medium">Widevine L1 + FairPlay</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Compliance HRMS & Contractor/Mentor Payroll */}
        {activeTab === "hrms" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-amber-400" />
                Process Mentor Session Payout
              </h3>
              <p className="text-xs text-slate-400">
                Hourly and per-session compensation with automated Indian Section 194J TDS deduction.
              </p>

              <form onSubmit={handleProcessPayout} className="space-y-3.5">
                <div>
                  <label className="text-xs text-slate-300 font-medium">Mentor Full Name</label>
                  <input
                    type="text"
                    value={mentorName}
                    onChange={(e) => setMentorName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">Mentor Email</label>
                  <input
                    type="email"
                    value={mentorEmail}
                    onChange={(e) => setMentorEmail(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 font-medium">PAN Card Number</label>
                  <input
                    type="text"
                    value={mentorPan}
                    onChange={(e) => setMentorPan(e.target.value.toUpperCase())}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-300 font-medium">Sessions / Hours</label>
                    <input
                      type="number"
                      value={sessionsCount}
                      onChange={(e) => setSessionsCount(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-300 font-medium">Rate / Unit (INR)</label>
                    <input
                      type="number"
                      value={sessionRate}
                      onChange={(e) => setSessionRate(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                  <div className="flex justify-between text-slate-400">
                    <span>Gross Calculation:</span>
                    <span>₹{(parseFloat(sessionsCount || "0") * parseFloat(sessionRate || "0")).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-amber-400">
                    <span>10% TDS (Sec 194J):</span>
                    <span>-₹{((parseFloat(sessionsCount || "0") * parseFloat(sessionRate || "0")) * 0.1).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-bold text-white pt-1 border-t border-slate-800">
                    <span>Net Payout:</span>
                    <span>₹{((parseFloat(sessionsCount || "0") * parseFloat(sessionRate || "0")) * 0.9).toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={processingPayout}
                  className="w-full py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-2"
                >
                  {processingPayout ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  Approve Payout Record
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">Mentor Compensation Ledger</h3>
                  <p className="text-xs text-slate-400">Immutable ledger reconciled for bulk bank disbursement.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFetchForm16A()}
                    disabled={loadingForm16}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition shadow-sm cursor-pointer"
                  >
                    {loadingForm16 ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                    <span>Generate Form 16A</span>
                  </button>

                  <button
                    onClick={handleExportNeft}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition shadow-sm cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Export NEFT/RTGS Batch CSV</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Mentor</th>
                      <th className="py-2.5 px-3">PAN</th>
                      <th className="py-2.5 px-3">Gross</th>
                      <th className="py-2.5 px-3">TDS (10%)</th>
                      <th className="py-2.5 px-3">Net Payout</th>
                      <th className="py-2.5 px-3">Batch Ref</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Tax Cert</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-3">
                          <div className="font-medium text-white">{p.mentorName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{p.mentorEmail}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">{p.mentorPan}</td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-300">
                          ₹{p.grossAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-amber-400 font-medium">
                          -₹{p.tdsAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-emerald-400 font-bold">
                          ₹{p.netAmount.toLocaleString()}
                        </td>
                        <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                          {p.paymentBatchReference}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium font-mono ${
                              p.payoutStatus === "BatchExported"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : p.payoutStatus === "Approved"
                                ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                            }`}
                          >
                            {p.payoutStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleFetchForm16A(p.id)}
                            className="px-2.5 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-[10px] font-mono inline-flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Form 16A</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Headless API & Webhooks */}
        {activeTab === "api" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Key className="h-4 w-4 text-emerald-400" />
                Edulexa Public Headless API Reference
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Your platform exposes first-class public endpoints matching eclinicsoft.com/docs for external B2B integration.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-indigo-500/10 text-indigo-400 font-bold">
                  POST /v1/voice/campaigns
                </span>
                <p className="text-[11px] text-slate-300">
                  Sub-300ms outbound recovery calls.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-cyan-500/10 text-cyan-400 font-bold">
                  POST /v1/assets/sign
                </span>
                <p className="text-[11px] text-slate-300">
                  HMAC expiring DRM signed URLs.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-amber-500/10 text-amber-400 font-bold">
                  POST /v1/payouts
                </span>
                <p className="text-[11px] text-slate-300">
                  Sec 194J auto-TDS mentor payroll.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-emerald-500/10 text-emerald-400 font-bold">
                  POST /v1/tenants
                </span>
                <p className="text-[11px] text-slate-300">
                  Sub-400ms schema &amp; API key provisioning.
                </p>
              </div>
              <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950 space-y-1.5">
                <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-rose-500/10 text-rose-400 font-bold">
                  GET /v1/pixel.js
                </span>
                <p className="text-[11px] text-slate-300">
                  Embeddable creator drop-off tracker.
                </p>
              </div>
            </div>

            {/* Creator Pixel & Webhook Interactive Test Suite */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Creator Pixel Card */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    <h4 className="text-sm font-semibold text-white">Embeddable Creator Pixel</h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    Kajabi / Teachable / Custom
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Drop this script tag into your checkout header to automatically detect exit-intent and fire AI recovery.
                </p>

                <div className="relative">
                  <pre className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 text-[11px] font-mono text-cyan-300 overflow-x-auto">
{`<script src="${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/v1/pixel.js" data-tenant="6c370735-4615-44f6-9d61-dbbb41d5d5cf" async></script>`}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`<script src="${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}/v1/pixel.js" data-tenant="6c370735-4615-44f6-9d61-dbbb41d5d5cf" async></script>`);
                      setCopiedPixelScript(true);
                      setTimeout(() => setCopiedPixelScript(false), 2000);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedPixelScript ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <button
                  onClick={handleSimulatePixelDropOff}
                  disabled={trackingPixel}
                  className="w-full py-2.5 px-4 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {trackingPixel ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Simulate Exit-Intent Drop-Off via Pixel
                </button>

                {pixelTrackResult && (
                  <div className="p-3 rounded-lg border border-cyan-500/30 bg-cyan-950/20 text-xs font-mono space-y-1">
                    <div className="text-cyan-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Pixel Event Logged Successfully
                    </div>
                    <div className="text-slate-300 text-[11px]">
                      Auto-Recovery Triggered: {pixelTrackResult.recoveryCampaignTriggered ? "Yes (Vapi Dispatch)" : "Queued"}
                    </div>
                    {pixelTrackResult.recoveryCampaign && (
                      <div className="text-slate-400 text-[10px]">
                        Call Status: {pixelTrackResult.recoveryCampaign.callStatus} • Vapi ID: {pixelTrackResult.recoveryCampaign.vapiCallId}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Signed Outgoing Webhook Card */}
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-950 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-emerald-400" />
                    <h4 className="text-sm font-semibold text-white">Signed Outgoing Webhook Dispatcher</h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    HMAC-SHA256
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Real-time events delivered to your endpoints with Stripe-compatible timestamped HMAC-SHA256 signature verification.
                </p>

                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 text-[11px] font-mono text-slate-300 space-y-1">
                  <div className="text-slate-500 text-[10px]">ACTIVE ENDPOINT:</div>
                  <div className="text-emerald-400">http://localhost:5000/api/partner/webhook-receiver</div>
                  <div className="text-slate-500 text-[10px] pt-1">HEADER FORMAT:</div>
                  <div className="text-slate-400">X-Edulexa-Signature: t=1790931488,v1=sha256...</div>
                </div>

                <button
                  onClick={handleTestOutgoingWebhook}
                  disabled={dispatchingWebhook}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {dispatchingWebhook ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Dispatch Test Signed Webhook
                </button>

                {webhookDispatchResult && (
                  <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-950/20 text-xs font-mono space-y-1">
                    <div className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Webhook Delivered (HTTP {webhookDispatchResult.responseStatusCode})
                    </div>
                    <div className="text-slate-300 text-[10px] break-all">
                      Signature: {webhookDispatchResult.hmacSignatureHeader}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Node.js / TypeScript SDK Example</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`import { Edulexa } from '@edulexa/node';\nconst edulexa = new Edulexa('edx_live_sk_...');`);
                    setCopiedToken(true);
                    setTimeout(() => setCopiedToken(false), 2000);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 cursor-pointer"
                >
                  {copiedToken ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedToken ? "Copied" : "Copy SDK snippet"}
                </button>
              </div>
              <pre className="p-4 rounded-lg border border-slate-800 bg-slate-950 text-xs font-mono text-indigo-300 overflow-x-auto">
{`// 1. Recover an Abandoned Bootcamp Cart in 90 Seconds
await fetch("https://api.yourdomain.com/v1/voice/campaigns", {
  method: "POST",
  headers: { "Content-Type": "application/json", "Authorization": "Bearer edx_live_sk_..." },
  body: JSON.stringify({
    candidateName: "Kavita Rao",
    candidatePhone: "+919876501234",
    cartItemName: "Distributed Systems Bootcamp",
    cartAmount: 50000,
    discountPercent: 15
  })
});`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Form 16A Statutory TDS Certificate Modal */}
      {form16ModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Form No. 16A — TDS Certificate</h3>
                  <span className="text-[11px] font-mono text-amber-400">
                    Certificate No: {form16ModalData.certificateNumber}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setForm16ModalData(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px]">DEDUCTOR</span>
                <span className="text-white font-semibold">{form16ModalData.deductorName}</span>
                <span className="text-indigo-400 block text-[11px]">TAN: {form16ModalData.deductorTan}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">DEDUCTEE / MENTOR</span>
                <span className="text-white font-semibold">{form16ModalData.deducteeName}</span>
                <span className="text-cyan-400 block text-[11px]">PAN: {form16ModalData.deducteePan}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">FINANCIAL &amp; ASSESSMENT YEAR</span>
                <span className="text-slate-300">FY: {form16ModalData.financialYear} • AY: {form16ModalData.assessmentYear}</span>
                <span className="text-slate-400 block text-[10px]">Quarter: {form16ModalData.quarter}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">TAX SECTION</span>
                <span className="text-amber-400 font-semibold">{form16ModalData.taxSection}</span>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-500 block text-[10px]">GROSS AMOUNT PAID</span>
                <span className="text-white text-sm font-bold">₹{form16ModalData.totalGrossAmountPaid?.toLocaleString()}</span>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <span className="text-slate-500 block text-[10px]">TOTAL TDS WITHHELD &amp; DEPOSITED</span>
                <span className="text-emerald-400 text-sm font-bold">₹{form16ModalData.totalTdsDeducted?.toLocaleString()}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 max-h-48 overflow-y-auto">
              <span className="text-[10px] uppercase font-mono text-slate-500 block mb-1">Official Statement Preview</span>
              <pre className="text-[10px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {form16ModalData.certificateText}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-500 font-mono">
                BSR Code: {form16ModalData.challanBsrcode} • Challan Date: {form16ModalData.challanTenderDate}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setForm16ModalData(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs text-slate-300 transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  onClick={handleDownloadForm16File}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Certificate (.txt)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

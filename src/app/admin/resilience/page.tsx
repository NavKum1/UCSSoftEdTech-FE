"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";

interface CloudRegion {
  id: string;
  regionCode: string;
  provider: string;
  regionName: string;
  status: "Healthy" | "Degraded" | "Critical" | "Offline";
  latencyMs: number;
  errorRatePercent: number;
  trafficWeightPercent: number;
  circuitBreakerState: "Closed" | "Open" | "HalfOpen";
  isPrimary: boolean;
  lastHealthCheckAt: string;
}

interface RoutingDecision {
  clientGeo: string;
  preferredRegion: string;
  routedRegion: string;
  provider: string;
  regionName: string;
  latencyEstimatedMs: number;
  isFailoverRerouted: boolean;
  failoverReason?: string | null;
  circuitBreakerState: string;
  evaluatedAt: string;
}

interface CircuitBreakerInfo {
  regionCode: string;
  regionName: string;
  provider: string;
  circuitBreakerState: string;
  status: string;
  latencyMs: number;
  errorRatePercent: number;
  trafficWeightPercent: number;
  failoverTargetRegion: string;
  isServingTraffic: boolean;
}

export default function MultiCloudResiliencePage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [regions, setRegions] = useState<CloudRegion[]>([]);
  const [circuitBreakers, setCircuitBreakers] = useState<CircuitBreakerInfo[]>([]);
  const [selectedGeo, setSelectedGeo] = useState<string>("Americas_East");
  const [routingDecision, setRoutingDecision] = useState<RoutingDecision | null>(null);

  // Chaos Injection State
  const [chaosRegion, setChaosRegion] = useState<string>("us-east-1");
  const [chaosFault, setChaosFault] = useState<string>("LatencySpike");
  const [chaosSeverity, setChaosSeverity] = useState<string>("Major");
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [isRecovering, setIsRecovering] = useState<boolean>(false);

  // Fetch Clusters & Circuit Breakers
  const fetchFleetStatus = async () => {
    try {
      setIsLoading(true);
      const [regRes, cbRes] = await Promise.all([
        apiFetch(`/api/resilience/regions`),
        apiFetch(`/api/resilience/circuit-breakers`),
      ]);

      const regData = await regRes.json();
      const cbData = await cbRes.json();

      if (regData.success) setRegions(regData.regions || []);
      if (cbData.success) setCircuitBreakers(cbData.circuitBreakers || []);
    } catch (err) {
      console.error("Failed to fetch cloud resilience fleet status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Test Active-Active Routing
  const testRouting = async (geo: string) => {
    setSelectedGeo(geo);
    try {
      const res = await apiFetch(`/api/resilience/route?geo=${geo}`);
      const data = await res.json();
      if (data.success) {
        setRoutingDecision(data.routing);
      }
    } catch (err) {
      console.error("Routing calculation failed:", err);
    }
  };

  // Inject Chaos
  const handleInjectChaos = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsInjecting(true);
      const res = await apiFetch(`/api/resilience/chaos/inject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regionCode: chaosRegion,
          faultType: chaosFault,
          severity: chaosSeverity,
          durationSeconds: 120,
          triggeredBy: "sre-engineer@enterprise.internal",
        }),
      });

      const data = await res.json();
      if (data.success && data.experiment) {
        setActiveExperimentId(data.experiment.id);
        await fetchFleetStatus();
        await testRouting(selectedGeo);
      }
    } catch (err) {
      console.error("Failed to inject chaos:", err);
    } finally {
      setIsInjecting(false);
    }
  };

  // Recover Chaos
  const handleRecoverChaos = async () => {
    if (!activeExperimentId) return;
    try {
      setIsRecovering(true);
      const res = await apiFetch(`/api/resilience/chaos/recover/${activeExperimentId}`, {
        method: "POST",
      });

      const data = await res.json();
      if (data.success) {
        setActiveExperimentId(null);
        await fetchFleetStatus();
        await testRouting(selectedGeo);
      }
    } catch (err) {
      console.error("Failed to recover chaos:", err);
    } finally {
      setIsRecovering(false);
    }
  };

  const fetchFleetStatusRef = useLatestRef(fetchFleetStatus);
  const testRoutingRef = useLatestRef(testRouting);
  useEffect(() => {
    if (!ready) return;
    fetchFleetStatusRef.current();
    testRoutingRef.current("Americas_East");
  }, [ready, fetchFleetStatusRef, testRoutingRef]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Healthy":
        return "bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-500/50";
      case "Degraded":
        return "bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-500/50";
      case "Critical":
        return "bg-orange-950 text-orange-400 border-orange-500/50";
      default:
        return "bg-rose-950 text-rose-400 border-rose-500/50";
    }
  };

  const getCbBadge = (state: string) => {
    switch (state) {
      case "Closed":
        return "bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border-emerald-600/50";
      case "HalfOpen":
        return "bg-amber-950/80 text-amber-600 dark:text-amber-300 border-amber-600/50 animate-pulse";
      default:
        return "bg-rose-950/80 text-rose-300 border-rose-600/50 animate-pulse";
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "AWS":
        return "🟧 AWS";
      case "GCP":
        return "🟦 GCP";
      case "Azure":
        return "🔷 Azure";
      default:
        return "☁️ Cloud";
    }
  };

  if (access) return <AccessNotice problem={access} feature="Multi-cloud resilience" />;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-border bg-card/80 backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-16 z-20">
        <div className="flex items-center space-x-4">
          <Link
            href="/admin/system"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-slate-700 text-muted-foreground border border-border transition"
          >
            ← System Ops
          </Link>
          <div className="h-4 w-px bg-muted" />
          <div className="flex items-center space-x-2">
            <span className="text-xl">🌐</span>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                Multi-Cloud Active-Active Resilience & Chaos Failover Hub
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Cross-Cloud Federation (AWS • GCP • Azure) • Global Anycast Routing • Automatic Circuit Breaker
              </p>
            </div>
          </div>
        </div>

        {/* Global Fleet Status */}
        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs text-muted-foreground">Active Clouds Serving Traffic</div>
            <div className="text-sm font-mono font-bold text-foreground">
              {regions.filter((r) => r.circuitBreakerState === "Closed").length} / {regions.length} Regions
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-lg bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-500/50 text-xs font-bold uppercase tracking-wider">
            ● Active-Active Online
          </span>
        </div>
      </header>

      {/* Main Studio Body */}
      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Regional Clusters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {regions.map((r) => (
            <div
              key={r.id}
              className={`p-4 rounded-2xl border transition relative space-y-3 ${
                r.circuitBreakerState === "Open"
                  ? "bg-rose-950/20 border-rose-800/80 shadow-lg shadow-rose-950/20"
                  : r.status === "Degraded"
                  ? "bg-amber-950/20 border-amber-800/80"
                  : "bg-card/60 border-border/80 hover:border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold text-muted-foreground">
                  {getProviderIcon(r.provider)}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider ${getStatusBadge(
                    r.status
                  )}`}
                >
                  {r.status}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold text-foreground">{r.regionName}</h3>
                <p className="text-[11px] font-mono text-muted-foreground">{r.regionCode}</p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Latency:</span>
                  <span className={r.latencyMs > 100 ? "text-rose-400 font-bold" : "text-emerald-700 dark:text-emerald-400"}>
                    {r.latencyMs.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Error Rate:</span>
                  <span className={r.errorRatePercent > 1.0 ? "text-rose-400 font-bold" : "text-muted-foreground"}>
                    {r.errorRatePercent.toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Traffic Share:</span>
                  <span className="text-foreground font-bold">{r.trafficWeightPercent}%</span>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground font-mono">Circuit:</span>
                <span
                  className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase ${getCbBadge(
                    r.circuitBreakerState
                  )}`}
                >
                  {r.circuitBreakerState}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Section: Live Anycast Routing Simulator & Chaos Engineering Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Active-Active Traffic Router (6 Cols) */}
          <div className="lg:col-span-6 p-5 rounded-2xl bg-card/60 border border-border/80 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Global Anycast Edge Routing Simulator</h2>
                <p className="text-xs text-muted-foreground">
                  Simulate candidate client connection from edge locations
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-muted font-mono text-cyan-700 dark:text-cyan-400 border border-border">
                Optimal Path Engine
              </span>
            </div>

            {/* Geo Selector Buttons */}
            <div className="flex flex-wrap gap-2">
              {[
                { code: "Americas_East", label: "🗽 New York / Virginia" },
                { code: "Americas_West", label: "🌉 San Francisco / Oregon" },
                { code: "Europe", label: "🏰 Frankfurt / London" },
                { code: "APAC_South", label: "🕌 Mumbai / Bengaluru" },
                { code: "APAC_East", label: "⛩️ Tokyo / Singapore" },
              ].map((geo) => (
                <button
                  key={geo.code}
                  onClick={() => testRouting(geo.code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    selectedGeo === geo.code
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "bg-muted/80 text-muted-foreground hover:bg-muted border border-border/60"
                  }`}
                >
                  {geo.label}
                </button>
              ))}
            </div>

            {/* Routing Result Card */}
            {routingDecision && (
              <div
                className={`p-4 rounded-xl border space-y-3 font-mono text-xs ${
                  routingDecision.isFailoverRerouted
                    ? "bg-rose-950/30 border-rose-600/60 text-rose-200"
                    : "bg-background/70 border-border text-foreground"
                }`}
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm">{routingDecision.isFailoverRerouted ? "⚠️" : "🚀"}</span>
                    <span className="font-bold">
                      {routingDecision.isFailoverRerouted
                        ? "AUTOMATIC FAILOVER ENGAGED"
                        : "DIRECT OPTIMAL ROUTE"}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Latency: {routingDecision.latencyEstimatedMs.toFixed(1)}ms
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-muted-foreground">Requested Geo: </span>
                    <span className="text-foreground font-bold">{routingDecision.clientGeo}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Target Region: </span>
                    <span className="text-cyan-700 dark:text-cyan-400 font-bold">{routingDecision.routedRegion}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cloud Provider: </span>
                    <span className="text-indigo-700 dark:text-indigo-400 font-bold">{routingDecision.provider}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Datacenter: </span>
                    <span className="text-foreground font-bold">{routingDecision.regionName}</span>
                  </div>
                </div>

                {routingDecision.isFailoverRerouted && (
                  <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/60 text-[11px] text-rose-300">
                    <span className="font-bold">Failover Reason: </span>
                    {routingDecision.failoverReason}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Chaos Engineering Fault Injector (6 Cols) */}
          <div className="lg:col-span-6 p-5 rounded-2xl bg-card/60 border border-border/80 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-bold text-foreground">Chaos Engineering & Fault Injection</h2>
                <p className="text-xs text-muted-foreground">
                  Inject network partitions, latency spikes, or regional cloud outages
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-rose-950 text-rose-400 font-mono border border-rose-800/50">
                SRE Live Simulator
              </span>
            </div>

            <form onSubmit={handleInjectChaos} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-muted-foreground mb-1">Target Cloud Region</label>
                  <select
                    value={chaosRegion}
                    onChange={(e) => setChaosRegion(e.target.value)}
                    className="w-full bg-background text-foreground p-2.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                  >
                    <option value="us-east-1">us-east-1 (AWS N. Virginia)</option>
                    <option value="us-west-2">us-west-2 (AWS Oregon)</option>
                    <option value="eu-central-1">eu-central-1 (GCP Frankfurt)</option>
                    <option value="ap-south-1">ap-south-1 (Azure Mumbai)</option>
                    <option value="ap-southeast-1">ap-southeast-1 (AWS Singapore)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-muted-foreground mb-1">Simulated Fault Type</label>
                  <select
                    value={chaosFault}
                    onChange={(e) => setChaosFault(e.target.value)}
                    className="w-full bg-background text-foreground p-2.5 rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-rose-500 font-mono"
                  >
                    <option value="LatencySpike">Latency Spike (+680ms)</option>
                    <option value="NetworkPartition">Network Partition (48% Drops)</option>
                    <option value="RegionBlackout">Total Region Blackout (100% Down)</option>
                    <option value="DatabaseDesync">Database Replica Desync (18s Lag)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground mb-1">Fault Severity Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {["Minor", "Major", "Catastrophic"].map((sev) => (
                    <button
                      key={sev}
                      type="button"
                      onClick={() => setChaosSeverity(sev)}
                      className={`p-2 rounded-lg font-mono text-[11px] font-bold border transition ${
                        chaosSeverity === sev
                          ? "bg-rose-950 text-rose-300 border-rose-600"
                          : "bg-background text-muted-foreground border-border hover:border-border"
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                {activeExperimentId ? (
                  <button
                    type="button"
                    onClick={handleRecoverChaos}
                    disabled={isRecovering}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <span>🛡️</span>
                    <span>{isRecovering ? "Disarming Fault..." : "Recover Active Chaos & Reset Circuit Breaker"}</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={isInjecting}
                    className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center space-x-2"
                  >
                    <span>⚡</span>
                    <span>{isInjecting ? "Simulating Partition..." : "Inject Chaos Fault & Trip Circuit Breaker"}</span>
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

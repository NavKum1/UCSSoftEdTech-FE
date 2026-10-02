"use client";

import React, { useState, useEffect } from "react";
import {
  Mic,
  Volume2,
  Sparkles,
  ShieldAlert,
  HeartHandshake,
  Rocket,
  Lock,
  Globe,
  CheckCircle2,
  Sliders,
  ChevronRight,
  Code2,
  MessageSquare,
  Play,
  RotateCw,
} from "lucide-react";

interface PersonaItem {
  id: string;
  code: string;
  displayName: string;
  description: string;
  voiceModel: string;
  voiceId: string;
  interruptionAggressiveness: number;
  scrutinyLevel: string;
  dialectCode: string;
  isDefault: boolean;
}

interface AdaptedPromptConfig {
  personaCode: string;
  displayName: string;
  scrutinyLevel: string;
  dialectCode: string;
  voiceId: string;
  interruptionAggressiveness: number;
  injectedSystemPrompt: string;
}

export default function PersonaSelectorPage() {
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("StaffArchitectFAANG");
  const [selectedDialect, setSelectedDialect] = useState<string>("US_WestCoast_Tech");
  const [previewConfig, setPreviewConfig] = useState<AdaptedPromptConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingPreview, setGeneratingPreview] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const apiBase = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000"}`;

  const dialects = [
    {
      code: "US_WestCoast_Tech",
      label: "Silicon Valley Tech",
      region: "United States (West Coast)",
      desc: "Conversational, direct, Silicon Valley engineering vocabulary.",
    },
    {
      code: "UK_London_Financial",
      label: "London Financial Tech",
      region: "United Kingdom (City of London)",
      desc: "Composed, analytical cadence with British technical phrasing.",
    },
    {
      code: "India_Bangalore_Enterprise",
      label: "Bangalore Enterprise Cloud",
      region: "India (Bangalore Hub)",
      desc: "High-scale architecture vocabulary, SLA and concurrency focus.",
    },
    {
      code: "EU_Berlin_Pragmatic",
      label: "Berlin Engineering Precision",
      region: "European Union (Berlin)",
      desc: "Structured, specification-driven, zero-ambiguity inquiry.",
    },
  ];

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/persona/catalog`);
      if (res.ok) {
        const data = await res.json();
        setPersonas(data);
        if (data.length > 0) {
          const defaultItem = data.find((p: PersonaItem) => p.isDefault) || data[0];
          setSelectedPersona(defaultItem.code);
          setSelectedDialect(defaultItem.dialectCode);
        }
      }
    } catch (err) {
      console.error("Failed to load personas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  const handleGeneratePreview = async (personaCode: string, dialectCode: string) => {
    setGeneratingPreview(true);
    try {
      const res = await fetch(`${apiBase}/api/persona/benchmark-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaCode,
          dialectCode,
          candidateName: "Elena Rostova",
          codeSnippet:
            "def handle_payment(account_id, amount):\n    cursor.execute(f'UPDATE balances SET balance = balance - {amount} WHERE id = {account_id}')",
          flaws: [
            "SQL injection vulnerability via raw f-string parameterization",
            "Lack of distributed database transaction isolation level",
          ],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewConfig(data);
        setStatusMessage(`Adapted system prompt dynamically compiled for ${data.displayName}.`);
      }
    } catch (err: any) {
      setStatusMessage(`Error compiling prompt: ${err.message}`);
    } finally {
      setGeneratingPreview(false);
    }
  };

  useEffect(() => {
    if (selectedPersona) {
      handleGeneratePreview(selectedPersona, selectedDialect);
    }
  }, [selectedPersona, selectedDialect]);

  const getPersonaIcon = (code: string) => {
    switch (code) {
      case "StaffArchitectFAANG":
        return <ShieldAlert className="w-5 h-5 text-red-400" />;
      case "EmpatheticMentor":
        return <HeartHandshake className="w-5 h-5 text-emerald-400" />;
      case "StartupCTO":
        return <Rocket className="w-5 h-5 text-amber-400" />;
      case "SecurityAuditor":
        return <Lock className="w-5 h-5 text-purple-400" />;
      default:
        return <Mic className="w-5 h-5 text-indigo-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <Sliders className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                AI Technical Interviewer Persona Studio
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-400">
              Customize technical inquiry styles, voice aggression thresholds, and regional dialect profiles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-mono">
              Vapi Real-Time Voice Engine Active
            </span>
          </div>
        </div>

        {statusMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-indigo-300 text-xs font-mono">
            <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Section 1: Choose Persona */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              1. Select Interviewer Persona & Scrutiny Style
            </h2>
            <span className="text-xs text-slate-400">{personas.length} Available Profiles</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {personas.map((persona) => {
              const isSelected = selectedPersona === persona.code;
              return (
                <div
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona.code)}
                  className={`cursor-pointer p-5 rounded-2xl border transition-all space-y-3 relative ${
                    isSelected
                      ? "border-indigo-500 bg-indigo-950/30 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50">
                      {getPersonaIcon(persona.code)}
                    </div>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded tracking-wider ${
                        persona.scrutinyLevel === "Draconian"
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : persona.scrutinyLevel === "Lenient"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}
                    >
                      {persona.scrutinyLevel}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-white tracking-tight">{persona.displayName}</h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {persona.description}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                    <span>Interruption Rate</span>
                    <span className="font-mono font-semibold text-slate-200">
                      {(persona.interruptionAggressiveness * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Dialect & Accent Tuning */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            2. Choose Speech Dialect & Regional Cadence
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dialects.map((d) => {
              const isSelected = selectedDialect === d.code;
              return (
                <div
                  key={d.code}
                  onClick={() => setSelectedDialect(d.code)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all space-y-1.5 ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-950/20 ring-1 ring-emerald-500"
                      : "border-slate-800 bg-slate-900/40 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{d.label}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{d.region}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{d.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Live Injected System Prompt Preview */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/50 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Live Vapi System Prompt & Directives Inspector
              </h2>
            </div>

            <button
              onClick={() => handleGeneratePreview(selectedPersona, selectedDialect)}
              disabled={generatingPreview}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
            >
              <RotateCw className={`w-3.5 h-3.5 ${generatingPreview ? "animate-spin" : ""}`} />
              <span>Recompile Prompt</span>
            </button>
          </div>

          {previewConfig ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-500 block">Persona:</span>
                  <span className="text-indigo-400 font-bold">{previewConfig.displayName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Scrutiny:</span>
                  <span className="text-white font-bold">{previewConfig.scrutinyLevel}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Dialect:</span>
                  <span className="text-emerald-400 font-bold">{previewConfig.dialectCode}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Voice ID:</span>
                  <span className="text-amber-400 font-bold">{previewConfig.voiceId}</span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap">
                {previewConfig.injectedSystemPrompt}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs italic">
              Loading adapted prompt directives...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

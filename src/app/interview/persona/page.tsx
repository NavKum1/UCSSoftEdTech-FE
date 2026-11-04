"use client";

import React, { useState, useEffect } from "react";
import { AccessNotice, useLegacyApi, useLatestRef } from "@/lib/legacyApi";
import {
  Mic,
  ShieldAlert,
  HeartHandshake,
  Rocket,
  Lock,
  CheckCircle2,
  RotateCw,
} from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, PageHeader } from "@/components/career/ui";

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
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [personas, setPersonas] = useState<PersonaItem[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<string>("StaffArchitectFAANG");
  const [selectedDialect, setSelectedDialect] = useState<string>("US_WestCoast_Tech");
  const [previewConfig, setPreviewConfig] = useState<AdaptedPromptConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generatingPreview, setGeneratingPreview] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");


  const dialects = [
    {
      code: "US_WestCoast_Tech",
      label: en("Silicon Valley Tech"),
      region: "United States (West Coast)",
      desc: "Conversational, direct, Silicon Valley engineering vocabulary.",
    },
    {
      code: "UK_London_Financial",
      label: en("London Financial Tech"),
      region: "United Kingdom (City of London)",
      desc: "Composed, analytical cadence with British technical phrasing.",
    },
    {
      code: "EU_Berlin_Pragmatic",
      label: en("Berlin Engineering Precision"),
      region: "European Union (Berlin)",
      desc: "Structured, specification-driven, zero-ambiguity inquiry.",
    },
  ];

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/persona/catalog`);
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

  const fetchPersonasRef = useLatestRef(fetchPersonas);
  useEffect(() => {
    if (!ready) return;
    fetchPersonasRef.current();
  }, [ready, fetchPersonasRef]);

  const handleGeneratePreview = async (personaCode: string, dialectCode: string) => {
    setGeneratingPreview(true);
    try {
      const res = await apiFetch(`/api/persona/benchmark-prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaCode,
          dialectCode,
          candidateName: "the candidate",
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
        setStatusMessage(`Preview ready for ${data.displayName}.`);
      }
    } catch (err) {
      setStatusMessage("We couldn't build the interviewer preview. Please try again.");
    } finally {
      setGeneratingPreview(false);
    }
  };

  const handleGeneratePreviewRef = useLatestRef(handleGeneratePreview);
  useEffect(() => {
    if (!ready) return;
    if (selectedPersona) {
      handleGeneratePreviewRef.current(selectedPersona, selectedDialect);
    }
  }, [selectedPersona, selectedDialect, ready, handleGeneratePreviewRef]);

  const getPersonaIcon = (code: string) => {
    switch (code) {
      case "StaffArchitectFAANG":
        return <ShieldAlert className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />;
      case "EmpatheticMentor":
        return <HeartHandshake className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />;
      case "StartupCTO":
        return <Rocket className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />;
      case "SecurityAuditor":
        return <Lock className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />;
      default:
        return <Mic className="h-5 w-5 text-indigo-700 dark:text-indigo-400" />;
    }
  };

  if (access) return <AccessNotice problem={access} feature="The interviewer persona studio" />;

  return (
    <div className="text-foreground">
      <PageHeader
        title={en("Interviewer style")}
        description={en("Choose how your AI interviewer asks questions, how often it interrupts, and how it speaks.")}
      />

      <div className="space-y-8">
        {statusMessage && (
          <div role="status" className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground shadow-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-700 dark:text-indigo-400" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Section 1: Choose Persona */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">{en("1. Choose an interviewer")}</h2>
            <span className="text-xs text-muted-foreground">{en("{length} available", { length: personas.length })}</span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {personas.map((persona) => {
              const isSelected = selectedPersona === persona.code;
              return (
                <div
                  key={persona.id}
                  onClick={() => setSelectedPersona(persona.code)}
                  className={`relative cursor-pointer space-y-3 rounded-xl border bg-card p-5 shadow-sm transition-colors ${
                    isSelected ? "border-indigo-500 ring-1 ring-indigo-500" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="rounded-lg border border-border bg-muted p-2">{getPersonaIcon(persona.code)}</div>
                    <Badge tone={persona.scrutinyLevel === "Draconian" ? "bad" : persona.scrutinyLevel === "Lenient" ? "good" : "warn"}>
                      {persona.scrutinyLevel}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{persona.displayName}</h3>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{persona.description}</p>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
                    <span>{en("Interruption rate")}</span>
                    <span className="font-semibold tabular-nums text-foreground">{(persona.interruptionAggressiveness * 100).toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Dialect & Accent Tuning */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">{en("2. Choose a speaking style")}</h2>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {dialects.map((d) => {
              const isSelected = selectedDialect === d.code;
              return (
                <div
                  key={d.code}
                  onClick={() => setSelectedDialect(d.code)}
                  className={`cursor-pointer space-y-1.5 rounded-xl border bg-card p-4 shadow-sm transition-colors ${
                    isSelected ? "border-indigo-500 ring-1 ring-indigo-500" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{en(d.label)}</span>
                    <span className="text-xs text-muted-foreground">{en(d.region)}</span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{en(d.desc)}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Live Injected System Prompt Preview */}
        <Card
          title={en("Interviewer instructions preview")}
          actions={
            <Button variant="secondary" onClick={() => handleGeneratePreview(selectedPersona, selectedDialect)} disabled={generatingPreview}>
              <RotateCw className={`h-4 w-4 ${generatingPreview ? "animate-spin" : ""}`} />
              <span>{en("Refresh preview")}</span>
            </Button>
          }
        >
          {previewConfig ? (
            <div className="space-y-4">
              <dl className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{en("Interviewer")}</dt>
                  <dd className="font-medium text-foreground">{previewConfig.displayName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{en("Scrutiny")}</dt>
                  <dd className="font-medium text-foreground">{previewConfig.scrutinyLevel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{en("Speaking style")}</dt>
                  <dd className="font-mono text-xs text-foreground">{previewConfig.dialectCode}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{en("Voice ID")}</dt>
                  <dd className="font-mono text-xs text-foreground">{previewConfig.voiceId}</dd>
                </div>
              </dl>

              <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-background p-4 font-mono text-xs leading-relaxed text-muted-foreground">
                {previewConfig.injectedSystemPrompt}
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">{en("Loading the preview…")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

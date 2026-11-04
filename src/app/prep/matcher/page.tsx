"use client";

import React, { useState } from "react";
import { ArrowRight, CheckCircle2, Target } from "lucide-react";
import Link from "next/link";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, EmptyState, ErrorBanner, PageHeader, brandFill, buttonClass } from "@/components/career/ui";

/** Resume-to-role analysis result (fields this page shows). */
interface ResumeMatchResult {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: string[];
  generatedSprint?: {
    id: string;
    title: string;
    description: string;
    requiredLanguage: string;
  } | null;
}

const inputClass =
  "w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 transition";

export default function ResumeMatcherPrepPage() {
  const en = useEn();
  const { apiFetch, access } = useLegacyApi();
  // Starts empty: the member pastes their own resume and the role they're aiming for
  const [resumeText, setResumeText] = useState("");
  const [targetTitle, setTargetTitle] = useState("");
  const [targetDescription, setTargetDescription] = useState("");

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ResumeMatchResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAnalyzing(true);
    setErrorMsg(null);
    setAnalysisResult(null);

    try {
      const res = await apiFetch(`/api/resume/analyze-and-match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          targetJobTitle: targetTitle,
          targetJobDescription: targetDescription
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAnalysisResult(data);
      } else {
        const err = await res.json();
        setErrorMsg(err.error || en("We couldn't analyse your resume. Please try again."));
      }
    } catch (e) {
      void e;
      setErrorMsg(en("We couldn't reach the server. Please check your connection and try again."));
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (access) return <AccessNotice problem={access} feature="The resume matcher" />;

  return (
    <div className="text-foreground">
      <PageHeader
        title={en("Resume match")}
        description={en("Compare your resume with a job description to see which skills match, which are missing, and a practice task that closes the gap.")}
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <form onSubmit={handleAnalyze} className="space-y-4">
            <div>
              <label htmlFor="targetTitle" className="mb-1.5 block text-sm font-medium text-foreground">
                {en("Job title")}
              </label>
              <input
                id="targetTitle"
                type="text"
                value={targetTitle}
                onChange={(e) => setTargetTitle(e.target.value)}
                required
                placeholder={en("e.g. Backend engineer")}
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="targetDescription" className="mb-1.5 block text-sm font-medium text-foreground">
                {en("Job description")}
              </label>
              <textarea
                id="targetDescription"
                rows={4}
                value={targetDescription}
                onChange={(e) => setTargetDescription(e.target.value)}
                required
                placeholder={en("Paste the job description, including the skills it asks for")}
                className={`${inputClass} resize-y`}
              />
            </div>

            <div>
              <label htmlFor="resumeText" className="mb-1.5 flex items-center justify-between text-sm font-medium text-foreground">
                <span>{en("Your resume")}</span>
                <span className="text-xs font-normal text-muted-foreground">{en("Plain text or Markdown")}</span>
              </label>
              <textarea
                id="resumeText"
                rows={8}
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                required
                placeholder={en("Paste your resume")}
                className={`${inputClass} resize-y leading-relaxed`}
              />
            </div>

            <Button type="submit" busy={isAnalyzing} className="w-full">
              {isAnalyzing ? en("Analyzing your resume…") : en("Compare with the job")}
            </Button>
          </form>

          {errorMsg && (
            <div className="mt-4">
              <ErrorBanner error={errorMsg} />
            </div>
          )}
        </Card>

        <div className="space-y-6">
          {analysisResult ? (
            <Card>
              <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{en("Match with this role")}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{targetTitle}</p>
                </div>
                <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{analysisResult.matchScore}%</p>
              </div>

              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{en("Skills you have ({length})", { length: analysisResult.matchedSkills.length })}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.matchedSkills.map((s: string, idx: number) => (
                      <Badge key={idx} tone="good">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-amber-700 dark:text-amber-400">
                    <Target className="h-4 w-4" />
                    <span>{en("Skills to build ({length})", { length: analysisResult.missingSkills.length })}</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysisResult.missingSkills.map((s: string, idx: number) => (
                      <Badge key={idx} tone="warn">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {analysisResult.recommendations.length > 0 && (
                <div className="mt-5 space-y-2 rounded-lg border border-border p-4">
                  <h2 className="text-sm font-semibold text-foreground">{en("Recommendations")}</h2>
                  <ul className="list-disc space-y-1.5 ps-5 text-sm text-muted-foreground">
                    {analysisResult.recommendations.map((rec: string, idx: number) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {analysisResult.generatedSprint && (
                <div className="mt-5 space-y-3 rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-foreground">{en("Practice task for this role")}</h2>
                    <Badge>{en("Language: {requiredLanguage}", { requiredLanguage: analysisResult.generatedSprint.requiredLanguage })}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{analysisResult.generatedSprint.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{analysisResult.generatedSprint.description}</p>
                  </div>
                  <Link href={`/sprint/${analysisResult.generatedSprint.id}`} className={`${buttonClass("primary")} w-full`} style={brandFill}>
                    {en("Start the practice task")}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}
            </Card>
          ) : (
            <EmptyState title={en("No comparison yet")}>
              {en("Add a job and your resume, then select \"Compare with the job\".")}
            </EmptyState>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

/**
 * Build & Defend Stage 3: the pilot's results (or, outside a pilot, the assessments' results). A school admin sees the whole
 * school; a teacher sees their own classes. API: /api/career/class-assessments/pilot-results (and .csv).
 */
import React from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { CA_API } from "@/components/career/classAssessments/types";
import { PilotResultsPage } from "@/components/career/classAssessments/PilotResults";

export default function ResultsPage() {
  const api = useApi();
  const { schoolId } = useCareerShell();
  // The school is part of the key, so switching schools loads that school's results
  return <PilotResultsPage key={schoolId ?? ""} api={api} path={`${CA_API}/pilot-results`} csvPath={`${CA_API}/pilot-results.csv`} />;
}

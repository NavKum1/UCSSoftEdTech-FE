"use client";

import { useEn } from "@/lib/english/EnglishProvider";
import type { Template, VivaMode } from "./types";

export function useTemplateNames(): Record<Template, string> {
  const en = useEn();
  return {
    project: en("Project defense"),
    coding: en("Coding task"),
    exam: en("Written exam plus viva"),
    essay: en("Essay"),
    report: en("Report"),
    labreport: en("Lab report"),
    presentation: en("Presentation"),
  };
}

export function useVivaModeNames(): Record<VivaMode, string> {
  const en = useEn();
  return { voice: en("By voice"), text: en("In writing"), choice: en("The student chooses") };
}

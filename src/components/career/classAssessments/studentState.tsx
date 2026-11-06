"use client";

import React from "react";
import { Badge } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";
import type { StudentAssessmentSummary } from "@/components/career/classAssessments/types";

/** Where a student is with an assessment, as a badge (the decision once their teacher has made it) */
export function StudentStateBadge({ item }: { item: Pick<StudentAssessmentSummary, "state" | "decision" | "score"> }) {
  const en = useEn();
  switch (item.state) {
    case "upcoming":
      return <Badge tone="info">{en("Not open yet")}</Badge>;
    case "open":
      return <Badge tone="good">{en("Open")}</Badge>;
    case "late":
      return <Badge tone="warn">{en("Past due, late work accepted")}</Badge>;
    case "in-progress":
      return <Badge tone="info">{en("In progress")}</Badge>;
    case "submitted":
      return <Badge tone="info">{en("Waiting for your teacher")}</Badge>;
    case "decided": {
      const score = item.score != null ? ` · ${Math.round(item.score)}/100` : "";
      if (item.decision === "pass") return <Badge tone="good">{en("Passed") + score}</Badge>;
      if (item.decision === "resubmit") return <Badge tone="warn">{en("Resubmit") + score}</Badge>;
      return <Badge tone="bad">{en("Not passed") + score}</Badge>;
    }
    default:
      return <Badge>{en("Closed")}</Badge>;
  }
}

export const isToDo = (s: StudentAssessmentSummary["state"]) => s === "upcoming" || s === "open" || s === "late" || s === "in-progress";

"use client";

/**
 * Build & Defend Stage 3: a pilot school's results for Edulexa staff, the same figures the school sees.
 * API: /api/career/platform/schools/{id}/pilot-results (and .csv).
 */
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { PilotResultsPage } from "@/components/career/classAssessments/PilotResults";

export default function PlatformPilotResultsPage() {
  const api = useApi();
  const { id } = useParams<{ id: string }>();
  const base = `/api/career/platform/schools/${id}`;
  return (
    <div>
      <p className="mb-4 text-sm">
        <Link href="/admin/career" className="font-medium underline-offset-2 hover:underline">Schools</Link>
      </p>
      <PilotResultsPage api={api} path={`${base}/pilot-results`} csvPath={`${base}/pilot-results.csv`} staff />
    </div>
  );
}

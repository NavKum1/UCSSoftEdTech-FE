import { API_BASE_URL } from "@/lib/apiClient";

export interface ShareRow {
  key: string;
  description: string | null;
  count: number;
  share: number | null;
}

export interface CountRow {
  key: string;
  attemptsStarted: number;
  attemptsSubmitted: number;
  submissions: number;
  submissionsDefended: number;
}

export interface DecisionMixRow {
  riskLevel: string;
  submissions: number;
  decided: number;
  advance: number;
  hold: number;
  decline: number;
  advanceShare: number | null;
}

export interface Correlation {
  predictor: string;
  outcome: string;
  n: number;
  reported: boolean;
  r: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  summary: string;
}

export interface FairnessGroup {
  group: string;
  candidates: number;
  decided: number;
  selectionRate: number | null;
  selectionImpactRatio: number | null;
  selectionBelowFourFifths: boolean;
  scored: number;
  scoringRate: number | null;
  scoringImpactRatio: number | null;
  scoringBelowFourFifths: boolean;
}

export interface FairnessCategory {
  category: string;
  disclosureShare: number | null;
  notReported: number;
  suppressedGroups: number;
  groups: FairnessGroup[];
}

export interface TransparencyReport {
  methodologyVersion: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  headline: {
    candidatesAssessed: number;
    submissions: number;
    defensesCompleted: number;
    humanDecisionShare: number | null;
    flaggedAdvancedShare: number | null;
    appeals: number | null;
  };
  volume: {
    attemptsStarted: number;
    attemptsSubmitted: number;
    completionRate: number | null;
    submissions: number;
    submissionsDefended: number;
    defenseRate: number | null;
    defensesCompleted: number;
    sprintDefenses: number;
    realWorkDefenses: number;
    defenseLanguagesUsed: number;
    byTaskType: CountRow[];
    byAiPolicy: CountRow[];
  };
  integrity: {
    submissions: number;
    analysedSubmissions: number;
    riskLevels: ShareRow[];
    signals: ShareRow[];
    oversight: {
      submissions: number;
      withHumanDecision: number;
      humanDecisionShare: number | null;
      byRiskLevel: DecisionMixRow[];
      flaggedSubmissions: number;
      flaggedDecided: number;
      flaggedAdvanced: number;
      flaggedAdvancedShare: number | null;
      decisionTimesMeasured: number;
      medianHoursToDecision: number | null;
    };
  };
  appeals: {
    available: boolean;
    statusText: string;
    total: number;
    appealRate: number | null;
    outcomes: ShareRow[];
    resolved: number;
    overturnedShareOfResolved: number | null;
    medianResolutionHours: number | null;
  };
  validity: {
    scope: string;
    contributingEmployers: string;
    enoughEmployers: boolean;
    hiresWithOutcomes: number;
    minimumN: number;
    results: Correlation[];
    caveat: string;
  };
  fairness: {
    minimumGroupSize: number;
    candidatesInScope: number;
    selfIdentified: number;
    selfIdentifiedShare: number | null;
    medianDefenseScore: number | null;
    categories: FairnessCategory[];
    notice: string;
  };
  accessibility: {
    defensesCompleted: number;
    languages: ShareRow[];
    defensesWithDuration: number;
    averageVoiceMinutesPerDefense: number | null;
  };
  commitments: { title: string; text: string; note: string | null }[];
  methodology: { version: string; sections: { title: string; items: { metric: string; definition: string }[] }[] };
  limitations: string[];
}

export interface PublishedReport {
  id: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  methodologyVersion: string;
  publishedAt: string | null;
  notes: string | null;
  report: TransparencyReport | null;
}

export interface ArchiveEntry {
  id: string;
  periodStart: string;
  periodEnd: string;
  publishedAt: string | null;
  status: "Published" | "Withdrawn";
  methodologyVersion: string;
  withdrawnAt: string | null;
  withdrawalReason: string | null;
}

export interface AdminReport extends PublishedReport {
  generatedAt: string;
  generatedBy: string;
  publishedBy: string | null;
  withdrawnAt: string | null;
  withdrawnBy: string | null;
  withdrawalReason: string | null;
}

export type PublicFetchResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "not-found" }
  | { kind: "withdrawn"; data: ArchiveEntry }
  | { kind: "error"; message: string };

// Public endpoints need no token, so these work for signed-out visitors
export async function fetchPublic<T>(path: string): Promise<PublicFetchResult<T>> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store" });
    if (res.status === 404) return { kind: "not-found" };
    if (res.status === 410) return { kind: "withdrawn", data: (await res.json()) as ArchiveEntry };
    if (!res.ok) return { kind: "error", message: `The server returned HTTP ${res.status}.` };
    return { kind: "ok", data: (await res.json()) as T };
  } catch {
    return { kind: "error", message: "Could not reach the server." };
  }
}

export function formatPeriod(start: string, end: string) {
  const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";
}

export function pct(v: number | null | undefined) {
  return v == null ? "—" : `${(v * 100).toFixed(1)}%`;
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

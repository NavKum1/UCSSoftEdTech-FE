"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  Accessibility,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCode2,
  Flag,
  Gavel,
  Info,
  Layers,
  Loader2,
  Mic,
  Printer,
  RefreshCw,
  ShieldQuestion,
  XCircle,
} from "lucide-react";

interface IntegritySignal {
  code: string;
  weight: number;
  detail: string;
}

interface Decision {
  decision: string;
  rationale: string;
  reviewerName: string;
  createdAt: string;
  evidenceHash: string;
  evidenceChangedSince: boolean;
}

interface EvidencePack {
  submissionId: string;
  evidenceHash: string;
  candidate: { userId: string; name: string | null; email: string | null };
  task: { sprintId: string | null; title: string | null; taskType: string | null; aiPolicy: string | null; language: string | null };
  timing: { submittedAt: string; attemptStartedAt: string | null; elapsedMinutes: number | null; activeEditingMinutes: number | null };
  tests: { passed: number; total: number; status: string; cases: Record<string, boolean> };
  defects: { id: string; title: string; fixedDefect: boolean }[];
  codeChanges: { file: string; linesAdded: number; linesRemoved: number; diff: string }[];
  aiUsage?: {
    prompts: number;
    charactersInsertedFromAssistant: number;
    shareOfFinalCodeFromAssistant: number;
    conversation: { at: string; prompt: string; response: string; charactersUsed: number }[];
  } | null;
  integrity: {
    riskLevel: string | null;
    riskScore: number | null;
    replayMatchesSubmission: boolean | null;
    typedCharacters: number | null;
    externallyPastedCharacters: number | null;
    focusLosses: number | null;
    maxSimilarityToAnotherCandidate: number | null;
    mostSimilarSubmissionId: string | null;
    signals: IntegritySignal[] | null;
  };
  defense?: {
    sessionId: string;
    technicalScore: number | null;
    missingSkills: string[] | null;
    durationSeconds: number | null;
    recordingUrl: string | null;
    questionsAndAnswers: { question: string; answer: string }[];
  } | null;
  consistencyNotes: string[];
  sections?: Record<string, unknown>;
  decisions: Decision[];
  notIncluded: string[];
  disclaimer: string;
}

const RISK_STYLES: Record<string, { label: string; className: string }> = {
  Clear: { label: "Clear", className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  Review: { label: "Review", className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  HighRisk: { label: "High risk", className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30" },
  Unknown: { label: "Unknown", className: "bg-muted text-muted-foreground border-border" },
};

const AI_POLICY_LABELS: Record<string, string> = {
  Prohibited: "AI assistance not allowed",
  Allowed: "AI allowed (built-in assistant, logged)",
  Evaluated: "AI allowed and its use is part of the review",
};

const DECISIONS = [
  { value: "Advance", hint: "Move the candidate to the next stage." },
  { value: "Hold", hint: "Needs a follow-up conversation or more information." },
  { value: "Decline", hint: "Do not proceed." },
] as const;

const PRINT_CSS = `
@media print {
  header, nav, .no-print { display: none !important; }
  body { background: #fff !important; color: #000 !important; }
  .glass-panel { box-shadow: none !important; backdrop-filter: none !important; background: #fff !important; break-inside: avoid; }
  .print-break { break-inside: auto !important; }
  pre { white-space: pre-wrap !important; }
}
`;

const MIN_RATIONALE = 20;

function fmtDate(v: string | null | undefined) {
  return v ? new Date(v).toLocaleString() : "—";
}

function pct(v: number | null | undefined) {
  return v == null ? "—" : `${Math.round(v * 100)}%`;
}

function Section({ title, icon, children, className = "" }: { title: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`glass-panel rounded-2xl p-5 border border-border space-y-3 ${className}`}>
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5">{value}</div>
    </div>
  );
}

function DiffView({ diff }: { diff: string }) {
  const lines = diff.replace(/\n$/, "").split("\n");
  return (
    <pre className="text-xs font-mono overflow-x-auto rounded-xl border border-border bg-muted/30 py-2">
      {lines.map((line, i) => {
        const kind = line.startsWith("+ ") ? "add" : line.startsWith("- ") ? "del" : "ctx";
        const cls =
          kind === "add"
            ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            : kind === "del"
              ? "bg-rose-500/10 text-rose-800 dark:text-rose-300"
              : "text-muted-foreground";
        return (
          <div key={i} className={`px-3 whitespace-pre ${cls}`}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

interface AppealsSection {
  note?: string;
  items: { id: string; category: string; reason: string; status: string; createdAt: string; resolverName: string | null; response: string | null; resolvedAt: string | null }[];
}

interface AccommodationsSection {
  note?: string;
  items: { type: string; details: string; scope: string; decidedBy: string | null; decidedAt: string | null }[];
}

const APPEAL_STATUS_STYLES: Record<string, string> = {
  Open: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Overturned: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Upheld: "bg-muted text-muted-foreground border-border",
  Withdrawn: "bg-muted text-muted-foreground border-border",
};

function humanize(key: string) {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

// Renders any contributor section generically, so sections added by other features show up without page changes
function GenericValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === "") return <span className="text-muted-foreground">—</span>;
  if (typeof value === "boolean") return <span>{value ? "Yes" : "No"}</span>;
  if (typeof value === "number") return <span>{value.toLocaleString()}</span>;
  if (typeof value === "string") {
    const isDate = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
    return <span className="whitespace-pre-wrap wrap-break-word">{isDate ? fmtDate(value) : value}</span>;
  }
  if (depth > 3) return <pre className="text-[11px] font-mono whitespace-pre-wrap break-all">{JSON.stringify(value, null, 2)}</pre>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">None</span>;
    if (value.every((v) => v === null || typeof v !== "object")) return <span>{value.map((v) => String(v)).join(", ")}</span>;
    return (
      <ol className="space-y-2">
        {value.map((v, i) => (
          <li key={i} className="rounded-lg border border-border p-2">
            <GenericValue value={v} depth={depth + 1} />
          </li>
        ))}
      </ol>
    );
  }
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    <dl className="grid sm:grid-cols-[minmax(8rem,auto)_1fr] gap-x-3 gap-y-1">
      {entries.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt className="text-muted-foreground">{humanize(k)}</dt>
          <dd className="text-foreground min-w-0">
            <GenericValue value={v} depth={depth + 1} />
          </dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export default function EvidencePackPage() {
  const params = useParams<{ submissionId: string }>();
  const submissionId = params?.submissionId ?? "";
  const { getToken } = useAuth();

  const [pack, setPack] = useState<EvidencePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [openFiles, setOpenFiles] = useState<Set<string>>(new Set());

  const [decision, setDecision] = useState<string>("");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [evidenceStale, setEvidenceStale] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);

  useEffect(() => {
    if (!submissionId) return;
    let active = true;
    (async () => {
      const res = await authenticatedFetch(`/api/evidence/${submissionId}`, {}, getToken);
      if (res.status === 404) throw new Error("This submission was not found.");
      if (res.status === 401 || res.status === 403) throw new Error("You need recruiter access to view evidence packs.");
      if (!res.ok) throw new Error(`Could not load the evidence pack. Please try again.`);
      return (await res.json()) as EvidencePack;
    })()
      .then((data) => {
        if (!active) return;
        setPack(data);
        setError(null);
        setEvidenceStale(false);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load the evidence pack."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [submissionId, getToken, reloadKey]);

  const reload = () => {
    setLoading(true);
    setSubmitError(null);
    setReloadKey((k) => k + 1);
  };

  const toggleFile = (file: string) =>
    setOpenFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });

  const handlePrint = () => {
    if (pack) setOpenFiles(new Set(pack.codeChanges.map((c) => c.file)));
    // Let the expanded diffs render before opening the print dialog
    setTimeout(() => window.print(), 100);
  };

  const submitDecision = async () => {
    if (!pack || !decision || rationale.trim().length < MIN_RATIONALE) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitted(null);
    try {
      const res = await authenticatedFetch(
        `/api/evidence/${submissionId}/decision`,
        { method: "POST", body: JSON.stringify({ decision, rationale: rationale.trim(), evidenceHash: pack.evidenceHash }) },
        getToken
      );
      if (!res.ok) {
        let message = `Could not record the decision. Please try again.`;
        try {
          const body = await res.json();
          if (body?.error) message = body.error;
        } catch {
          // non-JSON error body
        }
        if (res.status === 400 && /evidence changed/i.test(message)) setEvidenceStale(true);
        setSubmitError(message);
        return;
      }
      setSubmitted(decision);
      setDecision("");
      setRationale("");
      setReloadKey((k) => k + 1);
    } catch {
      setSubmitError("We couldn't reach the server while recording the decision. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading && !pack) {
    return (
      <div className="p-16 flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading evidence pack...
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="space-y-4">
        <Link href="/recruiter/evidence" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to queue
        </Link>
        <div className="glass-panel rounded-2xl p-8 border border-border flex flex-col items-center gap-3 text-sm text-rose-700 dark:text-rose-400">
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error ?? "Evidence pack unavailable."}</div>
          <button onClick={reload} className="text-xs underline text-muted-foreground hover:text-foreground cursor-pointer">Try again</button>
        </div>
      </div>
    );
  }

  const { integrity, tests, defense, aiUsage } = pack;
  const risk = RISK_STYLES[integrity.riskLevel ?? "Unknown"] ?? RISK_STYLES.Unknown;
  const caseEntries = Object.entries(tests.cases ?? {});
  const signals = integrity.signals ?? [];
  const rationaleLength = rationale.trim().length;
  const sections = pack.sections ?? {};
  const appealsSection = sections.appeals as AppealsSection | undefined;
  const accommodationsSection = sections.accommodations as AccommodationsSection | undefined;
  const otherSections = Object.entries(sections).filter(([key, v]) => key !== "appeals" && key !== "accommodations" && v != null);

  return (
    <div className="space-y-6">
      <style>{PRINT_CSS}</style>

      <div className="flex items-center justify-between gap-3 no-print">
        <Link href="/recruiter/evidence" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to queue
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={reload}
            className="py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-medium text-muted-foreground flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Reload
          </button>
          <button
            onClick={handlePrint}
            className="py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="pb-4 border-b border-border">
        <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">Evidence pack</div>
        <h1 className="text-2xl font-extrabold text-foreground mt-1">{pack.candidate.name || "Unnamed candidate"}</h1>
        <p className="text-xs text-muted-foreground">{pack.candidate.email}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Stat label="Task" value={pack.task.title || "Untitled sprint"} />
          <Stat label="Task type / language" value={`${pack.task.taskType ?? "—"} · ${pack.task.language ?? "—"}`} />
          <Stat label="AI policy" value={AI_POLICY_LABELS[pack.task.aiPolicy ?? ""] ?? pack.task.aiPolicy ?? "—"} />
          <Stat label="Submitted" value={fmtDate(pack.timing.submittedAt)} />
          <Stat label="Attempt started" value={fmtDate(pack.timing.attemptStartedAt)} />
          <Stat label="Elapsed" value={pack.timing.elapsedMinutes != null ? `${pack.timing.elapsedMinutes} min` : "—"} />
          <Stat label="Active editing" value={pack.timing.activeEditingMinutes != null ? `${pack.timing.activeEditingMinutes} min` : "—"} />
          <Stat label="Evidence hash" value={<span className="font-mono text-[11px] break-all">{pack.evidenceHash.slice(0, 16)}…</span>} />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-4 text-sm text-foreground flex gap-3">
        <Info className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-2">
          <p>{pack.disclaimer}</p>
          {pack.notIncluded.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold">Not included in this pack:</span>
              <ul className="list-disc ml-5 mt-1 space-y-0.5">
                {pack.notIncluded.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Consistency notes */}
      {pack.consistencyNotes.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <ShieldQuestion className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Implementation vs. explanation
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-foreground">
            {pack.consistencyNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Tests */}
      <Section title={`Tests: ${tests.passed}/${tests.total} passed`} icon={<CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}>
        <p className="text-xs text-muted-foreground">Status: {tests.status}</p>
        {caseEntries.length === 0 ? (
          <p className="text-xs text-muted-foreground">No per-test results recorded.</p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-1.5">
            {caseEntries.map(([name, ok]) => (
              <li key={name} className="flex items-center gap-2 text-xs">
                {ok ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span className="font-mono text-foreground break-all">{name}</span>
                <span className="sr-only">{ok ? "passed" : "failed"}</span>
              </li>
            ))}
          </ul>
        )}
        {pack.defects.length > 0 && (
          <div className="pt-2">
            <h3 className="text-xs font-semibold text-foreground mb-1.5">Planted defects</h3>
            <ul className="space-y-1">
              {pack.defects.map((d) => (
                <li key={d.id} className="flex items-center gap-2 text-xs">
                  {d.fixedDefect ? (
                    <span className="px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold">Fixed</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold">Not fixed</span>
                  )}
                  <span className="text-foreground">{d.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Code changes */}
      <Section title="Code changes" icon={<FileCode2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />} className="print-break">
        {pack.codeChanges.length === 0 ? (
          <p className="text-xs text-muted-foreground">No files submitted.</p>
        ) : (
          <div className="space-y-2">
            {pack.codeChanges.map((c) => {
              const open = openFiles.has(c.file);
              return (
                <div key={c.file} className="rounded-xl border border-border">
                  <button
                    onClick={() => toggleFile(c.file)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs hover:bg-muted/50 rounded-xl cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-mono text-foreground">
                      {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {c.file}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-emerald-700 dark:text-emerald-400">+{c.linesAdded}</span>
                      <span className="text-rose-700 dark:text-rose-400">-{c.linesRemoved}</span>
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3">
                      <DiffView diff={c.diff} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* AI usage */}
      {aiUsage && (
        <Section title="AI assistant usage" icon={<Bot className="w-4 h-4 text-purple-600 dark:text-purple-400" />} className="print-break">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Stat label="Prompts" value={aiUsage.prompts} />
            <Stat label="Characters inserted from assistant" value={aiUsage.charactersInsertedFromAssistant.toLocaleString()} />
            <Stat label="Share of final code from assistant" value={pct(aiUsage.shareOfFinalCodeFromAssistant)} />
          </div>
          {aiUsage.conversation.length === 0 ? (
            <p className="text-xs text-muted-foreground">The assistant was not used.</p>
          ) : (
            <ol className="space-y-3">
              {aiUsage.conversation.map((m, i) => (
                <li key={i} className="rounded-xl border border-border p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Prompt {i + 1} · {fmtDate(m.at)}</span>
                    <span>{m.charactersUsed.toLocaleString()} characters used in code</span>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap"><span className="font-semibold">Candidate: </span>{m.prompt}</p>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-muted-foreground bg-muted/30 rounded-lg p-2 overflow-x-auto">{m.response}</pre>
                </li>
              ))}
            </ol>
          )}
        </Section>
      )}

      {/* Integrity */}
      <Section title="Integrity signals" icon={<ShieldQuestion className="w-4 h-4 text-amber-600 dark:text-amber-400" />}>
        <p className="text-xs text-muted-foreground">
          These are patterns worth discussing with the candidate, not proof of misconduct. Many have innocent explanations.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat
            label="Signal level"
            value={<span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${risk.className}`}>{risk.label}</span>}
          />
          <Stat label="Signal score" value={integrity.riskScore != null ? Math.round(integrity.riskScore) : "—"} />
          <Stat
            label="Editor replay matches submission"
            value={integrity.replayMatchesSubmission == null ? "No replay recorded" : integrity.replayMatchesSubmission ? "Yes" : "No"}
          />
          <Stat label="Typed characters" value={integrity.typedCharacters?.toLocaleString() ?? "—"} />
          <Stat label="Pasted from outside the editor" value={integrity.externallyPastedCharacters?.toLocaleString() ?? "—"} />
          <Stat label="Times focus left the editor" value={integrity.focusLosses ?? "—"} />
          <Stat
            label="Highest similarity to another candidate"
            value={
              <span className="flex items-center gap-2">
                {pct(integrity.maxSimilarityToAnotherCandidate)}
                {integrity.mostSimilarSubmissionId && (
                  <Link href={`/recruiter/evidence/${integrity.mostSimilarSubmissionId}`} className="text-xs text-indigo-700 dark:text-indigo-400 underline no-print">
                    View that submission
                  </Link>
                )}
              </span>
            }
          />
        </div>
        {signals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No signals were raised.</p>
        ) : (
          <ul className="space-y-2">
            {signals.map((s, i) => (
              <li key={`${s.code}-${i}`} className="rounded-xl border border-border p-3 text-sm flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground">{s.detail}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    <span className="font-mono">{s.code}</span> · weight {s.weight}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Defense */}
      <Section title="Defense (voice or written)" icon={<Mic className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />} className="print-break">
        {!defense ? (
          <p className="text-xs text-muted-foreground">No voice defense has been completed for this submission yet.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat label="Technical score" value={defense.technicalScore != null ? `${Math.round(defense.technicalScore)}/100` : "Not scored"} />
              <Stat label="Duration" value={defense.durationSeconds != null ? `${Math.round(defense.durationSeconds / 60)} min` : "—"} />
              <Stat
                label="Missing skills"
                value={defense.missingSkills && defense.missingSkills.length > 0 ? defense.missingSkills.join(", ") : "None noted"}
              />
            </div>
            {defense.recordingUrl && (
              <audio controls preload="none" src={defense.recordingUrl} className="w-full no-print">
                Your browser does not support audio playback.
              </audio>
            )}
            {defense.questionsAndAnswers.length === 0 ? (
              <p className="text-xs text-muted-foreground">No question and answer pairs could be extracted from the transcript.</p>
            ) : (
              <ol className="space-y-2">
                {defense.questionsAndAnswers.map((qa, i) => (
                  <li key={i} className="rounded-xl border border-border p-3 text-sm space-y-1">
                    <p className="text-muted-foreground"><span className="font-semibold text-foreground">Q: </span>{qa.question}</p>
                    <p className="text-foreground"><span className="font-semibold">A: </span>{qa.answer}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </Section>

      {/* Approved accommodations (contributor section, not part of the evidence hash) */}
      {accommodationsSection && accommodationsSection.items?.length > 0 && (
        <Section title="Approved accommodations" icon={<Accessibility className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}>
          {accommodationsSection.note && <p className="text-xs text-muted-foreground">{accommodationsSection.note}</p>}
          <ul className="space-y-2">
            {accommodationsSection.items.map((a, i) => (
              <li key={i} className="rounded-xl border border-border p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-foreground">{humanize(a.type)}</span>
                  <span className="text-muted-foreground">{a.scope} · approved by {a.decidedBy ?? "reviewer"} on {fmtDate(a.decidedAt)}</span>
                </div>
                <p className="text-foreground whitespace-pre-wrap">{a.details}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Candidate appeals (contributor section, not part of the evidence hash) */}
      {appealsSection && appealsSection.items?.length > 0 && (
        <Section title="Candidate appeals" icon={<Flag className="w-4 h-4 text-amber-600 dark:text-amber-400" />}>
          {appealsSection.note && <p className="text-xs text-muted-foreground">{appealsSection.note}</p>}
          <ul className="space-y-2">
            {appealsSection.items.map((a) => (
              <li key={a.id} className="rounded-xl border border-border p-3 text-sm space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full border font-semibold ${APPEAL_STATUS_STYLES[a.status] ?? APPEAL_STATUS_STYLES.Upheld}`}>
                    {a.status === "Overturned" ? "Overturned (appeal succeeded)" : a.status}
                  </span>
                  <span className="font-semibold text-foreground">{humanize(a.category)}</span>
                  <span className="text-muted-foreground">{fmtDate(a.createdAt)}</span>
                </div>
                <p className="text-foreground whitespace-pre-wrap">{a.reason}</p>
                {a.response && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    <span className="font-semibold text-foreground">Response by {a.resolverName ?? "reviewer"} ({fmtDate(a.resolvedAt)}): </span>
                    {a.response}
                  </p>
                )}
                {a.status === "Open" && (
                  <Link href="/recruiter/appeals" className="text-xs text-indigo-700 dark:text-indigo-400 underline no-print">
                    Resolve in the appeals queue
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Sections contributed by other features, rendered generically */}
      {otherSections.map(([key, value]) => (
        <details key={key} className="glass-panel rounded-2xl p-5 border border-border group" open>
          <summary className="text-sm font-bold text-foreground flex items-center gap-2 cursor-pointer list-none">
            <ChevronRight className="w-4 h-4 transition-transform group-open:rotate-90 no-print" />
            <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            {humanize(key)}
          </summary>
          <div className="mt-3 text-xs">
            <GenericValue value={value} />
          </div>
        </details>
      ))}

      {/* Decision history */}
      <Section title="Decision history" icon={<Clock className="w-4 h-4 text-muted-foreground" />}>
        {pack.decisions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No decisions recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {pack.decisions.map((d, i) => (
              <li key={i} className="rounded-xl border border-border p-3 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-foreground">{d.decision}</span>
                  <span className="text-muted-foreground">by {d.reviewerName} · {fmtDate(d.createdAt)}</span>
                  {d.evidenceChangedSince && (
                    <span className="px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold">
                      Evidence has changed since this decision
                    </span>
                  )}
                </div>
                <p className="text-foreground whitespace-pre-wrap">{d.rationale}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Decision panel */}
      <section className="glass-panel rounded-2xl p-5 border border-indigo-500/30 space-y-4 no-print">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Gavel className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Record your decision
        </h2>
        <fieldset className="grid sm:grid-cols-3 gap-2">
          <legend className="sr-only">Decision</legend>
          {DECISIONS.map((d) => (
            <label
              key={d.value}
              className={`rounded-xl border p-3 cursor-pointer text-sm transition-colors ${
                decision === d.value ? "border-indigo-500 bg-indigo-500/10" : "border-border hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-2 font-semibold text-foreground">
                <input type="radio" name="decision" value={d.value} checked={decision === d.value} onChange={() => setDecision(d.value)} />
                {d.value}
              </span>
              <span className="block text-xs text-muted-foreground mt-1">{d.hint}</span>
            </label>
          ))}
        </fieldset>
        <div>
          <label htmlFor="rationale" className="text-xs font-semibold text-foreground">
            Rationale (shared with your team and connected ATS)
          </label>
          <textarea
            id="rationale"
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={4}
            placeholder="What in the evidence supports this decision?"
            className="mt-1 w-full rounded-xl bg-card border border-border p-3 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <div className={`text-[11px] mt-1 ${rationaleLength >= MIN_RATIONALE ? "text-muted-foreground" : "text-amber-700 dark:text-amber-400"}`}>
            {rationaleLength}/{MIN_RATIONALE} characters minimum
          </div>
        </div>

        {submitError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-400 flex flex-wrap items-center gap-3">
            <AlertCircle className="w-4 h-4" />
            <span>{submitError}</span>
            {evidenceStale && (
              <button onClick={reload} className="px-3 py-1 rounded-lg border border-rose-500/40 text-xs font-semibold hover:bg-rose-500/10 cursor-pointer">
                Reload evidence
              </button>
            )}
          </div>
        )}
        {submitted && !submitError && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Decision recorded: {submitted}.
          </div>
        )}

        <button
          onClick={submitDecision}
          disabled={submitting || !decision || rationaleLength < MIN_RATIONALE}
          className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 cursor-pointer"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Submit decision
        </button>
      </section>
    </div>
  );
}

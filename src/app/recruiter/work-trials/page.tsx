"use client";

import React, { useEffect, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  EyeOff,
  FileCode,
  FlaskConical,
  GitBranch,
  ListChecks,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  WandSparkles,
  X,
  XCircle,
} from "lucide-react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, EmptyState, ErrorBanner, Loading, PageHeader, SuccessBanner, Tabs } from "@/components/career/ui";

type Language = "python" | "javascript" | "typescript";
type AiPolicy = "Prohibited" | "Allowed" | "Evaluated";

interface TrialRow {
  id: string;
  title: string;
  roleTitle: string;
  language: Language;
  aiPolicy: AiPolicy;
  status: string;
  sourceSummary: string;
  publishedSprintId: string | null;
  inviteCode: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

interface Redaction {
  file: string;
  line: number;
  kind: string;
}

interface Defect {
  id: string;
  title: string;
  category: string;
  explanation: string;
  file: string;
  search: string;
  replace: string;
  tests: string[];
}

interface RunSummary {
  exitCode: number;
  passed: number;
  total: number;
  tests: Record<string, boolean>;
  output: string;
}

interface TestOutcome {
  name: string;
  original: boolean | null;
  seeded: boolean | null;
}

interface Validation {
  ranAt: string;
  sandboxUnavailable: boolean;
  passed: boolean;
  runtime?: string | null;
  problems: string[];
  original?: RunSummary | null;
  seeded?: RunSummary | null;
  defects?: { id: string; title: string; ok: boolean; tests: TestOutcome[] }[];
  controlTests?: TestOutcome[];
  detail?: string;
}

interface CodeFile {
  name: string;
  content: string;
}

interface TrialDetail extends TrialRow {
  focusAreas: string[];
  companyId: string | null;
  redactions: Redaction[];
  sourceFiles: { name: string; lines: number }[];
  module: { files: string[]; rationale: string | null; entryFile: string | null };
  originalFiles: CodeFile[];
  seededFiles: CodeFile[];
  defects: Defect[];
  hiddenTests: string | null;
  hiddenTestFile: string;
  visibleDescription: string | null;
  validation: Validation | null;
  generationModel: string | null;
  generationNotes: string | null;
  candidateLink: string | null;
  publishedAt: string | null;
  forcePublishReason: string | null;
}

const LANGUAGE_EXTENSIONS: Record<Language, string> = {
  python: ".py",
  javascript: ".js,.cjs,.mjs",
  typescript: ".ts",
};

const AI_POLICY_LABELS: Record<AiPolicy, string> = {
  Prohibited: "Prohibited: no AI assistance",
  Allowed: "Allowed: built-in assistant, usage logged",
  Evaluated: "Evaluated: AI usage is part of the review",
};

const STATUS_TONES: Record<string, "neutral" | "good" | "warn" | "info"> = {
  Fetched: "neutral",
  Generated: "info",
  Validated: "good",
  ValidationFailed: "warn",
  Published: "good",
  Discarded: "neutral",
};

const STATUS_LABELS: Record<string, string> = {
  Fetched: "Source fetched",
  Generated: "Generated",
  Validated: "Validated",
  ValidationFailed: "Validation failed",
  Published: "Published",
  Discarded: "Discarded",
};

const inputClass =
  "mt-1 w-full rounded-lg bg-card border border-border px-3 py-2 text-sm font-normal text-foreground shadow-sm placeholder:text-muted-foreground";
const labelClass = "block text-sm font-medium text-foreground";
const sectionClass = "rounded-xl border border-border bg-card p-5 shadow-sm space-y-3";

async function errorMessage(res: Response, fallback: string) {
  try {
    const body = await res.json();
    if (body?.error) {
      const problems: string[] = Array.isArray(body.problems) ? body.problems : [];
      return problems.length > 0 ? `${body.error} ${problems.slice(0, 6).join(" ")}` : (body.error as string);
    }
  } catch {
    // non-JSON body
  }
  if (res.status === 401 || res.status === 403) return "You need recruiter access to manage work trials.";
  if (res.status === 429) return "Too many requests. Wait a minute and try again.";
  return `${fallback}. Please try again.`;
}

function StatusBadge({ status }: { status: string }) {
  const en = useEn();
  return (
<Badge tone={STATUS_TONES[status] ?? "neutral"}>{en(STATUS_LABELS[status] ?? status)}</Badge>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked; the value is still selectable
    }
  };
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 min-w-0 break-all rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs font-mono text-foreground select-all">{value}</code>
        <button type="button" onClick={copy} aria-label={`Copy ${label}`} className="shrink-0 p-2 rounded-lg border border-border bg-card shadow-sm hover:bg-muted cursor-pointer">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

function CodeBlock({ code, maxHeight = "max-h-96" }: { code: string; maxHeight?: string }) {
  return (
    <pre className={`text-xs font-mono overflow-auto ${maxHeight} rounded-lg border border-border bg-muted/40 p-3 text-foreground whitespace-pre`}>
      {code || " "}
    </pre>
  );
}

function DefectDiff({ defect }: { defect: Defect }) {
  const removed = defect.search.replace(/\n$/, "").split("\n");
  const added = defect.replace.replace(/\n$/, "").split("\n");
  return (
    <pre className="text-xs font-mono overflow-x-auto rounded-lg border border-border bg-muted/40 py-2">
      {removed.map((line, i) => (
        <div key={`d${i}`} className="px-3 whitespace-pre bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
          {"  original  "}
          {line || " "}
        </div>
      ))}
      {added.map((line, i) => (
        <div key={`a${i}`} className="px-3 whitespace-pre bg-red-500/10 text-red-800 dark:text-red-300">
          {"  seeded    "}
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

function ResultIcon({ value }: { value: boolean | null | undefined }) {
  const en = useEn();
  if (value === true) return <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" /> pass</span>;
  if (value === false) return <span className="inline-flex items-center gap-1 text-red-700 dark:text-red-400"><XCircle className="w-3 h-3" /> fail</span>;
  return <span className="text-muted-foreground">{en("not run")}</span>;
}

function Section({ title, icon, children, actions }: { title: string; icon: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={sectionClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
          {icon} {title}
        </h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// New work trial wizard
// ---------------------------------------------------------------------------

function NewTrialWizard({
  getToken,
  onCreated,
  onCancel,
}: {
  getToken: () => Promise<string | null>;
  onCreated: (detail: TrialDetail) => void;
  onCancel: () => void;
}) {
  const en = useEn();
  const [source, setSource] = useState<"github" | "files">("github");
  const [repository, setRepository] = useState("");
  const [branch, setBranch] = useState("");
  const [pathPrefix, setPathPrefix] = useState("");
  const [githubToken, setGithubToken] = useState("");
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [pasteName, setPasteName] = useState("");
  const [pasteContent, setPasteContent] = useState("");
  const [language, setLanguage] = useState<Language>("python");
  const [roleTitle, setRoleTitle] = useState("");
  const [focusAreas, setFocusAreas] = useState("");
  const [aiPolicy, setAiPolicy] = useState<AiPolicy>("Allowed");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addUploaded = async (list: FileList | null) => {
    if (!list) return;
    const read = await Promise.all(
      Array.from(list).map(async (f) => ({ name: (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name, content: await f.text() }))
    );
    setFiles((current) => [...current.filter((c) => !read.some((r) => r.name === c.name)), ...read]);
  };

  const addPasted = () => {
    const name = pasteName.trim();
    if (!name || !pasteContent) return;
    setFiles((current) => [...current.filter((c) => c.name !== name), { name, content: pasteContent }]);
    setPasteName("");
    setPasteContent("");
  };

  const focusList = focusAreas.split(",").map((f) => f.trim()).filter(Boolean);
  const canSubmit =
    consent &&
    roleTitle.trim().length > 0 &&
    focusList.length <= 8 &&
    (source === "github" ? repository.trim().length > 0 : files.length > 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        "/api/work-trials",
        {
          method: "POST",
          body: JSON.stringify({
            source,
            repository: source === "github" ? repository.trim() : undefined,
            branch: source === "github" && branch.trim() ? branch.trim() : undefined,
            pathPrefix: source === "github" && pathPrefix.trim() ? pathPrefix.trim() : undefined,
            githubToken: source === "github" && githubToken.trim() ? githubToken.trim() : undefined,
            files: source === "files" ? files : undefined,
            language,
            roleTitle: roleTitle.trim(),
            focusAreas: focusList,
            aiPolicy,
            consentToAiProcessing: consent,
          }),
        },
        getToken
      );
      // The token is only needed for this one request
      setGithubToken("");
      if (!res.ok) {
        setError(await errorMessage(res, "Could not fetch the source"));
        return;
      }
      onCreated((await res.json()) as TrialDetail);
    } catch {
      setError(en("We couldn't reach the server while fetching the source. Please check your connection and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <PageHeader
        title={en("New work trial")}
        description={en("Choose the code to start from and describe the role. Nothing is sent to an AI model until you click Generate on the next screen.")}
        actions={<Button type="button" variant="secondary" onClick={onCancel}><X className="w-4 h-4" />{en(" Cancel")}</Button>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title={en("1. Source code")} icon={<GitBranch className="w-4 h-4" />}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={en("Source")}>
            {(["github", "files"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={source === s}
                onClick={() => setSource(s)}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium cursor-pointer ${
                  source === s ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "github" ? en("GitHub repository") : en("Paste or upload files")}
              </button>
            ))}
          </div>

          {source === "github" ? (
            <div className="space-y-3">
              <label className={labelClass}>
                {en("Repository")}
                <input value={repository} onChange={(e) => setRepository(e.target.value)} placeholder={en("owner/repo or https://github.com/owner/repo")} className={inputClass} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={labelClass}>
                  {en("Branch (optional)")}
                  <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder={en("default branch")} className={inputClass} />
                </label>
                <label className={labelClass}>
                  {en("Path prefix (optional)")}
                  <input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} placeholder={en("e.g. services/billing")} className={inputClass} />
                </label>
              </div>
              <label className={labelClass}>
                {en("GitHub token (optional, needed for private repositories)")}
                <input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} autoComplete="off" placeholder={en("Fine-grained token with read-only Contents access")} className={inputClass} />
                <span className="mt-1 flex items-start gap-1.5 font-normal text-xs text-muted-foreground">
                  <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                  {en("Used once to read the files for this request, then discarded. It is never stored or logged. Prefer a short-lived, read-only token scoped to this repository.")}
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <label className={labelClass}>
                {en("Upload files")}
                <input
                  type="file"
                  multiple
                  accept={LANGUAGE_EXTENSIONS[language]}
                  onChange={(e) => {
                    void addUploaded(e.target.files);
                    e.target.value = "";
                  }}
                  className="mt-1 block w-full text-xs text-muted-foreground file:me-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground"
                />
              </label>
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-sm font-medium text-foreground">{en("Or paste a file")}</div>
                <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder={`path/to/file${LANGUAGE_EXTENSIONS[language].split(",")[0]}`} className={inputClass} aria-label={en("File name")} />
                <textarea value={pasteContent} onChange={(e) => setPasteContent(e.target.value)} rows={6} placeholder={en("File content")} className={`${inputClass} font-mono text-xs`} aria-label={en("File content")} />
                <Button type="button" variant="secondary" onClick={addPasted} disabled={!pasteName.trim() || !pasteContent}>
                  <Upload className="w-4 h-4" />{en(" Add file")}
                </Button>
              </div>
              {files.length > 0 && (
                <ul className="text-xs space-y-1">
                  {files.map((f) => (
                    <li key={f.name} className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1">
                      <span className="font-mono text-foreground break-all">{f.name}</span>
                      <span className="flex items-center gap-2 text-muted-foreground shrink-0">
                        {f.content.split("\n").length} lines
                        <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((c) => c.filter((x) => x.name !== f.name))} className="p-1 rounded hover:bg-muted cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {en("At most 60 files / 500 KB in the chosen language are used. Tests, vendored, generated and configuration files are skipped; .env, key and certificate files are always dropped.")}
          </p>
        </Section>

        <Section title={en("2. The role")} icon={<ListChecks className="w-4 h-4" />}>
          <label className={labelClass}>
            {en("Language")}
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={inputClass}>
              <option value="python">{en("Python")}</option>
              <option value="javascript">{en("JavaScript (Node.js)")}</option>
              <option value="typescript">{en("TypeScript (Node.js)")}</option>
            </select>
          </label>
          <label className={labelClass}>
            {en("Role title")}
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} maxLength={120} placeholder={en("e.g. Backend Engineer, Payments")} className={inputClass} />
          </label>
          <label className={labelClass}>
            {en("Focus areas (comma separated, up to 8)")}
            <input value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} placeholder={en("e.g. input validation, money handling, error handling")} className={inputClass} />
          </label>
          <label className={labelClass}>
            {en("AI policy for candidates")}
            <select value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as AiPolicy)} className={inputClass}>
              {(Object.keys(AI_POLICY_LABELS) as AiPolicy[]).map((p) => (
                <option key={p} value={p}>{en(AI_POLICY_LABELS[p])}</option>
              ))}
            </select>
          </label>
        </Section>
      </div>

      <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-3 dark:border-amber-900 dark:bg-amber-950/40">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-foreground space-y-1.5">
            <p className="font-semibold">{en("How your code is handled")}</p>
            <p>
              {en("Before anything leaves our servers, the fetched files are sanitized: secret files are dropped, and AWS keys, private-key blocks, bearer and API tokens, password/secret assignments, connection strings, email addresses and internal hostnames/IPs are redacted. You will see every redaction (file, line, kind) on the next screen.")}
            </p>
            <p>
              {en("Sanitization is pattern-based. It catches common formats but cannot guarantee that every secret or piece of personal data is found, so avoid pointing at code that embeds customer data.")}
            </p>
            <p>
              {en("When you click Generate, the sanitized code is sent to a third-party AI model to choose a module and plant defects. Drafts and the code they hold are deleted after 30 days if not published; publishing keeps only the seeded files the candidate needs.")}
            </p>
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm font-medium text-foreground cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          {en("I am authorized to share this code, and I agree that it is sanitized and then sent to an AI model to generate the work trial.")}
        </label>
      </div>

      <ErrorBanner error={error} />
      <Button type="submit" disabled={!canSubmit} busy={submitting} className="w-full sm:w-auto">
        {en(" Fetch and sanitize source")}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Review screen
// ---------------------------------------------------------------------------

function ValidationPanel({ validation }: { validation: Validation }) {
  const en = useEn();
  return (
    <div className="space-y-3">
      {validation.sandboxUnavailable ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-foreground flex items-start gap-2 dark:border-amber-900 dark:bg-amber-950/40">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>{en("Sandbox unavailable at {number}: the tests could not be run, so nothing was validated. Try again once the code sandbox is running.", { number: new Date(validation.ranAt).toLocaleString() })}</span>
        </div>
      ) : validation.passed ? (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-foreground flex items-start gap-2 dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            {en("Validated {number}{value}: all tests pass on the original module, each defect's tests fail on the seeded module, and the control tests still pass.", { number: new Date(validation.ranAt).toLocaleString(), value: validation.runtime ? ` on ${validation.runtime}` : "" })}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-foreground space-y-1 dark:border-red-900 dark:bg-red-950/40">
          <div className="flex items-center gap-2 font-semibold"><XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />{" "}{en("Validation failed ({number})", { number: new Date(validation.ranAt).toLocaleString() })}</div>
          <ul className="list-disc ps-6 space-y-0.5">
            {validation.problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <p className="text-muted-foreground">{en("Regenerate the trial, or publish anyway with a recorded reason if you have checked it yourself.")}</p>
        </div>
      )}

      {(validation.defects?.length ?? 0) + (validation.controlTests?.length ?? 0) > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-start text-muted-foreground border-b border-border">
                <th className="py-1.5 pe-3 font-medium">{en("Defect")}</th>
                <th className="py-1.5 pe-3 font-medium">{en("Test")}</th>
                <th className="py-1.5 pe-3 font-medium">{en("Original (expect pass)")}</th>
                <th className="py-1.5 font-medium">{en("Seeded")}</th>
              </tr>
            </thead>
            <tbody>
              {validation.defects?.flatMap((d) =>
                d.tests.map((t) => (
                  <tr key={`${d.id}-${t.name}`} className="border-b border-border last:border-0">
                    <td className="py-1.5 pe-3 text-foreground">
                      <span className="inline-flex items-center gap-1">{d.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-red-600" />} {d.id}</span>
                    </td>
                    <td className="py-1.5 pe-3 font-mono text-foreground">{t.name}</td>
                    <td className="py-1.5 pe-3"><ResultIcon value={t.original} /></td>
                    <td className="py-1.5"><ResultIcon value={t.seeded} /> <span className="text-muted-foreground">{en("(expect fail)")}</span></td>
                  </tr>
                ))
              )}
              {validation.controlTests?.map((t) => (
                <tr key={`ctrl-${t.name}`} className="border-b border-border last:border-0">
                  <td className="py-1.5 pe-3 text-muted-foreground">control</td>
                  <td className="py-1.5 pe-3 font-mono text-foreground">{t.name}</td>
                  <td className="py-1.5 pe-3"><ResultIcon value={t.original} /></td>
                  <td className="py-1.5"><ResultIcon value={t.seeded} /> <span className="text-muted-foreground">{en("(expect pass)")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {validation.original && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-foreground">{en("Output: original module ({passed}/{total} passed, exit {exitCode})", { passed: validation.original.passed, total: validation.original.total, exitCode: validation.original.exitCode })}</summary>
          <div className="mt-2"><CodeBlock code={validation.original.output} maxHeight="max-h-72" /></div>
        </details>
      )}
      {validation.seeded && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-foreground">{en("Output: seeded module ({passed}/{total} passed, exit {exitCode})", { passed: validation.seeded.passed, total: validation.seeded.total, exitCode: validation.seeded.exitCode })}</summary>
          <div className="mt-2"><CodeBlock code={validation.seeded.output} maxHeight="max-h-72" /></div>
        </details>
      )}
    </div>
  );
}

function TrialReview({
  initial,
  getToken,
  onBack,
  onChanged,
}: {
  initial: TrialDetail;
  getToken: () => Promise<string | null>;
  onBack: () => void;
  onChanged: () => void;
}) {
  const en = useEn();
  const [trial, setTrial] = useState<TrialDetail>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState(initial.title);
  const [roleTitle, setRoleTitle] = useState(initial.roleTitle);
  const [aiPolicy, setAiPolicy] = useState<AiPolicy>(initial.aiPolicy);
  const [description, setDescription] = useState(initial.visibleDescription ?? "");
  const [defectTitles, setDefectTitles] = useState<Record<string, string>>(() => Object.fromEntries(initial.defects.map((d) => [d.id, d.title])));
  const [forceReason, setForceReason] = useState("");
  const [showForce, setShowForce] = useState(false);
  const [fileTab, setFileTab] = useState<string | null>(null);

  const applyTrial = (t: TrialDetail) => {
    setTrial(t);
    setTitle(t.title);
    setRoleTitle(t.roleTitle);
    setAiPolicy(t.aiPolicy);
    setDescription(t.visibleDescription ?? "");
    setDefectTitles(Object.fromEntries(t.defects.map((d) => [d.id, d.title])));
    onChanged();
  };

  const run = async (action: string, path: string, init: RequestInit, success?: string) => {
    setBusy(action);
    setError(null);
    setNotice(null);
    try {
      const res = await authenticatedFetch(`/api/work-trials/${trial.id}${path}`, init, getToken);
      if (res.status === 503) {
        const body = await res.json().catch(() => null);
        if (body?.trial) applyTrial(body.trial as TrialDetail);
        setError(body?.error ?? "Sandbox unavailable.");
        return;
      }
      if (!res.ok) {
        setError(await errorMessage(res, `Could not ${action}`));
        return;
      }
      const body = await res.json();
      if (action === "discard") {
        setNotice(body?.message ?? "Discarded.");
        onChanged();
        onBack();
        return;
      }
      applyTrial(body as TrialDetail);
      if (success) setNotice(success);
    } catch {
      setError(en("We couldn't reach the server while trying to {action}. Please check your connection and try again.", { action }));
    } finally {
      setBusy(null);
    }
  };

  const generate = () =>
    run("generate", "/generate", { method: "POST" }, "Generated. Review the defects and tests, then validate in the sandbox.");
  const validate = () => run("validate", "/validate", { method: "POST" });
  const save = () =>
    run(
      "save",
      "",
      {
        method: "PUT",
        body: JSON.stringify({
          title: title.trim(),
          roleTitle: roleTitle.trim(),
          aiPolicy,
          visibleDescription: trial.status === "Fetched" ? undefined : description,
          defects: trial.defects.map((d) => ({ id: d.id, title: (defectTitles[d.id] ?? d.title).trim() })),
        }),
      },
      "Changes saved."
    );
  const publish = (force: boolean) =>
    run("publish", "/publish", { method: "POST", body: JSON.stringify(force ? { force: true, reason: forceReason.trim() } : {}) }, "Published as a private sprint.");
  const discard = () => {
    const published = trial.status === "Published";
    if (
      !window.confirm(
        published
          ? "Discard this draft and wipe its stored code? The published sprint keeps its own copy of the seeded files so invited candidates can still take it."
          : "Discard this draft and wipe its stored code? This cannot be undone."
      )
    )
      return;
    void run("discard", "", { method: "DELETE" });
  };

  const editable = trial.status !== "Published" && trial.status !== "Discarded";
  const generated = trial.defects.length > 0 || trial.seededFiles.length > 0;
  const dirty =
    title !== trial.title ||
    roleTitle !== trial.roleTitle ||
    aiPolicy !== trial.aiPolicy ||
    description !== (trial.visibleDescription ?? "") ||
    trial.defects.some((d) => (defectTitles[d.id] ?? d.title) !== d.title);
  const candidateUrl = trial.candidateLink ? `${typeof window !== "undefined" ? window.location.origin : ""}${trial.candidateLink}` : null;
  const activeFile = trial.seededFiles.find((f) => f.name === fileTab) ?? trial.seededFiles[0];
  const activeOriginal = activeFile ? trial.originalFiles.find((f) => f.name === activeFile.name) : undefined;

  return (
    <div className="space-y-5">
      <div>
        <button type="button" onClick={onBack} className="mb-3 text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer">
          <ArrowLeft className="w-4 h-4" />{en(" All work trials")}
        </button>
        <PageHeader
          title={trial.title}
          description={
            <span className="flex flex-wrap items-center gap-2">
              <StatusBadge status={trial.status} />
              {trial.generationModel === "dev-stub" && <Badge tone="warn">{en("Development stub output")}</Badge>}
              <span>
            {en("{roleTitle} · {language} · AI {value}{value2}", { roleTitle: trial.roleTitle, language: trial.language, value: trial.aiPolicy.toLowerCase(), value2: trial.status !== "Published" ? ` · draft deleted ${new Date(trial.expiresAt).toLocaleDateString()} unless published` : "" })}
              </span>
            </span>
          }
          actions={
            <>
              {editable && (
                <Button onClick={generate} disabled={busy !== null} variant={generated ? "secondary" : "primary"}>
                  {busy === "generate" ? <Loader2 className="w-4 h-4 animate-spin" /> : <WandSparkles className="w-4 h-4" />} {generated ? en("Regenerate") : en("Generate")}
                </Button>
              )}
              {editable && generated && (
                <Button onClick={validate} disabled={busy !== null} variant={trial.status === "Generated" ? "primary" : "secondary"}>
                  {busy === "validate" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}{en(" Validate in sandbox")}
                </Button>
              )}
              {editable && generated && (
                <Button onClick={() => (trial.status === "Validated" ? publish(false) : setShowForce((s) => !s))} disabled={busy !== null} variant={trial.status === "Validated" ? "primary" : "secondary"}>
                  {busy === "publish" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}{en(" Publish")}
                </Button>
              )}
              {trial.status !== "Discarded" && (
                <Button onClick={discard} disabled={busy !== null} variant="secondary" className="text-red-700 dark:text-red-400">
                  {busy === "discard" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}{en(" Discard")}
                </Button>
              )}
            </>
          }
        />
      </div>

      {busy === "generate" && (
        <p role="status" className="text-sm text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" />{en(" Generating. Selecting a module and planting defects can take a minute or two; the result is saved even if you leave this page.")}</p>
      )}
      {busy === "validate" && (
        <p role="status" className="text-sm text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-4 h-4 animate-spin" />{en(" Running the hidden tests against the original and the seeded module...")}</p>
      )}
      <ErrorBanner error={error} />
      <SuccessBanner message={notice} />

      {showForce && editable && trial.status !== "Validated" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5 space-y-3 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground">
              {en("This trial has not passed sandbox validation, so its hidden tests may not detect the planted defects (or may fail on correct code). Publishing anyway records your reason with the trial.")}
            </p>
          </div>
          <textarea value={forceReason} onChange={(e) => setForceReason(e.target.value)} rows={3} maxLength={1000} placeholder={en("Why is it safe to publish without a passing validation? (at least 10 characters)")} className={inputClass} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => publish(true)} disabled={busy !== null || forceReason.trim().length < 10}>
              <Send className="w-4 h-4" />{en(" Publish without validation")}
            </Button>
            <Button variant="secondary" onClick={() => setShowForce(false)}>{en("Cancel")}</Button>
          </div>
        </div>
      )}

      {trial.status === "Published" && trial.inviteCode && candidateUrl && (
        <div className={sectionClass}>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2"><ClipboardCheck className="w-4 h-4" />{en(" Published as a private sprint")}</h2>
          <p className="text-sm text-muted-foreground">
            {en("Share the link (or the invite code) with candidates. Submissions appear in Evidence packs, where a person reviews them and decides.{value}", { value: trial.forcePublishReason ? ` Published without a passing validation: "${trial.forcePublishReason}"` : "" })}
          </p>
          <CopyField label={en("Invite code")} value={trial.inviteCode} />
          <CopyField label={en("Candidate link")} value={candidateUrl} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title={en("Source and redactions")} icon={<EyeOff className="w-4 h-4" />}>
          <p className="text-xs text-foreground">{trial.sourceSummary}</p>
          {trial.redactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{en("No secrets or identifying details were detected by the sanitizer. Pattern-based detection can miss things; skim the files below before generating.")}</p>
          ) : (
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-start text-muted-foreground border-b border-border">
                    <th className="py-1.5 pe-3 font-medium">{en("File")}</th>
                    <th className="py-1.5 pe-3 font-medium">{en("Line")}</th>
                    <th className="py-1.5 font-medium">{en("Redacted")}</th>
                  </tr>
                </thead>
                <tbody>
                  {trial.redactions.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-1.5 pe-3 font-mono text-foreground break-all">{r.file}</td>
                      <td className="py-1.5 pe-3 text-muted-foreground">{r.line > 0 ? r.line : en("whole file")}</td>
                      <td className="py-1.5 text-foreground">{r.kind.replace(/-/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {trial.sourceFiles.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-foreground">{en("{length} sanitized source file(s) stored", { length: trial.sourceFiles.length })}</summary>
              <ul className="mt-2 space-y-0.5">
                {trial.sourceFiles.map((f) => (
                  <li key={f.name} className="flex justify-between gap-2"><span className="font-mono text-foreground break-all">{f.name}</span><span className="text-muted-foreground shrink-0">{f.lines} lines</span></li>
                ))}
              </ul>
            </details>
          )}
        </Section>

        <Section title={en("Selected module")} icon={<FileCode className="w-4 h-4" />}>
          {trial.module.files.length === 0 ? (
            <p className="text-xs text-muted-foreground">{en("Not generated yet. Generate to let the AI model choose a self-contained module of 2-5 files and plant defects.")}</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {trial.module.files.map((f) => (
                  <span key={f} className="px-2 py-0.5 rounded-md border border-border bg-muted text-xs font-mono text-foreground">
                    {f}{f === trial.module.entryFile ? en(" (entry)") : ""}
                  </span>
                ))}
              </div>
              {trial.module.rationale && <p className="text-xs text-foreground">{trial.module.rationale}</p>}
              {trial.generationNotes && <p className="text-xs text-muted-foreground"><span className="font-medium">{en("Changes made to run in a bare runtime:")}</span> {trial.generationNotes}</p>}
              {trial.generationModel && <p className="text-xs text-muted-foreground">{en("Generated by {value}. AI output: review it before publishing.", { value: trial.generationModel === "dev-stub" ? en("the development stub (no AI model configured)") : trial.generationModel })}</p>}
            </>
          )}
        </Section>
      </div>

      {trial.defects.length > 0 && (
        <Section title={`Planted defects (${trial.defects.length})`} icon={<Bug className="w-4 h-4" />}>
          <p className="text-xs text-muted-foreground">{en("Hidden from candidates. Titles are shown to reviewers in evidence packs.")}</p>
          <div className="space-y-4">
            {trial.defects.map((d) => (
              <div key={d.id} className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{d.id}</Badge>
                  {d.category && <Badge tone="info">{d.category}</Badge>}
                  <span className="text-xs font-mono text-muted-foreground">{d.file}</span>
                </div>
                {editable ? (
                  <input
                    value={defectTitles[d.id] ?? d.title}
                    onChange={(e) => setDefectTitles((t) => ({ ...t, [d.id]: e.target.value }))}
                    maxLength={200}
                    aria-label={`Title of defect ${d.id}`}
                    className={inputClass}
                  />
                ) : (
                  <p className="text-sm font-semibold text-foreground">{d.title}</p>
                )}
                {d.explanation && <p className="text-xs text-foreground">{d.explanation}</p>}
                <DefectDiff defect={d} />
                <p className="text-xs text-muted-foreground">
                  {en("Detected by: ")}{d.tests.map((t) => <code key={t} className="font-mono text-foreground me-1.5">{t}</code>)}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {trial.seededFiles.length > 0 && activeFile && (
        <Section title={en("Files candidates receive")} icon={<FileCode className="w-4 h-4" />}>
          <Tabs
            label={en("Files candidates receive")}
            value={activeFile.name}
            onChange={(name) => setFileTab(name)}
            items={trial.seededFiles.map((f) => ({ id: f.name, label: f.name }))}
          />
          <CodeBlock code={activeFile.content} />
          {activeOriginal && (
            <details className="text-xs">
              <summary className="cursor-pointer font-medium text-foreground">{en("Original (correct) version of {name}", { name: activeFile.name })}</summary>
              <div className="mt-2"><CodeBlock code={activeOriginal.content} /></div>
            </details>
          )}
          {trial.status === "Published" && <p className="text-xs text-muted-foreground">{en("The original module was deleted when the trial was published.")}</p>}
        </Section>
      )}

      {trial.hiddenTests && (
        <Section title={`Hidden tests (${trial.hiddenTestFile})`} icon={<Lock className="w-4 h-4" />}>
          <p className="text-xs text-muted-foreground">{en("Never shown to candidates. Run against each submission in the sandbox.")}</p>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium text-foreground">{en("Show test file")}</summary>
            <div className="mt-2"><CodeBlock code={trial.hiddenTests} /></div>
          </details>
        </Section>
      )}

      <Section
        title={en("Candidate-facing details")}
        icon={<ListChecks className="w-4 h-4" />}
        actions={
          editable ? (
            <Button variant="secondary" onClick={save} disabled={busy !== null || !dirty}>
              {busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{en(" Save changes")}
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className={labelClass}>
            {en("Title")}
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} maxLength={160} className={inputClass} />
          </label>
          <label className={labelClass}>
            {en("Role title")}
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} disabled={!editable} maxLength={120} className={inputClass} />
          </label>
          <label className={labelClass}>
            {en("AI policy")}
            <select value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as AiPolicy)} disabled={!editable} className={inputClass}>
              {(Object.keys(AI_POLICY_LABELS) as AiPolicy[]).map((p) => (
                <option key={p} value={p}>{en(AI_POLICY_LABELS[p])}</option>
              ))}
            </select>
          </label>
        </div>
        {trial.status === "Fetched" ? (
          <p className="text-xs text-muted-foreground">{en("The task description is written during generation; you can edit it afterwards.")}</p>
        ) : (
          <label className={labelClass}>
            {en("Task description (symptoms, not answers)")}
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!editable} rows={10} maxLength={8000} className={`${inputClass} font-normal`} />
            {editable && aiPolicy !== trial.aiPolicy && (
              <span className="mt-1 block font-normal text-xs text-amber-700 dark:text-amber-400">{en("The description may mention the previous AI policy; update the text to match.")}</span>
            )}
          </label>
        )}
      </Section>

      <Section title={en("Sandbox validation")} icon={<FlaskConical className="w-4 h-4" />}>
        {trial.validation ? (
          <ValidationPanel validation={trial.validation} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {generated
              ? en("Not validated yet. Validation runs the hidden tests against the original module (all must pass) and against the seeded module (each defect's tests must fail, all others pass).")
              : en("Generate the trial first.")}
          </p>
        )}
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WorkTrialsPage() {
  const en = useEn();
  const { getToken } = useAuth();

  const [rows, setRows] = useState<TrialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [showDiscarded, setShowDiscarded] = useState(false);

  const [mode, setMode] = useState<"list" | "new" | "review">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TrialDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await authenticatedFetch(`/api/work-trials${showDiscarded ? "?includeDiscarded=true" : ""}`, {}, getToken);
      if (!res.ok) throw new Error(await errorMessage(res, "Could not load work trials"));
      return (await res.json()) as TrialRow[];
    })()
      .then((data) => {
        if (!active) return;
        setRows(data);
        setError(null);
      })
      .catch((e) => active && setError(e instanceof Error ? e.message : "Could not load work trials."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [getToken, reloadKey, showDiscarded]);

  useEffect(() => {
    if (mode !== "review" || !selectedId) return;
    let active = true;
    (async () => {
      const res = await authenticatedFetch(`/api/work-trials/${selectedId}`, {}, getToken);
      if (!res.ok) throw new Error(await errorMessage(res, "Could not load the work trial"));
      return (await res.json()) as TrialDetail;
    })()
      .then((data) => {
        if (!active) return;
        setDetail(data);
        setDetailError(null);
      })
      .catch((e) => active && setDetailError(e instanceof Error ? e.message : "Could not load the work trial."));
    return () => {
      active = false;
    };
  }, [mode, selectedId, getToken]);

  const refresh = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const openTrial = (id: string) => {
    setDetailError(null);
    setSelectedId(id);
    setMode("review");
  };

  const backToList = () => {
    setMode("list");
    setSelectedId(null);
    setDetail(null);
    refresh();
  };

  if (mode === "new") {
    return (
      <NewTrialWizard
        getToken={getToken}
        onCancel={() => setMode("list")}
        onCreated={(d) => {
          setDetail(d);
          setSelectedId(d.id);
          setMode("review");
          refresh();
        }}
      />
    );
  }

  if (mode === "review" && selectedId) {
    if (detailError) {
      return (
        <div className="space-y-4">
          <button type="button" onClick={backToList} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"><ArrowLeft className="w-4 h-4" />{en(" All work trials")}</button>
          <ErrorBanner error={detailError} />
        </div>
      );
    }
    if (!detail || detail.id !== selectedId) {
      return (
<Loading label={en("Loading work trial...")} />
      );
    }
    return <TrialReview key={detail.id} initial={detail} getToken={getToken} onBack={backToList} onChanged={refresh} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Work trials from your own code")}
        description={
          <>
            <Badge tone="warn">{en("Beta")}</Badge>{" "}
            {en("Point at a part of your codebase and get a private brownfield task: a small module from your code with planted defects and hidden tests, checked in the sandbox before you publish. Because each trial is generated from your code and kept private, it is harder to find answers online than for a reused take-home. AI output: always review it before publishing.")}
          </>
        }
        actions={
          <>
            <Button variant="secondary" onClick={refresh}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />{en(" Refresh")}
            </Button>
            <Button onClick={() => setMode("new")}>
              <Plus className="w-4 h-4" />{en(" New work trial")}
            </Button>
          </>
        }
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={showDiscarded}
          onChange={(e) => {
            setLoading(true);
            setShowDiscarded(e.target.checked);
          }}
        />
        {en("Show discarded drafts")}
      </label>

      {loading && rows.length === 0 ? (
        <Loading label={en("Loading work trials...")} />
      ) : error ? (
        <ErrorBanner error={error} onRetry={refresh} />
      ) : rows.length === 0 ? (
        <EmptyState title={en("No work trials yet.")}>
          <Button onClick={() => setMode("new")}>
            <Plus className="w-4 h-4" />{en(" Create your first work trial")}
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => openTrial(r.id)}
              type="button"
              className="w-full text-start rounded-xl border border-border bg-card p-4 shadow-sm hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{r.title}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {en("{roleTitle} · {language} · AI {value} · updated {number}", { roleTitle: r.roleTitle, language: r.language, value: r.aiPolicy.toLowerCase(), number: new Date(r.updatedAt).toLocaleString() })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 break-words">{r.sourceSummary}</p>
                </div>
                {r.inviteCode && (
                  <span className="text-xs font-mono px-2 py-1 rounded-md border border-border bg-muted text-foreground">{r.inviteCode}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

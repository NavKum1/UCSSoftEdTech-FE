"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  AlertCircle,
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

const STATUS_STYLES: Record<string, string> = {
  Fetched: "border-border bg-muted text-muted-foreground",
  Generated: "border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  Validated: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  ValidationFailed: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Published: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  Discarded: "border-border bg-muted text-muted-foreground",
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
  "mt-1 w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";
const secondaryButton =
  "py-2 px-3 rounded-xl bg-card hover:bg-muted border border-border text-xs font-semibold text-foreground flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";
const primaryButton =
  "py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

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
  return `${fallback} (HTTP ${res.status}).`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${STATUS_STYLES[status] ?? STATUS_STYLES.Fetched}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
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
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className="flex-1 min-w-0 break-all rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs font-mono text-foreground select-all">{value}</code>
        <button onClick={copy} aria-label={`Copy ${label}`} className="shrink-0 p-2 rounded-lg border border-border bg-card hover:bg-muted cursor-pointer">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
        </button>
      </div>
    </div>
  );
}

function CodeBlock({ code, maxHeight = "max-h-96" }: { code: string; maxHeight?: string }) {
  return (
    <pre className={`text-xs font-mono overflow-auto ${maxHeight} rounded-xl border border-border bg-muted/30 p-3 text-foreground whitespace-pre`}>
      {code || " "}
    </pre>
  );
}

function DefectDiff({ defect }: { defect: Defect }) {
  const removed = defect.search.replace(/\n$/, "").split("\n");
  const added = defect.replace.replace(/\n$/, "").split("\n");
  return (
    <pre className="text-xs font-mono overflow-x-auto rounded-xl border border-border bg-muted/30 py-2">
      {removed.map((line, i) => (
        <div key={`d${i}`} className="px-3 whitespace-pre bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
          {"  original  "}
          {line || " "}
        </div>
      ))}
      {added.map((line, i) => (
        <div key={`a${i}`} className="px-3 whitespace-pre bg-rose-500/10 text-rose-800 dark:text-rose-300">
          {"  seeded    "}
          {line || " "}
        </div>
      ))}
    </pre>
  );
}

function ResultIcon({ value }: { value: boolean | null | undefined }) {
  if (value === true) return <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" /> pass</span>;
  if (value === false) return <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400"><XCircle className="w-3 h-3" /> fail</span>;
  return <span className="text-muted-foreground">not run</span>;
}

function Section({ title, icon, children, actions }: { title: string; icon: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="glass-panel rounded-2xl border border-border p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
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
      setError("Network error while fetching the source.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold text-foreground flex items-center gap-2"><Plus className="w-5 h-5" /> New work trial</h2>
        <button type="button" onClick={onCancel} className={secondaryButton}><X className="w-3.5 h-3.5" /> Cancel</button>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="1. Source code" icon={<GitBranch className="w-4 h-4" />}>
          <div className="flex gap-2" role="radiogroup" aria-label="Source">
            {(["github", "files"] as const).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={source === s}
                onClick={() => setSource(s)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold cursor-pointer ${
                  source === s ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {s === "github" ? "GitHub repository" : "Paste or upload files"}
              </button>
            ))}
          </div>

          {source === "github" ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-foreground">
                Repository
                <input value={repository} onChange={(e) => setRepository(e.target.value)} placeholder="owner/repo or https://github.com/owner/repo" className={inputClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-foreground">
                  Branch (optional)
                  <input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="default branch" className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-foreground">
                  Path prefix (optional)
                  <input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} placeholder="e.g. services/billing" className={inputClass} />
                </label>
              </div>
              <label className="block text-xs font-semibold text-foreground">
                GitHub token (optional, needed for private repositories)
                <input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} autoComplete="off" placeholder="Fine-grained token with read-only Contents access" className={inputClass} />
                <span className="mt-1 flex items-start gap-1.5 font-normal text-[11px] text-muted-foreground">
                  <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                  Used once to read the files for this request, then discarded. It is never stored or logged. Prefer a short-lived, read-only token scoped to this repository.
                </span>
              </label>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-foreground">
                Upload files
                <input
                  type="file"
                  multiple
                  accept={LANGUAGE_EXTENSIONS[language]}
                  onChange={(e) => {
                    void addUploaded(e.target.files);
                    e.target.value = "";
                  }}
                  className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-foreground"
                />
              </label>
              <div className="rounded-xl border border-border p-3 space-y-2">
                <div className="text-xs font-semibold text-foreground">Or paste a file</div>
                <input value={pasteName} onChange={(e) => setPasteName(e.target.value)} placeholder={`path/to/file${LANGUAGE_EXTENSIONS[language].split(",")[0]}`} className={inputClass} aria-label="File name" />
                <textarea value={pasteContent} onChange={(e) => setPasteContent(e.target.value)} rows={6} placeholder="File content" className={`${inputClass} font-mono text-xs`} aria-label="File content" />
                <button type="button" onClick={addPasted} disabled={!pasteName.trim() || !pasteContent} className={secondaryButton}>
                  <Upload className="w-3.5 h-3.5" /> Add file
                </button>
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
          <p className="text-[11px] text-muted-foreground">
            At most 60 files / 500 KB in the chosen language are used. Tests, vendored, generated and configuration files are skipped;
            .env, key and certificate files are always dropped.
          </p>
        </Section>

        <Section title="2. The role" icon={<ListChecks className="w-4 h-4" />}>
          <label className="block text-xs font-semibold text-foreground">
            Language
            <select value={language} onChange={(e) => setLanguage(e.target.value as Language)} className={inputClass}>
              <option value="python">Python</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="typescript">TypeScript (Node.js)</option>
            </select>
          </label>
          <label className="block text-xs font-semibold text-foreground">
            Role title
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} maxLength={120} placeholder="e.g. Backend Engineer, Payments" className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-foreground">
            Focus areas (comma separated, up to 8)
            <input value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} placeholder="e.g. input validation, money handling, error handling" className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-foreground">
            AI policy for candidates
            <select value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as AiPolicy)} className={inputClass}>
              {(Object.keys(AI_POLICY_LABELS) as AiPolicy[]).map((p) => (
                <option key={p} value={p}>{AI_POLICY_LABELS[p]}</option>
              ))}
            </select>
          </label>
        </Section>
      </div>

      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-foreground space-y-1.5">
            <p className="font-bold text-sm">How your code is handled</p>
            <p>
              Before anything leaves our servers, the fetched files are sanitized: secret files are dropped, and AWS keys, private-key blocks,
              bearer and API tokens, password/secret assignments, connection strings, email addresses and internal hostnames/IPs are redacted.
              You will see every redaction (file, line, kind) on the next screen.
            </p>
            <p>
              Sanitization is pattern-based. It catches common formats but cannot guarantee that every secret or piece of personal data is found,
              so avoid pointing at code that embeds customer data.
            </p>
            <p>
              When you click Generate, the sanitized code is sent to a third-party AI model to choose a module and plant defects. Drafts and the
              code they hold are deleted after 30 days if not published; publishing keeps only the seeded files the candidate needs.
            </p>
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs font-semibold text-foreground cursor-pointer">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
          I am authorised to share this code, and I agree that it is sanitized and then sent to an AI model to generate the work trial.
        </label>
      </div>

      {error && (
        <p className="text-xs text-rose-700 dark:text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}</p>
      )}
      <button type="submit" disabled={!canSubmit || submitting} className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer">
        {submitting && <Loader2 className="w-4 h-4 animate-spin" />} Fetch and sanitize source
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Review screen
// ---------------------------------------------------------------------------

function ValidationPanel({ validation }: { validation: Validation }) {
  return (
    <div className="space-y-3">
      {validation.sandboxUnavailable ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-xs text-foreground flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span>Sandbox unavailable at {new Date(validation.ranAt).toLocaleString()}: the tests could not be run, so nothing was validated. Try again once the code sandbox is running.</span>
        </div>
      ) : validation.passed ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-foreground flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>
            Validated {new Date(validation.ranAt).toLocaleString()}{validation.runtime ? ` on ${validation.runtime}` : ""}: all tests pass on the original module, each
            defect&apos;s tests fail on the seeded module, and the control tests still pass.
          </span>
        </div>
      ) : (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-foreground space-y-1">
          <div className="flex items-center gap-2 font-semibold"><XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" /> Validation failed ({new Date(validation.ranAt).toLocaleString()})</div>
          <ul className="list-disc pl-6 space-y-0.5">
            {validation.problems.map((p, i) => <li key={i}>{p}</li>)}
          </ul>
          <p className="text-muted-foreground">Regenerate the trial, or publish anyway with a recorded reason if you have checked it yourself.</p>
        </div>
      )}

      {(validation.defects?.length ?? 0) + (validation.controlTests?.length ?? 0) > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-1.5 pr-3 font-semibold">Defect</th>
                <th className="py-1.5 pr-3 font-semibold">Test</th>
                <th className="py-1.5 pr-3 font-semibold">Original (expect pass)</th>
                <th className="py-1.5 font-semibold">Seeded</th>
              </tr>
            </thead>
            <tbody>
              {validation.defects?.flatMap((d) =>
                d.tests.map((t) => (
                  <tr key={`${d.id}-${t.name}`} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-3 text-foreground">
                      <span className="inline-flex items-center gap-1">{d.ok ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : <XCircle className="w-3 h-3 text-rose-600" />} {d.id}</span>
                    </td>
                    <td className="py-1.5 pr-3 font-mono text-foreground">{t.name}</td>
                    <td className="py-1.5 pr-3"><ResultIcon value={t.original} /></td>
                    <td className="py-1.5"><ResultIcon value={t.seeded} /> <span className="text-muted-foreground">(expect fail)</span></td>
                  </tr>
                ))
              )}
              {validation.controlTests?.map((t) => (
                <tr key={`ctrl-${t.name}`} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-3 text-muted-foreground">control</td>
                  <td className="py-1.5 pr-3 font-mono text-foreground">{t.name}</td>
                  <td className="py-1.5 pr-3"><ResultIcon value={t.original} /></td>
                  <td className="py-1.5"><ResultIcon value={t.seeded} /> <span className="text-muted-foreground">(expect pass)</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {validation.original && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-foreground">Output: original module ({validation.original.passed}/{validation.original.total} passed, exit {validation.original.exitCode})</summary>
          <div className="mt-2"><CodeBlock code={validation.original.output} maxHeight="max-h-72" /></div>
        </details>
      )}
      {validation.seeded && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-foreground">Output: seeded module ({validation.seeded.passed}/{validation.seeded.total} passed, exit {validation.seeded.exitCode})</summary>
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
      setError(`Network error while trying to ${action}.`);
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
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-border">
        <div className="min-w-0">
          <button onClick={onBack} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> All work trials
          </button>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-foreground break-words">{trial.title}</h1>
            <StatusBadge status={trial.status} />
            {trial.generationModel === "dev-stub" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">Development stub output</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {trial.roleTitle} · {trial.language} · AI {trial.aiPolicy.toLowerCase()}
            {trial.status !== "Published" ? ` · draft deleted ${new Date(trial.expiresAt).toLocaleDateString()} unless published` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && (
            <button onClick={generate} disabled={busy !== null} className={generated ? secondaryButton : primaryButton}>
              {busy === "generate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <WandSparkles className="w-3.5 h-3.5" />} {generated ? "Regenerate" : "Generate"}
            </button>
          )}
          {editable && generated && (
            <button onClick={validate} disabled={busy !== null} className={trial.status === "Generated" ? primaryButton : secondaryButton}>
              {busy === "validate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />} Validate in sandbox
            </button>
          )}
          {editable && generated && (
            <button onClick={() => (trial.status === "Validated" ? publish(false) : setShowForce((s) => !s))} disabled={busy !== null} className={trial.status === "Validated" ? primaryButton : secondaryButton}>
              {busy === "publish" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Publish
            </button>
          )}
          {trial.status !== "Discarded" && (
            <button onClick={discard} disabled={busy !== null} className="py-2 px-3 rounded-xl border border-rose-500/30 bg-card hover:bg-rose-500/10 text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
              {busy === "discard" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Discard
            </button>
          )}
        </div>
      </div>

      {busy === "generate" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating. Selecting a module and planting defects can take a minute or two; the result is saved even if you leave this page.</p>
      )}
      {busy === "validate" && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Running the hidden tests against the original and the seeded module...</p>
      )}
      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" /> {error}</div>
      )}
      {notice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}</div>
      )}

      {showForce && editable && trial.status !== "Validated" && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground">
              This trial has not passed sandbox validation, so its hidden tests may not detect the planted defects (or may fail on correct code).
              Publishing anyway records your reason with the trial.
            </p>
          </div>
          <textarea value={forceReason} onChange={(e) => setForceReason(e.target.value)} rows={3} maxLength={1000} placeholder="Why is it safe to publish without a passing validation? (at least 10 characters)" className={inputClass} />
          <div className="flex gap-2">
            <button onClick={() => publish(true)} disabled={busy !== null || forceReason.trim().length < 10} className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
              <Send className="w-3.5 h-3.5" /> Publish without validation
            </button>
            <button onClick={() => setShowForce(false)} className={secondaryButton}>Cancel</button>
          </div>
        </div>
      )}

      {trial.status === "Published" && trial.inviteCode && candidateUrl && (
        <div className="rounded-2xl border border-purple-500/40 bg-purple-500/5 p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> Published as a private sprint</h2>
          <p className="text-xs text-muted-foreground">
            Share the link (or the invite code) with candidates. Submissions appear in Evidence packs, where a person reviews them and decides.
            {trial.forcePublishReason ? ` Published without a passing validation: "${trial.forcePublishReason}"` : ""}
          </p>
          <CopyField label="Invite code" value={trial.inviteCode} />
          <CopyField label="Candidate link" value={candidateUrl} />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="Source and redactions" icon={<EyeOff className="w-4 h-4" />}>
          <p className="text-xs text-foreground">{trial.sourceSummary}</p>
          {trial.redactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No secrets or identifying details were detected by the sanitizer. Pattern-based detection can miss things; skim the files below before generating.</p>
          ) : (
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-1.5 pr-3 font-semibold">File</th>
                    <th className="py-1.5 pr-3 font-semibold">Line</th>
                    <th className="py-1.5 font-semibold">Redacted</th>
                  </tr>
                </thead>
                <tbody>
                  {trial.redactions.map((r, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="py-1.5 pr-3 font-mono text-foreground break-all">{r.file}</td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{r.line > 0 ? r.line : "whole file"}</td>
                      <td className="py-1.5 text-foreground">{r.kind.replace(/-/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {trial.sourceFiles.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-foreground">{trial.sourceFiles.length} sanitized source file(s) stored</summary>
              <ul className="mt-2 space-y-0.5">
                {trial.sourceFiles.map((f) => (
                  <li key={f.name} className="flex justify-between gap-2"><span className="font-mono text-foreground break-all">{f.name}</span><span className="text-muted-foreground shrink-0">{f.lines} lines</span></li>
                ))}
              </ul>
            </details>
          )}
        </Section>

        <Section title="Selected module" icon={<FileCode className="w-4 h-4" />}>
          {trial.module.files.length === 0 ? (
            <p className="text-xs text-muted-foreground">Not generated yet. Generate to let the AI model choose a self-contained module of 2-5 files and plant defects.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {trial.module.files.map((f) => (
                  <span key={f} className="px-2 py-0.5 rounded-lg border border-border bg-muted text-[11px] font-mono text-foreground">
                    {f}{f === trial.module.entryFile ? " (entry)" : ""}
                  </span>
                ))}
              </div>
              {trial.module.rationale && <p className="text-xs text-foreground">{trial.module.rationale}</p>}
              {trial.generationNotes && <p className="text-xs text-muted-foreground"><span className="font-semibold">Changes made to run in a bare runtime:</span> {trial.generationNotes}</p>}
              {trial.generationModel && <p className="text-[11px] text-muted-foreground">Generated by {trial.generationModel === "dev-stub" ? "the development stub (no AI model configured)" : trial.generationModel}. AI output: review it before publishing.</p>}
            </>
          )}
        </Section>
      </div>

      {trial.defects.length > 0 && (
        <Section title={`Planted defects (${trial.defects.length})`} icon={<Bug className="w-4 h-4" />}>
          <p className="text-[11px] text-muted-foreground">Hidden from candidates. Titles are shown to reviewers in evidence packs.</p>
          <div className="space-y-4">
            {trial.defects.map((d) => (
              <div key={d.id} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border bg-muted text-muted-foreground">{d.id}</span>
                  {d.category && <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">{d.category}</span>}
                  <span className="text-[11px] font-mono text-muted-foreground">{d.file}</span>
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
                <p className="text-[11px] text-muted-foreground">
                  Detected by: {d.tests.map((t) => <code key={t} className="font-mono text-foreground mr-1.5">{t}</code>)}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {trial.seededFiles.length > 0 && activeFile && (
        <Section title="Files candidates receive" icon={<FileCode className="w-4 h-4" />}>
          <div className="flex flex-wrap gap-1.5" role="tablist">
            {trial.seededFiles.map((f) => (
              <button
                key={f.name}
                role="tab"
                aria-selected={f.name === activeFile.name}
                onClick={() => setFileTab(f.name)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono cursor-pointer ${f.name === activeFile.name ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-border bg-card text-muted-foreground hover:bg-muted"}`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <CodeBlock code={activeFile.content} />
          {activeOriginal && (
            <details className="text-xs">
              <summary className="cursor-pointer font-semibold text-foreground">Original (correct) version of {activeFile.name}</summary>
              <div className="mt-2"><CodeBlock code={activeOriginal.content} /></div>
            </details>
          )}
          {trial.status === "Published" && <p className="text-[11px] text-muted-foreground">The original module was deleted when the trial was published.</p>}
        </Section>
      )}

      {trial.hiddenTests && (
        <Section title={`Hidden tests (${trial.hiddenTestFile})`} icon={<Lock className="w-4 h-4" />}>
          <p className="text-[11px] text-muted-foreground">Never shown to candidates. Run against each submission in the sandbox.</p>
          <details className="text-xs">
            <summary className="cursor-pointer font-semibold text-foreground">Show test file</summary>
            <div className="mt-2"><CodeBlock code={trial.hiddenTests} /></div>
          </details>
        </Section>
      )}

      <Section
        title="Candidate-facing details"
        icon={<ListChecks className="w-4 h-4" />}
        actions={
          editable ? (
            <button onClick={save} disabled={busy !== null || !dirty} className={secondaryButton}>
              {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save changes
            </button>
          ) : undefined
        }
      >
        <div className="grid md:grid-cols-3 gap-3">
          <label className="block text-xs font-semibold text-foreground">
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} maxLength={160} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-foreground">
            Role title
            <input value={roleTitle} onChange={(e) => setRoleTitle(e.target.value)} disabled={!editable} maxLength={120} className={inputClass} />
          </label>
          <label className="block text-xs font-semibold text-foreground">
            AI policy
            <select value={aiPolicy} onChange={(e) => setAiPolicy(e.target.value as AiPolicy)} disabled={!editable} className={inputClass}>
              {(Object.keys(AI_POLICY_LABELS) as AiPolicy[]).map((p) => (
                <option key={p} value={p}>{AI_POLICY_LABELS[p]}</option>
              ))}
            </select>
          </label>
        </div>
        {trial.status === "Fetched" ? (
          <p className="text-xs text-muted-foreground">The task description is written during generation; you can edit it afterwards.</p>
        ) : (
          <label className="block text-xs font-semibold text-foreground">
            Task description (symptoms, not answers)
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={!editable} rows={10} maxLength={8000} className={`${inputClass} font-normal`} />
            {editable && aiPolicy !== trial.aiPolicy && (
              <span className="mt-1 block font-normal text-[11px] text-amber-700 dark:text-amber-400">The description may mention the previous AI policy; update the text to match.</span>
            )}
          </label>
        )}
      </Section>

      <Section title="Sandbox validation" icon={<FlaskConical className="w-4 h-4" />}>
        {trial.validation ? (
          <ValidationPanel validation={trial.validation} />
        ) : (
          <p className="text-xs text-muted-foreground">
            {generated
              ? "Not validated yet. Validation runs the hidden tests against the original module (all must pass) and against the seeded module (each defect's tests must fail, all others pass)."
              : "Generate the trial first."}
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
          <button onClick={backToList} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" /> All work trials</button>
          <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {detailError}</div>
        </div>
      );
    }
    if (!detail || detail.id !== selectedId) {
      return (
        <div className="glass-panel rounded-2xl border border-border p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading work trial...
        </div>
      );
    }
    return <TrialReview key={detail.id} initial={detail} getToken={getToken} onBack={backToList} onChanged={refresh} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
            <FlaskConical className="w-4 h-4" /> Work trials <span className="normal-case tracking-normal px-1.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]">Beta</span>
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mt-1">Work trials from your own code</h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Point at a part of your codebase and get a private brownfield task: a small module from your code with planted defects and hidden
            tests, checked in the sandbox before you publish. Because each trial is generated from your code and kept private, it is harder to
            find answers online than for a reused take-home. AI output: always review it before publishing.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button onClick={refresh} className={secondaryButton}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={() => setMode("new")} className={primaryButton}>
            <Plus className="w-3.5 h-3.5" /> New work trial
          </button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <input
          type="checkbox"
          checked={showDiscarded}
          onChange={(e) => {
            setLoading(true);
            setShowDiscarded(e.target.checked);
          }}
        />
        Show discarded drafts
      </label>

      {loading && rows.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-border p-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading work trials...
        </div>
      ) : error ? (
        <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-border p-8 text-center text-sm text-muted-foreground space-y-3">
          <p>No work trials yet.</p>
          <button onClick={() => setMode("new")} className={`${primaryButton} mx-auto`}>
            <Plus className="w-3.5 h-3.5" /> Create your first work trial
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <button
              key={r.id}
              onClick={() => openTrial(r.id)}
              className="w-full text-left glass-panel rounded-2xl border border-border p-4 hover:bg-muted/40 transition-colors cursor-pointer"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-foreground">{r.title}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {r.roleTitle} · {r.language} · AI {r.aiPolicy.toLowerCase()} · updated {new Date(r.updatedAt).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{r.sourceSummary}</p>
                </div>
                {r.inviteCode && (
                  <span className="text-[11px] font-mono px-2 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300">{r.inviteCode}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

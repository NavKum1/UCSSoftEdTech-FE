"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Download,
  GraduationCap,
  Info,
  Loader2,
  Plus,
  Send,
  Target,
  Trash2,
  Upload,
  Users,
} from "lucide-react";

type GetToken = () => Promise<string | null>;

interface Cohort {
  id: string;
  name: string;
  program: string;
  graduationYear: number;
  createdAt: string;
  memberCount: number;
  assignmentCount: number;
}

interface AssignmentRow {
  id: string;
  sprintId: string;
  sprintTitle: string;
  isPrivate: boolean;
  requiredLanguage?: string | null;
  opensAt: string;
  dueAt: string;
  createdAt: string;
}

interface CohortDetail extends Omit<Cohort, "assignmentCount"> {
  branches: { branch: string; count: number }[];
  assignments: AssignmentRow[];
}

interface Member {
  id: string;
  name: string;
  email: string;
  rollNumber: string;
  branch: string;
  linked: boolean;
  preferredLanguage?: string | null;
}

interface ImportResult {
  added: number;
  updated: number;
  unchanged: number;
  errors: { line: number; message: string }[];
}

interface SprintOption {
  sprintId: string;
  title: string;
  requiredLanguage?: string;
}

interface Distribution {
  n: number;
  mean: number | null;
  median: number | null;
  buckets: { label: string; count: number }[];
}

interface Funnel {
  invited: number;
  started: number;
  submitted: number;
  defended: number;
}

interface StudentRow {
  memberId: string;
  rollNumber: string;
  name: string;
  email: string;
  branch: string;
  status: string;
  late: boolean;
  testsPercent: number | null;
  defenseScore: number | null;
  combined: number | null;
  defenseMissing: boolean;
  readiness: string;
  languageLabel: string | null;
}

interface DashboardData {
  sprint: { id: string; title: string };
  weights: { tests: number; defense: number };
  funnel: Funnel;
  distributions: {
    overall: { tests: Distribution; defense: Distribution };
    byBranch: { branch: string; members: number; funnel: Funnel; tests: Distribution; defense: Distribution; readiness: Record<string, number> }[];
  };
  integrityReview: Record<string, number>;
  readiness: { counts: Record<string, number>; students: StudentRow[] };
  notes: string[];
}

interface MappingRow {
  rowId: number;
  outcomeCode: string;
  measure: string;
  weight: number;
}

interface AttainmentData {
  target: number;
  thresholds: { level3: number; level2: number; level1: number };
  usingDefaultMappings: boolean;
  outcomes: {
    outcomeCode: string;
    title: string;
    measure: string;
    weight: number;
    assessed: number;
    atOrAboveTarget: number;
    percentAtOrAboveTarget: number | null;
    attainmentLevel: number | null;
  }[];
  measures: Record<string, string>;
  note: string;
}

interface Loaded<T> {
  key: string;
  data: T | null;
  error: string | null;
}

const BANDS = ["Ready", "Nearly ready", "Needs practice", "Awaiting results", "Not attempted"];
const BAND_CLASS: Record<string, string> = {
  Ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  "Nearly ready": "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  "Needs practice": "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300",
  "Awaiting results": "border-border bg-muted text-muted-foreground",
  "Not attempted": "border-border bg-muted text-muted-foreground",
};
const STATUS_LABEL: Record<string, string> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  submitted: "Submitted",
  defended: "Defended",
};
const PO_CODES = Array.from({ length: 12 }, (_, i) => `PO${i + 1}`);
const PSO_CODES = Array.from({ length: 9 }, (_, i) => `PSO${i + 1}`);

const inputClass = "w-full rounded-xl bg-card border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground";
const buttonClass =
  "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold cursor-pointer";
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted disabled:opacity-50 text-xs font-semibold text-foreground cursor-pointer";

async function apiJson<T>(path: string, getToken: GetToken, init: RequestInit = {}): Promise<T> {
  const res = await authenticatedFetch(path, init, getToken);
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401) throw new Error("Please sign in with your placement cell account.");
  if (!res.ok) throw new Error(body?.error || (res.status === 403 ? "You need institute admin access." : "Something went wrong on our side. Please try again."));
  return body as T;
}

async function downloadAuthed(path: string, fallbackName: string, getToken: GetToken) {
  const res = await authenticatedFetch(path, {}, getToken);
  if (!res.ok) throw new Error("We couldn't download the file. Please try again.");
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = match ? decodeURIComponent(match[1]) : fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}

function errorText(e: unknown, fallback: string) {
  return e instanceof Error && !(e instanceof TypeError) ? e.message : fallback;
}

function fmt(v: number | null | undefined, suffix = "") {
  return v == null ? "—" : `${Math.round(v * 10) / 10}${suffix}`;
}

function Message({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p className={`text-xs flex items-start gap-1.5 ${ok ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
      {ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />} {text}
    </p>
  );
}

function Spinner({ text }: { text: string }) {
  return (
    <p className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="w-4 h-4 animate-spin" /> {text}
    </p>
  );
}

export default function CampusAdminPage() {
  const { getToken } = useAuth();
  const [version, setVersion] = useState(0);
  const [cohorts, setCohorts] = useState<Loaded<Cohort[]> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [program, setProgram] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear() + 1));
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const key = String(version);
  useEffect(() => {
    let active = true;
    apiJson<{ cohorts: Cohort[] }>("/api/campus/cohorts", getToken)
      .then((d) => active && setCohorts({ key, data: d.cohorts, error: null }))
      .catch((e) => active && setCohorts({ key, data: null, error: errorText(e, "Could not load cohorts.") }));
    return () => {
      active = false;
    };
  }, [getToken, key]);

  const list = cohorts?.data ?? [];
  const activeId = selectedId ?? list[0]?.id ?? null;

  const createCohort = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateMessage(null);
    try {
      const created = await apiJson<Cohort>("/api/campus/cohorts", getToken, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), program: program.trim(), graduationYear: Number(year) }),
      });
      setName("");
      setProgram("");
      setSelectedId(created.id);
      setVersion((v) => v + 1);
      setCreateMessage({ ok: true, text: `Created ${created.name}.` });
    } catch (err) {
      setCreateMessage({ ok: false, text: errorText(err, "Could not create the cohort.") });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="pb-4 border-b border-border">
        <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
          <GraduationCap className="w-4 h-4" /> Placement cell
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-foreground mt-1">Campus cohorts and readiness</h1>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
          Import students, assign coding sprints with a voice defense, follow completion, and export readiness and NBA outcome evidence.
          Results support your planning; they do not decide who may sit for a placement drive.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="glass-panel rounded-2xl border border-border p-4 space-y-2">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Users className="w-4 h-4" /> Cohorts</h2>
            {!cohorts || cohorts.key !== key ? (
              <Spinner text="Loading..." />
            ) : cohorts.error ? (
              <Message ok={false} text={cohorts.error} />
            ) : list.length === 0 ? (
              <p className="text-xs text-muted-foreground">No cohorts yet. Create one below.</p>
            ) : (
              <ul className="space-y-1.5">
                {list.map((c) => (
                  <li key={c.id}>
                    <button
                      onClick={() => setSelectedId(c.id)}
                      className={`w-full text-left rounded-xl border px-3 py-2 cursor-pointer ${
                        c.id === activeId ? "border-indigo-500/50 bg-indigo-500/10" : "border-border bg-card/60 hover:bg-muted"
                      }`}
                    >
                      <span className="block text-sm font-semibold text-foreground truncate">{c.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {[c.program, c.graduationYear].filter(Boolean).join(" · ")} · {c.memberCount} students · {c.assignmentCount} sprints
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <form onSubmit={createCohort} className="glass-panel rounded-2xl border border-border p-4 space-y-2">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2"><Plus className="w-4 h-4" /> New cohort</h2>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name, e.g. CSE 2027 batch" required maxLength={120} />
            <input className={inputClass} value={program} onChange={(e) => setProgram(e.target.value)} placeholder="Program, e.g. B.Tech CSE" maxLength={120} />
            <input className={inputClass} value={year} onChange={(e) => setYear(e.target.value)} type="number" min={2000} max={2100} placeholder="Graduation year" required />
            <button type="submit" disabled={creating || !name.trim()} className={`${buttonClass} w-full`}>
              {creating && <Loader2 className="w-4 h-4 animate-spin" />} Create cohort
            </button>
            {createMessage && <Message {...createMessage} />}
          </form>
        </aside>

        <section className="min-w-0">
          {activeId ? (
            <CohortPanel
              key={activeId}
              cohortId={activeId}
              getToken={getToken}
              onChanged={() => setVersion((v) => v + 1)}
              onDeleted={() => {
                setSelectedId(null);
                setVersion((v) => v + 1);
              }}
            />
          ) : (
            cohorts?.data && (
              <div className="glass-panel rounded-2xl border border-border p-6 text-sm text-muted-foreground">Create a cohort to get started.</div>
            )
          )}
        </section>
      </div>
    </div>
  );
}

type Tab = "members" | "assign" | "dashboard" | "outcomes";

function CohortPanel({ cohortId, getToken, onChanged, onDeleted }: { cohortId: string; getToken: GetToken; onChanged: () => void; onDeleted: () => void }) {
  const [version, setVersion] = useState(0);
  const [detail, setDetail] = useState<Loaded<CohortDetail> | null>(null);
  const [tab, setTab] = useState<Tab>("members");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const key = `${cohortId}|${version}`;
  useEffect(() => {
    let active = true;
    apiJson<CohortDetail>(`/api/campus/cohorts/${cohortId}`, getToken)
      .then((d) => active && setDetail({ key, data: d, error: null }))
      .catch((e) => active && setDetail({ key, data: null, error: errorText(e, "Could not load the cohort.") }));
    return () => {
      active = false;
    };
  }, [getToken, cohortId, key]);

  const refresh = () => {
    setVersion((v) => v + 1);
    onChanged();
  };

  const deleteCohort = async () => {
    if (!detail?.data || !window.confirm(`Delete ${detail.data.name} with its ${detail.data.memberCount} students and assignments? Students' own results are not deleted.`)) return;
    try {
      await apiJson(`/api/campus/cohorts/${cohortId}`, getToken, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setDeleteError(errorText(e, "Could not delete the cohort."));
    }
  };

  if (!detail) return <div className="glass-panel rounded-2xl border border-border p-6"><Spinner text="Loading cohort..." /></div>;
  if (detail.error) return <div className="glass-panel rounded-2xl border border-border p-6"><Message ok={false} text={detail.error} /></div>;
  const d = detail.data!;

  const tabs: { id: Tab; label: string }[] = [
    { id: "members", label: `Students (${d.memberCount})` },
    { id: "assign", label: `Sprints (${d.assignments.length})` },
    { id: "dashboard", label: "Dashboard" },
    { id: "outcomes", label: "NBA outcomes" },
  ];

  return (
    <div className="glass-panel rounded-2xl border border-border p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-foreground break-words">{d.name}</h2>
          <p className="text-xs text-muted-foreground">
            {[d.program, d.graduationYear].filter(Boolean).join(" · ")}
            {d.branches.length > 0 && ` · ${d.branches.map((b) => `${b.branch} ${b.count}`).join(", ")}`}
          </p>
        </div>
        <button onClick={deleteCohort} className={`${secondaryButtonClass} text-rose-700 dark:text-rose-400`}>
          <Trash2 className="w-3.5 h-3.5" /> Delete cohort
        </button>
      </div>
      {deleteError && <Message ok={false} text={deleteError} />}

      <div className="flex gap-1 overflow-x-auto border-b border-border -mx-1 px-1" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px cursor-pointer ${
              tab === t.id ? "border-indigo-600 text-indigo-700 dark:text-indigo-300" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "members" && <MembersTab cohortId={cohortId} getToken={getToken} onChanged={refresh} />}
      {tab === "assign" && <AssignTab cohortId={cohortId} assignments={d.assignments} getToken={getToken} onChanged={refresh} />}
      {tab === "dashboard" && <DashboardTab cohortId={cohortId} assignments={d.assignments} getToken={getToken} />}
      {tab === "outcomes" && <OutcomesTab cohortId={cohortId} assignments={d.assignments} getToken={getToken} />}
    </div>
  );
}

const PAGE_SIZE = 50;

function MembersTab({ cohortId, getToken, onChanged }: { cohortId: string; getToken: GetToken; onChanged: () => void }) {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [version, setVersion] = useState(0);
  const [members, setMembers] = useState<Loaded<{ total: number; members: Member[] }> | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const key = `${query}|${page}|${version}`;
  useEffect(() => {
    let active = true;
    const qs = new URLSearchParams({ skip: String(page * PAGE_SIZE), take: String(PAGE_SIZE) });
    if (query) qs.set("search", query);
    apiJson<{ total: number; members: Member[] }>(`/api/campus/cohorts/${cohortId}/members?${qs}`, getToken)
      .then((d) => active && setMembers({ key, data: d, error: null }))
      .catch((e) => active && setMembers({ key, data: null, error: errorText(e, "Could not load students.") }));
    return () => {
      active = false;
    };
  }, [getToken, cohortId, key, page, query]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4_000_000) {
      setImportError("That file is larger than 4 MB. Split it into smaller files (up to 5,000 rows each).");
      return;
    }
    setFileName(file.name);
    setCsv(await file.text());
  };

  const runImport = async () => {
    setImporting(true);
    setImportResult(null);
    setImportError(null);
    try {
      const res = await authenticatedFetch(
        `/api/campus/cohorts/${cohortId}/members/import`,
        { method: "POST", headers: { "Content-Type": "text/csv; charset=utf-8" }, body: csv },
        getToken
      );
      const body = (await res.json().catch(() => null)) as (ImportResult & { error?: string }) | null;
      if (body && Array.isArray(body.errors)) {
        setImportResult(body);
        if (res.ok) {
          setVersion((v) => v + 1);
          onChanged();
        }
      } else {
        setImportError(body?.error || "We couldn't import the file. Please check it and try again.");
      }
    } catch {
      setImportError("Network error during import.");
    } finally {
      setImporting(false);
    }
  };

  const removeMember = async (m: Member) => {
    if (!window.confirm(`Remove ${m.name} (${m.email}) from this cohort?`)) return;
    setRowError(null);
    try {
      await apiJson(`/api/campus/cohorts/${cohortId}/members/${m.id}`, getToken, { method: "DELETE" });
      setVersion((v) => v + 1);
      onChanged();
    } catch (e) {
      setRowError(errorText(e, "Could not remove the student."));
    }
  };

  const total = members?.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Upload className="w-4 h-4" /> Import students from CSV</h3>
        <p className="text-xs text-muted-foreground">
          Header row: <code className="font-mono">name,email,roll_number,branch</code>. Other columns are ignored. Up to 5,000 rows per file; existing students
          (same email) are updated.
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <label className={`${secondaryButtonClass} w-full sm:w-auto`}>
            <Upload className="w-3.5 h-3.5" /> Choose file
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="sr-only" />
          </label>
          {fileName && <span className="text-xs text-muted-foreground truncate">{fileName}</span>}
        </div>
        <textarea
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setFileName(null);
          }}
          rows={5}
          placeholder={"name,email,roll_number,branch\nPriya Sharma,priya@college.edu,21CS001,CSE"}
          className={`${inputClass} font-mono text-xs`}
        />
        <button onClick={runImport} disabled={importing || !csv.trim()} className={buttonClass}>
          {importing && <Loader2 className="w-4 h-4 animate-spin" />} Import
        </button>
        {importError && <Message ok={false} text={importError} />}
        {importResult && (
          <div className="space-y-2">
            <Message
              ok={importResult.errors.length === 0}
              text={`${importResult.added} added, ${importResult.updated} updated, ${importResult.unchanged} unchanged, ${importResult.errors.length} row${importResult.errors.length === 1 ? "" : "s"} with problems.`}
            />
            {importResult.errors.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card">
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-1.5 px-2 font-semibold">Line</th>
                      <th className="py-1.5 px-2 font-semibold">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importResult.errors.map((e, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="py-1.5 px-2 font-mono text-foreground">{e.line}</td>
                        <td className="py-1.5 px-2 text-foreground">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(0);
            setQuery(search.trim());
          }}
        >
          <input className={inputClass} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, roll number or branch" />
          <button type="submit" className={secondaryButtonClass}>Search</button>
        </form>
        {rowError && <Message ok={false} text={rowError} />}
        {!members || members.key !== key ? (
          <Spinner text="Loading students..." />
        ) : members.error ? (
          <Message ok={false} text={members.error} />
        ) : members.data!.members.length === 0 ? (
          <p className="text-xs text-muted-foreground">{query ? "No students match that search." : "No students yet. Import a CSV above."}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Roll no.</th>
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold hidden sm:table-cell">Email</th>
                    <th className="py-2 pr-3 font-semibold">Branch</th>
                    <th className="py-2 pr-3 font-semibold hidden md:table-cell">Signed in</th>
                    <th className="py-2 font-semibold"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {members.data!.members.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-mono text-xs text-foreground">{m.rollNumber || "—"}</td>
                      <td className="py-2 pr-3 text-foreground">
                        {m.name}
                        <span className="block sm:hidden text-[11px] text-muted-foreground break-all">{m.email}</span>
                      </td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground hidden sm:table-cell break-all">{m.email}</td>
                      <td className="py-2 pr-3 text-xs text-foreground">{m.branch || "—"}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground hidden md:table-cell">{m.linked ? "Yes" : "Not yet"}</td>
                      <td className="py-2 text-right">
                        <button onClick={() => removeMember(m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 cursor-pointer" aria-label={`Remove ${m.name}`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{total} student{total === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-2">
                <button className={secondaryButtonClass} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>{page + 1} / {pages}</span>
                <button className={secondaryButtonClass} disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function AssignTab({ cohortId, assignments, getToken, onChanged }: { cohortId: string; assignments: AssignmentRow[]; getToken: GetToken; onChanged: () => void }) {
  const [sprints, setSprints] = useState<SprintOption[] | null>(null);
  const [sprintId, setSprintId] = useState("");
  const [manualId, setManualId] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [opensAt, setOpensAt] = useState(() => toLocalInput(new Date()));
  const [dueAt, setDueAt] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    d.setHours(23, 59, 0, 0);
    return toLocalInput(d);
  });
  const [sendInvites, setSendInvites] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    apiJson<{ sprints: SprintOption[] }>("/api/sprint", getToken)
      .then((d) => active && setSprints(d.sprints ?? []))
      .catch(() => active && setSprints([]));
    return () => {
      active = false;
    };
  }, [getToken]);

  const chosen = manualId.trim() || sprintId;
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const assign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guidPattern.test(chosen)) {
      setMessage({ ok: false, text: "Pick a sprint or paste a valid sprint id." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const result = await apiJson<{ created: boolean; assignment: { sprintTitle: string }; invites: { sent: number; failed: number; skipped: number } | null }>(
        `/api/campus/cohorts/${cohortId}/assignments`,
        getToken,
        {
          method: "POST",
          body: JSON.stringify({
            sprintId: chosen,
            opensAt: new Date(opensAt).toISOString(),
            dueAt: new Date(dueAt).toISOString(),
            sendInvites,
            inviteCode: inviteCode.trim() || null,
          }),
        }
      );
      const inv = result.invites;
      setMessage({
        ok: !inv || inv.failed === 0,
        text:
          `${result.created ? "Assigned" : "Updated"} ${result.assignment.sprintTitle}.` +
          (inv ? ` Emails: ${inv.sent} sent, ${inv.failed} failed, ${inv.skipped} skipped.` : " No emails sent."),
      });
      setManualId("");
      setInviteCode("");
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: errorText(err, "Could not assign the sprint.") });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: AssignmentRow) => {
    if (!window.confirm(`Remove ${a.sprintTitle} from this cohort? Students' submissions are kept.`)) return;
    try {
      await apiJson(`/api/campus/cohorts/${cohortId}/assignments/${a.id}`, getToken, { method: "DELETE" });
      onChanged();
    } catch (err) {
      setMessage({ ok: false, text: errorText(err, "Could not remove the assignment.") });
    }
  };

  return (
    <div className="space-y-5">
      <form onSubmit={assign} className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Send className="w-4 h-4" /> Assign a sprint</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold text-foreground">
            Public sprint
            <select className={`${inputClass} mt-1`} value={sprintId} onChange={(e) => setSprintId(e.target.value)} disabled={!sprints}>
              <option value="">{sprints ? "Choose a sprint" : "Loading..."}</option>
              {(sprints ?? []).map((s) => (
                <option key={s.sprintId} value={s.sprintId}>
                  {s.title}
                  {s.requiredLanguage ? ` (${s.requiredLanguage})` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold text-foreground">
            Or a private sprint id
            <input className={`${inputClass} mt-1 font-mono text-xs`} value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
          </label>
          {manualId.trim() && (
            <label className="block text-xs font-semibold text-foreground sm:col-span-2">
              Invite code (needed for private sprints owned by another organisation)
              <input className={`${inputClass} mt-1`} value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} />
            </label>
          )}
          <label className="block text-xs font-semibold text-foreground">
            Opens
            <input type="datetime-local" className={`${inputClass} mt-1`} value={opensAt} onChange={(e) => setOpensAt(e.target.value)} required />
          </label>
          <label className="block text-xs font-semibold text-foreground">
            Due
            <input type="datetime-local" className={`${inputClass} mt-1`} value={dueAt} onChange={(e) => setDueAt(e.target.value)} required />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-foreground">
          <input type="checkbox" checked={sendInvites} onChange={(e) => setSendInvites(e.target.checked)} /> Email every student the link and due date
        </label>
        <p className="text-[11px] text-muted-foreground">
          Only work students start after you assign the sprint counts on the dashboard. Assigning the same sprint again updates its dates.
        </p>
        <button type="submit" disabled={saving || !chosen} className={buttonClass}>
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} {saving && sendInvites ? "Assigning and emailing..." : "Assign"}
        </button>
        {message && <Message {...message} />}
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-bold text-foreground">Assigned sprints</h3>
        {assignments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing assigned yet.</p>
        ) : (
          <ul className="space-y-2">
            {assignments.map((a) => (
              <li key={a.id} className="rounded-xl border border-border bg-card/60 p-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground break-words">
                    {a.sprintTitle} {a.isPrivate && <span className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground align-middle">private</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Opens {formatDate(a.opensAt)} · Due {formatDate(a.dueAt)}</p>
                </div>
                <button onClick={() => remove(a)} className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 cursor-pointer" aria-label={`Remove ${a.sprintTitle}`}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SprintPicker({ assignments, value, onChange }: { assignments: AssignmentRow[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
      Sprint
      <select className="px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground max-w-full" value={value} onChange={(e) => onChange(e.target.value)}>
        {assignments.map((a) => (
          <option key={a.sprintId} value={a.sprintId}>{a.sprintTitle}</option>
        ))}
      </select>
    </label>
  );
}

function FunnelBars({ funnel }: { funnel: Funnel }) {
  const steps: [string, number][] = [
    ["Invited", funnel.invited],
    ["Started", funnel.started],
    ["Submitted", funnel.submitted],
    ["Defended", funnel.defended],
  ];
  const max = Math.max(1, funnel.invited);
  return (
    <div className="space-y-2">
      {steps.map(([label, value]) => {
        const pct = Math.round((100 * value) / max);
        return (
          <div key={label} className="grid grid-cols-[72px_1fr_64px] items-center gap-2 text-xs" title={`${label}: ${value} of ${funnel.invited} (${pct}%)`}>
            <span className="text-muted-foreground">{label}</span>
            <div className="h-3 rounded bg-muted overflow-hidden">
              <div className="h-full rounded-r bg-indigo-500 dark:bg-indigo-400" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-right text-foreground font-semibold tabular-nums">
              {value} <span className="text-muted-foreground font-normal">{pct}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Histogram({ title, dist, suffix }: { title: string; dist: Distribution; suffix: string }) {
  const max = Math.max(1, ...dist.buckets.map((b) => b.count));
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-bold text-foreground">{title}</h4>
        <span className="text-[11px] text-muted-foreground">
          n {dist.n} · mean {fmt(dist.mean, suffix)} · median {fmt(dist.median, suffix)}
        </span>
      </div>
      {dist.n === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">No results yet.</p>
      ) : (
        <div className="flex items-end gap-1.5 h-24" role="img" aria-label={`${title}: ${dist.buckets.map((b) => `${b.label} ${b.count}`).join(", ")}`}>
          {dist.buckets.map((b) => (
            <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${b.label}: ${b.count} student${b.count === 1 ? "" : "s"}`}>
              <span className="text-[10px] text-foreground tabular-nums">{b.count > 0 ? b.count : ""}</span>
              <div className="w-full rounded-t bg-indigo-500 dark:bg-indigo-400" style={{ height: `${(70 * b.count) / max}%`, minHeight: b.count > 0 ? 2 : 0 }} />
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        {dist.buckets.map((b) => (
          <span key={b.label} className="flex-1 text-center text-[10px] text-muted-foreground">{b.label}</span>
        ))}
      </div>
    </div>
  );
}

function DashboardTab({ cohortId, assignments, getToken }: { cohortId: string; assignments: AssignmentRow[]; getToken: GetToken }) {
  const [sprintId, setSprintId] = useState(assignments[0]?.sprintId ?? "");
  const [dashboard, setDashboard] = useState<Loaded<DashboardData> | null>(null);
  const [band, setBand] = useState("");
  const [page, setPage] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const key = `${cohortId}|${sprintId}`;
  useEffect(() => {
    if (!sprintId) return;
    let active = true;
    apiJson<DashboardData>(`/api/campus/cohorts/${cohortId}/dashboard?sprintId=${sprintId}`, getToken)
      .then((d) => active && setDashboard({ key, data: d, error: null }))
      .catch((e) => active && setDashboard({ key, data: null, error: errorText(e, "Could not load the dashboard.") }));
    return () => {
      active = false;
    };
  }, [getToken, cohortId, sprintId, key]);

  const students = useMemo(
    () => (dashboard?.data?.readiness.students ?? []).filter((s) => !band || s.readiness === band),
    [dashboard, band]
  );

  if (assignments.length === 0) return <p className="text-sm text-muted-foreground">Assign a sprint to see the dashboard.</p>;

  const download = () => {
    setDownloadError(null);
    downloadAuthed(`/api/campus/cohorts/${cohortId}/dashboard.csv?sprintId=${sprintId}`, "readiness.csv", getToken).catch((e) =>
      setDownloadError(errorText(e, "Download failed."))
    );
  };

  const d = dashboard?.key === key ? dashboard.data : null;
  const pages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const shown = students.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SprintPicker assignments={assignments} value={sprintId} onChange={(v) => { setSprintId(v); setPage(0); }} />
        <button onClick={download} className={secondaryButtonClass}><Download className="w-3.5 h-3.5" /> Download CSV</button>
      </div>
      {downloadError && <Message ok={false} text={downloadError} />}

      {!dashboard || dashboard.key !== key ? (
        <Spinner text="Loading dashboard..." />
      ) : dashboard.error ? (
        <Message ok={false} text={dashboard.error} />
      ) : d ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card/60 p-3 space-y-3">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Completion</h4>
              <FunnelBars funnel={d.funnel} />
            </div>
            <div className="rounded-xl border border-border bg-card/60 p-3 space-y-3">
              <h4 className="text-xs font-bold text-foreground">Readiness</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {BANDS.map((b) => (
                  <button
                    key={b}
                    onClick={() => { setBand(band === b ? "" : b); setPage(0); }}
                    className={`rounded-lg border px-2 py-1.5 text-left cursor-pointer ${BAND_CLASS[b]} ${band === b ? "ring-2 ring-indigo-500" : ""}`}
                    title={`Show only ${b}`}
                  >
                    <span className="block text-lg font-bold tabular-nums">{d.readiness.counts[b] ?? 0}</span>
                    <span className="block text-[11px] font-semibold">{b}</span>
                  </button>
                ))}
              </div>
              <div>
                <h5 className="text-[11px] font-semibold text-muted-foreground mb-1">Integrity review (submissions)</h5>
                <div className="flex flex-wrap gap-2 text-[11px]">
                  {[["Clear", "Clear"], ["Review", "Review"], ["HighRisk", "High risk"], ["Unknown", "Not analysed"]].map(([k, label]) => (
                    <span key={k} className="px-2 py-1 rounded-lg border border-border bg-card text-foreground">
                      {label}: <strong className="tabular-nums">{d.integrityReview[k] ?? 0}</strong>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Histogram title="Tests passed (%)" dist={d.distributions.overall.tests} suffix="%" />
            <Histogram title="Defense score" dist={d.distributions.overall.defense} suffix="" />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold text-foreground">By branch</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Branch</th>
                    <th className="py-2 pr-3 font-semibold text-right">Students</th>
                    <th className="py-2 pr-3 font-semibold text-right">Submitted</th>
                    <th className="py-2 pr-3 font-semibold text-right">Defended</th>
                    <th className="py-2 pr-3 font-semibold text-right">Median tests %</th>
                    <th className="py-2 pr-3 font-semibold text-right">Median defense</th>
                    <th className="py-2 pr-3 font-semibold text-right">Ready</th>
                    <th className="py-2 pr-3 font-semibold text-right">Nearly</th>
                    <th className="py-2 font-semibold text-right">Needs practice</th>
                  </tr>
                </thead>
                <tbody>
                  {d.distributions.byBranch.map((b) => (
                    <tr key={b.branch} className="border-b border-border last:border-0 text-foreground tabular-nums">
                      <td className="py-2 pr-3 font-semibold">{b.branch}</td>
                      <td className="py-2 pr-3 text-right">{b.members}</td>
                      <td className="py-2 pr-3 text-right">{b.funnel.submitted}</td>
                      <td className="py-2 pr-3 text-right">{b.funnel.defended}</td>
                      <td className="py-2 pr-3 text-right">{fmt(b.tests.median)}</td>
                      <td className="py-2 pr-3 text-right">{fmt(b.defense.median)}</td>
                      <td className="py-2 pr-3 text-right">{b.readiness["Ready"] ?? 0}</td>
                      <td className="py-2 pr-3 text-right">{b.readiness["Nearly ready"] ?? 0}</td>
                      <td className="py-2 text-right">{b.readiness["Needs practice"] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-foreground">Students {band && `· ${band}`}</h4>
              {band && <button className={secondaryButtonClass} onClick={() => setBand("")}>Show all</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Roll no.</th>
                    <th className="py-2 pr-3 font-semibold">Name</th>
                    <th className="py-2 pr-3 font-semibold hidden sm:table-cell">Branch</th>
                    <th className="py-2 pr-3 font-semibold hidden md:table-cell">Status</th>
                    <th className="py-2 pr-3 font-semibold text-right">Tests %</th>
                    <th className="py-2 pr-3 font-semibold text-right">Defense</th>
                    <th className="py-2 pr-3 font-semibold text-right hidden sm:table-cell">Combined</th>
                    <th className="py-2 pr-3 font-semibold">Readiness</th>
                    <th className="py-2 font-semibold hidden md:table-cell">Language</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.memberId} className="border-b border-border last:border-0 text-foreground">
                      <td className="py-2 pr-3 font-mono">{s.rollNumber || "—"}</td>
                      <td className="py-2 pr-3">{s.name}</td>
                      <td className="py-2 pr-3 hidden sm:table-cell">{s.branch}</td>
                      <td className="py-2 pr-3 hidden md:table-cell text-muted-foreground">
                        {STATUS_LABEL[s.status] ?? s.status}
                        {s.late && " (late)"}
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(s.testsPercent)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmt(s.defenseScore)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums hidden sm:table-cell" title={s.defenseMissing ? "Defense not completed; counted as 0" : undefined}>
                        {fmt(s.combined)}
                        {s.defenseMissing && "*"}
                      </td>
                      <td className="py-2 pr-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${BAND_CLASS[s.readiness] ?? ""}`}>{s.readiness}</span>
                      </td>
                      <td className="py-2 hidden md:table-cell text-muted-foreground">{s.languageLabel ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {students.length > PAGE_SIZE && (
              <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                <button className={secondaryButtonClass} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span>{page + 1} / {pages}</span>
                <button className={secondaryButtonClass} disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </div>

          <ul className="space-y-1 text-[11px] text-muted-foreground">
            {d.notes.map((n) => (
              <li key={n} className="flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {n}</li>
            ))}
            <li className="flex gap-1.5"><Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> * Combined score with the defense not yet completed.</li>
          </ul>
        </>
      ) : null}
    </div>
  );
}

let nextRowId = 1;

function OutcomesTab({ cohortId, assignments, getToken }: { cohortId: string; assignments: AssignmentRow[]; getToken: GetToken }) {
  const [sprintId, setSprintId] = useState(assignments[0]?.sprintId ?? "");
  const [mappingVersion, setMappingVersion] = useState(0);
  const [mappings, setMappings] = useState<Loaded<{ isDefault: boolean }> | null>(null);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [targetInput, setTargetInput] = useState("60");
  const [target, setTarget] = useState(60);
  const [attainment, setAttainment] = useState<Loaded<AttainmentData> | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiJson<{ outcomes: { code: string; title: string }[] }>("/api/campus/outcomes", getToken)
      .then((d) => active && setTitles(Object.fromEntries(d.outcomes.map((o) => [o.code, o.title]))))
      .catch(() => {
        // titles are cosmetic in the editor
      });
    return () => {
      active = false;
    };
  }, [getToken]);

  const mappingKey = `${sprintId}|${mappingVersion}`;
  useEffect(() => {
    if (!sprintId) return;
    let active = true;
    apiJson<{ isDefault: boolean; mappings: { outcomeCode: string; measure: string; weight: number }[] }>(`/api/campus/outcome-mappings/${sprintId}`, getToken)
      .then((d) => {
        if (!active) return;
        setRows(d.mappings.map((m) => ({ rowId: nextRowId++, outcomeCode: m.outcomeCode, measure: m.measure, weight: m.weight })));
        setMappings({ key: mappingKey, data: { isDefault: d.isDefault }, error: null });
      })
      .catch((e) => active && setMappings({ key: mappingKey, data: null, error: errorText(e, "Could not load outcome mappings.") }));
    return () => {
      active = false;
    };
  }, [getToken, sprintId, mappingKey]);

  const attainmentKey = `${cohortId}|${sprintId}|${target}|${mappingVersion}`;
  useEffect(() => {
    if (!sprintId) return;
    let active = true;
    apiJson<AttainmentData>(`/api/campus/cohorts/${cohortId}/attainment?sprintId=${sprintId}&target=${target}`, getToken)
      .then((d) => active && setAttainment({ key: attainmentKey, data: d, error: null }))
      .catch((e) => active && setAttainment({ key: attainmentKey, data: null, error: errorText(e, "Could not load attainment.") }));
    return () => {
      active = false;
    };
  }, [getToken, cohortId, sprintId, target, attainmentKey]);

  if (assignments.length === 0) return <p className="text-sm text-muted-foreground">Assign a sprint to map it to programme outcomes.</p>;

  const save = async (reset: boolean) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const body = reset ? [] : rows.map((r) => ({ outcomeCode: r.outcomeCode, measure: r.measure, weight: Number(r.weight) }));
      await apiJson(`/api/campus/outcome-mappings/${sprintId}`, getToken, { method: "PUT", body: JSON.stringify(body) });
      setSaveMessage({ ok: true, text: reset ? "Restored the default mapping." : "Mapping saved." });
      setMappingVersion((v) => v + 1);
    } catch (e) {
      setSaveMessage({ ok: false, text: errorText(e, "Could not save the mapping.") });
    } finally {
      setSaving(false);
    }
  };

  const update = (rowId: number, patch: Partial<MappingRow>) => setRows((rs) => rs.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  const usedCodes = new Set(rows.map((r) => r.outcomeCode));
  const nextFree = [...PO_CODES, ...PSO_CODES].find((c) => !usedCodes.has(c));

  const download = () => {
    setDownloadError(null);
    downloadAuthed(`/api/campus/cohorts/${cohortId}/attainment.csv?sprintId=${sprintId}&target=${target}`, "po-attainment.csv", getToken).catch((e) =>
      setDownloadError(errorText(e, "Download failed."))
    );
  };

  const a = attainment?.key === attainmentKey ? attainment.data : null;

  return (
    <div className="space-y-5">
      <SprintPicker assignments={assignments} value={sprintId} onChange={setSprintId} />

      <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">Outcome mapping for this sprint</h3>
        <p className="text-[11px] text-muted-foreground">
          Choose which programme outcomes this sprint provides evidence for and which measure to use: tests (code correctness), defense (explaining the work) or
          combined. Weight is carried into the export for your own CO-PO calculation (for example correlation level 1–3).
        </p>
        {!mappings || mappings.key !== mappingKey ? (
          <Spinner text="Loading mapping..." />
        ) : mappings.error ? (
          <Message ok={false} text={mappings.error} />
        ) : (
          <>
            {mappings.data?.isDefault && <p className="text-[11px] text-muted-foreground">Showing the default mapping. Save to customise it.</p>}
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.rowId} className="grid grid-cols-[1fr_auto] sm:grid-cols-[minmax(0,1fr)_140px_90px_auto] gap-2 items-center">
                  <select className={inputClass} value={r.outcomeCode} onChange={(e) => update(r.rowId, { outcomeCode: e.target.value })} aria-label="Outcome">
                    {[...PO_CODES, ...PSO_CODES].map((c) => (
                      <option key={c} value={c} disabled={c !== r.outcomeCode && usedCodes.has(c)}>
                        {c} {titles[c] ? `· ${titles[c]}` : c.startsWith("PSO") ? "· Programme-specific" : ""}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => setRows((rs) => rs.filter((x) => x.rowId !== r.rowId))} className="sm:order-last p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 cursor-pointer" aria-label={`Remove ${r.outcomeCode}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <select className={inputClass} value={r.measure} onChange={(e) => update(r.rowId, { measure: e.target.value })} aria-label="Measure">
                    <option value="tests">Tests</option>
                    <option value="defense">Defense</option>
                    <option value="combined">Combined</option>
                  </select>
                  <input
                    className={inputClass}
                    type="number"
                    min={0.1}
                    max={3}
                    step={0.1}
                    value={r.weight}
                    onChange={(e) => update(r.rowId, { weight: Number(e.target.value) })}
                    aria-label="Weight"
                  />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className={secondaryButtonClass}
                disabled={!nextFree}
                onClick={() => nextFree && setRows((rs) => [...rs, { rowId: nextRowId++, outcomeCode: nextFree, measure: "tests", weight: 1 }])}
              >
                <Plus className="w-3.5 h-3.5" /> Add outcome
              </button>
              <button className={buttonClass} disabled={saving} onClick={() => save(false)}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Save mapping
              </button>
              <button className={secondaryButtonClass} disabled={saving} onClick={() => save(true)}>Restore defaults</button>
            </div>
            {saveMessage && <Message {...saveMessage} />}
          </>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Target className="w-4 h-4" /> Attainment</h3>
          <div className="flex flex-wrap items-end gap-2">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const t = Number(targetInput);
                if (Number.isFinite(t) && t >= 0 && t <= 100) setTarget(t);
              }}
            >
              <label className="text-xs text-muted-foreground">
                Target score
                <input className="mt-1 w-20 rounded-xl bg-card border border-border px-3 py-2 text-xs text-foreground block" type="number" min={0} max={100} value={targetInput} onChange={(e) => setTargetInput(e.target.value)} />
              </label>
              <button type="submit" className={secondaryButtonClass}>Apply</button>
            </form>
            <button onClick={download} className={secondaryButtonClass}><Download className="w-3.5 h-3.5" /> Download CSV</button>
          </div>
        </div>
        {downloadError && <Message ok={false} text={downloadError} />}
        {!attainment || attainment.key !== attainmentKey ? (
          <Spinner text="Calculating..." />
        ) : attainment.error ? (
          <Message ok={false} text={attainment.error} />
        ) : a ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-semibold">Outcome</th>
                    <th className="py-2 pr-3 font-semibold">Measure</th>
                    <th className="py-2 pr-3 font-semibold text-right">Weight</th>
                    <th className="py-2 pr-3 font-semibold text-right">Assessed</th>
                    <th className="py-2 pr-3 font-semibold text-right">≥ {a.target}</th>
                    <th className="py-2 pr-3 font-semibold text-right">% of students</th>
                    <th className="py-2 font-semibold text-right">Level</th>
                  </tr>
                </thead>
                <tbody>
                  {a.outcomes.map((o) => (
                    <tr key={o.outcomeCode} className="border-b border-border last:border-0 text-foreground tabular-nums">
                      <td className="py-2 pr-3">
                        <span className="font-semibold">{o.outcomeCode}</span> <span className="text-muted-foreground">{o.title}</span>
                      </td>
                      <td className="py-2 pr-3 capitalize">{o.measure}</td>
                      <td className="py-2 pr-3 text-right">{o.weight}</td>
                      <td className="py-2 pr-3 text-right">{o.assessed}</td>
                      <td className="py-2 pr-3 text-right">{o.atOrAboveTarget}</td>
                      <td className="py-2 pr-3 text-right">{fmt(o.percentAtOrAboveTarget, "%")}</td>
                      <td className="py-2 text-right font-bold">{o.attainmentLevel ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Level 3 if at least {a.thresholds.level3}% of assessed students reach the target, 2 if at least {a.thresholds.level2}%, 1 if at least {a.thresholds.level1}%, otherwise 0.
              {a.usingDefaultMappings && " Using the default mapping."}
            </p>
            <p className="text-[11px] text-muted-foreground flex gap-1.5 rounded-lg border border-border bg-card/60 p-2">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {a.note}
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import { ReportTableView, formatCell, type Cell, type ReportTable } from "@/components/career/reports/ReportTableView";

type Section = "engagement" | "service" | "employers" | "equity";

const SECTION_LABELS: Record<Section, string> = {
  engagement: "Engagement",
  service: "Service volume",
  employers: "Employers",
  equity: "Equity view",
};

interface TermOption {
  name: string;
  from: string;
  to: string;
  current: boolean;
}

interface Options {
  sections: Section[];
  role: string;
  canEditSettings: boolean;
  minCellSize: number;
  minCellSizeFloor: number;
  terms: TermOption[];
  today: string;
}

interface Report {
  section: Section;
  title: string;
  range: { from: string; to: string; term?: string | null; timeZone: string };
  metrics: { key: string; label: string; value: Cell; hint?: string | null }[];
  tables: ReportTable[];
  notes: string[];
}

interface Preset {
  id: string;
  name: string;
  params: { section: Section; term?: string | null; from?: string | null; to?: string | null };
}

interface Filters {
  term: string;
  from: string;
  to: string;
}

function query(f: Filters) {
  const p = new URLSearchParams();
  if (f.term) p.set("term", f.term);
  else {
    if (f.from) p.set("from", f.from);
    if (f.to) p.set("to", f.to);
  }
  return p.toString();
}

export default function ReportsPage() {
  const api = useApi();
  const opts = useLoad(() => api<Options>("/api/career/reports/options"), []);
  const presets = useLoad(() => api<Preset[]>("/api/career/reports/presets"), []);
  const [section, setSection] = useState<Section | null>(null);
  const [draft, setDraft] = useState<Filters | null>(null);
  const [applied, setApplied] = useState<Filters | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [minCell, setMinCell] = useState<number | "">("");

  // Defaults until the user picks: first allowed section, the current term (or the last 90 days)
  const defaults: Filters = { term: opts.data?.terms.find((t) => t.current)?.name ?? "", from: "", to: "" };
  const sec: Section | null = section ?? opts.data?.sections[0] ?? null;
  const filters: Filters = applied ?? defaults;
  const draftF: Filters = draft ?? filters;
  const minCellValue = minCell === "" ? (opts.data?.minCellSize ?? "") : minCell;
  const q = query(filters);
  const rep = useLoad(() => (sec ? api<Report>(`/api/career/reports/${sec}?${q}`) : Promise.resolve(null)), [sec, q, version]);
  const report = rep.data;

  const run = useCallback(async (key: string, fn: () => Promise<void>, done?: string) => {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      if (done) setSuccess(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  const download = (path: string, key: string) =>
    run(key, async () => {
      const res = await api<Response>(path, { raw: true });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "report.csv";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }, "Download started.");

  const printable = () =>
    run("print", async () => {
      const res = await api<Response>(`/api/career/reports/summary.html?${q}`, { raw: true });
      if (!res.ok) throw new Error(`Couldn't build the summary (${res.status})`);
      const url = URL.createObjectURL(new Blob([await res.text()], { type: "text/html" }));
      const w = window.open(url, "_blank", "noopener");
      if (!w) throw new Error("Allow pop-ups to open the printable summary.");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });

  const applyPreset = (p: Preset) => {
    const f = { term: p.params.term ?? "", from: p.params.from ?? "", to: p.params.to ?? "" };
    if (opts.data?.sections.includes(p.params.section)) setSection(p.params.section);
    setDraft(f);
    setApplied(f);
    setSuccess(`Preset "${p.name}" applied.`);
  };

  if (opts.loading) return <Loading />;
  if (opts.error || !opts.data) return <ErrorBanner error={opts.error ?? "Reports are unavailable."} onRetry={opts.reload} />;
  const o = opts.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="How students use career services, built from appointments, document review, mentoring, experiences and employer activity at your school."
        actions={
          <>
            <Button variant="secondary" busy={busy === "csv"} onClick={() => sec && download(`/api/career/reports/${sec}.csv?${q}`, "csv")}>
              Export CSV
            </Button>
            <Button variant="secondary" busy={busy === "print"} onClick={printable}>
              Printable summary
            </Button>
          </>
        }
      />

      <nav aria-label="Report sections" className="flex flex-wrap gap-2">
        {o.sections.map((s) => (
          <button
            key={s}
            type="button"
            aria-current={sec === s ? "page" : undefined}
            onClick={() => setSection(s)}
            className={`rounded-full border px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 ${sec === s ? "border-transparent font-semibold text-white" : "border-border hover:bg-muted"}`}
            style={sec === s ? { background: "var(--brand, #4f46e5)" } : undefined}
          >
            {SECTION_LABELS[s]}
          </button>
        ))}
      </nav>

      <Card title="Filters">
        <form
          className="grid gap-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ ...draftF });
          }}
        >
          <Field label="Term" hint="Pick a term, or choose “Custom dates”.">
            {(p) => (
              <select {...p} value={draftF.term} onChange={(e) => setDraft({ ...draftF, term: e.target.value })}>
                <option value="">Custom dates</option>
                {o.terms.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                    {t.current ? " (current)" : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="From" hint={draftF.term ? "Set by the term" : "Default: 90 days ago"}>
            {(p) => <input {...p} type="date" disabled={!!draftF.term} value={draftF.from} max={o.today} onChange={(e) => setDraft({ ...draftF, from: e.target.value })} />}
          </Field>
          <Field label="To" hint={draftF.term ? "Set by the term" : "Default: today"}>
            {(p) => <input {...p} type="date" disabled={!!draftF.term} value={draftF.to} onChange={(e) => setDraft({ ...draftF, to: e.target.value })} />}
          </Field>
          <Button type="submit">Apply</Button>
        </form>

        <div className="mt-5 grid gap-4 border-t border-border pt-4 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-semibold">My saved presets</h3>
            {presets.error && <ErrorBanner error={presets.error} onRetry={presets.reload} />}
            {presets.data && presets.data.length === 0 && <p className="text-sm text-muted-foreground">No presets yet.</p>}
            <ul className="space-y-1">
              {presets.data?.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <button type="button" className="truncate text-left underline-offset-2 hover:underline focus-visible:outline-2" onClick={() => applyPreset(p)}>
                    {p.name} <span className="text-muted-foreground">· {SECTION_LABELS[p.params.section]} · {p.params.term || `${p.params.from ?? "…"} to ${p.params.to ?? "today"}`}</span>
                  </button>
                  <Button
                    variant="ghost"
                    aria-label={`Delete preset ${p.name}`}
                    busy={busy === `del-${p.id}`}
                    onClick={() => run(`del-${p.id}`, async () => { await api(`/api/career/reports/presets/${p.id}`, { method: "DELETE" }); presets.reload(); }, "Preset deleted.")}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          </div>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!sec) return;
              run("preset", async () => {
                await api("/api/career/reports/presets", { json: { name: presetName, section: sec, term: filters.term || null, from: filters.term ? null : filters.from || null, to: filters.term ? null : filters.to || null } });
                setPresetName("");
                presets.reload();
              }, "Preset saved.");
            }}
          >
            <div className="flex-1">
              <Field label="Save current report and filters as" hint="Saving with an existing name replaces it.">
                {(p) => <input {...p} value={presetName} maxLength={80} onChange={(e) => setPresetName(e.target.value)} placeholder="e.g. Fall engagement" />}
              </Field>
            </div>
            <Button type="submit" variant="secondary" busy={busy === "preset"} disabled={!presetName.trim()}>
              Save preset
            </Button>
          </form>
        </div>
      </Card>

      <div aria-live="polite" role="status" className="space-y-2">
        <ErrorBanner error={error ?? rep.error} />
        <SuccessBanner message={success} />
      </div>

      {rep.loading && <Loading label="Building report…" />}
      {report && !rep.loading && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">{report.title}</h2>
            <p className="text-sm text-muted-foreground">
              {report.range.term ? `${report.range.term}: ` : ""}
              {report.range.from} to {report.range.to} ({report.range.timeZone})
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
            {report.metrics.map((m) => (
              <div key={m.key} className="rounded-xl border border-border bg-card p-3">
                <dt className="text-xs text-muted-foreground">{m.label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{formatCell(m.value)}</dd>
                {m.hint && <dd className="mt-1 text-xs text-muted-foreground">{m.hint}</dd>}
              </div>
            ))}
          </dl>
          <div className="grid gap-4 lg:grid-cols-2">
            {report.tables.map((t) => (
              <ReportTableView
                key={t.key}
                table={t}
                exporting={busy === `csv-${t.key}`}
                onExport={() => download(`/api/career/reports/${report.section}.csv?${q}&table=${t.key}`, `csv-${t.key}`)}
              />
            ))}
          </div>
          {report.notes.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {report.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {o.canEditSettings && (
        <Card title="Privacy setting">
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              run("settings", async () => {
                await api("/api/career/reports/settings", { method: "PUT", json: { minCellSize: Number(minCellValue) } });
                opts.reload();
                setVersion((v) => v + 1);
              }, "Setting saved.");
            }}
          >
            <div className="w-64">
              <Field label="Smallest group shown in the equity view" hint={`Smaller groups appear as “<n”. Minimum ${o.minCellSizeFloor}.`}>
                {(p) => <input {...p} type="number" min={o.minCellSizeFloor} max={50} value={minCellValue ?? ""} onChange={(e) => setMinCell(e.target.value === "" ? "" : Number(e.target.value))} />}
              </Field>
            </div>
            <Button type="submit" busy={busy === "settings"}>
              Save
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

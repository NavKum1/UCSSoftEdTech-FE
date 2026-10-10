"use client";

import React, { useCallback, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
import { AttainmentView, type Catalog, type FrameworkInfo, type SourceInfo } from "@/components/career/frameworks/AttainmentView";

interface Mapping {
  outcomeCode: string;
  source: string;
  sourceRef: string;
  weight: number;
  targetScore: number;
  level3: number;
  level2: number;
  level1: number;
}

interface MappingDto extends Omit<Mapping, "sourceRef"> {
  id: string;
  sourceRef: string | null;
}

interface RefOption {
  value: string;
  label: string;
}

interface RefOptions {
  sprints: RefOption[];
  sprintsWithEvidence: RefOption[];
  checklistItems: RefOption[];
  evaluationQuestions: RefOption[];
}

type Tab = "attainment" | "mappings" | "frameworks";

const cell = "rounded-md border border-border bg-background px-2 py-1 text-sm focus-visible:outline-2 focus-visible:outline-offset-1";

function refOptionsFor(source: string, refs: RefOptions | null): RefOption[] {
  if (!refs) return [];
  if (source === "doc_review_rubric") return refs.checklistItems;
  if (source === "internship_evaluation") return refs.evaluationQuestions;
  if (source === "mentoring_participation") return [];
  const seen = new Map<string, RefOption>();
  [...refs.sprints, ...refs.sprintsWithEvidence].forEach((o) => seen.set(o.value, o));
  return [...seen.values()];
}

function MappingEditor({ framework, sources, canEdit, onSaved }: { framework: FrameworkInfo; sources: SourceInfo[]; canEdit: boolean; onSaved: () => void }) {
  const api = useApi();
  const base = `/api/career/frameworks/${encodeURIComponent(framework.key)}`;
  const loaded = useLoad(() => api<{ mappings: MappingDto[] }>(`${base}/mappings`), [base]);
  const refs = useLoad(() => api<RefOptions>("/api/career/frameworks/reference-options"), []);
  const [rows, setRows] = useState<Mapping[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const current: Mapping[] = rows ?? (loaded.data?.mappings ?? []).map((m) => ({ ...m, sourceRef: m.sourceRef ?? "" }));
  const update = (i: number, patch: Partial<Mapping>) => setRows(current.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const codes = framework.outcomes.map((o) => o.code);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api<{ mappings: MappingDto[] }>(`${base}/mappings`, {
        method: "PUT",
        json: current.map((r) => ({ ...r, sourceRef: r.sourceRef.trim() || null })),
      });
      setRows(res.mappings.map((m) => ({ ...m, sourceRef: m.sourceRef ?? "" })));
      setSuccess("Mappings saved.");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loaded.loading) return <Loading />;
  if (loaded.error) return <ErrorBanner error={loaded.error} onRetry={loaded.reload} />;

  return (
    <Card title={`Evidence mappings: ${framework.name}`}>
      <p className="mb-3 text-sm text-muted-foreground">
        Each row counts one evidence measure towards an outcome. Target: the score (0–100) a student must reach. Thresholds: the share of assessed students at or
        above target needed for levels 3, 2 and 1. {framework.allowsProgramSpecific && "Programme-specific outcomes PSO1–PSO9 are also accepted."}
      </p>
      <ErrorBanner error={error} />
      <SuccessBanner message={success} />
      {current.length === 0 && <EmptyState title="No mappings yet">{canEdit ? "Add a row to map evidence to an outcome." : "A career admin hasn't mapped evidence yet."}</EmptyState>}
      {current.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Evidence mappings</caption>
            <thead>
              <tr>
                {["Outcome", "Evidence source", "Source detail", "Weight", "Target", "Level 3 %", "Level 2 %", "Level 1 %", ""].map((h, i) => (
                  <th key={i} scope="col" className="px-2 py-1 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {current.map((r, i) => {
                const src = sources.find((s) => s.key === r.source);
                const listId = `refs-${i}`;
                const n = i + 1;
                return (
                  <tr key={i} className="border-t border-border">
                    <td className="px-2 py-1">
                      <select aria-label={`Outcome, row ${n}`} className={cell} disabled={!canEdit} value={r.outcomeCode} onChange={(e) => update(i, { outcomeCode: e.target.value })}>
                        {!codes.includes(r.outcomeCode) && <option value={r.outcomeCode}>{r.outcomeCode}</option>}
                        {framework.outcomes.map((o) => <option key={o.code} value={o.code}>{o.code}: {o.title.slice(0, 60)}</option>)}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <select aria-label={`Evidence source, row ${n}`} className={cell} disabled={!canEdit} value={r.source} onChange={(e) => update(i, { source: e.target.value, sourceRef: "" })}>
                        {sources.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                      {src && <span className="ml-1">{src.direct ? <Badge tone="info">Direct</Badge> : <Badge>Indirect</Badge>}</span>}
                    </td>
                    <td className="px-2 py-1">
                      <input
                        aria-label={`${src?.refLabel ?? "Source detail"}, row ${n}`}
                        placeholder={src?.refLabel}
                        className={`${cell} w-56`}
                        disabled={!canEdit}
                        list={listId}
                        value={r.sourceRef}
                        onChange={(e) => update(i, { sourceRef: e.target.value })}
                      />
                      <datalist id={listId}>
                        {refOptionsFor(r.source, refs.data).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </datalist>
                    </td>
                    {(["weight", "targetScore", "level3", "level2", "level1"] as const).map((f) => (
                      <td key={f} className="px-2 py-1">
                        <input
                          type="number"
                          aria-label={`${{ weight: "Weight", targetScore: "Target score", level3: "Level 3 threshold", level2: "Level 2 threshold", level1: "Level 1 threshold" }[f]}, row ${n}`}
                          className={`${cell} w-20`}
                          disabled={!canEdit}
                          min={0}
                          max={f === "weight" ? 10 : 100}
                          step={f === "weight" ? 0.1 : 1}
                          value={r[f]}
                          onChange={(e) => update(i, { [f]: Number(e.target.value) })}
                        />
                      </td>
                    ))}
                    <td className="px-2 py-1">
                      {canEdit && (
                        <Button variant="ghost" type="button" onClick={() => setRows(current.filter((_, j) => j !== i))} aria-label={`Remove row ${n}`}>
                          Remove
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() =>
              setRows([...current, { outcomeCode: codes[0] ?? "", source: sources[0]?.key ?? "sprint_tests", sourceRef: "", weight: 1, targetScore: 60, level3: 70, level2: 60, level1: 50 }])
            }
          >
            Add mapping
          </Button>
          <Button type="button" busy={busy} onClick={save}>Save mappings</Button>
        </div>
      )}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium">About the evidence sources</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          {sources.map((s) => <li key={s.key}><strong>{s.label}</strong> ({s.direct ? "direct" : "indirect"}): {s.description}</li>)}
        </ul>
      </details>
    </Card>
  );
}

function parseOutcomes(text: string) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const at = l.indexOf("|");
      return at < 0 ? { code: l, title: "" } : { code: l.slice(0, at).trim(), title: l.slice(at + 1).trim() };
    });
}

function FrameworksSetup({ cat, onChanged }: { cat: Catalog; onChanged: () => void }) {
  const api = useApi();
  const [enabled, setEnabled] = useState<string[] | null>(null);
  const [minCell, setMinCell] = useState<number | "">("");
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [outcomes, setOutcomes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const on = enabled ?? cat.enabled;

  const run = useCallback(async (key: string, fn: () => Promise<void>, done: string) => {
    setBusy(key);
    setError(null);
    setSuccess(null);
    try {
      await fn();
      setSuccess(done);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, [onChanged]);

  const startEdit = (f: FrameworkInfo | null) => {
    setEditing(f ? f.key : "new");
    setName(f?.name ?? "");
    setDescription(f?.description ?? "");
    setOutcomes(f ? f.outcomes.map((o) => `${o.code} | ${o.title}`).join("\n") : "");
  };

  return (
    <div className="space-y-6">
      <ErrorBanner error={error} />
      <SuccessBanner message={success} />
      <Card title="Frameworks your school measures against">
        <fieldset disabled={!cat.canEdit}>
          <legend className="sr-only">Frameworks</legend>
          <ul className="space-y-3">
            {cat.frameworks.map((f) => (
              <li key={f.key} className="rounded-lg border border-border p-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={on.includes(f.key)}
                    onChange={(e) => setEnabled(e.target.checked ? [...on, f.key] : on.filter((k) => k !== f.key))}
                  />
                  <span>
                    <span className="font-medium">{f.name}</span> {f.builtIn ? <Badge>Built in</Badge> : <Badge tone="info">Custom</Badge>}{" "}
                    <span className="text-xs text-muted-foreground">{f.outcomes.length} outcomes · {f.mappingCount} mappings</span>
                    <span className="block text-sm text-muted-foreground">{f.description}</span>
                    {f.builtIn && <span className="block text-xs text-muted-foreground">{f.note}</span>}
                  </span>
                </label>
                {!f.builtIn && cat.canEdit && (
                  <div className="mt-2 flex gap-2">
                    <Button variant="secondary" type="button" onClick={() => startEdit(f)}>Edit</Button>
                    <Button
                      variant="danger"
                      type="button"
                      busy={busy === `del-${f.key}`}
                      onClick={() => {
                        if (!window.confirm(`Delete "${f.name}" and its mappings?`)) return;
                        run(`del-${f.key}`, () => api(`/api/career/frameworks/custom/${encodeURIComponent(f.key)}`, { method: "DELETE" }).then(() => undefined), "Framework deleted.");
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="mt-4 max-w-xs">
            <Field label="Smallest group shown" hint={`Groups smaller than this show as "<n". At least ${cat.minCellSizeFloor}.`}>
              {(p) => (
                <input {...p} type="number" min={cat.minCellSizeFloor} max={50} value={minCell === "" ? cat.minCellSize : minCell} onChange={(e) => setMinCell(e.target.value === "" ? "" : Number(e.target.value))} />
              )}
            </Field>
          </div>
        </fieldset>
        {cat.canEdit && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              busy={busy === "settings"}
              onClick={() =>
                run("settings", () => api("/api/career/frameworks/settings", { method: "PUT", json: { enabled: on, minCellSize: minCell === "" ? cat.minCellSize : minCell } }).then(() => setEnabled(null)), "Settings saved.")
              }
            >
              Save choices
            </Button>
            <Button variant="secondary" type="button" onClick={() => startEdit(null)}>New custom framework</Button>
          </div>
        )}
      </Card>

      {editing && cat.canEdit && (
        <Card title={editing === "new" ? "New custom framework" : "Edit custom framework"}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const body = { name, description, outcomes: parseOutcomes(outcomes) };
              run(
                "custom",
                () =>
                  (editing === "new"
                    ? api("/api/career/frameworks/custom", { method: "POST", json: body })
                    : api(`/api/career/frameworks/custom/${encodeURIComponent(editing)}`, { method: "PUT", json: body })
                  ).then(() => setEditing(null)),
                "Framework saved.",
              );
            }}
          >
            <Field label="Name">{(p) => <input {...p} required value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />}</Field>
            <Field label="Description (optional)">{(p) => <input {...p} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />}</Field>
            <Field label="Outcomes" hint="One per line: CODE | Title, for example “CS1 | Write correct, tested programs”.">
              {(p) => <textarea {...p} rows={6} required value={outcomes} onChange={(e) => setOutcomes(e.target.value)} />}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" busy={busy === "custom"}>Save framework</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

export default function CareerCenterFrameworksPage() {
  const api = useApi();
  const cat = useLoad(() => api<Catalog>("/api/career/frameworks"), []);
  const [tab, setTab] = useState<Tab>("attainment");
  const [key, setKey] = useState<string | null>(null);

  if (cat.loading && !cat.data) return <Loading />;
  if (cat.error || !cat.data) return <ErrorBanner error={cat.error ?? "Frameworks are unavailable."} onRetry={cat.reload} />;
  const c = cat.data;
  const choices = c.frameworks.filter((f) => f.enabled).length > 0 ? c.frameworks.filter((f) => f.enabled) : c.frameworks;
  const current = choices.find((f) => f.key === key) ?? choices[0];
  const tabs: [Tab, string][] = [["attainment", "Attainment"], ["mappings", "Evidence mappings"], ["frameworks", "Choose frameworks"]];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outcome frameworks"
        description="Measure outcome attainment for accreditation (NBA, ABET) and career readiness (NACE) from direct evidence of student work. Reports are aggregate only."
      />
      <div role="group" aria-label="Sections" className="flex flex-wrap gap-2">
        {tabs.map(([t, label]) => (
          <Button key={t} type="button" variant={tab === t ? "primary" : "secondary"} aria-pressed={tab === t} onClick={() => setTab(t)}>
            {label}
          </Button>
        ))}
      </div>

      {tab !== "frameworks" && current && (
        <div className="max-w-md">
          <Field label="Framework" hint={c.enabled.length === 0 ? "No frameworks are switched on yet; showing all." : undefined}>
            {(p) => (
              <select {...p} value={current.key} onChange={(e) => setKey(e.target.value)}>
                {choices.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
              </select>
            )}
          </Field>
        </div>
      )}

      {tab === "attainment" && current && <AttainmentView key={current.key} framework={current} />}
      {tab === "mappings" && current && <MappingEditor key={current.key} framework={current} sources={c.sources} canEdit={c.canEdit} onSaved={cat.reload} />}
      {tab === "frameworks" && <FrameworksSetup cat={c} onChanged={cat.reload} />}
    </div>
  );
}

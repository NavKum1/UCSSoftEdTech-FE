"use client";

/**
 * The leads: quick filters for the day's work (my leads, new, overdue, unassigned), search and more filters, saved views,
 * a table or a board by stage (drag a card, or use its stage menu), selection with bulk assign / move / tag, and CSV export.
 */

import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Ban, Bookmark, Download, KanbanSquare, List, Search, SlidersHorizontal, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  crm,
  OPEN_STAGES,
  query,
  relative,
  StageBadge,
  STAGE_LABEL,
  STAGES,
  type Filters,
  type GetToken,
  type LeadList,
  type LeadRow,
  type Member,
  type SavedView,
} from "./api";

const input = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20";

const QUICK: { key: string; label: string; filters: Filters }[] = [
  { key: "all", label: "All leads", filters: {} },
  { key: "mine", label: "My leads", filters: { owner: "me" } },
  { key: "new", label: "New", filters: { stage: "New" } },
  { key: "awaiting", label: "Replied, needs answer", filters: { awaiting: true } },
  { key: "overdue", label: "Follow-up overdue", filters: { overdue: true } },
  { key: "unassigned", label: "Unassigned", filters: { owner: "none" } },
];

const same = (a: Filters, b: Filters) => JSON.stringify(clean(a)) === JSON.stringify(clean(b));
function clean(f: Filters): Filters {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(f).sort()) {
    const v = (f as Record<string, unknown>)[k];
    if (v !== undefined && v !== "" && v !== false && v !== null) out[k] = v;
  }
  return out as Filters;
}

export default function LeadsView({
  getToken,
  team,
  data,
  filters,
  setFilters,
  loading,
  error,
  openLead,
  reload,
}: {
  getToken: GetToken;
  team: Member[];
  data: LeadList | null;
  filters: Filters;
  setFilters: (f: Filters) => void;
  loading: boolean;
  error: string | null;
  openLead: (id: string) => void;
  reload: () => void;
}) {
  const [layout, setLayout] = useState<"table" | "board">(() => {
    try {
      return (localStorage.getItem("crm_layout") as "table" | "board") || "table";
    } catch {
      return "table";
    }
  });
  const [more, setMore] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [views, setViews] = useState<SavedView[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState(filters.q ?? "");
  const activeTeam = team.filter((m) => m.active);

  useEffect(() => {
    crm<SavedView[]>(getToken, "/views").then(setViews).catch(() => setViews([]));
  }, [getToken]);

  // Search as you type (debounced)
  useEffect(() => {
    if ((filters.q ?? "") === search) return;
    const t = setTimeout(() => setFilters({ ...filters, q: search || undefined }), 300);
    return () => clearTimeout(t);
  }, [search, filters, setFilters]);

  const switchLayout = (l: "table" | "board") => {
    setLayout(l);
    try {
      localStorage.setItem("crm_layout", l);
    } catch {}
  };

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const visibleIds = leads.map((l) => l.leadId);
  const allChecked = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const bulk = async (body: Record<string, unknown>, label: string) => {
    setMessage(null);
    try {
      const r = await crm<{ updated: number }>(getToken, "/leads/bulk", { method: "POST", body: { leadIds: [...selected], ...body } });
      setMessage({ ok: true, text: `${label}: ${r.updated} ${r.updated === 1 ? "lead" : "leads"} updated.` });
      setSelected(new Set());
      reload();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  };

  const move = async (lead: LeadRow, stage: string) => {
    if (stage === lead.stage) return;
    if (stage === "Lost") {
      // Lost needs a reason, given in the lead's panel
      openLead(lead.leadId);
      return;
    }
    try {
      await crm(getToken, `/leads/${lead.leadId}`, { method: "PATCH", body: { stage } });
      reload();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  };

  const exportCsv = async () => {
    const res = await authenticatedFetch(`/api/institute/crm/export${query(filters)}`, {}, getToken);
    if (!res.ok) {
      setMessage({ ok: false, text: "The export failed. Please try again." });
      return;
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveView = async () => {
    const name = window.prompt("Name this view (only you see it)");
    if (!name?.trim()) return;
    try {
      const v = await crm<SavedView>(getToken, "/views", { method: "POST", body: { name: name.trim(), filters: clean(filters) } });
      setViews((vs) => [...vs, v].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    }
  };

  const deleteView = async (id: string) => {
    await crm(getToken, `/views/${id}`, { method: "DELETE" }).catch(() => null);
    setViews((vs) => vs.filter((v) => v.id !== id));
  };

  const advanced = !!(filters.tag || filters.source || filters.type || (filters.stage && filters.stage !== "New") || (filters.owner && !["me", "none"].includes(filters.owner)));
  const isQuick = QUICK.some((q) => same(q.filters, { ...filters, q: undefined }));

  return (
    <div className="space-y-4">
      {/* Quick filters and saved views */}
      <div className="flex flex-wrap items-center gap-1.5">
        {QUICK.map((q) => {
          const on = same(q.filters, { ...filters, q: undefined });
          const count = q.key === "new" ? data?.counts?.New : q.key === "awaiting" ? data?.awaiting : undefined;
          return (
            <button
              key={q.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilters({ ...q.filters, q: filters.q })}
              title={q.key === "overdue" ? "Leads with a follow-up whose due time has passed and isn't ticked off" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${on ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card hover:bg-muted"}`}
            >
              {q.label}
              {count ? <span className="ml-1 tabular-nums opacity-80">{count}</span> : null}
            </button>
          );
        })}
        {views.map((v) => {
          const on = same(v.filters, filters);
          return (
            <span key={v.id} className={`inline-flex items-center rounded-full border text-xs font-medium ${on ? "border-cyan-700 bg-cyan-700 text-white" : "border-border bg-card"}`}>
              <button type="button" onClick={() => { setFilters(v.filters); setSearch(v.filters.q ?? ""); }} className="inline-flex items-center gap-1 py-1.5 pl-3 pr-1.5">
                <Bookmark aria-hidden="true" className="h-3 w-3" />
                {v.name}
              </button>
              <button type="button" aria-label={`Delete view ${v.name}`} onClick={() => deleteView(v.id)} className="rounded-full py-1.5 pr-2 opacity-60 hover:opacity-100">
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {!isQuick && !views.some((v) => same(v.filters, filters)) && (
          <button type="button" onClick={saveView} className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
            <Bookmark aria-hidden="true" className="h-3 w-3" /> Save this view
          </button>
        )}
      </div>

      {/* Search, filters, layout, export */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-56 flex-1">
          <span className="sr-only">Search leads</span>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className={`${input} w-full pl-9`} placeholder="Search name, email, phone, course or question" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${advanced ? "border-cyan-600 text-cyan-800 dark:text-cyan-300" : "border-border"} hover:bg-muted`}>
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" /> Filters
        </button>
        <div className="inline-flex rounded-lg border border-border p-0.5" role="group" aria-label="Layout">
          <button type="button" aria-pressed={layout === "table"} onClick={() => switchLayout("table")} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm ${layout === "table" ? "bg-muted font-medium" : "text-muted-foreground"}`}>
            <List aria-hidden="true" className="h-4 w-4" /> Table
          </button>
          <button type="button" aria-pressed={layout === "board"} onClick={() => switchLayout("board")} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm ${layout === "board" ? "bg-muted font-medium" : "text-muted-foreground"}`}>
            <KanbanSquare aria-hidden="true" className="h-4 w-4" /> Board
          </button>
        </div>
        <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" title="Download the leads shown as a CSV file">
          <Download aria-hidden="true" className="h-4 w-4" /> Export
        </button>
      </div>

      {more && (
        <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-5">
          <Select label="Stage" value={filters.stage ?? ""} onChange={(v) => setFilters({ ...filters, stage: v || undefined })} options={STAGES.map((s) => [s, STAGE_LABEL[s]])} />
          <Select
            label="Owner"
            value={filters.owner ?? ""}
            onChange={(v) => setFilters({ ...filters, owner: v || undefined })}
            options={[["me", "Me"], ["none", "Unassigned"], ...activeTeam.map((m) => [m.id, m.name] as [string, string])]}
          />
          <Select label="Request" value={filters.type ?? ""} onChange={(v) => setFilters({ ...filters, type: v || undefined })} options={[["course", "Course inquiry"], ["guidance", "Career guidance"]]} />
          <Select label="Source" value={filters.source ?? ""} onChange={(v) => setFilters({ ...filters, source: v || undefined })} options={(data?.sources ?? []).map((s) => [s, s])} />
          <Select label="Tag" value={filters.tag ?? ""} onChange={(v) => setFilters({ ...filters, tag: v || undefined })} options={(data?.tags ?? []).map((t) => [t, t])} />
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!filters.overdue} onChange={(e) => setFilters({ ...filters, overdue: e.target.checked || undefined })} /> Follow-up overdue only
            </label>
            <button type="button" className="ml-auto text-sm text-cyan-700 hover:underline dark:text-cyan-400" onClick={() => { setFilters({}); setSearch(""); }}>
              Clear filters
            </button>
          </div>
        </div>
      )}

      {data?.me === null && filters.owner === "me" && (
        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          You&apos;re not on your institute&apos;s team list yet, so no leads are yours. Ask your admin to add you with your sign-in email.
        </p>
      )}
      {message && (
        <p role={message.ok ? "status" : "alert"} className={`rounded-lg px-3 py-2 text-sm ${message.ok ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "bg-red-500/10 text-red-800 dark:text-red-300"}`}>
          {message.text}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:text-red-300">
          {error}
        </p>
      )}

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-cyan-600/40 bg-card p-2.5 shadow-sm">
          <span className="px-1 text-sm font-medium">{selected.size} selected</span>
          <BulkSelect label="Assign to…" onPick={(v) => bulk({ ownerSet: true, ownerMemberId: v === "none" ? null : v }, "Assigned")} options={[["none", "Unassigned"], ...activeTeam.map((m) => [m.id, m.name] as [string, string])]} />
          <BulkSelect label="Move to…" onPick={(v) => bulk({ stage: v }, `Moved to ${STAGE_LABEL[v]}`)} options={STAGES.filter((s) => s !== "Lost").map((s) => [s, STAGE_LABEL[s]])} />
          <button
            type="button"
            className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted"
            onClick={() => {
              const t = window.prompt("Tag to add");
              if (t?.trim()) bulk({ addTag: t.trim() }, `Tagged "${t.trim()}"`);
            }}
          >
            Add tag
          </button>
          {(data?.tags.length ?? 0) > 0 && <BulkSelect label="Remove tag…" onPick={(v) => bulk({ removeTag: v }, `Removed "${v}"`)} options={(data?.tags ?? []).map((t) => [t, t])} />}
          <button type="button" className="ml-auto rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted" onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="h-64 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : data && data.total === 0 ? (
        <Empty />
      ) : layout === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" aria-label="Select all shown" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(visibleIds))} />
                </th>
                <th className="px-3 py-2.5 font-medium">Lead</th>
                <th className="px-3 py-2.5 font-medium">Interested in</th>
                <th className="px-3 py-2.5 font-medium">Stage</th>
                <th className="px-3 py-2.5 font-medium">Owner</th>
                <th className="px-3 py-2.5 font-medium">Next follow-up</th>
                <th className="px-3 py-2.5 font-medium">Last contact</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">
                    No leads match. <button type="button" className="text-cyan-700 hover:underline dark:text-cyan-400" onClick={() => { setFilters({}); setSearch(""); }}>Show all leads</button>
                  </td>
                </tr>
              )}
              {leads.map((l) => (
                <tr key={l.leadId} className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/40 ${selected.has(l.leadId) ? "bg-cyan-600/5" : ""}`} onClick={() => openLead(l.leadId)}>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Select ${l.name ?? l.email ?? "lead"}`} checked={selected.has(l.leadId)} onChange={() => toggle(l.leadId)} />
                  </td>
                  <td className="px-3 py-2.5">
                    <button type="button" className="text-left font-medium hover:underline" onClick={(e) => { e.stopPropagation(); openLead(l.leadId); }}>
                      {l.name || l.email || "Unnamed lead"}
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{l.email ?? l.phone ?? "No contact details"}</span>
                      {l.duplicate && <span className="inline-flex items-center gap-0.5 text-amber-800 dark:text-amber-300" title="Another inquiry has the same email"><AlertTriangle aria-hidden="true" className="h-3 w-3" />Duplicate</span>}
                      {l.doNotContact && <span className="inline-flex items-center gap-0.5 text-red-700 dark:text-red-400"><Ban aria-hidden="true" className="h-3 w-3" />Do not contact</span>}
                      {l.tags.map((t) => <span key={t} className="rounded-full bg-muted px-1.5">{t}</span>)}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span>{l.requestType === "guidance" ? "Career guidance" : (l.course ?? "Course no longer listed")}</span>
                    <div className="text-xs text-muted-foreground">{l.source}{l.quizShared ? " · quiz shared" : ""}</div>
                  </td>
                  <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <StageMenu lead={l} onMove={move} />
                  </td>
                  <td className="px-3 py-2.5">{l.owner ?? <span className="text-muted-foreground">Unassigned</span>}</td>
                  <td className={`px-3 py-2.5 whitespace-nowrap ${l.overdue ? "font-medium text-red-700 dark:text-red-400" : ""}`}>
                    {l.nextFollowUpAt ? relative(l.nextFollowUpAt) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {l.awaitingReply ? (
                      <span className="rounded-full bg-cyan-600/10 px-2 py-0.5 text-xs font-medium text-cyan-800 dark:text-cyan-300">Replied {relative(l.lastReplyAt)}</span>
                    ) : l.lastContactAt ? (
                      <span className="text-muted-foreground">{relative(l.lastContactAt)}</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Not contacted</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.leads.length >= 1000 && <p className="p-3 text-xs text-muted-foreground">Showing the 1,000 most recently active. Narrow the filters to see others.</p>}
        </div>
      ) : (
        <Board leads={leads} onMove={move} openLead={openLead} />
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="text-xs font-medium text-muted-foreground">
      {label}
      <select className={`${input} mt-1 w-full`} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function BulkSelect({ label, onPick, options }: { label: string; onPick: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      aria-label={label}
      value=""
      onChange={(e) => e.target.value && onPick(e.target.value)}
      className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm"
    >
      <option value="">{label}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function StageMenu({ lead, onMove }: { lead: LeadRow; onMove: (l: LeadRow, s: string) => void }) {
  return (
    <label className="relative inline-flex">
      <span className="sr-only">Stage for {lead.name}</span>
      <StageBadge stage={lead.stage} />
      <select value={lead.stage} onChange={(e) => onMove(lead, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {STAGES.map((s) => (
          <option key={s} value={s}>
            {STAGE_LABEL[s]}
          </option>
        ))}
      </select>
    </label>
  );
}

function Board({ leads, onMove, openLead }: { leads: LeadRow[]; onMove: (l: LeadRow, s: string) => void; openLead: (id: string) => void }) {
  const [dragging, setDragging] = useState<LeadRow | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const columns = [...OPEN_STAGES, "Enrolled", "Lost"];
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((stage) => {
        const items = leads.filter((l) => l.stage === stage);
        return (
          <section
            key={stage}
            aria-label={STAGE_LABEL[stage]}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(stage);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={() => {
              if (dragging) onMove(dragging, stage);
              setDragging(null);
              setOver(null);
            }}
            className={`flex w-64 shrink-0 flex-col rounded-2xl border p-2 ${over === stage ? "border-cyan-600 bg-cyan-600/5" : "border-border bg-muted/30"}`}
          >
            <h3 className="flex items-center justify-between px-1.5 pb-2 text-xs font-semibold">
              {STAGE_LABEL[stage]} <span className="tabular-nums text-muted-foreground">{items.length}</span>
            </h3>
            <ul className="space-y-2">
              {items.slice(0, 100).map((l) => (
                <li
                  key={l.leadId}
                  draggable
                  onDragStart={() => setDragging(l)}
                  onDragEnd={() => setDragging(null)}
                  className="cursor-grab rounded-xl border border-border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing"
                >
                  <button type="button" onClick={() => openLead(l.leadId)} className="block w-full text-left font-medium hover:underline">
                    {l.name || l.email || "Unnamed lead"}
                  </button>
                  <p className="truncate text-xs text-muted-foreground">{l.requestType === "guidance" ? "Career guidance" : (l.course ?? "Course")}</p>
                  {l.awaitingReply && <p className="mt-1 inline-block rounded-full bg-cyan-600/10 px-2 py-0.5 text-[11px] font-medium text-cyan-800 dark:text-cyan-300">Replied, needs answer</p>}
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">{l.owner ?? "Unassigned"}</p>
                  <p className={`text-xs ${l.overdue ? "font-medium text-red-700 dark:text-red-400" : "text-muted-foreground"}`}>
                    {l.nextFollowUpAt ? `${l.overdue ? "Follow-up overdue" : "Next follow-up"} ${relative(l.nextFollowUpAt)}` : "No follow-up scheduled"}
                  </p>
                  <button type="button" onClick={() => openLead(l.leadId)} className="mt-1.5 w-full rounded-md border border-cyan-600/40 px-1.5 py-1 text-xs font-medium text-cyan-800 hover:bg-cyan-600/10 dark:text-cyan-300">
                    Open: notes, calls, follow-ups
                  </button>
                  <select aria-label={`Move ${l.name ?? "lead"}`} value={l.stage} onChange={(e) => onMove(l, e.target.value)} className="mt-1.5 w-full rounded-md border border-border bg-background px-1.5 py-1 text-xs">
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
              {items.length > 100 && <li className="px-1.5 text-xs text-muted-foreground">+{items.length - 100} more; use the table or filters.</li>}
              {items.length === 0 && <li className="px-1.5 py-4 text-center text-xs text-muted-foreground">Drop a lead here</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="font-medium">No leads yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Leads arrive when people ask about your courses on Edulexa, request career guidance from you, or fill in the guidance form on your website.
      </p>
      <a href="/institute/guidance" className="mt-3 inline-block text-sm text-cyan-700 hover:underline dark:text-cyan-400">
        Get the form for your website
      </a>
    </div>
  );
}


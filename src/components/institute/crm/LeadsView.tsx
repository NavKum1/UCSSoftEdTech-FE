"use client";

/**
 * The leads: quick filters for the day's work (my leads, new, overdue, unassigned), search and more filters, saved views,
 * a table or a board by stage (drag a card, or use its stage menu), selection with bulk assign / move / tag, and CSV export.
 */

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useLatestRef } from "@/lib/legacyApi";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Ban, Bookmark, Download, KanbanSquare, List, Search, SlidersHorizontal, X } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import {
  crm,
  OPEN_STAGES,
  query,
  relative,
  PriorityBadge,
  StageBadge,
  StageDot,
  STAGE_BORDER,
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
  { key: "priority", label: "High priority", filters: { priority: true } },
  { key: "overdue", label: "Follow-up overdue", filters: { overdue: true } },
  { key: "unassigned", label: "Unassigned", filters: { owner: "none" } },
  { key: "spam", label: "Possible spam", filters: { spam: true } },
  { key: "incomplete", label: "Incomplete", filters: { incomplete: true } },
];

const LAYOUT_KEY = "crm_layout";
function readLayout(): "table" | "board" {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "board" ? "board" : "table";
  } catch {
    return "table";
  }
}
function subscribeLayout(cb: () => void) {
  window.addEventListener(LAYOUT_KEY, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(LAYOUT_KEY, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Received ranges: [key, label, ISO start] (computed when the page loads) */
const RANGES: [string, string, string][] = [
  ["30", "Last 30 days", new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)],
  ["90", "Last 90 days", new Date(Date.now() - 90 * 86400e3).toISOString().slice(0, 10)],
  ["365", "Last 12 months", new Date(Date.now() - 365 * 86400e3).toISOString().slice(0, 10)],
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
  loadMore,
  loadingMore,
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
  loadMore: () => void;
  loadingMore: boolean;
}) {
  // The remembered layout is read from this browser only after hydration (the server always renders the table)
  const layout = useSyncExternalStore(subscribeLayout, readLayout, () => "table" as const);
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
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {}
    window.dispatchEvent(new Event(LAYOUT_KEY));
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
          const count = q.key === "new" ? data?.counts?.New : q.key === "awaiting" ? data?.awaiting : q.key === "priority" ? data?.highPriority : q.key === "spam" ? data?.spam : q.key === "incomplete" ? data?.incomplete : undefined;
          return (
            <button
              key={q.key}
              type="button"
              aria-pressed={on}
              onClick={() => setFilters({ ...q.filters, q: filters.q })}
              title={q.key === "overdue" ? "Leads with a follow-up whose due time has passed and isn't ticked off" : q.key === "incomplete" ? "People who started a website form and gave their contact details but haven't sent it yet" : undefined}
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
          <input className={`${input} w-full pl-9`} placeholder="Search name, email, phone, course, source, tag or question" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <button type="button" onClick={() => setMore(!more)} aria-expanded={more} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${advanced ? "border-cyan-600 text-cyan-800 dark:text-cyan-300" : "border-border"} hover:bg-muted`}>
          <SlidersHorizontal aria-hidden="true" className="h-4 w-4" /> Filters
        </button>
        <label className="inline-flex items-center gap-1.5 text-sm">
          <span className="sr-only">Sort</span>
          <select value={filters.sort ?? ""} onChange={(e) => setFilters({ ...filters, sort: e.target.value || undefined, dir: undefined })} className={`${input} py-2`}>
            <option value="">Recent activity first</option>
            <option value="received">Newest received first</option>
            <option value="followup">Next follow-up first</option>
            <option value="contact">Last contacted first</option>
            <option value="name">Name A–Z</option>
            <option value="course">Interested in A–Z</option>
            <option value="stage">Stage (pipeline order)</option>
            <option value="owner">Owner A–Z</option>
          </select>
        </label>
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
        <div className="grid gap-2 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-6">
          <Select label="Stage" value={filters.stage ?? ""} onChange={(v) => setFilters({ ...filters, stage: v || undefined })} options={STAGES.map((s) => [s, STAGE_LABEL[s]])} />
          <Select
            label="Owner"
            value={filters.owner ?? ""}
            onChange={(v) => setFilters({ ...filters, owner: v || undefined })}
            options={[["me", "Me"], ["none", "Unassigned"], ...activeTeam.map((m) => [m.id, m.name] as [string, string])]}
          />
          <Select label="Request" value={filters.type ?? ""} onChange={(v) => setFilters({ ...filters, type: v || undefined })} options={[["course", "Course inquiry"], ["guidance", "Career guidance"]]} />
          <Select label="Source" value={filters.source ?? ""} onChange={(v) => setFilters({ ...filters, source: v || undefined })} options={(data?.sources ?? []).map((s) => [s, s])} />
          <Select
            label="Received"
            value={RANGES.find((r) => r[2] === filters.from)?.[0] ?? (filters.from ? "custom" : "")}
            onChange={(v) => setFilters({ ...filters, from: RANGES.find((r) => r[0] === v)?.[2] })}
            options={RANGES.map((r) => [r[0], r[1]])}
          />
          <Select label="Tag" value={filters.tag ?? ""} onChange={(v) => setFilters({ ...filters, tag: v || undefined })} options={(data?.tags ?? []).map((t) => [t, t])} />
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-6">
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
      ) : data && (data.totalAll ?? data.total) === 0 ? (
        <Empty />
      ) : layout === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2.5">
                  <input type="checkbox" aria-label="Select all shown" checked={allChecked} onChange={() => setSelected(allChecked ? new Set() : new Set(visibleIds))} />
                </th>
                <SortHeader label="Lead" sort="name" filters={filters} setFilters={setFilters} />
                <SortHeader label="Interested in" sort="course" filters={filters} setFilters={setFilters} />
                <SortHeader label="Stage" sort="stage" filters={filters} setFilters={setFilters} />
                <SortHeader label="Owner" sort="owner" filters={filters} setFilters={setFilters} />
                <SortHeader label="Next follow-up" sort="followup" filters={filters} setFilters={setFilters} />
                <SortHeader label="Last contact" sort="contact" filters={filters} setFilters={setFilters} />
                <SortHeader label="Received" sort="received" filters={filters} setFilters={setFilters} />
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
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
                      <span>{[l.email, l.phone].filter(Boolean).join(" · ") || "No contact details"}</span>
                      {l.duplicate && <span className="inline-flex items-center gap-0.5 text-amber-800 dark:text-amber-300" title="Another inquiry has the same email"><AlertTriangle aria-hidden="true" className="h-3 w-3" />Duplicate</span>}
                      {l.doNotContact && <span className="inline-flex items-center gap-0.5 text-red-700 dark:text-red-400"><Ban aria-hidden="true" className="h-3 w-3" />Do not contact</span>}
                      {l.highPriority && <PriorityBadge />}
                      {l.spam && (
                        <span className="rounded-full border border-zinc-500/30 bg-zinc-500/10 px-1.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300" title={l.spamReasons ?? undefined}>
                          Possible spam
                        </span>
                      )}
                      {l.incomplete && <IncompleteBadge unconfirmed={l.unconfirmed} />}
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
                    ) : l.stage !== "New" ? (
                      // Moved on (or imported at a later stage) with no contact recorded here
                      <span className="text-muted-foreground" title="No contact recorded in Edulexa">—</span>
                    ) : (
                      <span className="text-xs font-medium text-amber-800 dark:text-amber-300">Not contacted</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground" title={new Date(l.createdAt).toLocaleString()}>
                    {relative(l.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
              <span>
                Showing {leads.length.toLocaleString()} of {data.total.toLocaleString()}
                {data.total !== (data.totalAll ?? data.total) ? ` matching (${(data.totalAll ?? data.total).toLocaleString()} in all)` : ""}
              </span>
              {data.hasMore && (
                <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50">
                  {loadingMore ? "Loading…" : "Load 50 more"}
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <Board getToken={getToken} filters={filters} refreshKey={data} onMove={move} openLead={openLead} />
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

/**
 * The board: one column per stage, each loading its own leads (25 at a time, "Load more") with its true total, so it
 * works with any number of leads. Columns reload whenever the list reloads (after a move, a filter change, …).
 */
function Board({
  getToken,
  filters,
  refreshKey,
  onMove,
  openLead,
}: {
  getToken: GetToken;
  filters: Filters;
  refreshKey: unknown;
  onMove: (l: LeadRow, s: string) => void;
  openLead: (id: string) => void;
}) {
  const [dragging, setDragging] = useState<LeadRow | null>(null);
  const columns = [...OPEN_STAGES, "Enrolled", "Lost"];
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {columns.map((stage) => (
        <BoardColumn
          key={stage}
          stage={stage}
          getToken={getToken}
          filters={filters}
          refreshKey={refreshKey}
          dragging={dragging}
          setDragging={setDragging}
          onMove={onMove}
          openLead={openLead}
        />
      ))}
    </div>
  );
}

function BoardColumn({
  stage,
  getToken,
  filters,
  refreshKey,
  dragging,
  setDragging,
  onMove,
  openLead,
}: {
  stage: string;
  getToken: GetToken;
  filters: Filters;
  refreshKey: unknown;
  dragging: LeadRow | null;
  setDragging: (l: LeadRow | null) => void;
  onMove: (l: LeadRow, s: string) => void;
  openLead: (id: string) => void;
}) {
  const [items, setItems] = useState<LeadRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  // A filter on one stage hides the other columns' leads
  const hidden = !!filters.stage && filters.stage !== stage;
  const path = useCallback(
    (p: number) => `/leads${query({ ...filters, stage })}${query({ ...filters, stage }) ? "&" : "?"}pageSize=25&summary=false&page=${p}`,
    [filters, stage]
  );

  const load = useCallback(
    async (p: number) => {
      setBusy(true);
      try {
        const r = await crm<{ leads: LeadRow[]; total: number; hasMore: boolean }>(getToken, path(p));
        setItems((prev) => (p === 1 ? r.leads : [...prev, ...r.leads]));
        setTotal(r.total);
        setHasMore(r.hasMore);
        setPage(p);
      } catch {
        setHasMore(false);
      } finally {
        setBusy(false);
      }
    },
    [getToken, path]
  );
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (!hidden) loadRef.current(1);
  }, [loadRef, hidden, refreshKey, filters]);

  const shown = hidden ? [] : items;
  return (
    <section
      aria-label={STAGE_LABEL[stage]}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        if (dragging) onMove(dragging, stage);
        setDragging(null);
        setOver(false);
      }}
      className={`flex w-64 shrink-0 flex-col rounded-2xl border border-t-4 p-2 ${STAGE_BORDER[stage]} ${over ? "bg-cyan-600/5 ring-2 ring-cyan-600/40" : "border-x-border border-b-border bg-muted/30"}`}
    >
      <h3 className="flex items-center justify-between px-1.5 pb-2 text-xs font-semibold">
        <span className="inline-flex items-center gap-1.5">
          <StageDot stage={stage} />
          {STAGE_LABEL[stage]}
        </span>
        <span className="tabular-nums text-muted-foreground">{hidden ? "—" : (total ?? "…").toLocaleString()}</span>
      </h3>
      <ul className="space-y-2">
        {shown.map((l) => (
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
            {l.highPriority && (
              <p className="mt-1">
                <PriorityBadge />
              </p>
            )}
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
        {!hidden && hasMore && (
          <li>
            <button type="button" disabled={busy} onClick={() => load(page + 1)} className="w-full rounded-lg border border-dashed border-border py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50">
              {busy ? "Loading…" : `Load more (${((total ?? 0) - shown.length).toLocaleString()} more)`}
            </button>
          </li>
        )}
        {!hidden && !busy && total === 0 && <li className="px-1.5 py-4 text-center text-xs text-muted-foreground">Drop a lead here</li>}
        {hidden && <li className="px-1.5 py-4 text-center text-xs text-muted-foreground">Filtered out</li>}
      </ul>
    </section>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <p className="font-medium">No leads yet</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Leads arrive when people ask about your courses on Edulexa, request career guidance from you, or fill in the guidance form on your website.
      </p>
      <Link href="/institute/guidance" className="mt-3 inline-block text-sm text-cyan-700 hover:underline dark:text-cyan-400">
        Get the form for your website
      </Link>
    </div>
  );
}


/** Natural first direction for each column: A–Z / pipeline order / soonest for text and follow-ups, newest first for dates */
const ASC_FIRST = new Set(["name", "course", "stage", "owner", "followup"]);

/** A column header that sorts the list by that column; a second click reverses the order. */
function SortHeader({ label, sort, filters, setFilters }: { label: string; sort: string; filters: Filters; setFilters: (f: Filters) => void }) {
  const active = (filters.sort ?? "") === sort;
  const natural = ASC_FIRST.has(sort) ? "asc" : "desc";
  const dir = active ? (filters.dir ?? natural) : null;
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  const click = () => {
    const next = active ? (dir === "asc" ? "desc" : "asc") : natural;
    setFilters({ ...filters, sort, dir: next === natural ? undefined : next });
  };
  return (
    <th className="px-3 py-2.5 font-medium" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}>
      <button type="button" onClick={click} className={`inline-flex items-center gap-1 rounded hover:text-foreground ${active ? "text-foreground" : ""}`} title={`Sort by ${label.toLowerCase()}`}>
        {label}
        <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${active ? "" : "opacity-40"}`} />
      </button>
    </th>
  );
}

/** A website form saved part way (not sent yet) */
function IncompleteBadge({ unconfirmed }: { unconfirmed?: boolean }) {
  return (
    <span
      className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-300"
      title={`Started your website form but hasn't sent it yet${unconfirmed ? "; email not confirmed" : ""}`}
    >
      Incomplete
    </span>
  );
}

"use client";

/**
 * Platform admin: self-serve schools (plan items S1/S2, 2 Nov 2026). Every school that signed up on /start, with its
 * plan, state and owner; a trial can be extended, a school suspended (read-only at once), or a read-only school opened again for a set number of days. Schools on a
 * contract with Edulexa's team aren't listed: they have no self-serve plan.
 */
import React, { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { REASONS, day } from "@/components/institute/SchoolPlan";
import { useEn } from "@/lib/english/EnglishProvider";

interface SchoolRow {
  instituteId: string;
  name: string | null;
  slug: string | null;
  plan: string;
  interval: "month" | "year";
  currency: string;
  status: "Trialing" | "Active" | "PastDue" | "ReadOnly" | "Deleted";
  provider: string;
  country: string;
  ownerEmail: string;
  freeEmail: boolean;
  trialEndsAt: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  readOnlySince: string | null;
  deleteAfter: string | null;
  readOnlyReason: string | null;
  createdAt: string;
}

const FILTERS = [
  { key: "", label: "All" },
  { key: "Trialing", label: "In trial" },
  { key: "Active", label: "Paying" },
  { key: "PastDue", label: "Payment failed" },
  { key: "ReadOnly", label: "Read-only" },
  { key: "Deleted", label: "Deleted" },
];
const TONE: Record<string, string> = {
  Trialing: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
  Active: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200",
  PastDue: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200",
  ReadOnly: "bg-red-50 text-red-800 dark:bg-red-950/60 dark:text-red-200",
  Deleted: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
const button = "rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted disabled:opacity-50";

function stateLine(s: SchoolRow) {
  if (s.status === "Trialing") return `Trial ends ${day(s.trialEndsAt)}${s.cancelAtPeriodEnd ? " (cancelled)" : ""}`; // en() where shown
  if (s.status === "Active") return `${s.cancelAtPeriodEnd ? "Ends" : "Renews"} ${day(s.currentPeriodEnd)}`;
  if (s.status === "PastDue") return "Last payment failed";
  if (s.status === "ReadOnly") return `Read-only: ${REASONS[s.readOnlyReason ?? ""] ?? "not paid"}. Deleted ${day(s.deleteAfter)}`;
  return "Data deleted";
}

export default function PlatformSchoolsPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [rows, setRows] = useState<SchoolRow[] | null>(null);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async (status: string) => {
    const res = await apiFetch(`/api/admin/schools${status ? `?status=${status}` : ""}`);
    if (!res.ok) return setMessage({ ok: false, text: "The schools couldn't be loaded. Please try again." });
    setRows(await res.json());
  };
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current(filter);
  }, [ready, filter, loadRef]);

  if (access) return <AccessNotice problem={access} feature="schools" />;

  const act = async (s: SchoolRow, action: "extend" | "suspend" | "reactivate") => {
    let body: object = {};
    if (action === "extend") {
      const days = Number(window.prompt(`Extend ${s.name ?? "this school"}'s trial by how many days? (1 to 90)`, "14"));
      if (!days) return;
      body = { days };
    }
    if (action === "reactivate") {
      const days = Number(window.prompt(`Open ${s.name ?? "this school"} again for how many days? Use this when they've paid Edulexa's team directly; it becomes read-only again afterwards unless they choose a plan. (1 to 400)`, "30"));
      if (!days) return;
      body = { days };
    }
    if (action === "suspend" && !window.confirm(`Suspend ${s.name ?? "this school"}? It becomes read-only now and its plan stops charging. Its data is deleted after 30 days unless you bring it back.`))
      return;
    setBusy(s.instituteId + action);
    setMessage(null);
    const res = await apiFetch(`/api/admin/schools/${s.instituteId}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json().catch(() => null);
    setBusy(null);
    if (!res.ok) return setMessage({ ok: false, text: d?.error ?? "That didn't work." });
    setMessage({ ok: true, text: action === "extend" ? "The trial was extended." : action === "suspend" ? "The school was suspended." : "The school is open again." });
    await load(filter);
  };

  const q = query.trim().toLowerCase();
  const shown = (rows ?? []).filter((s) => !q || [s.name, s.slug, s.ownerEmail, s.country].some((v) => v?.toLowerCase().includes(q)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Schools</h1>
        <p className="mt-1 text-sm text-muted-foreground">Schools that signed up themselves, their plan and how they pay. Schools on a contract aren&apos;t listed.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Show" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${filter === f.key ? "bg-foreground text-background" : "border border-border hover:bg-muted"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative ms-auto w-full sm:w-64">
          <span className="sr-only">Search schools</span>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, address, owner or country"
            className="w-full rounded-lg border border-border bg-background py-2 ps-9 pe-3 text-sm"
          />
        </label>
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
          {message.text}
        </p>
      )}

      {rows == null ? (
        <Loader2 aria-label="Loading" className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {rows.length === 0 ? "No school has signed up yet. Schools appear here once they finish the sign-up at /start." : "No school matches that search."}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {shown.map((s) => (
            <li key={s.instituteId} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.4fr)_13rem] md:items-center">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name ?? "School"}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {s.ownerEmail}
                  {s.freeEmail && <span className="ms-1.5 rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-950/60 dark:text-amber-200">personal e-mail</span>}
                </p>
              </div>
              <div className="text-sm">
                <p>
                  {s.plan}, {s.interval === "year" ? "yearly" : "monthly"}
                </p>
                <p className="text-muted-foreground">
                  {s.country} · {s.currency} · {s.provider === "razorpay" ? "Razorpay" : "Stripe"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${TONE[s.status]}`}>{FILTERS.find((f) => f.key === s.status)?.label}</span>
                <span className="text-muted-foreground">{en(stateLine(s))}</span>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {s.status === "Trialing" && (
                  <button type="button" disabled={busy != null} onClick={() => void act(s, "extend")} className={button}>
                    Extend trial
                  </button>
                )}
                {s.status !== "Deleted" && s.status !== "ReadOnly" && (
                  <button type="button" disabled={busy != null} onClick={() => void act(s, "suspend")} className={`${button} text-red-700 dark:text-red-300`}>
                    Suspend
                  </button>
                )}
                {s.status === "ReadOnly" && (
                  <button type="button" disabled={busy != null} onClick={() => void act(s, "reactivate")} className={button}>
                    Reopen
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import React, { useRef, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { ROLES, ROLE_LABELS, labelOf } from "@/components/career/coreLabels";

interface Member {
  id: string;
  userId?: string | null;
  email: string;
  name: string;
  role: string;
  status: string;
  studentNumber?: string | null;
  ferpaHold: boolean;
  source: string;
  createdAt: string;
  linkedAt?: string | null;
}

interface ImportResult {
  dryRun: boolean;
  created: number;
  updated: number;
  errors: { line: number; error: string }[];
}

interface MemberCounts {
  total: number;
  byRole: Record<string, number>;
  byStatus: Record<string, number>;
}

const PAGE_SIZE = 25;
const STATUS_TONE: Record<string, "good" | "warn" | "bad"> = { Active: "good", Invited: "warn", Suspended: "bad" };

export default function PeoplePage() {
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  const isAdmin = me?.memberships.some((m) => m.instituteId === schoolId && m.role === "CareerAdmin") ?? false;

  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const list = useLoad(
    () => api<{ total: number; items: Member[] }>(`/api/career/admin/members?page=${page}&pageSize=${PAGE_SIZE}${role ? `&role=${role}` : ""}${search ? `&q=${encodeURIComponent(search)}` : ""}`),
    [api, schoolId, role, search, page],
  );

  const counts = useLoad(() => api<MemberCounts>("/api/career/admin/member-counts"), [api, schoolId, list.data]);

  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [invite, setInvite] = useState({ email: "", name: "", role: "Counselor" });

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    void run("invite", async () => {
      await api("/api/career/admin/members", { method: "POST", json: { email: invite.email, name: invite.name || null, role: invite.role } });
      setMsg(`${invite.email} was invited as ${ROLE_LABELS[invite.role]}. They're linked when they sign in with that email.`);
      setInvite({ ...invite, email: "", name: "" });
      list.reload();
    });
  };

  const update = (m: Member, change: Partial<Pick<Member, "role" | "status" | "ferpaHold">>) =>
    run(m.id, async () => {
      const saved = await api<Member>(`/api/career/admin/members/${m.id}`, { method: "PATCH", json: change });
      list.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === m.id ? saved : x)) } : d));
      setMsg(`${m.name} was updated.`);
    });

  const remove = (m: Member) => {
    if (!window.confirm(`Remove ${m.name} (${ROLE_LABELS[m.role] ?? m.role}) from this school?`)) return;
    void run(m.id, async () => {
      await api(`/api/career/admin/members/${m.id}`, { method: "DELETE" });
      setMsg(`${m.name} was removed.`);
      list.reload();
    });
  };

  // Roster import: preview first, then confirm with the same file
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const importRoster = (dryRun: boolean) =>
    run(dryRun ? "preview" : "import", async () => {
      if (!file) throw new Error("Choose a CSV file first.");
      const fd = new FormData();
      fd.append("file", file);
      const r = await api<ImportResult>(`/api/career/admin/roster/import?dryRun=${dryRun}`, { method: "POST", body: fd });
      if (dryRun) setPreview(r);
      else {
        setPreview(null);
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setMsg(`Roster imported: ${r.created} added, ${r.updated} updated${r.errors.length ? `, ${r.errors.length} rows skipped` : ""}.`);
        list.reload();
      }
    });

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="People" description="Students, staff and faculty at your school." />
      <ErrorBanner error={err ?? list.error} />
      <SuccessBanner message={msg} />
      {counts.data && (
        <dl className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label="Member counts">
          <div><dt className="inline text-muted-foreground">Total: </dt><dd className="inline font-semibold">{counts.data.total}</dd></div>
          {ROLES.filter((r) => counts.data!.byRole[r]).map((r) => (
            <div key={r}><dt className="inline text-muted-foreground">{ROLE_LABELS[r] ?? r}: </dt><dd className="inline font-semibold">{counts.data!.byRole[r]}</dd></div>
          ))}
          {Object.entries(counts.data.byStatus).filter(([, n]) => n > 0).map(([st, n]) => (
            <div key={st}><dt className="inline text-muted-foreground">{st}: </dt><dd className="inline font-semibold">{n}</dd></div>
          ))}
        </dl>
      )}

      <Card className="mb-6">
        <form
          className="flex flex-wrap items-end gap-3"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(q.trim());
          }}
        >
          <div className="w-48">
            <Field label="Role">
              {(p) => (
                <select
                  {...p}
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All roles</option>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="min-w-48 flex-1">
            <Field label="Search name or email">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </Card>

      <Card title={`Members (${total})`} className="mb-6">
        {list.loading && !list.data ? (
          <Loading />
        ) : (list.data?.items ?? []).length === 0 ? (
          <EmptyState title="No one matches">Try another role or search, or invite someone below.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Members, page {page} of {pages}</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">Name</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Role</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Directory hold</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Added</th>
                  <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data!.items.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}{m.studentNumber ? ` · #${m.studentNumber}` : ""}</div>
                      {!m.userId && <div className="text-xs text-muted-foreground">Not signed in yet</div>}
                    </td>
                    <td className="py-2 pr-3">
                      {isAdmin ? (
                        <select aria-label={`Role for ${m.name}`} className="rounded-md border border-border bg-background px-2 py-1" value={m.role} disabled={busy === m.id} onChange={(e) => update(m, { role: e.target.value })}>
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        labelOf(ROLE_LABELS, m.role)
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {isAdmin ? (
                        <select aria-label={`Status for ${m.name}`} className="rounded-md border border-border bg-background px-2 py-1" value={m.status} disabled={busy === m.id} onChange={(e) => update(m, { status: e.target.value })}>
                          {["Active", "Invited", "Suspended"].map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {m.role === "Student" || m.role === "Alumni" ? (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="h-4 w-4" checked={m.ferpaHold} disabled={!isAdmin || busy === m.id} onChange={(e) => update(m, { ferpaHold: e.target.checked })} />
                          {m.ferpaHold ? "On" : "Off"}
                          <span className="sr-only"> directory hold for {m.name}</span>
                        </label>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(m.createdAt)}<div className="text-xs text-muted-foreground">{m.source}</div></td>
                    <td className="py-2 text-right">
                      {isAdmin && (
                        <Button variant="ghost" onClick={() => remove(m)} busy={busy === m.id} aria-label={`Remove ${m.name}`}>Remove</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span aria-live="polite">Page {page} of {pages}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
          </nav>
        )}
      </Card>

      {isAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Invite someone">
            <form onSubmit={sendInvite} className="space-y-3">
              <Field label="Email">{(p) => <input {...p} type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />}</Field>
              <Field label="Name">{(p) => <input {...p} value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />}</Field>
              <Field label="Role">
                {(p) => (
                  <select {...p} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                )}
              </Field>
              <Button type="submit" busy={busy === "invite"}>Send invite</Button>
            </form>
          </Card>

          <Card title="Import student roster">
            <p className="mb-3 text-sm text-muted-foreground">
              CSV with an <strong>Email</strong> column and optional Name, Student number, Degree, Major (separate several with ;) and Graduation date. Rows become school-verified education.
            </p>
            <div className="space-y-3">
              <Field label="CSV file">
                {(p) => (
                  <input
                    {...p}
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setPreview(null);
                    }}
                  />
                )}
              </Field>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => importRoster(true)} busy={busy === "preview"} disabled={!file}>Preview</Button>
                <Button onClick={() => importRoster(false)} busy={busy === "import"} disabled={!file || !preview}>Confirm import</Button>
              </div>
              {preview && (
                <div role="status" className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">Preview: {preview.created} new, {preview.updated} updated, {preview.errors.length} with problems.</p>
                  {preview.errors.length > 0 && (
                    <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-red-700 dark:text-red-400">
                      {preview.errors.map((e, i) => <li key={i}>Line {e.line}: {e.error}</li>)}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Rows with problems are skipped. Nothing is saved until you confirm.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

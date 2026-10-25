"use client";

import React, { useRef, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT, useCareerLabels } from "@/components/career/ui";
import { ROLES, labelOf, useRoleLabels } from "@/components/career/coreLabels";

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
const MEMBER_STATUSES = ["Active", "Invited", "Suspended"];

export default function PeoplePage() {
  const t = useCareerT("careerCenterPeople");
  const ROLE_LABELS = useRoleLabels();
  const STATUS_LABELS = useCareerLabels("careerCenterPeople.memberStatus", MEMBER_STATUSES);
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
      setErr(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const sendInvite = (e: React.FormEvent) => {
    e.preventDefault();
    void run("invite", async () => {
      await api("/api/career/admin/members", { method: "POST", json: { email: invite.email, name: invite.name || null, role: invite.role } });
      setMsg(t("emailWasInvitedAsRole", { email: invite.email, role: ROLE_LABELS[invite.role] }));
      setInvite({ ...invite, email: "", name: "" });
      list.reload();
    });
  };

  const update = (m: Member, change: Partial<Pick<Member, "role" | "status" | "ferpaHold">>) =>
    run(m.id, async () => {
      const saved = await api<Member>(`/api/career/admin/members/${m.id}`, { method: "PATCH", json: change });
      list.setData((d) => (d ? { ...d, items: d.items.map((x) => (x.id === m.id ? saved : x)) } : d));
      setMsg(t("nameWasUpdated", { name: m.name }));
    });

  const remove = (m: Member) => {
    if (!window.confirm(t("removeNameRoleFromThis", { name: m.name, role: ROLE_LABELS[m.role] ?? m.role }))) return;
    void run(m.id, async () => {
      await api(`/api/career/admin/members/${m.id}`, { method: "DELETE" });
      setMsg(t("nameWasRemoved", { name: m.name }));
      list.reload();
    });
  };

  // Roster import: preview first, then confirm with the same file
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const importRoster = (dryRun: boolean) =>
    run(dryRun ? "preview" : "import", async () => {
      if (!file) throw new Error(t("chooseACSVFileFirst"));
      const fd = new FormData();
      fd.append("file", file);
      const r = await api<ImportResult>(`/api/career/admin/roster/import?dryRun=${dryRun}`, { method: "POST", body: fd });
      if (dryRun) setPreview(r);
      else {
        setPreview(null);
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
        setMsg(t("rosterImportedCreatedAddedUpdated", { created: r.created, updated: r.updated, value: r.errors.length ? t("countRowsSkipped", { count: r.errors.length }) : "" }));
        list.reload();
      }
    });

  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader title={t("people")} description={t("studentsStaffAndFacultyAt")} />
      <ErrorBanner error={err ?? list.error} />
      <SuccessBanner message={msg} />
      {counts.data && (
        <dl className="mb-6 flex flex-wrap gap-x-6 gap-y-2 text-sm" aria-label={t("memberCounts")}>
          <div><dt className="inline text-muted-foreground">{t("total")}{" "}</dt><dd className="inline font-semibold">{counts.data.total}</dd></div>
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
            <Field label={t("role")}>
              {(p) => (
                <select
                  {...p}
                  value={role}
                  onChange={(e) => {
                    setRole(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">{t("allRoles")}</option>
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="min-w-48 flex-1">
            <Field label={t("searchNameOrEmail")}>{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          </div>
          <Button type="submit" variant="secondary">{t("search")}</Button>
        </form>
      </Card>

      <Card title={t("membersTotal", { total })} className="mb-6">
        {list.loading && !list.data ? (
          <Loading />
        ) : (list.data?.items ?? []).length === 0 ? (
          <EmptyState title={t("noOneMatches")}>{t("tryAnotherRoleOrSearch")}</EmptyState>
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("membersPagePageOfPages", { page, pages })}</caption>
              <thead>
                <tr className="border-b border-border text-start [&_th]:text-start">
                  <th scope="col" className="py-2 pe-3 font-medium">{t("name")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("role")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("status")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("directoryHold")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("added")}</th>
                  <th scope="col" className="py-2"><span className="sr-only">{t("actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {list.data!.items.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pe-3">
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.email}{m.studentNumber ? ` · #${m.studentNumber}` : ""}</div>
                      {!m.userId && <div className="text-xs text-muted-foreground">{t("notSignedInYet")}</div>}
                    </td>
                    <td className="py-2 pe-3">
                      {isAdmin ? (
                        <select aria-label={t("roleForName", { name: m.name })} className="rounded-md border border-border bg-background px-2 py-1" value={m.role} disabled={busy === m.id} onChange={(e) => update(m, { role: e.target.value })}>
                          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                        </select>
                      ) : (
                        labelOf(ROLE_LABELS, m.role)
                      )}
                    </td>
                    <td className="py-2 pe-3">
                      {isAdmin ? (
                        <select aria-label={t("statusForName", { name: m.name })} className="rounded-md border border-border bg-background px-2 py-1" value={m.status} disabled={busy === m.id} onChange={(e) => update(m, { status: e.target.value })}>
                          {MEMBER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      ) : (
                        <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABELS[m.status] ?? m.status}</Badge>
                      )}
                    </td>
                    <td className="py-2 pe-3">
                      {m.role === "Student" || m.role === "Alumni" ? (
                        <label className="flex items-center gap-2">
                          <input type="checkbox" className="h-4 w-4" checked={m.ferpaHold} disabled={!isAdmin || busy === m.id} onChange={(e) => update(m, { ferpaHold: e.target.checked })} />
                          {m.ferpaHold ? t("on") : t("off")}
                          <span className="sr-only">{" "}{t("directoryHoldForName", { name: m.name })}</span>
                        </label>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pe-3 whitespace-nowrap">{formatDate(m.createdAt)}<div className="text-xs text-muted-foreground">{m.source}</div></td>
                    <td className="py-2 text-end">
                      {isAdmin && (
                        <Button variant="ghost" onClick={() => remove(m)} busy={busy === m.id} aria-label={t("removeName", { name: m.name })}>{t("remove")}</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
        {pages > 1 && (
          <nav aria-label={t("pages")} className="mt-4 flex items-center gap-3 text-sm">
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("previous")}</Button>
            <span aria-live="polite">{t("pagePageOfPages", { page, pages })}</span>
            <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("next")}</Button>
          </nav>
        )}
      </Card>

      {isAdmin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title={t("inviteSomeone")}>
            <form onSubmit={sendInvite} className="space-y-3">
              <Field label={t("email")}>{(p) => <input {...p} type="email" required value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} />}</Field>
              <Field label={t("name")}>{(p) => <input {...p} value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />}</Field>
              <Field label={t("role")}>
                {(p) => (
                  <select {...p} value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                )}
              </Field>
              <Button type="submit" busy={busy === "invite"}>{t("sendInvite")}</Button>
            </form>
          </Card>

          <Card title={t("importStudentRoster")}>
            <p className="mb-3 text-sm text-muted-foreground">
              {t.rich("cSVWithAnEmailColumn", { strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
            <div className="space-y-3">
              <Field label={t("cSVFile")}>
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
                <Button variant="secondary" onClick={() => importRoster(true)} busy={busy === "preview"} disabled={!file}>{t("preview")}</Button>
                <Button onClick={() => importRoster(false)} busy={busy === "import"} disabled={!file || !preview}>{t("confirmImport")}</Button>
              </div>
              {preview && (
                <div role="status" className="rounded-lg border border-border p-3 text-sm">
                  <p className="font-medium">{t("previewCreatedNewUpdatedUpdated", { created: preview.created, updated: preview.updated, count: preview.errors.length })}</p>
                  {preview.errors.length > 0 && (
                    <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto ps-5 text-red-700 dark:text-red-400">
                      {preview.errors.map((e, i) => <li key={i}>{t("lineLineError", { line: e.line, error: e.error })}</li>)}
                    </ul>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">{t("rowsWithProblemsAreSkipped")}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

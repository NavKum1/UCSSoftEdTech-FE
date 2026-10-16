"use client";

/** G18 career-center privacy: rights-request queue, minors and guardians, school privacy policy and retention overrides. */
import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT } from "@/components/career/ui";
import { downloadBlob, requestTone, type PrivacyRequestRow, useRequestTypeLabels, useRequestStatusLabels } from "@/components/career/privacy/StudentPrivacyRights";

interface QueueRow {
  request: PrivacyRequestRow & { membershipId: string };
  student?: { name: string; email: string } | null;
}
interface PlanRow { table: string; module: string; action: string; rows: number; reason: string }
interface Detail {
  request: PrivacyRequestRow & { membershipId: string };
  student?: { name: string; email: string; studentNumber?: string | null } | null;
  trail: { action: string; at: string }[];
}
interface Guardian { id: string; name: string; email: string; status: string; respondedAt?: string | null; method?: string | null; noticeVersion?: string | null }
interface MinorRow { membershipId: string; name: string; email: string; dateOfBirth?: string | null; underAge?: boolean | null; ageSource?: string | null; isMinor: boolean; guardianConsented: boolean; guardians: Guardian[] }
interface Policy { countryCode: string; law: string; minorAge: number; guardianConsentRequired: boolean; purposeConsentRequired: boolean; rightsResponseDays: number; noticeVersion: string; noticeUrl?: string | null }
interface RetentionRow { recordType: string; globalDays: number; minimumDays: number; schoolDays: number | null; effectiveDays: number }

const ACTION_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { Delete: "bad", Keep: "neutral", Anonymise: "warn", Rekey: "warn", Pseudonymised: "info" };

function RequestPanel({ id, onChanged }: { id: string; onChanged: () => void }) {
  const tr = useCareerT("careerCenterPrivacy");
  const REQUEST_TYPE_LABELS = useRequestTypeLabels();
  const api = useApi();
  const detail = useLoad(() => api<Detail>(`/api/career/privacy/admin/requests/${id}`), [api, id]);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const r = detail.data?.request;

  const act = (key: string, fn: () => Promise<void>) => async () => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      detail.reload();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (detail.loading && !detail.data) return <Loading />;
  if (!r) return <ErrorBanner error={detail.error} />;
  const open = r.status === "Submitted" || r.status === "InProgress";
  return (
    <div className="space-y-3 text-sm">
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <p>
        {tr.rich("nameEmailTypeDueDueAt", { strong: (chunks) => <strong>{chunks}</strong>, name: detail.data?.student?.name, bdi: (chunks) => <bdi className="text-muted-foreground">{chunks}</bdi>, email: detail.data?.student?.email, type: REQUEST_TYPE_LABELS[r.type], dueAt: formatDate(r.dueAt) })}
      </p>
      {r.details && <p className="rounded-md bg-muted p-2">{r.details}</p>}
      {open && (
        <div className="flex flex-wrap gap-2">
          {r.status === "Submitted" && <Button variant="secondary" busy={busy === "start"} onClick={act("start", async () => { await api(`/api/career/privacy/admin/requests/${id}/start`, { method: "POST" }); })}>{tr("start")}</Button>}
          {r.type === "Export" && (
            <Button variant="secondary" busy={busy === "dl"} onClick={act("dl", async () => { await downloadBlob(await api<Response>(`/api/career/privacy/admin/requests/${id}/export`, { raw: true }), "career-record.zip"); })}>
              {tr("previewExport")}
            </Button>
          )}
          {r.type === "Erasure" && (
            <Button variant="secondary" busy={busy === "plan"} onClick={act("plan", async () => { setPlan((await api<{ tables: PlanRow[] }>(`/api/career/privacy/admin/requests/${id}/erasure-plan`)).tables); })}>
              {tr("showErasurePlan")}
            </Button>
          )}
        </div>
      )}
      {plan && (
        <ScrollArea>
          <table className="w-full text-sm">
            <caption className="sr-only">{tr("whatErasureWouldDo")}</caption>
            <thead><tr className="border-b border-border [&_th]:text-start"><th scope="col" className="py-1 pe-3">{tr("table")}</th><th scope="col" className="py-1 pe-3">{tr("rows")}</th><th scope="col" className="py-1 pe-3">{tr("action")}</th><th scope="col" className="py-1">{tr("why")}</th></tr></thead>
            <tbody>
              {plan.map((p) => (
                <tr key={p.table} className="border-b border-border last:border-0 align-top">
                  <td className="py-1 pe-3"><bdi>{p.table}</bdi></td>
                  <td className="py-1 pe-3">{p.rows}</td>
                  <td className="py-1 pe-3"><Badge tone={ACTION_TONE[p.action] ?? "neutral"}>{p.action}</Badge></td>
                  <td className="py-1 text-muted-foreground">{p.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      {open && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("noteToTheStudent")} hint={tr("shownToTheStudentRequired")}>
            {(p) => <textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          {r.type === "Erasure" && (
            <Field label={tr("typeERASEToConfirm")} hint={tr("erasureCantBeUndone")}>{(p) => <input {...p} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />}</Field>
          )}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button
              variant={r.type === "Erasure" ? "danger" : "primary"}
              busy={busy === "complete"}
              onClick={act("complete", async () => {
                await api(`/api/career/privacy/admin/requests/${id}/complete`, { method: "POST", json: { note, confirm } });
                setMsg(r.type === "Erasure" ? tr("erasureDone") : tr("requestCompleted"));
              })}
            >
              {r.type === "Erasure" ? tr("eraseAndComplete") : r.type === "Export" ? tr("releaseExportToTheStudent") : tr("markCorrected")}
            </Button>
            <Button variant="secondary" busy={busy === "reject"} onClick={act("reject", async () => { await api(`/api/career/privacy/admin/requests/${id}/reject`, { method: "POST", json: { note } }); setMsg(tr("requestDeclined")); })}>
              {tr("decline")}
            </Button>
          </div>
        </div>
      )}
      <div>
        <h3 className="mb-1 font-medium">{tr("auditTrail")}</h3>
        <ol className="space-y-1 text-xs text-muted-foreground">
          {detail.data!.trail.map((t, i) => (
            <li key={i}>{formatDate(t.at, true)} · <bdi>{t.action}</bdi></li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function PolicyCard() {
  const tr = useCareerT("careerCenterPrivacy");
  const api = useApi();
  const pol = useLoad(() => api<{ effective: Policy; overrides: Partial<Policy>; canEdit: boolean }>("/api/career/privacy/admin/policy"), [api]);
  const [draft, setDraft] = useState<Partial<Policy> | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const form: Partial<Policy> = draft ?? pol.data?.overrides ?? {};
  const setForm = (f: Partial<Policy>) => setDraft(f);
  const tri = (v: boolean | null | undefined) => (v == null ? "" : v ? "yes" : "no");
  const fromTri = (s: string) => (s === "" ? null : s === "yes");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await api<{ effective: Policy; overrides: Partial<Policy>; canEdit: boolean }>("/api/career/privacy/admin/policy", { method: "PUT", json: form });
      pol.setData(() => r);
      setDraft(null);
      setMsg(tr("privacyPolicySaved"));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const e = pol.data?.effective;
  return (
    <Card title={tr("schoolPrivacyPolicy")} className="mb-6">
      <ErrorBanner error={err ?? pol.error} />
      <SuccessBanner message={msg} />
      {!e ? <Loading /> : (
        <form onSubmit={save} className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            {tr("inForceLawCountryCodeMinor", { law: e.law, countryCode: e.countryCode, minorAge: e.minorAge })}{" "}{e.guardianConsentRequired ? tr("required") : tr("notRequired")}{tr("purposesAre")}{" "}{e.purposeConsentRequired ? tr("offUntilTheStudentAgrees") : tr("onUnlessWithdrawn")}{tr("requestsAnsweredWithinRightsResponseDays", { rightsResponseDays: e.rightsResponseDays })}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={tr("countryCode")}>{(p) => <input {...p} value={form.countryCode ?? ""} maxLength={2} onChange={(x) => setForm({ ...form, countryCode: x.target.value || null as unknown as string })} />}</Field>
            <Field label={tr("minorBelowAge")}>{(p) => <input {...p} type="number" min={13} max={21} value={form.minorAge ?? ""} onChange={(x) => setForm({ ...form, minorAge: x.target.value ? Number(x.target.value) : (null as unknown as number) })} />}</Field>
            <Field label={tr("daysToAnswerRequests")}>{(p) => <input {...p} type="number" min={1} max={120} value={form.rightsResponseDays ?? ""} onChange={(x) => setForm({ ...form, rightsResponseDays: x.target.value ? Number(x.target.value) : (null as unknown as number) })} />}</Field>
            <Field label={tr("guardianConsentForMinors")}>
              {(p) => (
                <select {...p} value={tri(form.guardianConsentRequired)} onChange={(x) => setForm({ ...form, guardianConsentRequired: fromTri(x.target.value) as boolean })}>
                  <option value="">{tr("countryDefault")}</option><option value="yes">{tr("required2")}</option><option value="no">{tr("notRequired2")}</option>
                </select>
              )}
            </Field>
            <Field label={tr("consentPurposes")}>
              {(p) => (
                <select {...p} value={tri(form.purposeConsentRequired)} onChange={(x) => setForm({ ...form, purposeConsentRequired: fromTri(x.target.value) as boolean })}>
                  <option value="">{tr("countryDefault")}</option><option value="yes">{tr("offUntilAgreedOptIn")}</option><option value="no">{tr("onUnlessWithdrawn2")}</option>
                </select>
              )}
            </Field>
            <Field label={tr("noticeVersion")}>{(p) => <input {...p} value={form.noticeVersion ?? ""} onChange={(x) => setForm({ ...form, noticeVersion: x.target.value })} />}</Field>
            <Field label={tr("privacyNoticeLink")}>{(p) => <input {...p} type="url" value={form.noticeUrl ?? ""} onChange={(x) => setForm({ ...form, noticeUrl: x.target.value })} />}</Field>
          </div>
          {pol.data?.canEdit && <Button type="submit" busy={busy}>{tr("savePolicy")}</Button>}
        </form>
      )}
    </Card>
  );
}

function RetentionCard() {
  const tr = useCareerT("careerCenterPrivacy");
  const api = useApi();
  const data = useLoad(() => api<{ periods: RetentionRow[] }>("/api/career/privacy/admin/retention"), [api]);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const save = async () => {
    setBusy("save"); setErr(null); setMsg(null);
    try {
      const periods: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(edit)) periods[k] = v.trim() === "" ? null : Number(v);
      const r = await api<{ periods: RetentionRow[] }>("/api/career/privacy/admin/retention", { method: "PUT", json: { periods } });
      data.setData(() => r);
      setEdit({});
      setMsg(tr("retentionPeriodsSaved"));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(null); }
  };
  const preview = async () => {
    setBusy("preview"); setErr(null); setMsg(null);
    try {
      const r = await api<{ recordType: string; count: number }[]>("/api/career/privacy/admin/retention/preview", { method: "POST" });
      setMsg(r.length === 0 ? tr("nothingWouldBeDeletedBy") : r.map((x) => tr("recordTypeWouldBeDeleted", { recordType: x.recordType, count: x.count })).join("; "));
    } catch (x) { setErr((x as Error).message); } finally { setBusy(null); }
  };
  return (
    <Card title={tr("retentionAtThisSchool")} className="mb-6">
      <ErrorBanner error={err ?? data.error} />
      <SuccessBanner message={msg} />
      <p className="mb-3 text-sm text-muted-foreground">{tr("youCanKeepTheseRecords")}</p>
      {!data.data ? <Loading /> : (
        <ScrollArea>
          <table className="w-full text-sm">
            <caption className="sr-only">{tr("retentionPeriods")}</caption>
            <thead><tr className="border-b border-border [&_th]:text-start"><th scope="col" className="py-2 pe-3">{tr("records")}</th><th scope="col" className="py-2 pe-3">{tr("platformDays")}</th><th scope="col" className="py-2 pe-3">{tr("minimum")}</th><th scope="col" className="py-2">{tr("thisSchoolDays")}</th></tr></thead>
            <tbody>
              {data.data.periods.map((p) => (
                <tr key={p.recordType} className="border-b border-border last:border-0">
                  <td className="py-2 pe-3"><bdi>{p.recordType}</bdi></td>
                  <td className="py-2 pe-3">{p.globalDays === 0 ? tr("forever") : p.globalDays}</td>
                  <td className="py-2 pe-3">{p.minimumDays}</td>
                  <td className="py-2">
                    <input
                      aria-label={tr("daysToKeepRecordTypeAt", { recordType: p.recordType })}
                      type="number"
                      min={p.minimumDays}
                      className="w-28 rounded-md border border-border bg-background px-2 py-1"
                      value={edit[p.recordType] ?? (p.schoolDays == null ? "" : String(p.schoolDays))}
                      onChange={(e) => setEdit({ ...edit, [p.recordType]: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      <div className="mt-3 flex gap-2">
        <Button onClick={save} busy={busy === "save"} disabled={Object.keys(edit).length === 0}>{tr("savePeriods")}</Button>
        <Button variant="secondary" onClick={preview} busy={busy === "preview"}>{tr("previewWhatWouldBeDeleted")}</Button>
      </div>
    </Card>
  );
}

function MinorsCard() {
  const tr = useCareerT("careerCenterPrivacy");
  const api = useApi();
  const data = useLoad(() => api<{ policy: Policy; students: MinorRow[] }>("/api/career/privacy/admin/minors"), [api]);
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [inviteFor, setInviteFor] = useState<string | null>(null);
  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");
  const run = (key: string, fn: () => Promise<void>) => async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(key); setErr(null); setMsg(null);
    try { await fn(); data.reload(); } catch (x) { setErr((x as Error).message); } finally { setBusy(null); }
  };
  return (
    <Card title={tr("minorsAndGuardianConsent")} className="mb-6">
      <ErrorBanner error={err ?? data.error} />
      <SuccessBanner message={msg} />
      <form onSubmit={run("import", async () => {
        const r = await api<{ updated: number; errors: { error: string }[] }>("/api/career/privacy/admin/ages/import", { method: "POST", json: { csv } });
        setMsg(tr("updatedStudentsUpdatedValue", { updated: r.updated, value: r.errors.length ? tr("countRowsHadProblemsValue", { count: r.errors.length, value: r.errors.map((x) => x.error).join(" ") }) : "." }));
        setCsv("");
      })} className="mb-4 space-y-2">
        <Field label={tr("importDatesOfBirthCSV")} hint={tr("columnsEmailOrStudentNumberThen")}>
          {(p) => <textarea {...p} rows={3} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={tr("emailDateOfBirth")} />}
        </Field>
        <Button type="submit" variant="secondary" busy={busy === "import"} disabled={!csv.trim()}>{tr("import")}</Button>
      </form>
      {!data.data ? <Loading /> : data.data.students.length === 0 ? (
        <EmptyState title={tr("noAgesRecorded")}>{tr("importDatesOfBirthOr")}</EmptyState>
      ) : (
        <ScrollArea>
          <table className="w-full text-sm">
            <caption className="sr-only">{tr("studentsWithAnAgeOn")}</caption>
            <thead><tr className="border-b border-border [&_th]:text-start"><th scope="col" className="py-2 pe-3">{tr("student2")}</th><th scope="col" className="py-2 pe-3">{tr("ageRecord")}</th><th scope="col" className="py-2 pe-3">{tr("guardian")}</th><th scope="col" className="py-2"><span className="sr-only">{tr("actions")}</span></th></tr></thead>
            <tbody>
              {data.data.students.map((s) => (
                <tr key={s.membershipId} className="border-b border-border last:border-0 align-top">
                  <td className="py-2 pe-3">{s.name}<div className="text-xs text-muted-foreground"><bdi>{s.email}</bdi></div></td>
                  <td className="py-2 pe-3">
                    {s.isMinor ? <Badge tone="warn">{tr("minor")}</Badge> : <Badge>{tr("adult")}</Badge>}
                    <div className="text-xs text-muted-foreground">{s.dateOfBirth ? tr("bornDateOfBirth", { dateOfBirth: formatDate(s.dateOfBirth) }) : s.underAge ? tr("flaggedUnder18") : ""}{s.ageSource ? ` · ${s.ageSource}` : ""}</div>
                  </td>
                  <td className="py-2 pe-3">
                    {s.guardians.length === 0 ? <span className="text-muted-foreground">{tr("none")}</span> : s.guardians.map((g) => (
                      <div key={g.id} className="flex flex-wrap items-center gap-2">
                        <span>{g.name}</span>
                        <Badge tone={g.status === "Consented" ? "good" : g.status === "Declined" ? "bad" : "neutral"}>{g.status}</Badge>
                        {g.status !== "Consented" && (
                          <Button variant="ghost" busy={busy === g.id} onClick={run(g.id, async () => { await api(`/api/career/privacy/admin/guardians/${g.id}/resend`, { method: "POST" }); setMsg(tr("sentANewLinkTo", { name: g.name })); })} aria-label={tr("resendLinkToName", { name: g.name })}>{tr("resend")}</Button>
                        )}
                      </div>
                    ))}
                  </td>
                  <td className="py-2 text-end">
                    <Button variant="secondary" onClick={() => setInviteFor(inviteFor === s.membershipId ? null : s.membershipId)} aria-expanded={inviteFor === s.membershipId}>{tr("addGuardian")}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      {inviteFor && (
        <form onSubmit={run("invite", async () => {
          await api(`/api/career/privacy/admin/students/${inviteFor}/guardians`, { method: "POST", json: { name: gName, email: gEmail, relationship: "Parent" } });
          setMsg(tr("consentLinkEmailedToThe"));
          setInviteFor(null); setGName(""); setGEmail("");
        })} className="mt-4 grid gap-3 sm:grid-cols-3 sm:items-end">
          <Field label={tr("guardiansName")}>{(p) => <input {...p} value={gName} onChange={(e) => setGName(e.target.value)} required />}</Field>
          <Field label={tr("guardiansEmail")}>{(p) => <input {...p} type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} required />}</Field>
          <Button type="submit" busy={busy === "invite"}>{tr("emailConsentLink")}</Button>
        </form>
      )}
    </Card>
  );
}

export default function CareerCenterPrivacyPage() {
  const tr = useCareerT("careerCenterPrivacy");
  const REQUEST_STATUS_LABELS = useRequestStatusLabels();
  const REQUEST_TYPE_LABELS = useRequestTypeLabels();
  const api = useApi();
  const [status, setStatus] = useState("open");
  const queue = useLoad(() => api<{ counts: { open: number; overdue: number }; requests: QueueRow[] }>(`/api/career/privacy/admin/requests?status=${status}`), [api, status]);
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title={tr("privacyRequests")} description={tr("dataRequestsFromStudentsAnd")} />
      <ErrorBanner error={queue.error} />

      <Card title={tr("requestQueue")} className="mb-6">
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <Field label={tr("show")}>
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">{tr("open")}</option>
                <option value="completed">{tr("completed")}</option>
                <option value="rejected">{tr("declined")}</option>
                <option value="all">{tr("all")}</option>
              </select>
            )}
          </Field>
          {queue.data && (
            <p role="status" className="text-sm">
              {tr("openOpen", { open: queue.data.counts.open })}{queue.data.counts.overdue > 0 ? <>, <strong>{tr("overdueOverdue", { overdue: queue.data.counts.overdue })}</strong></> : null}
            </p>
          )}
        </div>
        {queue.loading && !queue.data ? <Loading /> : (queue.data?.requests ?? []).length === 0 ? (
          <EmptyState title={tr("noRequests")} />
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{tr("privacyRequests")}</caption>
              <thead><tr className="border-b border-border [&_th]:text-start"><th scope="col" className="py-2 pe-3">{tr("student2")}</th><th scope="col" className="py-2 pe-3">{tr("request")}</th><th scope="col" className="py-2 pe-3">{tr("due")}</th><th scope="col" className="py-2 pe-3">{tr("status")}</th><th scope="col" className="py-2"><span className="sr-only">{tr("open")}</span></th></tr></thead>
              <tbody>
                {queue.data!.requests.map(({ request: r, student }) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pe-3">{student?.name ?? "—"}<div className="text-xs text-muted-foreground"><bdi>{student?.email}</bdi></div></td>
                    <td className="py-2 pe-3">{REQUEST_TYPE_LABELS[r.type] ?? r.type}</td>
                    <td className="py-2 pe-3">{formatDate(r.dueAt)} {r.overdue && <Badge tone="bad">{tr("overdue")}</Badge>}</td>
                    <td className="py-2 pe-3"><Badge tone={requestTone(r.status)}>{REQUEST_STATUS_LABELS[r.status] ?? r.status}</Badge></td>
                    <td className="py-2 text-end">
                      <Button variant="secondary" onClick={() => setSelected(selected === r.id ? null : r.id)} aria-expanded={selected === r.id} aria-label={tr("openRequestFromName", { name: student?.name ?? tr("student") })}>
                        {selected === r.id ? tr("close") : tr("open")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
        {selected && (
          <div className="mt-4 border-t border-border pt-4">
            <RequestPanel id={selected} onChanged={queue.reload} />
          </div>
        )}
      </Card>

      <MinorsCard />
      <PolicyCard />
      <RetentionCard />
    </div>
  );
}

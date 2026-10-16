"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { SeverityBadge, type Counselor, type Signal, type TriageSettings, useIsTriageAdmin, useSeverityLabels } from "@/components/career/triage/shared";

interface CaseloadRow {
  userId: string;
  name: string;
  email: string;
  majors: string[];
  college?: string | null;
  graduationDate?: string | null;
  counselorUserId?: string | null;
  counselorName?: string | null;
  assignmentSource: string;
  signalCount: number;
  score: number;
  signals: Signal[];
  snoozedSignals: Signal[];
  lastContactAt?: string | null;
}

interface CaseloadResponse {
  scope: string;
  total: number;
  flagged: number;
  students: CaseloadRow[];
}

interface PanelSignal extends Signal {
  snooze?: { id: string; until: string; reason: string; byName?: string | null } | null;
}

interface StudentPanelData {
  userId: string;
  name: string;
  email: string;
  majors: string[];
  college?: string | null;
  graduationDate?: string | null;
  counselorName?: string | null;
  assignmentSource: string;
  signals: PanelSignal[];
  timeline: { at: string; kind: string; title: string; detail?: string | null }[];
  copilotEnabled: boolean;
}

interface Brief {
  generationId: string;
  text: string;
  label: string;
  simulated: boolean;
  includesStaffOnlyNotes: boolean;
  injectionSuspected: boolean;
}

interface Draft {
  generationId: string;
  subject: string;
  body: string;
  label: string;
  simulated: boolean;
  injectionSuspected: boolean;
}

/** Where a student's counselor assignment came from, in the career language (G1). */
function useSourceLabel() {
  const tr = useCareerT("careerCenterCaseload");
  return (s: string) => (s === "Manual" ? tr("sourceManual") : s === "Pool" ? tr("sourcePool") : s === "Unassigned" ? tr("sourceUnassigned") : s.startsWith("Rule:") ? tr("sourceRule", { rule: s.slice(5).toLowerCase() }) : s);
}

export default function CaseloadPage() {
  const tr = useCareerT("careerCenterCaseload");
  const SOURCE_LABEL = useSourceLabel();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const isAdmin = useIsTriageAdmin();
  const [scope, setScope] = useState("mine");
  const [rule, setRule] = useState("");
  const [severity, setSeverity] = useState("");
  const [sort, setSort] = useState("severity");
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [includeSnoozed, setIncludeSnoozed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const settings = useLoad(() => api<TriageSettings>("/api/career/triage/settings"), [api, schoolId]);
  const counselors = useLoad(() => api<Counselor[]>("/api/career/triage/counselors"), [api, schoolId]);
  const params = new URLSearchParams({ scope, sort, flaggedOnly: String(flaggedOnly), includeSnoozed: String(includeSnoozed) });
  if (rule) params.set("rule", rule);
  if (severity) params.set("severity", severity);
  if (query) params.set("q", query);
  const qs = params.toString();
  const list = useLoad(() => api<CaseloadResponse>(`/api/career/triage/caseload?${qs}`), [api, schoolId, qs]);

  return (
    <div>
      <PageHeader
        title={tr("caseload")}
        description={tr("studentsWhoMayNeedA")}
        actions={
          isAdmin ? (
            <div className="flex gap-2">
              <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/career-center/caseload/rules">
                {tr("caseloadRules")}
              </Link>
              <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/career-center/caseload/settings">
                {tr("signalCopilotSettings")}
              </Link>
            </div>
          ) : undefined
        }
      />
      <ErrorBanner error={settings.error || counselors.error} />

      <Card title={tr("filters")}>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(q.trim());
          }}
        >
          <Field label={tr("students")}>
            {(p) => (
              <select {...p} value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="mine">{tr("myCaseload")}</option>
                <option value="all">{tr("allStudents")}</option>
                <option value="unassigned">{tr("unassignedPool")}</option>
                {(counselors.data || []).map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {tr("nameSCaseload", { name: c.name })}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("signal")}>
            {(p) => (
              <select {...p} value={rule} onChange={(e) => setRule(e.target.value)}>
                <option value="">{tr("anySignal")}</option>
                {(settings.data?.rules || []).map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("minimumSeverity")}>
            {(p) => (
              <select {...p} value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="">{tr("any")}</option>
                <option value="high">{tr("high")}</option>
                <option value="medium">{tr("mediumOrHigh")}</option>
                <option value="low">{tr("lowOrHigher")}</option>
              </select>
            )}
          </Field>
          <Field label={tr("sortBy")}>
            {(p) => (
              <select {...p} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="severity">{tr("highestSeverity")}</option>
                <option value="count">{tr("numberOfSignals")}</option>
                <option value="name">{tr("name")}</option>
                <option value="graduation">{tr("graduationDate")}</option>
              </select>
            )}
          </Field>
          <Field label={tr("searchNameEmailOrMajor")}>{(p) => <input {...p} value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          <div className="flex items-end gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />{" "}{tr("onlyStudentsWithSignals")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeSnoozed} onChange={(e) => setIncludeSnoozed(e.target.checked)} />{" "}{tr("includeSnoozed")}
            </label>
          </div>
          <div className="flex items-end">
            <Button type="submit" variant="secondary">
              {tr("search")}
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card title={list.data ? tr("totalStudentSFlaggedWith", { total: list.data.total, flagged: list.data.flagged }) : tr("students")}>
          <ErrorBanner error={list.error} onRetry={list.reload} />
          {list.loading && !list.data ? (
            <Loading />
          ) : !list.data || list.data.students.length === 0 ? (
            <EmptyState title={tr("noStudentsMatch")}>
              {scope === "mine" ? tr("yourCaseloadIsEmptyA") : tr("tryOtherFilters")}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border" aria-live="polite">
              {list.data.students.map((s) => (
                <li key={s.userId}>
                  <button
                    type="button"
                    onClick={() => setSelected(s.userId)}
                    aria-pressed={selected === s.userId}
                    className={`w-full rounded-md px-2 py-3 text-start hover:bg-muted focus-visible:outline-2 ${selected === s.userId ? "bg-muted" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {tr("signalCountSignalS", { signalCount: s.signalCount })}{s.snoozedSignals.length > 0 ? tr("countSnoozed", { count: s.snoozedSignals.length }) : ""}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tr("majorsGraduatesGraduationDateCounselorNa", { majors: s.majors.join(", ") || tr("majorNotOnFile"), graduationDate: formatDate(s.graduationDate), counselorName: s.counselorName || SOURCE_LABEL(s.assignmentSource) })}
                      {s.lastContactAt ? tr("lastContactLastContactAt", { lastContactAt: formatDate(s.lastContactAt) }) : ""}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.signals.map((x) => (
                        <SeverityBadge key={x.key} severity={x.severity}>
                          {x.title}
                        </SeverityBadge>
                      ))}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div>
          {selected ? (
            <StudentPanel key={selected} studentId={selected} onChanged={list.reload} />
          ) : (
            <Card>
              <EmptyState title={tr("chooseAStudent")}>{tr("selectAStudentToSee")}</EmptyState>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentPanel({ studentId, onChanged }: { studentId: string; onChanged: () => void }) {
  const tr = useCareerT("careerCenterCaseload");
  const SOURCE_LABEL = useSourceLabel();
  const SEVERITY_LABEL = useSeverityLabels();
  const api = useApi();
  const panel = useLoad(() => api<StudentPanelData>(`/api/career/triage/students/${studentId}`), [api, studentId]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [snoozeFor, setSnoozeFor] = useState<string | null>(null);
  const [snoozeDays, setSnoozeDays] = useState(14);
  const [snoozeReason, setSnoozeReason] = useState("");
  const [contactMethod, setContactMethod] = useState("Email");
  const [contactNote, setContactNote] = useState("");
  const [brief, setBrief] = useState<Brief | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  async function run(key: string, fn: () => Promise<unknown>, success?: string) {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      if (success) setMsg(success);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  if (panel.loading && !panel.data) return <Loading />;
  if (!panel.data) return <ErrorBanner error={panel.error} onRetry={panel.reload} />;
  const d = panel.data;

  return (
    <div className="space-y-4">
      <Card title={d.name}>
        <p className="text-sm text-muted-foreground">
          {d.email} · {d.majors.join(", ") || tr("majorNotOnFile")}
          {d.college ? ` · ${d.college}` : ""}{" "}{tr("graduatesGraduationDate", { graduationDate: formatDate(d.graduationDate) })}
        </p>
        <p className="text-sm text-muted-foreground">{tr("counselorCounselorName", { counselorName: d.counselorName || SOURCE_LABEL(d.assignmentSource) })}</p>
        <div className="mt-2">
          <SuccessBanner message={msg} />
          <ErrorBanner error={err} />
        </div>
      </Card>

      <Card title={tr("signals")}>
        {d.signals.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("noSignalsRightNow")}</p>
        ) : (
          <ul className="space-y-3">
            {d.signals.map((s) => (
              <li key={s.key} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <SeverityBadge severity={s.severity}>{SEVERITY_LABEL[s.severity] ?? s.severity}</SeverityBadge>
                  <span className="font-medium">{s.title}</span>
                  {s.snooze && <Badge>{tr("snoozedUntilUntil", { until: formatDate(s.snooze.until) })}</Badge>}
                </div>
                <p className="mt-1 text-sm">{s.reason}</p>
                {s.snooze && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tr("snoozedByByNameReason", { byName: s.snooze.byName || tr("staff"), reason: s.snooze.reason })}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {s.link && (
                    <Link className="text-sm underline" href={s.link}>
                      {tr("openModule")}
                    </Link>
                  )}
                  {s.snooze ? (
                    <Button
                      variant="ghost"
                      busy={busy === `un-${s.key}`}
                      onClick={() =>
                        run(`un-${s.key}`, () => api(`/api/career/triage/students/${studentId}/snooze/${s.key}`, { method: "DELETE" }), tr("snoozeRemoved")).then((ok) => {
                          if (ok) {
                            panel.reload();
                            onChanged();
                          }
                        })
                      }
                    >
                      {tr("removeSnooze")}
                    </Button>
                  ) : (
                    <Button variant="ghost" onClick={() => setSnoozeFor(snoozeFor === s.key ? null : s.key)} aria-expanded={snoozeFor === s.key}>
                      {tr("snooze")}
                    </Button>
                  )}
                </div>
                {snoozeFor === s.key && (
                  <form
                    className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr_auto]"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run("snooze", () => api(`/api/career/triage/students/${studentId}/snooze`, { json: { rule: s.key, days: snoozeDays, reason: snoozeReason } }), tr("signalSnoozedThisIsRecorded")).then((ok) => {
                        if (ok) {
                          setSnoozeFor(null);
                          setSnoozeReason("");
                          panel.reload();
                          onChanged();
                        }
                      });
                    }}
                  >
                    <Field label={tr("days")}>{(p) => <input {...p} type="number" min={1} max={180} value={snoozeDays} onChange={(e) => setSnoozeDays(Number(e.target.value))} />}</Field>
                    <Field label={tr("reasonRequired")}>{(p) => <input {...p} required value={snoozeReason} onChange={(e) => setSnoozeReason(e.target.value)} />}</Field>
                    <div className="flex items-end">
                      <Button type="submit" busy={busy === "snooze"}>
                        {tr("snooze2")}
                      </Button>
                    </div>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={tr("markContacted")}>
        <form
          className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            run("contact", () => api(`/api/career/triage/students/${studentId}/contacted`, { json: { method: contactMethod, note: contactNote } }), tr("contactRecorded")).then((ok) => {
              if (ok) {
                setContactNote("");
                panel.reload();
                onChanged();
              }
            });
          }}
        >
          <Field label={tr("how")}>
            {(p) => (
              <select {...p} value={contactMethod} onChange={(e) => setContactMethod(e.target.value)}>
                <option value="Email">{tr("email")}</option>
                <option value="Phone">{tr("phone")}</option>
                <option value="InPerson">{tr("inPerson")}</option>
                <option value="Message">{tr("message")}</option>
                <option value="Other">{tr("other")}</option>
              </select>
            )}
          </Field>
          <Field label={tr("noteOptional")}>{(p) => <input {...p} value={contactNote} onChange={(e) => setContactNote(e.target.value)} />}</Field>
          <div className="flex items-end">
            <Button type="submit" variant="secondary" busy={busy === "contact"}>
              {tr("save")}
            </Button>
          </div>
        </form>
      </Card>

      <Card title={tr("copilot")}>
        {!d.copilotEnabled ? (
          <p className="text-sm text-muted-foreground">{tr("theAICopilotIsTurned")}</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" busy={busy === "brief"} onClick={() => run("brief", async () => setBrief(await api<Brief>("/api/career/triage/copilot/brief", { json: { studentUserId: studentId } })))}>
                {tr("appointmentPrepBrief")}
              </Button>
              <Button
                variant="secondary"
                busy={busy === "draft"}
                onClick={() =>
                  run("draft", async () => {
                    const r = await api<Draft>("/api/career/triage/copilot/outreach", { json: { studentUserId: studentId } });
                    setDraft(r);
                    setSubject(r.subject);
                    setBody(r.body);
                    setConfirmed(false);
                  })
                }
              >
                {tr("draftOutreachMessage")}
              </Button>
            </div>
            {brief && (
              <section aria-label={tr("appointmentPrepBrief")} className="rounded-md border border-border p-3">
                <div className="mb-2 flex flex-wrap gap-2">
                  <Badge tone="info">{brief.label}</Badge>
                  {brief.simulated && <Badge tone="warn">{tr("developmentStub")}</Badge>}
                  {brief.includesStaffOnlyNotes && <Badge>{tr("includesStaffOnlyNotesDont")}</Badge>}
                  {brief.injectionSuspected && <Badge tone="warn">{tr("studentTextContainedInstructionLike")}</Badge>}
                </div>
                <pre className="whitespace-pre-wrap font-sans text-sm">{brief.text}</pre>
              </section>
            )}
            {draft && (
              <form
                aria-label={tr("outreachDraft")}
                className="space-y-2 rounded-md border border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run("send", () => api(`/api/career/triage/students/${studentId}/outreach/send`, { json: { subject, body, generationId: draft.generationId, confirm: confirmed } }), tr("messageSentThroughMessaging")).then((ok) => {
                    if (ok) {
                      setDraft(null);
                      panel.reload();
                      onChanged();
                    }
                  });
                }}
              >
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info">{draft.label}</Badge>
                  {draft.simulated && <Badge tone="warn">{tr("developmentStubRemoveTheStub")}</Badge>}
                </div>
                <Field label={tr("subject")}>{(p) => <input {...p} required value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
                <Field label={tr("message")}>{(p) => <textarea {...p} required rows={8} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />{" "}{tr("iReviewedThisMessageAnd")}
                </label>
                <div className="flex gap-2">
                  <Button type="submit" disabled={!confirmed} busy={busy === "send"}>
                    {tr("sendViaMessaging")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setDraft(null)}>
                    {tr("discard")}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Card>

      <Card title={tr("recentActivity")}>
        {d.timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">{tr("noActivityOnRecord")}</p>
        ) : (
          <ol className="space-y-2">
            {d.timeline.map((t, i) => (
              <li key={i} className="text-sm">
                <span className="text-muted-foreground">{formatDate(t.at, true)}</span> · <span className="font-medium">{t.title}</span>
                {t.detail ? <span className="text-muted-foreground"> · {t.detail}</span> : null}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
import type { Counselor } from "@/components/career/triage/shared";

interface Rule {
  id: string;
  counselorUserId: string;
  counselorName: string;
  kind: "Major" | "College" | "Alpha";
  value?: string | null;
  alphaFrom?: string | null;
  alphaTo?: string | null;
  priority: number;
}

interface Row {
  userId: string;
  name: string;
  email: string;
  majors: string[];
  counselorName?: string | null;
  assignmentSource: string;
}

export default function CaseloadRulesPage() {
  const t = useCareerT("careerCenterCaseloadRules");
  const api = useApi();
  const { schoolId } = useCareerShell();
  const rules = useLoad(() => api<Rule[]>("/api/career/triage/rules"), [api, schoolId]);
  const counselors = useLoad(() => api<Counselor[]>("/api/career/triage/counselors"), [api, schoolId]);
  const [scope, setScope] = useState("all");
  const students = useLoad(() => api<{ students: Row[] }>(`/api/career/triage/caseload?scope=${encodeURIComponent(scope)}&sort=name`), [api, schoolId, scope]);
  const [form, setForm] = useState({ counselorUserId: "", kind: "Major", value: "", alphaFrom: "", alphaTo: "", priority: 100 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(success);
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const describe = (r: Rule) => (r.kind === "Alpha" ? t("describeAlpha", { from: r.alphaFrom, to: r.alphaTo }) : t("describeRule", { kind: r.kind, value: r.value }));

  return (
    <div>
      <PageHeader
        title={t("caseloadRules")}
        description={t("assignStudentsToCounselorsBy")}
        actions={
          <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/career-center/caseload">
            {t("backToCaseload")}
          </Link>
        }
      />
      <SuccessBanner message={msg} />
      <ErrorBanner error={err || rules.error || counselors.error} />

      <Card title={t("rules")}>
        {rules.loading && !rules.data ? (
          <Loading />
        ) : !rules.data || rules.data.length === 0 ? (
          <EmptyState title={t("noRulesYet")}>{t("everyStudentIsInThe")}</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{t("caseloadRulesInTheOrder")}</caption>
            <thead>
              <tr className="text-start text-muted-foreground [&_th]:text-start">
                <th scope="col" className="py-2">{t("priority")}</th>
                <th scope="col">{t("rule")}</th>
                <th scope="col">{t("counselor")}</th>
                <th scope="col"><span className="sr-only">{t("actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {rules.data.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2">{r.priority}</td>
                  <td>{describe(r)}</td>
                  <td>{r.counselorName}</td>
                  <td className="text-end">
                    <Button
                      variant="ghost"
                      busy={busy === r.id}
                      aria-label={t("deleteRuleR", { r: describe(r) })}
                      onClick={() => run(r.id, () => api(`/api/career/triage/rules/${r.id}`, { method: "DELETE" }), t("ruleDeleted")).then((ok) => ok && (rules.reload(), students.reload()))}
                    >
                      {t("delete")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            run("add", () => api("/api/career/triage/rules", { json: { ...form, priority: Number(form.priority) } }), t("ruleAdded")).then((ok) => {
              if (ok) {
                setForm({ ...form, value: "", alphaFrom: "", alphaTo: "" });
                rules.reload();
                students.reload();
              }
            });
          }}
        >
          <Field label={t("counselor")}>
            {(p) => (
              <select {...p} required value={form.counselorUserId} onChange={(e) => setForm({ ...form, counselorUserId: e.target.value })}>
                <option value="">{t("choose")}</option>
                {(counselors.data || []).map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("matchOn")}>
            {(p) => (
              <select {...p} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="Major">{t("major")}</option>
                <option value="College">{t("college")}</option>
                <option value="Alpha">{t("lastNameRange")}</option>
              </select>
            )}
          </Field>
          {form.kind === "Alpha" ? (
            <>
              <Field label={t("fromLetter")}>{(p) => <input {...p} required maxLength={1} value={form.alphaFrom} onChange={(e) => setForm({ ...form, alphaFrom: e.target.value })} />}</Field>
              <Field label={t("toLetter")}>{(p) => <input {...p} required maxLength={1} value={form.alphaTo} onChange={(e) => setForm({ ...form, alphaTo: e.target.value })} />}</Field>
            </>
          ) : (
            <div className="lg:col-span-2">
              <Field label={form.kind === "Major" ? t("major") : t("college")}>{(p) => <input {...p} required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />}</Field>
            </div>
          )}
          <Field label={t("priority")} hint={t("lowerRunsFirst")}>
            {(p) => <input {...p} type="number" min={0} max={10000} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />}
          </Field>
          <div className="flex items-end">
            <Button type="submit" busy={busy === "add"}>
              {t("addRule")}
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-4">
        <Card title={t("reassignStudents")}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t("show")}>
              {(p) => (
                <select {...p} value={scope} onChange={(e) => { setScope(e.target.value); setPicked(new Set()); }}>
                  <option value="all">{t("allStudents")}</option>
                  <option value="unassigned">{t("unassignedPool")}</option>
                  {(counselors.data || []).map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {t("nameSCaseload", { name: c.name })}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("moveSelectedTo")}>
              {(p) => (
                <select {...p} value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">{t("choose")}</option>
                  {(counselors.data || []).map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name}
                    </option>
                  ))}
                  <option value="pool">{t("unassignedPoolPinned")}</option>
                  <option value="rules">{t("followTheRulesRemoveManual")}</option>
                </select>
              )}
            </Field>
            <div className="flex items-end">
              <Button
                disabled={picked.size === 0 || !target}
                busy={busy === "assign"}
                onClick={() => {
                  const mode = target === "pool" || target === "rules" ? target : "assign";
                  run("assign", () => api("/api/career/triage/assignments", { json: { studentUserIds: [...picked], mode, counselorUserId: mode === "assign" ? target : null } }), t("updatedSizeStudentS", { size: picked.size })).then((ok) => {
                    if (ok) {
                      setPicked(new Set());
                      students.reload();
                    }
                  });
                }}
              >
                {t("reassignSizeSelected", { size: picked.size })}
              </Button>
            </div>
          </div>
          <ErrorBanner error={students.error} />
          {students.loading && !students.data ? (
            <Loading />
          ) : (
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">{t("studentsAndTheirCounselor")}</caption>
              <thead>
                <tr className="text-start text-muted-foreground [&_th]:text-start">
                  <th scope="col" className="py-2">
                    <span className="sr-only">{t("select")}</span>
                  </th>
                  <th scope="col">{t("student")}</th>
                  <th scope="col">{t("major")}</th>
                  <th scope="col">{t("counselor")}</th>
                </tr>
              </thead>
              <tbody>
                {(students.data?.students || []).map((s) => (
                  <tr key={s.userId} className="border-t border-border">
                    <td className="py-2">
                      <input type="checkbox" aria-label={t("selectName", { name: s.name })} checked={picked.has(s.userId)} onChange={() => toggle(s.userId)} />
                    </td>
                    <td>{s.name}</td>
                    <td>{s.majors.join(", ") || "—"}</td>
                    <td>
                      {s.counselorName || t("unassigned")} <span className="text-xs text-muted-foreground">({s.assignmentSource})</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

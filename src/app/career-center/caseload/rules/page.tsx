"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad } from "@/components/career/ui";
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

  const describe = (r: Rule) => (r.kind === "Alpha" ? `Last name ${r.alphaFrom}–${r.alphaTo}` : `${r.kind}: ${r.value}`);

  return (
    <div>
      <PageHeader
        title="Caseload rules"
        description="Assign students to counselors by major, college or last-name range. The first matching rule (lowest priority number) wins; a manual assignment overrides the rules. Students no rule matches stay in the unassigned pool."
        actions={
          <Link className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" href="/career-center/caseload">
            Back to caseload
          </Link>
        }
      />
      <SuccessBanner message={msg} />
      <ErrorBanner error={err || rules.error || counselors.error} />

      <Card title="Rules">
        {rules.loading && !rules.data ? (
          <Loading />
        ) : !rules.data || rules.data.length === 0 ? (
          <EmptyState title="No rules yet">Every student is in the unassigned pool until you add a rule or assign them.</EmptyState>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Caseload rules in the order they apply</caption>
            <thead>
              <tr className="text-left text-muted-foreground">
                <th scope="col" className="py-2">Priority</th>
                <th scope="col">Rule</th>
                <th scope="col">Counselor</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {rules.data.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="py-2">{r.priority}</td>
                  <td>{describe(r)}</td>
                  <td>{r.counselorName}</td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      busy={busy === r.id}
                      aria-label={`Delete rule ${describe(r)}`}
                      onClick={() => run(r.id, () => api(`/api/career/triage/rules/${r.id}`, { method: "DELETE" }), "Rule deleted.").then((ok) => ok && (rules.reload(), students.reload()))}
                    >
                      Delete
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
            run("add", () => api("/api/career/triage/rules", { json: { ...form, priority: Number(form.priority) } }), "Rule added.").then((ok) => {
              if (ok) {
                setForm({ ...form, value: "", alphaFrom: "", alphaTo: "" });
                rules.reload();
                students.reload();
              }
            });
          }}
        >
          <Field label="Counselor">
            {(p) => (
              <select {...p} required value={form.counselorUserId} onChange={(e) => setForm({ ...form, counselorUserId: e.target.value })}>
                <option value="">Choose…</option>
                {(counselors.data || []).map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Match on">
            {(p) => (
              <select {...p} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
                <option value="Major">Major</option>
                <option value="College">College</option>
                <option value="Alpha">Last-name range</option>
              </select>
            )}
          </Field>
          {form.kind === "Alpha" ? (
            <>
              <Field label="From letter">{(p) => <input {...p} required maxLength={1} value={form.alphaFrom} onChange={(e) => setForm({ ...form, alphaFrom: e.target.value })} />}</Field>
              <Field label="To letter">{(p) => <input {...p} required maxLength={1} value={form.alphaTo} onChange={(e) => setForm({ ...form, alphaTo: e.target.value })} />}</Field>
            </>
          ) : (
            <div className="lg:col-span-2">
              <Field label={form.kind === "Major" ? "Major" : "College"}>{(p) => <input {...p} required value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />}</Field>
            </div>
          )}
          <Field label="Priority" hint="Lower runs first">
            {(p) => <input {...p} type="number" min={0} max={10000} value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />}
          </Field>
          <div className="flex items-end">
            <Button type="submit" busy={busy === "add"}>
              Add rule
            </Button>
          </div>
        </form>
      </Card>

      <div className="mt-4">
        <Card title="Reassign students">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Show">
              {(p) => (
                <select {...p} value={scope} onChange={(e) => { setScope(e.target.value); setPicked(new Set()); }}>
                  <option value="all">All students</option>
                  <option value="unassigned">Unassigned pool</option>
                  {(counselors.data || []).map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name}&apos;s caseload
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Move selected to">
              {(p) => (
                <select {...p} value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Choose…</option>
                  {(counselors.data || []).map((c) => (
                    <option key={c.userId} value={c.userId}>
                      {c.name}
                    </option>
                  ))}
                  <option value="pool">Unassigned pool (pinned)</option>
                  <option value="rules">Follow the rules (remove manual assignment)</option>
                </select>
              )}
            </Field>
            <div className="flex items-end">
              <Button
                disabled={picked.size === 0 || !target}
                busy={busy === "assign"}
                onClick={() => {
                  const mode = target === "pool" || target === "rules" ? target : "assign";
                  run("assign", () => api("/api/career/triage/assignments", { json: { studentUserIds: [...picked], mode, counselorUserId: mode === "assign" ? target : null } }), `Updated ${picked.size} student(s).`).then((ok) => {
                    if (ok) {
                      setPicked(new Set());
                      students.reload();
                    }
                  });
                }}
              >
                Reassign {picked.size} selected
              </Button>
            </div>
          </div>
          <ErrorBanner error={students.error} />
          {students.loading && !students.data ? (
            <Loading />
          ) : (
            <table className="mt-3 w-full text-sm">
              <caption className="sr-only">Students and their counselor</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="py-2">
                    <span className="sr-only">Select</span>
                  </th>
                  <th scope="col">Student</th>
                  <th scope="col">Major</th>
                  <th scope="col">Counselor</th>
                </tr>
              </thead>
              <tbody>
                {(students.data?.students || []).map((s) => (
                  <tr key={s.userId} className="border-t border-border">
                    <td className="py-2">
                      <input type="checkbox" aria-label={`Select ${s.name}`} checked={picked.has(s.userId)} onChange={() => toggle(s.userId)} />
                    </td>
                    <td>{s.name}</td>
                    <td>{s.majors.join(", ") || "—"}</td>
                    <td>
                      {s.counselorName || "Unassigned"} <span className="text-xs text-muted-foreground">({s.assignmentSource})</span>
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

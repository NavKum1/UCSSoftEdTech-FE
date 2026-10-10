"use client";

import React, { useEffect, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";

interface Session {
  id: string;
  name: string;
  location?: string | null;
  status: string;
  minutesPerStudent: number;
  openedAt: string;
  closedAt?: string | null;
  counts: Record<string, number>;
}

interface QueueEntry {
  id: string;
  queueNumber: number;
  status: string;
  topic?: string | null;
  source: string;
  checkedInAt: string;
  calledAt?: string | null;
  position?: number | null;
  waitedMinutes: number;
  student: { userId?: string | null; name: string; email?: string | null; studentNumber?: string | null };
  calledBy?: string | null;
}

interface Queue {
  session: Session;
  averageServiceMinutes: number;
  waiting: number;
  estimatedWaitMinutes: number;
  entries: QueueEntry[];
}

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "info" | "neutral"> = { Waiting: "info", Called: "warn", Seen: "good", NoShow: "bad", Left: "neutral" };
const STATUS_LABEL: Record<string, string> = { Waiting: "Waiting", Called: "With counselor", Seen: "Seen", NoShow: "No-show", Left: "Left" };

/** Drop-in sessions: open one, watch the live queue, call the next student, record the result; kiosk link. */
export function StaffDropIn({ isAdmin }: { isAdmin: boolean }) {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const sessions = useLoad(() => api<Session[]>("/api/career/appointments/dropin/sessions"), [api, schoolId]);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "Drop-in advising", location: "", minutesPerStudent: 15 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = (sessions.data ?? []).filter((s) => s.status === "Open");
  const active = selected ?? open[0]?.id ?? null;

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api<Session>("/api/career/appointments/dropin/sessions", { method: "POST", json: form });
      setSelected(s.id);
      sessions.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <ErrorBanner error={error || sessions.error} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <Card title="Sessions">
            {sessions.loading ? (
              <Loading />
            ) : !sessions.data?.length ? (
              <p className="text-sm text-muted-foreground">No drop-in sessions in the last two weeks.</p>
            ) : (
              <ul className="space-y-2">
                {sessions.data.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-pressed={active === s.id}
                      onClick={() => setSelected(s.id)}
                      className={`w-full rounded-md border p-2 text-left text-sm focus-visible:outline-2 ${active === s.id ? "border-[var(--brand,#4f46e5)]" : "border-border hover:bg-muted"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{s.name}</span>
                        <Badge tone={s.status === "Open" ? "good" : "neutral"}>{s.status}</Badge>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(s.openedAt, true)} · {s.counts.Waiting ?? 0} waiting · {s.counts.Seen ?? 0} seen
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="Open a session">
            <form onSubmit={start} className="space-y-3">
              <Field label="Name">{(p) => <input {...p} required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
              <Field label="Location">{(p) => <input {...p} maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
              <Field label="Typical minutes per student" hint="Used for wait estimates until the session has its own history.">
                {(p) => <input {...p} type="number" min={1} max={120} value={form.minutesPerStudent} onChange={(e) => setForm({ ...form, minutesPerStudent: Number(e.target.value) })} />}
              </Field>
              <Button type="submit" busy={busy}>
                Open drop-in
              </Button>
            </form>
          </Card>
          <KioskLink isAdmin={isAdmin} />
        </div>
        <div className="lg:col-span-2">{active ? <QueuePanel id={active} onClosed={sessions.reload} /> : <EmptyState title="No session selected">Open a drop-in session to start a queue.</EmptyState>}</div>
      </div>
    </div>
  );
}

function QueuePanel({ id, onClosed }: { id: string; onClosed: () => void }) {
  const api = useApi();
  const q = useLoad(() => api<Queue>(`/api/career/appointments/dropin/sessions/${id}/queue`), [api, id]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [add, setAdd] = useState({ identifier: "", topic: "" });
  const { reload } = q;

  useEffect(() => {
    const t = setInterval(() => reload(), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const m = await fn();
      if (m) setMessage(m);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (q.loading && !q.data) return <Loading />;
  if (q.error) return <ErrorBanner error={q.error} onRetry={reload} />;
  const data = q.data!;
  const isOpen = data.session.status === "Open";
  const current = data.entries.filter((e) => e.status === "Waiting" || e.status === "Called");
  const done = data.entries.filter((e) => e.status !== "Waiting" && e.status !== "Called");

  return (
    <Card
      title={`${data.session.name}${data.session.location ? ` · ${data.session.location}` : ""}`}
      actions={
        isOpen && (
          <Button
            type="button"
            variant="secondary"
            busy={busy === "close"}
            onClick={() => {
              if (window.confirm("Close this session? Anyone still waiting will be removed from the line.")) void run("close", async () => {
                await api(`/api/career/appointments/dropin/sessions/${id}/close`, { method: "POST" });
                onClosed();
                return "Session closed.";
              });
            }}
          >
            Close session
          </Button>
        )
      }
    >
      <div role="status" aria-live="polite" className="mb-4 flex flex-wrap gap-4 text-sm">
        <span>
          <strong>{data.waiting}</strong> waiting
        </span>
        <span>
          Est. wait for a new arrival: <strong>{data.estimatedWaitMinutes} min</strong>
        </span>
        <span>
          Average meeting: <strong>{data.averageServiceMinutes} min</strong>
        </span>
      </div>
      <SuccessBanner message={message} />
      <ErrorBanner error={error} />
      {isOpen && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            busy={busy === "next"}
            disabled={data.waiting === 0}
            onClick={() =>
              void run("next", async () => {
                const r = await api<{ called: { queueNumber: number; student: { name?: string } } | null }>(`/api/career/appointments/dropin/sessions/${id}/call-next`, { method: "POST" });
                return r.called ? `Called #${r.called.queueNumber}: ${r.called.student.name ?? "student"}.` : "Nobody is waiting.";
              })
            }
          >
            Call next student
          </Button>
        </div>
      )}
      {current.length === 0 ? (
        <p className="text-sm text-muted-foreground">The line is empty.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Current queue</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="p-2">#</th>
                <th scope="col" className="p-2">Student</th>
                <th scope="col" className="p-2">Topic</th>
                <th scope="col" className="p-2">Waited</th>
                <th scope="col" className="p-2">Status</th>
                <th scope="col" className="p-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {current.map((e) => (
                <tr key={e.id} className="border-b border-border align-top">
                  <td className="p-2 font-semibold">{e.queueNumber}</td>
                  <td className="p-2">
                    {e.student.name}
                    <span className="block text-xs text-muted-foreground">
                      {e.student.email}
                      {e.source === "Kiosk" ? " · kiosk" : e.source === "Staff" ? " · added by staff" : ""}
                    </span>
                  </td>
                  <td className="p-2">{e.topic ?? "—"}</td>
                  <td className="p-2">{Math.round(e.waitedMinutes)} min</td>
                  <td className="p-2">
                    <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status] ?? e.status}</Badge>
                    {e.calledBy && <span className="block text-xs text-muted-foreground">{e.calledBy}</span>}
                  </td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      {(e.status === "Called" ? ["Seen", "NoShow", "Waiting"] : ["Called", "NoShow", "Left"]).map((s) => (
                        <Button
                          key={s}
                          type="button"
                          variant="secondary"
                          busy={busy === e.id + s}
                          onClick={() => void run(e.id + s, () => api(`/api/career/appointments/dropin/entries/${e.id}/status`, { method: "POST", json: { status: s } }).then(() => undefined))}
                          aria-label={`${s === "Waiting" ? "Back to waiting" : s === "Called" ? "Call" : s === "NoShow" ? "No-show" : s === "Seen" ? "Mark seen" : "Remove"}: number ${e.queueNumber}`}
                        >
                          {s === "Waiting" ? "Back to line" : s === "Called" ? "Call" : s === "NoShow" ? "No-show" : s === "Seen" ? "Seen" : "Remove"}
                        </Button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isOpen && (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run("add", async () => {
              const r = await api<{ queueNumber: number }>(`/api/career/appointments/dropin/sessions/${id}/add`, { method: "POST", json: add });
              setAdd({ identifier: "", topic: "" });
              return `Added as #${r.queueNumber}.`;
            });
          }}
        >
          <div className="min-w-48 flex-1">
            <Field label="Add a student (email or student number)">{(p) => <input {...p} required value={add.identifier} onChange={(e) => setAdd({ ...add, identifier: e.target.value })} />}</Field>
          </div>
          <div className="min-w-48 flex-1">
            <Field label="Topic">{(p) => <input {...p} maxLength={300} value={add.topic} onChange={(e) => setAdd({ ...add, topic: e.target.value })} />}</Field>
          </div>
          <Button type="submit" variant="secondary" busy={busy === "add"}>
            Add to line
          </Button>
        </form>
      )}
      {done.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium">Finished ({done.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {done.map((e) => (
              <li key={e.id}>
                #{e.queueNumber} {e.student.name} · <Badge tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status] ?? e.status}</Badge> · waited {Math.round(e.waitedMinutes)} min
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function KioskLink({ isAdmin }: { isAdmin: boolean }) {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const k = useLoad(() => api<{ kioskPath: string; kioskTokenRotatedAt: string }>("/api/career/appointments/kiosk"), [api, schoolId]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const url = k.data && typeof window !== "undefined" ? window.location.origin + k.data.kioskPath : "";

  const rotate = async () => {
    if (!window.confirm("Make a new kiosk link? The current link stops working right away.")) return;
    setError(null);
    try {
      const d = await api<{ kioskPath: string; kioskTokenRotatedAt: string }>("/api/career/appointments/kiosk/rotate", { method: "POST" });
      k.setData(d);
      setMessage("New kiosk link created. Open it on the kiosk device.");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Card title="Check-in kiosk">
      <p className="mb-2 text-sm text-muted-foreground">Open this link on a front-desk tablet. Students check in with their school email or student number; no student details are shown on the kiosk.</p>
      <ErrorBanner error={error || k.error} />
      <SuccessBanner message={message} />
      {k.data && (
        <>
          <Field label="Kiosk link">{(p) => <input {...p} readOnly value={url} onFocus={(e) => e.currentTarget.select()} />}</Field>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void navigator.clipboard?.writeText(url).then(() => setMessage("Link copied."))}>
              Copy link
            </Button>
            {isAdmin && (
              <Button type="button" variant="secondary" onClick={() => void rotate()}>
                New link
              </Button>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

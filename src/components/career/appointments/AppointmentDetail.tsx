"use client";

import React, { useState } from "react";
import { ArrowLeft, CalendarPlus } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { InviteNote, MeetingSourceNote } from "./groupShared";
import { useOutcomeLabels, type Appointment, type Note, IntakeAnswers, MeetingInfo, statusTone, useDownload, whenText, useModeLabels, useStatusLabel } from "./shared";

interface StaffTask {
  id: string;
  title: string;
  details?: string | null;
  dueDate?: string | null;
  status: string;
  assigneeType: string;
}

interface Detail {
  appointment: Appointment;
  notes: (Note & { visibility: string; canEdit: boolean; author: string })[];
  tasks: StaffTask[];
  history: Appointment[];
}

/** Staff view of one appointment: details, intake, outcome, advising notes (private or shared) and follow-up tasks. */
export function AppointmentDetail({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const tr = useCareerT("appointmentDetail");
  const OUTCOME_LABELS = useOutcomeLabels();
  const statusLabel = useStatusLabel();
  const MODE_LABELS = useModeLabels();
  const api = useApi();
  const download = useDownload();
  const d = useLoad(() => api<Detail>(`/api/career/appointments/${id}`), [api, id]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState({ body: "", visibility: "Private" });
  const [task, setTask] = useState({ title: "", dueDate: "", assignee: "Student" });
  const [cancel, setCancel] = useState({ open: false, reason: "", late: false });
  const [editing, setEditing] = useState<{ id: string; body: string; visibility: string } | null>(null);
  const [now] = useState(() => Date.now());

  const run = async (key: string, fn: () => Promise<void>, done?: string) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      if (done) setMessage(done);
      d.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (d.loading && !d.data) return <Loading />;
  if (d.error) return <ErrorBanner error={d.error} onRetry={d.reload} />;
  const { appointment: a, notes, tasks, history } = d.data!;
  const started = new Date(a.startUtc).getTime() <= now + 15 * 60000;

  return (
    <div className="space-y-4">
      <Button type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" aria-hidden />{" "}{tr("backToAppointments")}
      </Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {a.student?.name} · {a.typeName}
          </h1>
          <p className="text-sm">{whenText(a, a.timeZone)}</p>
          <p className="text-sm text-muted-foreground">
            {tr("withNameModeEmail", { name: a.counselor.name, mode: MODE_LABELS[a.mode] ?? a.mode, email: a.student?.email })}
            {a.student?.studentNumber ? ` · #${a.student.studentNumber}` : ""}
          </p>
          <MeetingInfo a={a} />
          <MeetingSourceNote x={a} />
          <InviteNote x={a} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {a.bookedOnBehalf && <Badge>{tr("bookedByStaff")}</Badge>}
          {a.rescheduleCount > 0 && <Badge>{tr("rescheduledRescheduleCount", { rescheduleCount: a.rescheduleCount })}</Badge>}
          <Badge tone={statusTone(a)}>{statusLabel(a)}</Badge>
        </div>
      </div>
      <SuccessBanner message={message} />
      <ErrorBanner error={error} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title={tr("advisingNotes")} actions={<span className="text-xs text-muted-foreground">{tr("educationRecordsNeverSharedWith")}</span>}>
            {notes.length === 0 ? (
              <p className="mb-3 text-sm text-muted-foreground">{tr("noNotesYet")}</p>
            ) : (
              <ul className="mb-4 space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md border border-border p-3">
                    {editing?.id === n.id ? (
                      <form
                        className="space-y-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void run("edit", async () => {
                            await api(`/api/career/appointments/notes/${n.id}`, { method: "PUT", json: { body: editing.body, visibility: editing.visibility } });
                            setEditing(null);
                          }, tr("noteSaved"));
                        }}
                      >
                        <Field label={tr("note")}>{(p) => <textarea {...p} rows={4} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />}</Field>
                        <VisibilityChoice value={editing.visibility} onChange={(v) => setEditing({ ...editing, visibility: v })} name={`vis-${n.id}`} />
                        <div className="flex gap-2">
                          <Button type="submit" busy={busy === "edit"}>
                            {tr("save")}
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                            {tr("cancel")}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge tone={n.visibility === "Shared" ? "info" : "neutral"}>{n.visibility === "Shared" ? tr("sharedWithStudent") : tr("privateToStaff")}</Badge>
                          <span>
                            {n.author} · {formatDate(n.createdAt, true)}
                            {n.updatedAt !== n.createdAt ? tr("edited") : ""}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                        {n.canEdit && (
                          <div className="mt-2 flex gap-2">
                            <Button type="button" variant="ghost" onClick={() => setEditing({ id: n.id, body: n.body, visibility: n.visibility })}>
                              {tr("edit")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              busy={busy === n.id}
                              onClick={() => {
                                if (window.confirm(tr("deleteThisNoteThisCant"))) void run(n.id, () => api(`/api/career/appointments/notes/${n.id}`, { method: "DELETE" }).then(() => undefined), tr("noteDeleted"));
                              }}
                            >
                              {tr("delete")}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void run("note", async () => {
                  await api(`/api/career/appointments/${a.id}/notes`, { method: "POST", json: note });
                  setNote({ body: "", visibility: note.visibility });
                }, note.visibility === "Shared" ? tr("noteAddedAndSharedWith") : tr("privateNoteAdded"));
              }}
            >
              <Field label={tr("addANote")}>{(p) => <textarea {...p} rows={4} required maxLength={10000} value={note.body} onChange={(e) => setNote({ ...note, body: e.target.value })} />}</Field>
              <VisibilityChoice value={note.visibility} onChange={(v) => setNote({ ...note, visibility: v })} name="vis-new" />
              <Button type="submit" busy={busy === "note"}>
                {tr("addNote")}
              </Button>
            </form>
          </Card>

          <Card title={tr("followUpTasks")}>
            {tasks.length > 0 && (
              <ul className="mb-4 space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <input
                      id={`t-${t.id}`}
                      type="checkbox"
                      checked={t.status === "Done"}
                      onChange={() => void run(t.id, () => api(`/api/career/appointments/tasks/${t.id}`, { method: "PATCH", json: { status: t.status === "Done" ? "Open" : "Done" } }).then(() => undefined))}
                    />
                    <label htmlFor={`t-${t.id}`} className={t.status === "Done" ? "text-muted-foreground line-through" : ""}>
                      {t.title}
                    </label>
                    <Badge>{t.assigneeType === "Student" ? tr("student") : tr("counselor")}</Badge>
                    {t.dueDate && <span className="text-xs text-muted-foreground">{tr("dueDueDate", { dueDate: formatDate(t.dueDate) })}</span>}
                  </li>
                ))}
              </ul>
            )}
            <form
              className="grid gap-3 sm:grid-cols-4 sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                void run("task", async () => {
                  await api(`/api/career/appointments/${a.id}/tasks`, { method: "POST", json: { title: task.title, dueDate: task.dueDate || null, assignee: task.assignee } });
                  setTask({ ...task, title: "", dueDate: "" });
                }, tr("taskAdded"));
              }}
            >
              <div className="sm:col-span-2">
                <Field label={tr("task")}>{(p) => <input {...p} required maxLength={200} value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} />}</Field>
              </div>
              <Field label={tr("dueDate")}>{(p) => <input {...p} type="date" value={task.dueDate} onChange={(e) => setTask({ ...task, dueDate: e.target.value })} />}</Field>
              <Field label={tr("who")}>
                {(p) => (
                  <select {...p} value={task.assignee} onChange={(e) => setTask({ ...task, assignee: e.target.value })}>
                    <option value="Student">{tr("student")}</option>
                    <option value="Counselor">{tr("counselor")}</option>
                  </select>
                )}
              </Field>
              <Button type="submit" busy={busy === "task"}>
                {tr("addTask")}
              </Button>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title={tr("afterTheMeeting")}>
            {a.status === "Cancelled" && !a.outcome ? (
              <p className="text-sm text-muted-foreground">{tr("cancelled")}{a.cancelReason ? `: ${a.cancelReason}` : "."}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{started ? tr("recordWhatHappened") : tr("youCanRecordAttendanceOnce")}</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label={tr("outcome")}>
                  {(["Attended", "NoShow", "CancelledLate"] as const).map((key) => [key, OUTCOME_LABELS[key]] as const).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      variant={a.outcome === key ? "primary" : "secondary"}
                      aria-pressed={a.outcome === key}
                      disabled={key !== "CancelledLate" && !started}
                      busy={busy === key}
                      onClick={() => void run(key, () => api(`/api/career/appointments/${a.id}/outcome`, { method: "POST", json: { outcome: key } }).then(() => undefined), tr("markedAsLabel", { label: label.toLowerCase() }))}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <Card title={tr("intakeAnswers")}>
            <IntakeAnswers appointment={a} />
          </Card>
          <Card title={tr("actions")}>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => void run("ics", () => download(`/api/career/appointments/${a.id}/ics`, "appointment.ics"))}>
                <CalendarPlus className="h-4 w-4" aria-hidden />{" "}{tr("calendarFile")}
              </Button>
              {a.status === "Booked" && (
                <Button type="button" variant="secondary" aria-expanded={cancel.open} onClick={() => setCancel({ ...cancel, open: !cancel.open })}>
                  {tr("cancelAppointment")}
                </Button>
              )}
            </div>
            {cancel.open && (
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("cancel", async () => {
                    await api(`/api/career/appointments/${a.id}/cancel`, { method: "POST", json: { reason: cancel.reason, late: cancel.late } });
                    setCancel({ open: false, reason: "", late: false });
                  }, tr("appointmentCancelledTheStudentWas"));
                }}
              >
                <Field label={tr("reasonSentToTheStudent")}>{(p) => <textarea {...p} rows={2} maxLength={500} value={cancel.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} />}</Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={cancel.late} onChange={(e) => setCancel({ ...cancel, late: e.target.checked })} />{" "}{tr("countAsALateCancellation")}
                </label>
                <Button type="submit" variant="danger" busy={busy === "cancel"}>
                  {tr("cancelAppointment")}
                </Button>
              </form>
            )}
          </Card>
          <Card title={tr("earlierAppointments")}>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{tr("firstAppointmentWithThisStudent")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <button type="button" className="text-start underline" onClick={() => onOpen(h.id)}>
                      {formatDate(h.startUtc)} · {h.typeName}
                    </button>{" "}
                    <Badge tone={statusTone(h)}>{statusLabel(h)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function VisibilityChoice({ value, onChange, name }: { value: string; onChange: (v: string) => void; name: string }) {
  const tr = useCareerT("appointmentDetail");
  return (
    <fieldset className="text-sm">
      <legend className="mb-1 font-medium">{tr("whoCanSeeThisNote")}</legend>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <input type="radio" name={name} value="Private" checked={value === "Private"} onChange={() => onChange("Private")} />{" "}{tr("careerStaffOnly")}
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={name} value="Shared" checked={value === "Shared"} onChange={() => onChange("Shared")} />{" "}{tr("alsoTheStudent")}
        </label>
      </div>
    </fieldset>
  );
}

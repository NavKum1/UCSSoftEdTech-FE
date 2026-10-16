"use client";

import React, { useState } from "react";
import { Paperclip } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import type { CareerTranslator } from "@/components/career/i18n/CareerI18nProvider";
import { Badge, Button, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";

export interface ThreadRow {
  id: string;
  kind: "CareerCenter" | "Mentorship";
  subject: string;
  status: "Open" | "Closed";
  studentUserId: string;
  studentName: string;
  mentorshipId?: string | null;
  mentorName?: string | null;
  assigneeUserId?: string | null;
  assigneeName?: string | null;
  lastMessageAt: string;
  lastMessagePreview?: string | null;
  unread: number;
  mentorshipStatus?: string | null;
}

interface Post {
  id: string;
  authorUserId: string;
  authorName: string;
  authorSide: "Student" | "Staff" | "Mentor";
  body: string;
  isInternalNote: boolean;
  createdAt: string;
  attachment: { id: string; name: string } | null;
  mine: boolean;
  seen: boolean;
}

interface ThreadDetail {
  thread: { id: string; kind: string; subject: string; status: string; studentName: string; mentorName?: string | null; assigneeUserId?: string | null; mentorshipStatus?: string | null };
  viewerSide: "Student" | "Staff" | "Mentor";
  canPost: boolean;
  canAddNotes: boolean;
  otherLastReadAt?: string | null;
  staff: { userId: string; name: string; role: string }[] | null;
  posts: Post[];
}

const REPORT_REASONS = ["Harassment", "Spam", "Inappropriate", "Safety", "Other"];

export async function downloadMessageFile(api: ReturnType<typeof useApi>, threadId: string, file: { id: string; name: string }, t: CareerTranslator) {
  const res = await api<Response>(`/api/career/messaging/threads/${threadId}/files/${file.id}`, { raw: true });
  if (!res.ok) throw new Error(res.status === 404 ? t("fileNotAvailable") : t("downloadFailedStatus", { status: res.status }));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Thread list with unread counts; the selected row is marked with aria-current. */
export function ThreadList({ threads, selected, onSelect, showStudent }: { threads: ThreadRow[]; selected: string | null; onSelect: (id: string) => void; showStudent?: boolean }) {
  const tr = useCareerT("messagingShared");
  return (
    <ul className="divide-y divide-border rounded-xl border border-border" aria-label={tr("conversations")}>
      {threads.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={selected === t.id ? "true" : undefined}
            className={`block w-full px-4 py-3 text-start hover:bg-muted focus-visible:outline-2 ${selected === t.id ? "bg-muted" : ""}`}
          >
            <span className="flex items-center justify-between gap-2">
              <span className={`truncate text-sm ${t.unread > 0 ? "font-semibold" : "font-medium"}`}>{t.subject}</span>
              {t.unread > 0 && <Badge tone="info">{tr("unreadUnread", { unread: t.unread })}</Badge>}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {showStudent ? `${t.studentName} · ` : t.kind === "Mentorship" ? tr("mentorMentorName", { mentorName: t.mentorName ?? "" }) : ""}
              {t.lastMessagePreview}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {formatDate(t.lastMessageAt, true)}
              {t.status === "Closed" && <Badge>{tr("closed")}</Badge>}
              {t.kind === "Mentorship" && <Badge>{tr("mentorship")}</Badge>}
              {showStudent && (t.assigneeName ? <span>{tr("assignedAssigneeName", { assigneeName: t.assigneeName })}</span> : <Badge tone="warn">{tr("unassigned")}</Badge>)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** One conversation: messages, read receipts, attachments, reply box; staff also get notes, assignment and close/reopen. */
export function ThreadView({ threadId, onChanged }: { threadId: string; onChanged?: () => void }) {
  const tr = useCareerT("messagingShared");
  const api = useApi();
  const { data, error, loading, reload } = useLoad(() => api<ThreadDetail>(`/api/career/messaging/threads/${threadId}`), [threadId]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [asNote, setAsNote] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState("Harassment");
  const [details, setDetails] = useState("");
  const [fileKey, setFileKey] = useState(0);

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setActionError(null);
    setMsg(null);
    try {
      await fn();
      if (success) setMsg(success);
      reload();
      onChanged?.();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData();
    form.append("body", body);
    if (asNote) form.append("internal", "true");
    if (file) form.append("file", file);
    run(async () => {
      await api(`/api/career/messaging/threads/${threadId}/posts`, { method: "POST", body: form });
      setBody("");
      setFile(null);
      setAsNote(false);
      setFileKey((k) => k + 1);
    }, asNote ? tr("noteAdded") : tr("messageSent"));
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBanner error={error} onRetry={reload} />;
  if (!data) return null;
  const t = data.thread;
  const isStaff = data.viewerSide === "Staff";

  return (
    <section aria-labelledby="thread-title" className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="thread-title" className="text-base font-semibold">{t.subject}</h2>
          <p className="text-xs text-muted-foreground">
            {t.kind === "Mentorship" ? tr("mentorshipBetweenMentorNameAndStudentNam", { mentorName: String(t.mentorName), studentName: t.studentName }) : isStaff ? tr("withStudentName", { studentName: t.studentName }) : tr("withYourCareerCenter")}
            {" · "}
            {t.status === "Closed" ? tr("closed") : tr("open")}
            {t.kind === "Mentorship" && t.mentorshipStatus && tr("mentorshipMentorshipStatus", { mentorshipStatus: t.mentorshipStatus.toLowerCase() })}
          </p>
        </div>
        {isStaff && t.kind === "CareerCenter" && (
          <div className="flex flex-wrap items-end gap-2">
            <Field label={tr("assignedTo")}>
              {(p) => (
                <select
                  {...p}
                  value={t.assigneeUserId ?? ""}
                  onChange={(e) => run(() => api(`/api/career/messaging/threads/${threadId}/assign`, { json: { assigneeUserId: e.target.value || null } }), tr("assignmentUpdated"))}
                >
                  <option value="">{tr("unassignedSharedInbox")}</option>
                  {data.staff?.map((s) => (
                    <option key={s.userId} value={s.userId}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Button variant="secondary" busy={busy} onClick={() => run(() => api(`/api/career/messaging/threads/${threadId}/${t.status === "Closed" ? "reopen" : "close"}`, { method: "POST" }), t.status === "Closed" ? tr("reopened") : tr("closed2"))}>
              {t.status === "Closed" ? tr("reopen") : tr("close")}
            </Button>
          </div>
        )}
        {!isStaff && t.kind === "CareerCenter" && t.status === "Open" && (
          <Button variant="secondary" busy={busy} onClick={() => run(() => api(`/api/career/messaging/threads/${threadId}/close`, { method: "POST" }), tr("conversationClosed"))}>
            {tr("closeConversation")}
          </Button>
        )}
      </div>

      <div aria-live="polite">
        <ErrorBanner error={actionError} />
        <SuccessBanner message={msg} />
      </div>

      <ol className="space-y-3" aria-label={tr("messages")}>
        {data.posts.map((p) => (
          <li
            key={p.id}
            className={`rounded-lg border p-3 text-sm ${p.isInternalNote ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : p.mine ? "border-border bg-muted/50" : "border-border"}`}
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{p.mine ? tr("you") : p.authorName}</span>
              {p.isInternalNote && <Badge tone="warn">{tr("internalNoteStaffOnly")}</Badge>}
              <span>{formatDate(p.createdAt, true)}</span>
              {p.mine && !p.isInternalNote && <span>{p.seen ? tr("seen") : tr("sent")}</span>}
              {!p.mine && !isStaff && (
                <button type="button" className="ms-auto underline" onClick={() => setReporting(p.id)}>
                  {tr("report")}
                </button>
              )}
            </div>
            {p.body && <p className="whitespace-pre-wrap">{p.body}</p>}
            {p.attachment && (
              <button
                type="button"
                className="mt-2 inline-flex items-center gap-1 text-xs underline"
                onClick={() => downloadMessageFile(api, threadId, p.attachment!, tr).catch((e: Error) => setActionError(e.message))}
              >
                <Paperclip className="h-3 w-3" aria-hidden /> {p.attachment.name}
              </button>
            )}
            {reporting === p.id && (
              <form
                className="mt-3 space-y-2 rounded-md border border-border p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => api(`/api/career/messaging/threads/${threadId}/report`, { json: { postId: p.id, reason, details } }), tr("thanksTheCareerCenterWill")).then(() => setReporting(null));
                }}
              >
                <Field label={tr("reason")}>
                  {(f) => (
                    <select {...f} value={reason} onChange={(e) => setReason(e.target.value)}>
                      {REPORT_REASONS.map((r) => (
                        <option key={r} value={r}>{tr(`reportReason.${r}`)}</option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={tr("detailsOptional")}>{(f) => <textarea {...f} rows={2} value={details} onChange={(e) => setDetails(e.target.value)} />}</Field>
                <div className="flex gap-2">
                  <Button type="submit" variant="danger" busy={busy}>
                    {tr("sendReport")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setReporting(null)}>
                    {tr("cancel")}
                  </Button>
                </div>
              </form>
            )}
          </li>
        ))}
      </ol>

      {data.canPost ? (
        <form onSubmit={send} className="mt-5 space-y-3 border-t border-border pt-4">
          <Field label={asNote ? tr("internalNoteOnlyStaffCan") : tr("reply")} hint={tr("dontSharePasswordsOrGovernment")}>
            {(p) => <textarea {...p} rows={4} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} />}
          </Field>
          <Field label={tr("attachmentOptional")} hint={tr("pDFWordPNGJPEGOr")}>
            {(p) => <input key={fileKey} {...p} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" busy={busy} disabled={!body.trim() && !file}>
              {asNote ? tr("addNote") : tr("send")}
            </Button>
            {data.canAddNotes && (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={asNote} onChange={(e) => setAsNote(e.target.checked)} />
                {tr("internalNote")}
              </label>
            )}
          </div>
        </form>
      ) : (
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
          {t.kind === "Mentorship" ? tr("newMessagesCanBeSent") : tr("youCanReadThisConversation")}
        </p>
      )}
    </section>
  );
}

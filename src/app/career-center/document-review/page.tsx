"use client";

import React, { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import {
  AnchoredText,
  CommentList,
  RATING_LABELS,
  RubricTable,
  STATUS_LABELS,
  StatusBadge,
  downloadFile,
  formatSize,
  type FileMeta,
  type ReviewComment,
  type ReviewDetail,
  type ReviewOptions,
  type RubricItem,
} from "@/components/career/docReview/shared";

interface QueueItem {
  id: string;
  kind: string;
  kindLabel: string;
  target: string;
  status: string;
  urgent: boolean;
  studentDeadline: string | null;
  currentVersion: number;
  submittedAt: string;
  dueAt: string;
  overdue: boolean;
  waitingHours: number;
  student: string | null;
  assignee: { userId: string; name: string | null } | null;
}

interface Reviewer {
  userId: string;
  name: string;
  email: string;
  role: string;
}

interface ReviewerMetric {
  userId: string | null;
  name: string;
  email: string;
  returned: number;
  medianTurnaroundHours: number | null;
  onTimePercent: number | null;
  averageRating: number | null;
  openAssigned: number;
}

interface Metrics {
  from: string;
  to: string;
  submitted: number;
  returned: number;
  medianTurnaroundHours: number | null;
  onTimePercent: number | null;
  averageRating: number | null;
  open: number;
  unassigned: number;
  overdue: number;
  byKind: { kind: string; label: string; submitted: number }[];
  reviewers: ReviewerMetric[];
}

interface Settings {
  slaBusinessDays: number;
  urgentWithinDays: number;
  timeZone: string;
  rubrics: Record<string, RubricItem[]>;
}

export default function CareerCenterDocumentReviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <DocumentReviewStaff />
    </Suspense>
  );
}

type Tab = "queue" | "metrics" | "settings";

function DocumentReviewStaff() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("id");
  const [tab, setTab] = useState<Tab>("queue");
  const { me, schoolId } = useCareerShell();
  const isAdmin = !!me?.memberships.some((m) => m.role === "CareerAdmin" && (!schoolId || m.instituteId === schoolId));

  if (selected) return <Workspace id={selected} isAdmin={isAdmin} onBack={() => router.push("/career-center/document-review")} />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "queue", label: "Queue" },
    { key: "metrics", label: "Metrics" },
    { key: "settings", label: "Settings" },
  ];
  return (
    <div>
      <PageHeader title="Document review" description="Students' resumes, cover letters and statements waiting for a counselor. Reviews are education records and are never shared with employers." />
      <div role="tablist" aria-label="Document review sections" className="mb-4 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            id={`tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium focus-visible:outline-2 ${tab === t.key ? "border-[var(--brand,#4f46e5)]" : "border-transparent text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "queue" && <Queue onOpen={(id) => router.push(`/career-center/document-review?id=${id}`)} />}
        {tab === "metrics" && <MetricsPanel />}
        {tab === "settings" && <SettingsPanel isAdmin={isAdmin} />}
      </div>
    </div>
  );
}

function waiting(hours: number) {
  if (hours < 24) return `${Math.max(0, Math.round(hours))} h`;
  return `${Math.floor(hours / 24)} d ${Math.round(hours % 24)} h`;
}

function Queue({ onOpen }: { onOpen: (id: string) => void }) {
  const api = useApi();
  const [status, setStatus] = useState("open");
  const [kind, setKind] = useState("");
  const [assignee, setAssignee] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [minWait, setMinWait] = useState("");
  const options = useLoad(() => api<ReviewOptions>("/api/career/doc-review/options"), []);
  const reviewers = useLoad(() => api<Reviewer[]>("/api/career/doc-review/staff/reviewers"), []);
  const qs = new URLSearchParams({ status });
  if (kind) qs.set("kind", kind);
  if (assignee) qs.set("assignee", assignee);
  if (overdue) qs.set("overdue", "true");
  if (minWait) qs.set("minWaitDays", minWait);
  const query = qs.toString();
  const queue = useLoad(() => api<{ total: number; overdueCount: number; items: QueueItem[] }>(`/api/career/doc-review/staff/queue?${query}`), [query]);

  return (
    <div className="space-y-4">
      <Card>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Status">
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">Open (not yet returned)</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
                <option value="all">All</option>
              </select>
            )}
          </Field>
          <Field label="Document type">
            {(p) => (
              <select {...p} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">Any</option>
                {options.data?.kinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Assignee">
            {(p) => (
              <select {...p} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">Anyone</option>
                <option value="me">Me</option>
                <option value="unassigned">Unassigned</option>
                {reviewers.data?.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Waiting at least (days)">
            {(p) => <input {...p} type="number" min={0} max={60} value={minWait} onChange={(e) => setMinWait(e.target.value)} />}
          </Field>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} /> Overdue only
            </label>
          </div>
        </div>
      </Card>
      <ErrorBanner error={queue.error} onRetry={queue.reload} />
      <Card title={queue.data ? `${queue.data.total} in view${queue.data.overdueCount ? ` · ${queue.data.overdueCount} overdue` : ""}` : "Queue"}>
        <div aria-live="polite">
          {queue.loading ? (
            <Loading />
          ) : !queue.data || queue.data.items.length === 0 ? (
            <EmptyState title="Nothing here">No documents match these filters.</EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">Review queue</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">Document</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Student</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Waiting</th>
                    <th scope="col" className="py-2 pr-3 font-medium">Due</th>
                    <th scope="col" className="py-2 font-medium">Reviewer</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.items.map((i) => (
                    <tr key={i.id} className="border-b border-border last:border-0 align-top">
                      <td className="py-2 pr-3">
                        <button type="button" className="text-left font-medium underline-offset-2 hover:underline focus-visible:outline-2" onClick={() => onOpen(i.id)}>
                          {i.kindLabel}: {i.target}
                        </button>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.currentVersion > 1 && <Badge>Version {i.currentVersion}</Badge>}
                          {i.urgent && <Badge tone="warn">Urgent{i.studentDeadline ? ` · deadline ${i.studentDeadline}` : ""}</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{i.student ?? "—"}</td>
                      <td className="py-2 pr-3">
                        <StatusBadge status={i.status} overdue={i.overdue} />
                      </td>
                      <td className="py-2 pr-3">{waiting(i.waitingHours)}</td>
                      <td className="py-2 pr-3">{formatDate(i.dueAt, true)}</td>
                      <td className="py-2">{i.assignee?.name ?? "Unassigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Character offsets of the current selection inside the given element, ignoring display-only footnote markers. */
function selectionOffsets(el: HTMLElement | null): { start: number; end: number; text: string } | null {
  const sel = typeof window !== "undefined" ? window.getSelection() : null;
  if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer) || !el.contains(range.endContainer)) return null;
  const offsetOf = (node: Node, offset: number) => {
    const before = document.createRange();
    before.selectNodeContents(el);
    before.setEnd(node, offset);
    return plainText(before.cloneContents()).length;
  };
  const start = offsetOf(range.startContainer, range.startOffset);
  const end = offsetOf(range.endContainer, range.endOffset);
  if (end <= start) return null;
  return { start, end, text: plainText(el).slice(start, end) };
}

// Text of a node without <sup> footnote markers, matching the stored submission text
function plainText(root: Node): string {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let out = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    let inSup = false;
    for (let p = n.parentNode; p && p !== root; p = p.parentNode) if (p.nodeName === "SUP") inSup = true;
    if (!inSup) out += n.textContent ?? "";
  }
  return out;
}

function Workspace({ id, isAdmin, onBack }: { id: string; isAdmin: boolean; onBack: () => void }) {
  const api = useApi();
  const { me } = useCareerShell();
  const detail = useLoad(() => api<ReviewDetail>(`/api/career/doc-review/staff/requests/${id}`), [id]);
  const reviewers = useLoad(() => api<Reviewer[]>("/api/career/doc-review/staff/reviewers"), []);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ versionId: string; summary: string; ratings: Record<string, { rating: string; note: string }> } | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [page, setPage] = useState("");
  const [anchor, setAnchor] = useState<{ start: number; end: number; text: string } | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const textRef = useRef<HTMLPreElement>(null);
  const annotatedRef = useRef<HTMLInputElement>(null);

  const d = detail.data;
  const current = d?.versions.find((v) => v.number === d.currentVersion) ?? null;
  const isOpen = !!d && ["Unassigned", "Assigned", "InReview"].includes(d.status);
  const mine = !!d && !!me && d.assignee?.userId === me.userId;
  const canReview = isOpen && (mine || isAdmin || !d?.assignee);

  // The draft form is seeded from the saved review of the current version
  const form =
    draft && current && draft.versionId === current.id
      ? draft
      : current
        ? {
            versionId: current.id,
            summary: current.summary ?? "",
            ratings: Object.fromEntries((current.rubric ?? []).map((r) => [r.key, { rating: r.rating ?? "", note: r.note ?? "" }])),
          }
        : null;

  const act = async (key: string, fn: () => Promise<unknown>, ok: string, after?: () => void) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const res = await fn();
      if (res && typeof res === "object" && "versions" in (res as object)) detail.setData(res as ReviewDetail);
      else detail.reload();
      setMessage(ok);
      after?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const post = (path: string, json?: unknown) => api<ReviewDetail>(`/api/career/doc-review/staff/requests/${id}${path}`, json === undefined ? { method: "POST" } : { json });
  const download = (f: FileMeta) => act("dl-" + f.id, () => downloadFile(api, f), `Downloaded ${f.fileName}.`);

  const saveReview = () =>
    form &&
    act(
      "save",
      () =>
        api<ReviewDetail>(`/api/career/doc-review/staff/requests/${id}/review`, {
          method: "PUT",
          json: {
            summary: form.summary,
            rubric: (d?.rubricTemplate ?? []).map((t) => ({ key: t.key, rating: form.ratings[t.key]?.rating || null, note: form.ratings[t.key]?.note || null })),
          },
        }),
      "Review saved.",
      () => setDraft(null),
    );

  const addComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return setError("Write a comment.");
    const body: Record<string, unknown> = { body: commentBody };
    if (anchor) {
      body.anchorStart = anchor.start;
      body.anchorEnd = anchor.end;
    }
    if (page) body.page = Number(page);
    void act("comment", () => post("/comments", body), "Comment added.", () => {
      setCommentBody("");
      setAnchor(null);
      setPage("");
    });
  };

  return (
    <div>
      <PageHeader
        title={d ? `${d.kindLabel}: ${d.target}` : "Review"}
        description={d?.student ? `${d.student.name} · ${d.student.email}` : undefined}
        actions={
          <Button variant="secondary" onClick={onBack}>
            Back to queue
          </Button>
        }
      />
      <ErrorBanner error={detail.error || error} onRetry={detail.error ? detail.reload : undefined} />
      <SuccessBanner message={message} />
      {detail.loading && !d ? (
        <Loading />
      ) : d && current && form ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card title="Request">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={d.status} overdue={d.overdue} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Due</dt>
                  <dd>{formatDate(d.dueAt, true)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Student&apos;s deadline</dt>
                  <dd>{d.studentDeadline ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reviewer</dt>
                  <dd>{d.assignee?.name ?? "Unassigned"}</dd>
                </div>
              </dl>
              {isOpen && (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  {!mine && (!d.assignee || isAdmin) && (
                    <Button busy={busy === "claim"} onClick={() => act("claim", () => post("/claim"), "Assigned to you.")}>
                      Claim
                    </Button>
                  )}
                  {mine && d.status === "Assigned" && (
                    <Button busy={busy === "start"} onClick={() => act("start", () => post("/start"), "Review started.")}>
                      Start review
                    </Button>
                  )}
                  {(isAdmin || mine) && (
                    <>
                      <Field label="Assign to">
                        {(p) => (
                          <select {...p} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                            <option value="">Choose…</option>
                            <option value="none">Nobody (back to queue)</option>
                            {reviewers.data?.map((r) => (
                              <option key={r.userId} value={r.userId}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                      <Button
                        variant="secondary"
                        disabled={!assignTo}
                        busy={busy === "assign"}
                        onClick={() => act("assign", () => post("/assign", { assigneeUserId: assignTo === "none" ? null : assignTo }), "Assignment updated.", () => setAssignTo(""))}
                      >
                        Assign
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" busy={busy === "prio"} onClick={() => act("prio", () => post("/priority", { urgent: !d.urgent }), d.urgent ? "Marked normal priority." : "Marked urgent.")}>
                    {d.urgent ? "Remove urgent" : "Mark urgent"}
                  </Button>
                </div>
              )}
            </Card>

            <Card title={`Version ${current.number} (submitted ${formatDate(current.submittedAt, true)})`}>
              <div className="space-y-3 text-sm">
                {current.notesToReviewer && (
                  <p>
                    <span className="font-medium">Student&apos;s notes: </span>
                    {current.notesToReviewer}
                  </p>
                )}
                {current.file && (
                  <p>
                    File:{" "}
                    <Button variant="ghost" className="px-1 py-0 underline" busy={busy === "dl-" + current.file.id} onClick={() => download(current.file!)}>
                      {current.file.fileName}
                    </Button>{" "}
                    <span className="text-muted-foreground">({formatSize(current.file.sizeBytes)})</span>
                  </p>
                )}
                {current.text && (
                  <>
                    <p className="text-xs text-muted-foreground">Select a passage, then use &quot;Comment on selection&quot; to anchor a comment to it.</p>
                    <AnchoredText ref={textRef} text={current.text} comments={current.comments} label="Submitted text" />
                  </>
                )}
                {current.jobDescription && (
                  <details>
                    <summary className="cursor-pointer font-medium">Job or program description</summary>
                    <p className="mt-2 whitespace-pre-wrap">{current.jobDescription}</p>
                  </details>
                )}
              </div>
            </Card>

            {d.versions.length > 1 && (
              <Card title="Earlier versions">
                <ul className="space-y-4">
                  {d.versions
                    .filter((v) => v.number !== d.currentVersion)
                    .reverse()
                    .map((v) => (
                      <li key={v.id}>
                        <details>
                          <summary className="cursor-pointer text-sm font-medium">
                            Version {v.number} · returned {formatDate(v.returnedAt, true)} {v.reviewer?.name ? `by ${v.reviewer.name}` : ""}
                          </summary>
                          <div className="mt-2 space-y-3 text-sm">
                            {v.file && (
                              <Button variant="ghost" className="px-1 py-0 underline" onClick={() => download(v.file!)}>
                                {v.file.fileName}
                              </Button>
                            )}
                            {v.text && <AnchoredText text={v.text} comments={v.comments} label={`Text of version ${v.number}`} />}
                            <p className="whitespace-pre-wrap">{v.summary}</p>
                            <RubricTable rubric={v.rubric ?? []} />
                            <CommentList comments={v.comments} />
                          </div>
                        </details>
                      </li>
                    ))}
                </ul>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card title="Review">
              {!canReview && isOpen && <p className="mb-3 text-sm text-muted-foreground">This review is assigned to someone else.</p>}
              {!isOpen && <p className="mb-3 text-sm text-muted-foreground">Returned {formatDate(current.returnedAt, true)}. The student can send a new version.</p>}
              <fieldset disabled={!canReview || busy !== null} className="space-y-4">
                <Field label="Overall summary" hint="Required before returning. Write your own feedback; the student sees it as written.">
                  {(p) => (
                    <textarea {...p} rows={5} maxLength={5000} value={form.summary} onChange={(e) => setDraft({ ...form, summary: e.target.value })} />
                  )}
                </Field>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Checklist</h3>
                  {d.rubricTemplate.map((t) => (
                    <div key={t.key} className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                      <Field label={`${t.label}: note`}>
                        {(p) => (
                          <input
                            {...p}
                            maxLength={1000}
                            value={form.ratings[t.key]?.note ?? ""}
                            onChange={(e) => setDraft({ ...form, ratings: { ...form.ratings, [t.key]: { rating: form.ratings[t.key]?.rating ?? "", note: e.target.value } } })}
                          />
                        )}
                      </Field>
                      <Field label={`${t.label}: result`}>
                        {(p) => (
                          <select
                            {...p}
                            value={form.ratings[t.key]?.rating ?? ""}
                            onChange={(e) => setDraft({ ...form, ratings: { ...form.ratings, [t.key]: { note: form.ratings[t.key]?.note ?? "", rating: e.target.value } } })}
                          >
                            <option value="">Not rated</option>
                            {Object.entries(RATING_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" busy={busy === "save"} onClick={() => void saveReview()}>
                    Save draft
                  </Button>
                  <Button
                    busy={busy === "return"}
                    onClick={async () => {
                      if (draft) {
                        // Save edits first so what's returned matches the screen
                        await saveReview();
                      }
                      void act("return", () => post("/return"), "Returned to the student. They've been notified.");
                    }}
                  >
                    Return to student
                  </Button>
                </div>
              </fieldset>
            </Card>

            <Card title="Comments">
              {canReview && (
                <form onSubmit={addComment} className="mb-4 space-y-3">
                  {current.text && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Button type="button" variant="secondary" onClick={() => {
                        const sel = selectionOffsets(textRef.current);
                        if (!sel) setError("Select a passage in the submitted text first.");
                        else {
                          setError(null);
                          setAnchor(sel);
                        }
                      }}>
                        Comment on selection
                      </Button>
                      {anchor ? (
                        <span>
                          On: <q className="italic">{anchor.text.length > 80 ? anchor.text.slice(0, 80) + "…" : anchor.text}</q>{" "}
                          <Button type="button" variant="ghost" className="px-1 py-0 text-xs" onClick={() => setAnchor(null)}>
                            Clear
                          </Button>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">General comment</span>
                      )}
                    </div>
                  )}
                  {current.file && (
                    <Field label="Page (optional)">
                      {(p) => <input {...p} type="number" min={1} max={500} value={page} onChange={(e) => setPage(e.target.value)} />}
                    </Field>
                  )}
                  <Field label="Comment">
                    {(p) => <textarea {...p} rows={3} maxLength={2000} value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />}
                  </Field>
                  <Button type="submit" variant="secondary" busy={busy === "comment"}>
                    Add comment
                  </Button>
                </form>
              )}
              <CommentList
                comments={current.comments}
                busyId={busy?.startsWith("del-") ? busy.slice(4) : null}
                onDelete={canReview ? (c: ReviewComment) => act("del-" + c.id, () => api<ReviewDetail>(`/api/career/doc-review/staff/requests/${id}/comments/${c.id}`, { method: "DELETE" }), "Comment deleted.") : undefined}
              />
            </Card>

            <Card title="Annotated file">
              {current.annotatedFile ? (
                <p className="mb-3 text-sm">
                  <Button variant="ghost" className="px-1 py-0 underline" onClick={() => download(current.annotatedFile!)}>
                    {current.annotatedFile.fileName}
                  </Button>{" "}
                  <span className="text-muted-foreground">({formatSize(current.annotatedFile.sizeBytes)})</span>
                </p>
              ) : (
                <p className="mb-3 text-sm text-muted-foreground">Optional: upload a marked-up copy for the student.</p>
              )}
              {canReview && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = annotatedRef.current?.files?.[0];
                    if (!f) return setError("Choose a file to upload.");
                    if (f.size > 10 * 1024 * 1024) return setError("Files can be up to 10 MB.");
                    const fd = new FormData();
                    fd.append("file", f);
                    void act("annotated", () => api<ReviewDetail>(`/api/career/doc-review/staff/requests/${id}/annotated`, { method: "POST", body: fd }), "Annotated file uploaded.", () => {
                      if (annotatedRef.current) annotatedRef.current.value = "";
                    });
                  }}
                >
                  <Field label={current.annotatedFile ? "Replace annotated file" : "Annotated file"} hint="PDF, Word, PNG, JPEG or text, up to 10 MB.">
                    {(p) => <input {...p} ref={annotatedRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" />}
                  </Field>
                  <Button type="submit" variant="secondary" busy={busy === "annotated"}>
                    Upload
                  </Button>
                </form>
              )}
            </Card>

            {(d.rating || d.ratingComment) && (
              <Card title="Student feedback">
                <p className="text-sm">
                  Helpfulness: {d.rating ?? "—"} / 5{d.ratingComment ? ` · “${d.ratingComment}”` : ""}
                </p>
              </Card>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricsPanel() {
  const api = useApi();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const query = qs.toString();
  const metrics = useLoad(() => api<Metrics>(`/api/career/doc-review/staff/metrics?${query}`), [query]);
  const m = metrics.data;
  const exportCsv = async () => {
    setError(null);
    try {
      const res = await api<Response>(`/api/career/doc-review/staff/metrics.csv?${query}`, { raw: true });
      if (!res.ok) throw new Error(`Export failed (${res.status}).`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "document-review-metrics.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const stat = (label: string, value: React.ReactNode) => (
    <div className="rounded-lg border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold">{value}</dd>
    </div>
  );
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="From">{(p) => <input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="To">{(p) => <input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
          <Button variant="secondary" onClick={() => void exportCsv()}>
            Export CSV
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Defaults to the last 90 days.</p>
      </Card>
      <ErrorBanner error={metrics.error || error} onRetry={metrics.reload} />
      {metrics.loading && !m ? (
        <Loading />
      ) : m ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-live="polite">
            {stat("Submitted", m.submitted)}
            {stat("Returned", m.returned)}
            {stat("Median turnaround", m.medianTurnaroundHours == null ? "—" : waiting(m.medianTurnaroundHours))}
            {stat("On time", m.onTimePercent == null ? "—" : `${m.onTimePercent}%`)}
            {stat("Open now (unassigned)", `${m.open} (${m.unassigned})`)}
            {stat("Overdue now", m.overdue)}
          </dl>
          <Card title="By reviewer">
            {m.reviewers.length === 0 ? (
              <EmptyState title="No reviews in this period" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <caption className="sr-only">Reviews by reviewer</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pr-3 font-medium">Reviewer</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Returned</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Median turnaround</th>
                      <th scope="col" className="py-2 pr-3 font-medium">On time</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Avg. rating</th>
                      <th scope="col" className="py-2 font-medium">Open assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.reviewers.map((r) => (
                      <tr key={r.userId ?? r.name} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pr-3 font-medium">{r.name}</th>
                        <td className="py-2 pr-3">{r.returned}</td>
                        <td className="py-2 pr-3">{r.medianTurnaroundHours == null ? "—" : waiting(r.medianTurnaroundHours)}</td>
                        <td className="py-2 pr-3">{r.onTimePercent == null ? "—" : `${r.onTimePercent}%`}</td>
                        <td className="py-2 pr-3">{r.averageRating ?? "—"}</td>
                        <td className="py-2">{r.openAssigned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card title="Submitted by document type">
            <ul className="grid gap-2 text-sm sm:grid-cols-3">
              {m.byKind.map((k) => (
                <li key={k.kind}>
                  {k.label}: <span className="font-semibold">{k.submitted}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      ) : null}
    </div>
  );
}

const KIND_LABELS: Record<string, string> = {
  Resume: "Resume",
  CoverLetter: "Cover letter",
  PersonalStatement: "Personal statement",
  LinkedInSummary: "LinkedIn summary",
  Other: "Other",
};

function SettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const api = useApi();
  const settings = useLoad(() => api<Settings>("/api/career/doc-review/staff/settings"), []);
  const [edits, setEdits] = useState<{ sla?: string; urgent?: string; rubrics: Record<string, string> }>({ rubrics: {} });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const s = settings.data;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const rubrics: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(edits.rubrics)) rubrics[k] = v.split("\n").map((l) => l.trim()).filter(Boolean);
      const next = await api<Settings>("/api/career/doc-review/staff/settings", {
        method: "PUT",
        json: {
          slaBusinessDays: edits.sla !== undefined ? Number(edits.sla) : undefined,
          urgentWithinDays: edits.urgent !== undefined ? Number(edits.urgent) : undefined,
          rubrics: Object.keys(rubrics).length ? rubrics : undefined,
        },
      });
      settings.setData(next);
      setEdits({ rubrics: {} });
      setMessage("Settings saved.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (settings.loading && !s) return <Loading />;
  return (
    <div className="space-y-4">
      <ErrorBanner error={settings.error || error} onRetry={settings.reload} />
      <SuccessBanner message={message} />
      {s && (
        <form onSubmit={save}>
          <fieldset disabled={!isAdmin || busy} className="space-y-4">
            {!isAdmin && <p className="text-sm text-muted-foreground">Only career admins can change these settings.</p>}
            <Card title="Turnaround">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Review target (business days)" hint={`Counted Monday to Friday in the school's time zone (${s.timeZone}).`}>
                  {(p) => <input {...p} type="number" min={1} max={20} value={edits.sla ?? String(s.slaBusinessDays)} onChange={(e) => setEdits({ ...edits, sla: e.target.value })} />}
                </Field>
                <Field label="Urgent when the student's deadline is within (days)">
                  {(p) => <input {...p} type="number" min={0} max={60} value={edits.urgent ?? String(s.urgentWithinDays)} onChange={(e) => setEdits({ ...edits, urgent: e.target.value })} />}
                </Field>
              </div>
            </Card>
            <Card title="Checklists">
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(s.rubrics).map(([kind, items]) => (
                  <Field key={kind} label={`${KIND_LABELS[kind] ?? kind} checklist`} hint="One item per line (1 to 15).">
                    {(p) => (
                      <textarea
                        {...p}
                        rows={6}
                        value={edits.rubrics[kind] ?? items.map((i) => i.label).join("\n")}
                        onChange={(e) => setEdits({ ...edits, rubrics: { ...edits.rubrics, [kind]: e.target.value } })}
                      />
                    )}
                  </Field>
                ))}
              </div>
            </Card>
            <p className="text-xs text-muted-foreground">Student peer reviewers are not available yet; reviews are done by counselors and career admins.</p>
            {isAdmin && (
              <Button type="submit" busy={busy}>
                Save settings
              </Button>
            )}
          </fieldset>
        </form>
      )}
    </div>
  );
}

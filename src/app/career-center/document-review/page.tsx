"use client";

import React, { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT, useCareerLabels } from "@/components/career/ui";
import {
  AnchoredText,
  CommentList,
  RubricTable,
  StatusBadge,
  type FileMeta,
  type ReviewComment,
  type ReviewDetail,
  type ReviewOptions,
  type RubricItem,
  useReviewStatusLabels,
  useRatingLabels,
  useDownloadFile,
  useFormatSize,
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
  const tr = useCareerT("careerCenterDocumentReview");
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("id");
  const [tab, setTab] = useState<Tab>("queue");
  const { me, schoolId } = useCareerShell();
  const isAdmin = !!me?.memberships.some((m) => m.role === "CareerAdmin" && (!schoolId || m.instituteId === schoolId));

  if (selected) return <Workspace id={selected} isAdmin={isAdmin} onBack={() => router.push("/career-center/document-review")} />;

  const tabs: { key: Tab; label: string }[] = [
    { key: "queue", label: tr("queue") },
    { key: "metrics", label: tr("metrics") },
    { key: "settings", label: tr("settings") },
  ];
  return (
    <div>
      <PageHeader title={tr("documentReview")} description={tr("studentsResumesCoverLettersAnd")} />
      <div role="tablist" aria-label={tr("documentReviewSections")} className="mb-4 flex gap-1 border-b border-border">
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
  const tr = useCareerT("careerCenterDocumentReview");
  const STATUS_LABELS = useReviewStatusLabels();
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
          <Field label={tr("status")}>
            {(p) => (
              <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">{tr("openNotYetReturned")}</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
                <option value="all">{tr("all")}</option>
              </select>
            )}
          </Field>
          <Field label={tr("documentType")}>
            {(p) => (
              <select {...p} value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">{tr("any")}</option>
                {options.data?.kinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("assignee")}>
            {(p) => (
              <select {...p} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                <option value="">{tr("anyone")}</option>
                <option value="me">{tr("me")}</option>
                <option value="unassigned">{tr("unassigned")}</option>
                {reviewers.data?.map((r) => (
                  <option key={r.userId} value={r.userId}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={tr("waitingAtLeastDays")}>
            {(p) => <input {...p} type="number" min={0} max={60} value={minWait} onChange={(e) => setMinWait(e.target.value)} />}
          </Field>
          <div className="flex items-end pb-2">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={overdue} onChange={(e) => setOverdue(e.target.checked)} />{" "}{tr("overdueOnly")}
            </label>
          </div>
        </div>
      </Card>
      <ErrorBanner error={queue.error} onRetry={queue.reload} />
      <Card title={queue.data ? tr("totalInViewValue", { total: queue.data.total, value: queue.data.overdueCount ? tr("overdueCountOverdue", { overdueCount: queue.data.overdueCount }) : "" }) : tr("queue")}>
        <div aria-live="polite">
          {queue.loading ? (
            <Loading />
          ) : !queue.data || queue.data.items.length === 0 ? (
            <EmptyState title={tr("nothingHere")}>{tr("noDocumentsMatchTheseFilters")}</EmptyState>
          ) : (
            <ScrollArea>
              <table className="w-full min-w-[720px] text-start text-sm [&_th]:text-start">
                <caption className="sr-only">{tr("reviewQueue")}</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="py-2 pe-3 font-medium">{tr("document")}</th>
                    <th scope="col" className="py-2 pe-3 font-medium">{tr("student")}</th>
                    <th scope="col" className="py-2 pe-3 font-medium">{tr("status")}</th>
                    <th scope="col" className="py-2 pe-3 font-medium">{tr("waiting")}</th>
                    <th scope="col" className="py-2 pe-3 font-medium">{tr("due")}</th>
                    <th scope="col" className="py-2 font-medium">{tr("reviewer")}</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.items.map((i) => (
                    <tr key={i.id} className="border-b border-border last:border-0 align-top">
                      <td className="py-2 pe-3">
                        <button type="button" className="text-start font-medium underline-offset-2 hover:underline focus-visible:outline-2" onClick={() => onOpen(i.id)}>
                          {i.kindLabel}: {i.target}
                        </button>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.currentVersion > 1 && <Badge>{tr("versionCurrentVersion", { currentVersion: i.currentVersion })}</Badge>}
                          {i.urgent && <Badge tone="warn">{tr("urgent")}{i.studentDeadline ? tr("deadlineStudentDeadline", { studentDeadline: i.studentDeadline }) : ""}</Badge>}
                        </div>
                      </td>
                      <td className="py-2 pe-3">{i.student ?? "—"}</td>
                      <td className="py-2 pe-3">
                        <StatusBadge status={i.status} overdue={i.overdue} />
                      </td>
                      <td className="py-2 pe-3">{waiting(i.waitingHours)}</td>
                      <td className="py-2 pe-3">{formatDate(i.dueAt, true)}</td>
                      <td className="py-2">{i.assignee?.name ?? tr("unassigned")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
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
  const tr = useCareerT("careerCenterDocumentReview");
  const formatSize = useFormatSize();
  const downloadFile = useDownloadFile();
  const RATING_LABELS = useRatingLabels();
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
  const download = (f: FileMeta) => act("dl-" + f.id, () => downloadFile(api, f), tr("downloadedFileName", { fileName: f.fileName }));

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
      tr("reviewSaved"),
      () => setDraft(null),
    );

  const addComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return setError(tr("writeAComment"));
    const body: Record<string, unknown> = { body: commentBody };
    if (anchor) {
      body.anchorStart = anchor.start;
      body.anchorEnd = anchor.end;
    }
    if (page) body.page = Number(page);
    void act("comment", () => post("/comments", body), tr("commentAdded"), () => {
      setCommentBody("");
      setAnchor(null);
      setPage("");
    });
  };

  return (
    <div>
      <PageHeader
        title={d ? `${d.kindLabel}: ${d.target}` : tr("review")}
        description={d?.student ? `${d.student.name} · ${d.student.email}` : undefined}
        actions={
          <Button variant="secondary" onClick={onBack}>
            {tr("backToQueue")}
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
            <Card title={tr("request")}>
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">{tr("status")}</dt>
                  <dd>
                    <StatusBadge status={d.status} overdue={d.overdue} />
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tr("due")}</dt>
                  <dd>{formatDate(d.dueAt, true)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tr("studentsDeadline")}</dt>
                  <dd>{d.studentDeadline ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{tr("reviewer")}</dt>
                  <dd>{d.assignee?.name ?? tr("unassigned")}</dd>
                </div>
              </dl>
              {isOpen && (
                <div className="mt-4 flex flex-wrap items-end gap-2">
                  {!mine && (!d.assignee || isAdmin) && (
                    <Button busy={busy === "claim"} onClick={() => act("claim", () => post("/claim"), tr("assignedToYou"))}>
                      {tr("claim")}
                    </Button>
                  )}
                  {mine && d.status === "Assigned" && (
                    <Button busy={busy === "start"} onClick={() => act("start", () => post("/start"), tr("reviewStarted"))}>
                      {tr("startReview")}
                    </Button>
                  )}
                  {(isAdmin || mine) && (
                    <>
                      <Field label={tr("assignTo")}>
                        {(p) => (
                          <select {...p} value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                            <option value="">{tr("choose")}</option>
                            <option value="none">{tr("nobodyBackToQueue")}</option>
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
                        onClick={() => act("assign", () => post("/assign", { assigneeUserId: assignTo === "none" ? null : assignTo }), tr("assignmentUpdated"), () => setAssignTo(""))}
                      >
                        {tr("assign")}
                      </Button>
                    </>
                  )}
                  <Button variant="ghost" busy={busy === "prio"} onClick={() => act("prio", () => post("/priority", { urgent: !d.urgent }), d.urgent ? tr("markedNormalPriority") : tr("markedUrgent"))}>
                    {d.urgent ? tr("removeUrgent") : tr("markUrgent")}
                  </Button>
                </div>
              )}
            </Card>

            <Card title={tr("versionNumberSubmittedSubmittedAt", { number: current.number, submittedAt: formatDate(current.submittedAt, true) })}>
              <div className="space-y-3 text-sm">
                {current.notesToReviewer && (
                  <p>
                    <span className="font-medium">{tr("studentsNotes")}{" "}</span>
                    {current.notesToReviewer}
                  </p>
                )}
                {current.file && (
                  <p>
                    {tr("file")}{" "}
                    <Button variant="ghost" className="px-1 py-0 underline" busy={busy === "dl-" + current.file.id} onClick={() => download(current.file!)}>
                      {current.file.fileName}
                    </Button>{" "}
                    <span className="text-muted-foreground">({formatSize(current.file.sizeBytes)})</span>
                  </p>
                )}
                {current.text && (
                  <>
                    <p className="text-xs text-muted-foreground">{tr("selectAPassageThenUse")}</p>
                    <AnchoredText ref={textRef} text={current.text} comments={current.comments} label={tr("submittedText")} />
                  </>
                )}
                {current.jobDescription && (
                  <details>
                    <summary className="cursor-pointer font-medium">{tr("jobOrProgramDescription")}</summary>
                    <p className="mt-2 whitespace-pre-wrap">{current.jobDescription}</p>
                  </details>
                )}
              </div>
            </Card>

            {d.versions.length > 1 && (
              <Card title={tr("earlierVersions")}>
                <ul className="space-y-4">
                  {d.versions
                    .filter((v) => v.number !== d.currentVersion)
                    .reverse()
                    .map((v) => (
                      <li key={v.id}>
                        <details>
                          <summary className="cursor-pointer text-sm font-medium">
                            {tr("versionNumberReturnedReturnedAt", { number: v.number, returnedAt: formatDate(v.returnedAt, true) })}{" "}{v.reviewer?.name ? tr("byName", { name: v.reviewer.name }) : ""}
                          </summary>
                          <div className="mt-2 space-y-3 text-sm">
                            {v.file && (
                              <Button variant="ghost" className="px-1 py-0 underline" onClick={() => download(v.file!)}>
                                {v.file.fileName}
                              </Button>
                            )}
                            {v.text && <AnchoredText text={v.text} comments={v.comments} label={tr("textOfVersionNumber", { number: v.number })} />}
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
            <Card title={tr("review")}>
              {!canReview && isOpen && <p className="mb-3 text-sm text-muted-foreground">{tr("thisReviewIsAssignedTo")}</p>}
              {!isOpen && <p className="mb-3 text-sm text-muted-foreground">{tr("returnedReturnedAtTheStudentCan", { returnedAt: formatDate(current.returnedAt, true) })}</p>}
              <fieldset disabled={!canReview || busy !== null} className="space-y-4">
                <Field label={tr("overallSummary")} hint={tr("requiredBeforeReturningWriteYour")}>
                  {(p) => (
                    <textarea {...p} rows={5} maxLength={5000} value={form.summary} onChange={(e) => setDraft({ ...form, summary: e.target.value })} />
                  )}
                </Field>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">{tr("checklist")}</h3>
                  {d.rubricTemplate.map((t) => (
                    <div key={t.key} className="grid gap-2 sm:grid-cols-[1fr_10rem]">
                      <Field label={tr("labelNote", { label: t.label })}>
                        {(p) => (
                          <input
                            {...p}
                            maxLength={1000}
                            value={form.ratings[t.key]?.note ?? ""}
                            onChange={(e) => setDraft({ ...form, ratings: { ...form.ratings, [t.key]: { rating: form.ratings[t.key]?.rating ?? "", note: e.target.value } } })}
                          />
                        )}
                      </Field>
                      <Field label={tr("labelResult", { label: t.label })}>
                        {(p) => (
                          <select
                            {...p}
                            value={form.ratings[t.key]?.rating ?? ""}
                            onChange={(e) => setDraft({ ...form, ratings: { ...form.ratings, [t.key]: { note: form.ratings[t.key]?.note ?? "", rating: e.target.value } } })}
                          >
                            <option value="">{tr("notRated")}</option>
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
                    {tr("saveDraft")}
                  </Button>
                  <Button
                    busy={busy === "return"}
                    onClick={async () => {
                      if (draft) {
                        // Save edits first so what's returned matches the screen
                        await saveReview();
                      }
                      void act("return", () => post("/return"), tr("returnedToTheStudentTheyve"));
                    }}
                  >
                    {tr("returnToStudent")}
                  </Button>
                </div>
              </fieldset>
            </Card>

            <Card title={tr("comments")}>
              {canReview && (
                <form onSubmit={addComment} className="mb-4 space-y-3">
                  {current.text && (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Button type="button" variant="secondary" onClick={() => {
                        const sel = selectionOffsets(textRef.current);
                        if (!sel) setError(tr("selectAPassageInThe"));
                        else {
                          setError(null);
                          setAnchor(sel);
                        }
                      }}>
                        {tr("commentOnSelection")}
                      </Button>
                      {anchor ? (
                        <span>
                          {tr("on")}{" "}<q className="italic">{anchor.text.length > 80 ? anchor.text.slice(0, 80) + "…" : anchor.text}</q>{" "}
                          <Button type="button" variant="ghost" className="px-1 py-0 text-xs" onClick={() => setAnchor(null)}>
                            {tr("clear")}
                          </Button>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{tr("generalComment")}</span>
                      )}
                    </div>
                  )}
                  {current.file && (
                    <Field label={tr("pageOptional")}>
                      {(p) => <input {...p} type="number" min={1} max={500} value={page} onChange={(e) => setPage(e.target.value)} />}
                    </Field>
                  )}
                  <Field label={tr("comment")}>
                    {(p) => <textarea {...p} rows={3} maxLength={2000} value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />}
                  </Field>
                  <Button type="submit" variant="secondary" busy={busy === "comment"}>
                    {tr("addComment")}
                  </Button>
                </form>
              )}
              <CommentList
                comments={current.comments}
                busyId={busy?.startsWith("del-") ? busy.slice(4) : null}
                onDelete={canReview ? (c: ReviewComment) => act("del-" + c.id, () => api<ReviewDetail>(`/api/career/doc-review/staff/requests/${id}/comments/${c.id}`, { method: "DELETE" }), tr("commentDeleted")) : undefined}
              />
            </Card>

            <Card title={tr("annotatedFile")}>
              {current.annotatedFile ? (
                <p className="mb-3 text-sm">
                  <Button variant="ghost" className="px-1 py-0 underline" onClick={() => download(current.annotatedFile!)}>
                    {current.annotatedFile.fileName}
                  </Button>{" "}
                  <span className="text-muted-foreground">({formatSize(current.annotatedFile.sizeBytes)})</span>
                </p>
              ) : (
                <p className="mb-3 text-sm text-muted-foreground">{tr("optionalUploadAMarkedUp")}</p>
              )}
              {canReview && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = annotatedRef.current?.files?.[0];
                    if (!f) return setError(tr("chooseAFileToUpload"));
                    if (f.size > 10 * 1024 * 1024) return setError(tr("filesCanBeUpTo"));
                    const fd = new FormData();
                    fd.append("file", f);
                    void act("annotated", () => api<ReviewDetail>(`/api/career/doc-review/staff/requests/${id}/annotated`, { method: "POST", body: fd }), tr("annotatedFileUploaded"), () => {
                      if (annotatedRef.current) annotatedRef.current.value = "";
                    });
                  }}
                >
                  <Field label={current.annotatedFile ? tr("replaceAnnotatedFile") : tr("annotatedFile")} hint={tr("pDFWordPNGJPEGOr")}>
                    {(p) => <input {...p} ref={annotatedRef} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" />}
                  </Field>
                  <Button type="submit" variant="secondary" busy={busy === "annotated"}>
                    {tr("upload")}
                  </Button>
                </form>
              )}
            </Card>

            {(d.rating || d.ratingComment) && (
              <Card title={tr("studentFeedback")}>
                <p className="text-sm">
                  {tr("helpfulnessRating5", { rating: d.rating ?? "—" })}{d.ratingComment ? ` · “${d.ratingComment}”` : ""}
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
  const tr = useCareerT("careerCenterDocumentReview");
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
      if (!res.ok) throw new Error(tr("exportFailedStatus", { status: res.status }));
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
          <Field label={tr("from")}>{(p) => <input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label={tr("to")}>{(p) => <input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
          <Button variant="secondary" onClick={() => void exportCsv()}>
            {tr("exportCSV")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{tr("defaultsToTheLast90")}</p>
      </Card>
      <ErrorBanner error={metrics.error || error} onRetry={metrics.reload} />
      {metrics.loading && !m ? (
        <Loading />
      ) : m ? (
        <>
          <dl className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-live="polite">
            {stat(tr("submitted"), m.submitted)}
            {stat(tr("returned"), m.returned)}
            {stat(tr("medianTurnaround"), m.medianTurnaroundHours == null ? "—" : waiting(m.medianTurnaroundHours))}
            {stat(tr("onTime"), m.onTimePercent == null ? "—" : `${m.onTimePercent}%`)}
            {stat(tr("openNowUnassigned"), `${m.open} (${m.unassigned})`)}
            {stat(tr("overdueNow"), m.overdue)}
          </dl>
          <Card title={tr("byReviewer")}>
            {m.reviewers.length === 0 ? (
              <EmptyState title={tr("noReviewsInThisPeriod")} />
            ) : (
              <ScrollArea>
                <table className="w-full min-w-[560px] text-start text-sm [&_th]:text-start">
                  <caption className="sr-only">{tr("reviewsByReviewer")}</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 pe-3 font-medium">{tr("reviewer")}</th>
                      <th scope="col" className="py-2 pe-3 font-medium">{tr("returned")}</th>
                      <th scope="col" className="py-2 pe-3 font-medium">{tr("medianTurnaround")}</th>
                      <th scope="col" className="py-2 pe-3 font-medium">{tr("onTime")}</th>
                      <th scope="col" className="py-2 pe-3 font-medium">{tr("avgRating")}</th>
                      <th scope="col" className="py-2 font-medium">{tr("openAssigned")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.reviewers.map((r) => (
                      <tr key={r.userId ?? r.name} className="border-b border-border last:border-0">
                        <th scope="row" className="py-2 pe-3 font-medium">{r.name}</th>
                        <td className="py-2 pe-3">{r.returned}</td>
                        <td className="py-2 pe-3">{r.medianTurnaroundHours == null ? "—" : waiting(r.medianTurnaroundHours)}</td>
                        <td className="py-2 pe-3">{r.onTimePercent == null ? "—" : `${r.onTimePercent}%`}</td>
                        <td className="py-2 pe-3">{r.averageRating ?? "—"}</td>
                        <td className="py-2">{r.openAssigned}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </Card>
          <Card title={tr("submittedByDocumentType")}>
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

const KIND_LABELS_KEYS = ["Resume", "CoverLetter", "PersonalStatement", "LinkedInSummary", "Other"];
/** kind labels in the career language (G1) */
function useKindLabels(): Record<string, string> {
  return useCareerLabels("careerCenterDocumentReview.kind", KIND_LABELS_KEYS);
}

function SettingsPanel({ isAdmin }: { isAdmin: boolean }) {
  const tr = useCareerT("careerCenterDocumentReview");
  const KIND_LABELS = useKindLabels();
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
      setMessage(tr("settingsSaved"));
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
            {!isAdmin && <p className="text-sm text-muted-foreground">{tr("onlyCareerAdminsCanChange")}</p>}
            <Card title={tr("turnaround")}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tr("reviewTargetBusinessDays")} hint={tr("countedMondayToFridayIn", { timeZone: s.timeZone })}>
                  {(p) => <input {...p} type="number" min={1} max={20} value={edits.sla ?? String(s.slaBusinessDays)} onChange={(e) => setEdits({ ...edits, sla: e.target.value })} />}
                </Field>
                <Field label={tr("urgentWhenTheStudentsDeadline")}>
                  {(p) => <input {...p} type="number" min={0} max={60} value={edits.urgent ?? String(s.urgentWithinDays)} onChange={(e) => setEdits({ ...edits, urgent: e.target.value })} />}
                </Field>
              </div>
            </Card>
            <Card title={tr("checklists")}>
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(s.rubrics).map(([kind, items]) => (
                  <Field key={kind} label={tr("kindChecklist", { kind: KIND_LABELS[kind] ?? kind })} hint={tr("oneItemPerLine1")}>
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
            <p className="text-xs text-muted-foreground">{tr("studentPeerReviewersAreNot")}</p>
            {isAdmin && (
              <Button type="submit" busy={busy}>
                {tr("saveSettings")}
              </Button>
            )}
          </fieldset>
        </form>
      )}
    </div>
  );
}

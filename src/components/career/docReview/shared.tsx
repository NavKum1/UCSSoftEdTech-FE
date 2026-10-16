"use client";

/**
 * Shared types and views for human document review (plan item C6): used by the student page and the
 * career-center review workspace. Reviews are written by people; nothing here generates or rewrites text.
 */

import React, { useCallback } from "react";
import type { CareerTranslator } from "@/components/career/i18n/CareerI18nProvider";
import { Badge, Button, formatDate, useCareerT, useCareerLabels } from "@/components/career/ui";
import type { useApi } from "@/lib/appAuth";

export interface FileMeta {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface RubricItem {
  key: string;
  label: string;
}

export interface RubricResult {
  key: string;
  label: string;
  rating: string | null;
  note: string | null;
}

export interface ReviewComment {
  id: string;
  body: string;
  anchorStart: number | null;
  anchorEnd: number | null;
  quote: string | null;
  page: number | null;
  createdAt: string;
  author: string | null;
  mine: boolean;
}

export interface ReviewVersion {
  id: string;
  number: number;
  submittedAt: string;
  dueAt: string;
  text: string | null;
  jobDescription: string | null;
  notesToReviewer: string | null;
  file: FileMeta | null;
  returnedAt: string | null;
  reviewStartedAt: string | null;
  reviewer: { userId: string; name: string | null } | null;
  summary: string | null;
  rubric: RubricResult[] | null;
  annotatedFile: FileMeta | null;
  comments: ReviewComment[];
}

export interface ReviewDetail {
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
  returnedAt: string | null;
  completedAt: string | null;
  rating: number | null;
  ratingComment: string | null;
  assignee: { userId: string; name: string | null } | null;
  student: { userId: string; name: string; email: string } | null;
  rubricTemplate: RubricItem[];
  versions: ReviewVersion[];
}

export interface ReviewOptions {
  slaBusinessDays: number;
  urgentWithinDays: number;
  timeZone: string;
  ratings: string[];
  kinds: { kind: string; label: string; rubric: RubricItem[] }[];
}

export const STATUS_LABELS_KEYS = ["Unassigned", "Assigned", "InReview", "Returned", "Done"];
/** status labels in the career language (G1) */
export function useReviewStatusLabels(): Record<string, string> {
  return useCareerLabels("docReviewShared.status", STATUS_LABELS_KEYS);
}

export const RATING_LABELS_KEYS = ["Strong", "Satisfactory", "NeedsWork", "NotApplicable"];
/** rating labels in the career language (G1) */
export function useRatingLabels(): Record<string, string> {
  return useCareerLabels("docReviewShared.rating", RATING_LABELS_KEYS);
}

export function StatusBadge({ status, overdue }: { status: string; overdue?: boolean }) {
  const t = useCareerT("docReviewShared");
  const STATUS_LABELS = useReviewStatusLabels();
  const tone = status === "Returned" || status === "Done" ? "good" : status === "Unassigned" ? "neutral" : "info";
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={tone}>{STATUS_LABELS[status] ?? status}</Badge>
      {overdue && <Badge tone="bad">{t("overdue")}</Badge>}
    </span>
  );
}

/** Fetches a protected file with the caller's credentials and saves it. */
export async function downloadFile(api: ReturnType<typeof useApi>, file: FileMeta, t: CareerTranslator) {
  const res = await api<Response>(`/api/career/doc-review/files/${file.id}`, { raw: true });
  if (!res.ok) throw new Error(res.status === 404 ? t("fileNotAvailable") : t("downloadFailedStatus", { status: res.status }));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** downloadFile with its error texts in the career language (G1). */
export function useDownloadFile() {
  const t = useCareerT("docReviewShared");
  return useCallback((api: ReturnType<typeof useApi>, file: FileMeta) => downloadFile(api, file, t), [t]);
}

/** File size text ("12 KB"), in the career language (G1). */
export function useFormatSize() {
  const t = useCareerT("docReviewShared");
  return useCallback((bytes: number) => {
    if (bytes < 1024) return t("sizeBytes", { n: bytes });
    if (bytes < 1024 * 1024) return t("sizeKb", { n: Math.round(bytes / 1024) });
    return t("sizeMb", { n: (bytes / 1024 / 1024).toFixed(1) });
  }, [t]);
}

/**
 * Pasted text with commented ranges highlighted. Each highlight carries a footnote number that matches the comment list,
 * so meaning never depends on color alone.
 */
export const AnchoredText = React.forwardRef<HTMLPreElement, { text: string; comments: ReviewComment[]; label: string }>(function AnchoredText(
  { text, comments, label },
  ref,
) {
  const t = useCareerT("docReviewShared");
  const anchored = comments
    .map((c, i) => ({ c, n: i + 1 }))
    .filter((x) => x.c.anchorStart != null && x.c.anchorEnd != null)
    .sort((a, b) => (a.c.anchorStart ?? 0) - (b.c.anchorStart ?? 0));
  const parts: React.ReactNode[] = [];
  let pos = 0;
  for (const { c, n } of anchored) {
    const s = Math.max(c.anchorStart ?? 0, pos);
    const e = c.anchorEnd ?? 0;
    if (e <= s) continue;
    if (s > pos) parts.push(text.slice(pos, s));
    parts.push(
      <mark key={c.id} className="rounded-sm bg-amber-100 px-0.5 text-foreground underline decoration-amber-600 decoration-2 dark:bg-amber-900/40">
        {text.slice(s, e)}
        <sup className="ms-0.5 font-semibold" aria-label={t("commentN", { n })}>
          [{n}]
        </sup>
      </mark>,
    );
    pos = e;
  }
  if (pos < text.length) parts.push(text.slice(pos));
  return (
    <pre
      ref={ref}
      tabIndex={0}
      aria-label={label}
      className="max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 p-3 font-sans text-sm leading-relaxed focus-visible:outline-2"
    >
      {parts}
    </pre>
  );
});

export function CommentList({ comments, onDelete, busyId }: { comments: ReviewComment[]; onDelete?: (c: ReviewComment) => void; busyId?: string | null }) {
  const t = useCareerT("docReviewShared");
  if (comments.length === 0) return <p className="text-sm text-muted-foreground">{t("noComments")}</p>;
  return (
    <ol className="space-y-3">
      {comments.map((c, i) => (
        <li key={c.id} className="rounded-md border border-border p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">[{i + 1}]</span>
            {c.page != null && <span>{t("pagePage", { page: c.page })}</span>}
            {c.quote && <q className="italic">{c.quote}</q>}
            {!c.quote && c.page == null && <span>{t("general")}</span>}
            <span>
              {c.author ?? t("reviewer")} · {formatDate(c.createdAt, true)}
            </span>
          </div>
          <p className="whitespace-pre-wrap">{c.body}</p>
          {onDelete && c.mine && (
            <Button variant="ghost" className="mt-1 px-2 py-1 text-xs" busy={busyId === c.id} onClick={() => onDelete(c)}>
              {t("deleteComment")}{" "}{i + 1}
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}

export function RubricTable({ rubric }: { rubric: RubricResult[] }) {
  const t = useCareerT("docReviewShared");
  const RATING_LABELS = useRatingLabels();
  if (rubric.length === 0) return <p className="text-sm text-muted-foreground">{t("noChecklistResults")}</p>;
  return (
    <table className="w-full text-start text-sm [&_th]:text-start">
      <caption className="sr-only">{t("checklistResults")}</caption>
      <thead>
        <tr className="border-b border-border text-xs text-muted-foreground">
          <th scope="col" className="py-2 pe-3 font-medium">
            {t("item")}
          </th>
          <th scope="col" className="py-2 pe-3 font-medium">
            {t("result")}
          </th>
          <th scope="col" className="py-2 font-medium">
            {t("note")}
          </th>
        </tr>
      </thead>
      <tbody>
        {rubric.map((r) => (
          <tr key={r.key} className="border-b border-border last:border-0 align-top">
            <th scope="row" className="py-2 pe-3 font-medium">
              {r.label}
            </th>
            <td className="py-2 pe-3">
              {r.rating ? <Badge tone={r.rating === "Strong" ? "good" : r.rating === "NeedsWork" ? "warn" : "neutral"}>{RATING_LABELS[r.rating] ?? r.rating}</Badge> : "—"}
            </td>
            <td className="py-2 whitespace-pre-wrap">{r.note ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

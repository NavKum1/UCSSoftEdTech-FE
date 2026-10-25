"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import {
  AnchoredText,
  CommentList,
  RubricTable,
  StatusBadge,
  type FileMeta,
  type ReviewDetail,
  type ReviewOptions,
  type ReviewVersion,
  useDownloadFile,
  useFormatSize,
} from "@/components/career/docReview/shared";

interface RequestRow {
  id: string;
  kind: string;
  kindLabel: string;
  target: string;
  status: string;
  currentVersion: number;
  submittedAt: string;
  dueAt: string;
  returnedAt: string | null;
  urgent: boolean;
  rating: number | null;
}

export default function StudentDocumentReviewPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudentDocumentReview />
    </Suspense>
  );
}

function StudentDocumentReview() {
  const t = useCareerT("studentDocumentReview");
  const api = useApi();
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("id");
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const options = useLoad(() => api<ReviewOptions>("/api/career/doc-review/options"), []);
  const list = useLoad(() => api<RequestRow[]>("/api/career/doc-review/requests"), []);

  const open = (id: string | null) => router.push(id ? `/student/document-review?id=${id}` : "/student/document-review");

  if (selected) {
    return <ThreadDetail id={selected} options={options.data} onBack={() => { open(null); list.reload(); }} />;
  }

  return (
    <div>
      <PageHeader
        title={t("documentReview")}
        description={t("sendYourResumeCoverLetter")}
        actions={!showForm && <Button onClick={() => setShowForm(true)}>{t("requestAReview")}</Button>}
      />
      <SuccessBanner message={message} />
      <ErrorBanner error={options.error || list.error} onRetry={() => { options.reload(); list.reload(); }} />
      {showForm && options.data && (
        <SubmitForm
          options={options.data}
          onCancel={() => setShowForm(false)}
          onDone={(d) => {
            setShowForm(false);
            setMessage(t("sentACounselorAimsTo", { dueAt: formatDate(d.dueAt, true) }));
            list.reload();
          }}
        />
      )}
      <Card title={t("myReviews")}>
        {list.loading ? (
          <Loading />
        ) : !list.data || list.data.length === 0 ? (
          <EmptyState title={t("noReviewsYet")}>{t("requestAReviewToGet")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {list.data.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <button type="button" className="text-start font-medium underline-offset-2 hover:underline focus-visible:outline-2" onClick={() => open(r.id)}>
                    {r.kindLabel}: {r.target}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {t("versionCurrentVersionSentSubmittedAt", { currentVersion: r.currentVersion, submittedAt: formatDate(r.submittedAt, true) })}
                    {r.status !== "Returned" && r.status !== "Done" ? t("expectedByDueAt", { dueAt: formatDate(r.dueAt, true) }) : ""}
                  </p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function SubmitForm({
  options,
  requestId,
  defaults,
  onCancel,
  onDone,
}: {
  options: ReviewOptions;
  requestId?: string;
  defaults?: { kind: string; target: string };
  onCancel: () => void;
  onDone: (d: ReviewDetail) => void;
}) {
  const t = useCareerT("studentDocumentReview");
  const api = useApi();
  const resubmit = !!requestId;
  const [kind, setKind] = useState(defaults?.kind ?? "Resume");
  const [target, setTarget] = useState(defaults?.target ?? "");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [jd, setJd] = useState("");
  const [notes, setNotes] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === "file" && !file) return setError(t("chooseAFileToUpload"));
    if (mode === "file" && file && file.size > 10 * 1024 * 1024) return setError(t("filesCanBeUpTo"));
    if (mode === "text" && !text.trim()) return setError(t("pasteTheTextYouWant"));
    const fd = new FormData();
    if (!resubmit) fd.append("kind", kind);
    if (target.trim()) fd.append("target", target.trim());
    if (jd.trim()) fd.append("jobDescription", jd.trim());
    if (notes.trim()) fd.append("notes", notes.trim());
    if (deadline) fd.append("deadline", deadline);
    if (mode === "file" && file) fd.append("file", file);
    else fd.append("text", text);
    setBusy(true);
    try {
      const d = await api<ReviewDetail>(resubmit ? `/api/career/doc-review/requests/${requestId}/versions` : "/api/career/doc-review/requests", { method: "POST", body: fd });
      onDone(d);
    } catch (err) {
      setError(err instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={resubmit ? t("sendANewVersion") : t("requestAReview")} className="mb-6">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <ErrorBanner error={error} />
        {!resubmit && (
          <Field label={t("documentType")}>
            {(p) => (
              <select {...p} value={kind} onChange={(e) => setKind(e.target.value)}>
                {options.kinds.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
        <Field label={resubmit ? t("whatItsForOptionalChange") : t("whatItsFor")} hint={t("forExampleSoftwareInternshipsOr")}>
          {(p) => <input {...p} value={target} maxLength={200} required={!resubmit} onChange={(e) => setTarget(e.target.value)} />}
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("howWillYouShareIt")}</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="mode" checked={mode === "file"} onChange={() => setMode("file")} />{" "}{t("uploadAFile")}
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="radio" name="mode" checked={mode === "text"} onChange={() => setMode("text")} />{" "}{t("pasteText")}
            </label>
          </div>
        </fieldset>
        {mode === "file" ? (
          <Field label={t("file")} hint={t("pDFWordDocxPNGJPEG")}>
            {(p) => <input {...p} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
          </Field>
        ) : (
          <Field label={t("textToReview")} hint={t("upTo20000Characters")}>
            {(p) => <textarea {...p} rows={10} maxLength={20000} value={text} onChange={(e) => setText(e.target.value)} />}
          </Field>
        )}
        <Field label={t("jobOrProgramDescriptionOptional")} hint={t("pasteThePostingSoThe")}>
          {(p) => <textarea {...p} rows={4} maxLength={20000} value={jd} onChange={(e) => setJd(e.target.value)} />}
        </Field>
        <Field label={t("notesForTheReviewerOptional")}>
          {(p) => <textarea {...p} rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <Field label={t("yourDeadlineOptional")} hint={t("deadlinesWithinUrgentWithinDaysDaysAre", { urgentWithinDays: options.urgentWithinDays, slaBusinessDays: options.slaBusinessDays })}>
          {(p) => <input {...p} type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
        </Field>
        <div className="flex gap-2">
          <Button type="submit" busy={busy}>
            {resubmit ? t("sendNewVersion") : t("sendForReview")}
          </Button>
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ThreadDetail({ id, options, onBack }: { id: string; options: ReviewOptions | null; onBack: () => void }) {
  const t = useCareerT("studentDocumentReview");
  const downloadFile = useDownloadFile();
  const api = useApi();
  const detail = useLoad(() => api<ReviewDetail>(`/api/career/doc-review/requests/${id}`), [id]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resubmitting, setResubmitting] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingComment, setRatingComment] = useState("");

  const d = detail.data;
  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
      setMessage(ok);
      detail.reload();
    } catch (e) {
      setError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  const download = (f: FileMeta) => act("dl-" + f.id, () => downloadFile(api, f), t("downloadedFileName", { fileName: f.fileName }));

  return (
    <div>
      <PageHeader
        title={d ? `${d.kindLabel}: ${d.target}` : t("documentReview")}
        actions={
          <Button variant="secondary" onClick={onBack}>
            {t("backToMyReviews")}
          </Button>
        }
      />
      <ErrorBanner error={detail.error || error} onRetry={detail.error ? detail.reload : undefined} />
      <SuccessBanner message={message} />
      {detail.loading && !d ? (
        <Loading />
      ) : d ? (
        <div className="space-y-6">
          <Card>
            <dl className="grid gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">{t("status")}</dt>
                <dd>
                  <StatusBadge status={d.status} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{d.returnedAt ? t("returned") : t("expectedBy")}</dt>
                <dd>{formatDate(d.returnedAt ?? d.dueAt, true)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("yourDeadline")}</dt>
                <dd>{d.studentDeadline ?? "—"}</dd>
              </div>
            </dl>
            {(d.status === "Returned" || d.status === "Done") && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => setResubmitting(true)}>{t("sendANewVersion")}</Button>
                {d.status === "Returned" && (
                  <Button variant="secondary" busy={busy === "done"} onClick={() => act("done", () => api(`/api/career/doc-review/requests/${id}/done`, { method: "POST" }), t("markedAsDone"))}>
                    {t("markAsDone")}
                  </Button>
                )}
              </div>
            )}
          </Card>

          {resubmitting && options && (
            <SubmitForm
              options={options}
              requestId={id}
              defaults={{ kind: d.kind, target: "" }}
              onCancel={() => setResubmitting(false)}
              onDone={() => {
                setResubmitting(false);
                setMessage(t("newVersionSent"));
                detail.reload();
              }}
            />
          )}

          {(d.returnedAt || d.status === "Done") && (
            <Card title={t("wasThisReviewHelpful")}>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = rating ?? d.rating;
                  if (!value) return setError(t("chooseARatingFrom1"));
                  void act("rate", () => api(`/api/career/doc-review/requests/${id}/rating`, { json: { rating: value, comment: ratingComment || d.ratingComment } }), t("thanksForYourRating"));
                }}
              >
                <fieldset>
                  <legend className="mb-2 text-sm">{t("n1NotHelpful5Very")}</legend>
                  <div className="flex flex-wrap gap-3">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className="inline-flex items-center gap-1 text-sm">
                        <input type="radio" name="rating" value={n} checked={(rating ?? d.rating) === n} onChange={() => setRating(n)} /> {n}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label={t("commentOptional")}>
                  {(p) => <input {...p} maxLength={1000} value={ratingComment} placeholder={d.ratingComment ?? ""} onChange={(e) => setRatingComment(e.target.value)} />}
                </Field>
                <Button type="submit" variant="secondary" busy={busy === "rate"}>
                  {t("saveRating")}
                </Button>
              </form>
            </Card>
          )}

          {[...d.versions].reverse().map((v) => (
            <VersionCard key={v.id} v={v} latest={v.number === d.currentVersion} onDownload={download} busy={busy} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VersionCard({ v, latest, onDownload, busy }: { v: ReviewVersion; latest: boolean; onDownload: (f: FileMeta) => void; busy: string | null }) {
  const t = useCareerT("studentDocumentReview");
  const formatSize = useFormatSize();
  return (
    <Card title={t("versionNumberValue", { number: v.number, value: latest ? t("latest") : "" })}>
      <p className="mb-3 text-xs text-muted-foreground">
        {t("sentSubmittedAt", { submittedAt: formatDate(v.submittedAt, true) })}
        {v.returnedAt ? t("returnedReturnedAtValue", { returnedAt: formatDate(v.returnedAt, true), value: v.reviewer?.name ? t("byName", { name: v.reviewer.name }) : "" }) : t("waitingForReview")}
      </p>
      <div className="space-y-4">
        {v.file && (
          <p className="text-sm">
            {t("yourFile")}{" "}
            <Button variant="ghost" className="px-1 py-0 underline" busy={busy === "dl-" + v.file.id} onClick={() => onDownload(v.file!)}>
              {v.file.fileName}
            </Button>{" "}
            <span className="text-muted-foreground">({formatSize(v.file.sizeBytes)})</span>
          </p>
        )}
        {v.text && <AnchoredText text={v.text} comments={v.comments} label={t("textOfVersionNumber", { number: v.number })} />}
        {v.notesToReviewer && (
          <p className="text-sm">
            <span className="font-medium">{t("yourNotes")}{" "}</span>
            {v.notesToReviewer}
          </p>
        )}
        {v.returnedAt ? (
          <>
            <section>
              <h3 className="mb-1 text-sm font-semibold">{t("summary")}</h3>
              <p className="whitespace-pre-wrap text-sm">{v.summary}</p>
            </section>
            <section>
              <h3 className="mb-1 text-sm font-semibold">{t("checklist")}</h3>
              <RubricTable rubric={v.rubric ?? []} />
            </section>
            <section>
              <h3 className="mb-1 text-sm font-semibold">{t("comments")}</h3>
              <CommentList comments={v.comments} />
            </section>
            {v.annotatedFile && (
              <p className="text-sm">
                {t("annotatedCopyFromYourReviewer")}{" "}
                <Button variant="secondary" busy={busy === "dl-" + v.annotatedFile.id} onClick={() => onDownload(v.annotatedFile!)}>
                  {t("downloadFileName", { fileName: v.annotatedFile.fileName })}
                </Button>
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("theReviewWillAppearHere")}</p>
        )}
      </div>
    </Card>
  );
}

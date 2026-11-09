"use client";

/**
 * Résumés (docs/resume_tools_plan_nov2026.md, stage 1): the person's own résumé library, for members and students alike.
 * Upload a PDF or Word file (Edulexa reads its text), keep versions, view the text, download, rename, archive and restore.
 * Campus job applications, document review and on-campus interview sign-up offer these résumés ("From your library") and
 * keep their own copy when one is sent.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Download, FilePlus2, FileText, History, ListChecks, Pencil, PenLine, RotateCcw, Sparkles, Upload } from "lucide-react";
import ResumeBookCard from "@/components/resumes/ResumeBookCard";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, EmptyState, ErrorBanner, formatDate, Modal, PageHeader, SuccessBanner, Tabs } from "@/components/career/ui";

interface Version {
  id: string;
  number: number;
  fileName: string | null;
  hasFile: boolean;
  textReadable: boolean;
  note: string | null;
  createdAt: string;
  // Where this version was sent (applications, document review, interview sign-up)
  sends?: { kind: string; label: string; sentAt: string }[];
  // Career-center approvals (stage 3): the school and when
  approvals?: { instituteId: string; school: string; approvedAt: string }[];
}
interface Rules { toolsEnabled: boolean; template: string; pageLimit: number | null; school: string | null; pageSize: string }
interface Resume {
  id: string;
  title: string;
  kind: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  currentVersion: Version | null;
}

const MAX_BYTES = 5_000_000;
const ACCEPT = ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export default function ResumesPage() {
  const en = useEn();
  const { apiFetch, ready, access } = useLegacyApi();
  const [view, setView] = useState<"library" | "archived">("library");
  const [items, setItems] = useState<Resume[] | null>(null);
  const [approvedIds, setApprovedIds] = useState<string[]>([]);
  const [approvedOlder, setApprovedOlder] = useState<{ versionId: string; documentId: string; number: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [textOf, setTextOf] = useState<{ title: string; text: string | null } | null>(null);
  // Stage 4: AI feedback on an uploaded résumé's lines (built résumés get it in the editor)
  const [feedbackOf, setFeedbackOf] = useState<{ title: string; comments: { line: string; kind: string; comment: string }[] } | null>(null);
  const [rules, setRules] = useState<Rules | null>(null);
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/resumes${view === "archived" ? "?archived=true" : ""}`);
    const body = res.ok
      ? ((await res.json()) as { resumes: Resume[]; approvedVersionIds?: string[]; approvedVersions?: { versionId: string; documentId: string; number: number }[] })
      : null;
    setItems(body?.resumes ?? []);
    setApprovedIds(body?.approvedVersionIds ?? []);
    setApprovedOlder(body?.approvedVersions ?? []);
  }, [apiFetch, view]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, view, loadRef]);
  const rulesRef = useLatestRef(async () => {
    const res = await apiFetch("/api/resumes/rules");
    if (res.ok) setRules((await res.json()) as Rules);
  });
  useEffect(() => {
    if (ready) void rulesRef.current();
  }, [ready, rulesRef]);

  /** A new built résumé (blank, from the person's record, or from an uploaded version), opened in the editor */
  const startBuilt = async (from: "blank" | "record" | "upload", versionId?: string, title?: string) => {
    const res = await act("new", () => apiFetch("/api/resumes/built", { method: "POST", body: JSON.stringify({ from, versionId, title }) }));
    if (res) router.push(`/resumes/${((await res.json()) as Resume).id}`);
  };

  const failure = async (res: Response) => ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? en("That didn't work. Please try again.");

  /** Runs an action with a busy marker and the shared error and success messages */
  const act = async (key: string, run: () => Promise<Response>, success?: string) => {
    setError(null);
    setNotice(null);
    setBusy(key);
    try {
      const res = await run();
      if (!res.ok) {
        setError(await failure(res));
        return null;
      }
      if (success) setNotice(success);
      await load();
      return res;
    } catch {
      setError(en("We couldn't reach the server. Please check your connection and try again."));
      return null;
    } finally {
      setBusy(null);
    }
  };

  /** Checks a chosen file here first, so the reason shows at once (the server checks again) */
  const checkFile = (file: File) => {
    if (!/\.(pdf|docx)$/i.test(file.name)) return en("Upload a PDF or Word (.docx) file.");
    if (file.size > MAX_BYTES) return en("Résumés can be up to 5 MB.");
    return null;
  };

  const uploadNew = async (file: File) => {
    const problem = checkFile(file);
    if (problem) return setError(problem);
    const fd = new FormData();
    fd.append("file", file);
    const res = await act("upload", () => apiFetch("/api/resumes", { method: "POST", body: fd }));
    if (res) {
      const r = (await res.json()) as Resume;
      setNotice(r.currentVersion?.textReadable ? en("Résumé added.") : en("Résumé added. We couldn't read text from this file (it may be a scanned image). You can still send it as it is."));
      if (view !== "library") setView("library");
    }
  };

  const uploadVersion = async (resume: Resume, file: File) => {
    const problem = checkFile(file);
    if (problem) return setError(problem);
    const fd = new FormData();
    fd.append("file", file);
    await act(`version-${resume.id}`, () => apiFetch(`/api/resumes/${resume.id}/versions`, { method: "POST", body: fd }), en("New version saved."));
  };

  const showText = async (resume: Resume, version: Version) => {
    setError(null);
    const res = await apiFetch(`/api/resumes/versions/${version.id}/text`);
    if (!res.ok) return setError(await failure(res));
    const body = (await res.json()) as { text: string };
    setTextOf({ title: resume.title, text: version.textReadable && body.text.trim() ? body.text : null });
  };

  const download = async (version: Version) => {
    setError(null);
    setBusy(`download-${version.id}`);
    try {
      const res = await apiFetch(`/api/resumes/versions/${version.id}/file`);
      if (!res.ok) return setError(await failure(res));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = version.fileName ?? "resume";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(en("The download didn't work. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  if (access) return <AccessNotice problem={access} feature="your résumés" />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Résumés")}
        description={en("Keep your résumés in one place. Send them with campus job applications, document reviews and interview sign-ups.")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/resumes/job-check" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <ListChecks aria-hidden="true" className="h-4 w-4" />
              {en("Check against a job")}
            </Link>
            <Link href="/resumes/cover-letters" className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <FileText aria-hidden="true" className="h-4 w-4" />
              {en("Cover letters")}
            </Link>
            <Button type="button" variant="secondary" aria-expanded={creating} aria-controls="new-resume" onClick={() => setCreating(!creating)}>
              <FilePlus2 aria-hidden="true" className="h-4 w-4" />
              {en("Build a résumé")}
            </Button>
            <FileButton label={en("Upload résumé")} busy={busy === "upload"} primary onFile={uploadNew} />
          </div>
        }
      />
      {rules && !rules.toolsEnabled && (
        <p role="status" className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm">
          {en("{school} uses another résumé tool, so its forms don't take résumés from here. Your library still works for everything else.", { school: rules.school ?? en("Your school") })}
        </p>
      )}
      {creating && (
        <section id="new-resume" aria-labelledby="new-resume-title" className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 id="new-resume-title" className="text-base font-semibold">{en("Build a résumé")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {en("Edulexa lays it out and makes the PDF. Lines from your verified results print with a Verified mark that links to the proof.")}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <button type="button" className="rounded-lg border border-border p-4 text-start hover:bg-muted/50 disabled:opacity-60" disabled={busy === "new"} onClick={() => void startBuilt("record")}>
              <span className="block text-sm font-semibold">{en("Start from your record")}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{en("Your name and email, and the education your school holds, already verified.")}</span>
            </button>
            <button type="button" className="rounded-lg border border-border p-4 text-start hover:bg-muted/50 disabled:opacity-60" disabled={busy === "new"} onClick={() => void startBuilt("blank")}>
              <span className="block text-sm font-semibold">{en("Start blank")}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{en("Your name and email; add sections as you go.")}</span>
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{en("To start from a file you uploaded, use \"Turn into a built résumé\" on it below.")}</p>
        </section>
      )}
      <Tabs
        label={en("Résumés")}
        value={view}
        onChange={(v) => {
          setItems(null);
          setView(v);
        }}
        items={[
          { id: "library", label: en("Library") },
          { id: "archived", label: en("Archived") },
        ]}
      />
      <ErrorBanner error={error} />
      <SuccessBanner message={notice} />

      {!items ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-32 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
          <div className="h-32 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" />
        </div>
      ) : items.length === 0 ? (
        view === "library" ? (
          <EmptyState title={en("No résumés yet")}>
            <p>{en("Upload your résumé to keep it in one place and send it with applications, document reviews and interview sign-ups.")}</p>
            <p className="mt-1">{en("PDF or Word (.docx), up to 5 MB.")}</p>
          </EmptyState>
        ) : (
          <EmptyState title={en("Nothing archived")}>
            <p>{en("Résumés you archive appear here. You can restore them at any time.")}</p>
          </EmptyState>
        )
      ) : (
        <ul className="space-y-4">
          {items.map((r) => (
            <ResumeCard
              key={r.id}
              resume={r}
              approved={!!r.currentVersion && approvedIds.includes(r.currentVersion.id)}
              busy={busy}
              onVersion={(file) => uploadVersion(r, file)}
              onText={(v) => showText(r, v)}
              onDownload={download}
              onRename={(title) => act(`rename-${r.id}`, () => apiFetch(`/api/resumes/${r.id}`, { method: "PUT", body: JSON.stringify({ title }) }), en("Renamed."))}
              onArchive={() => act(`archive-${r.id}`, () => apiFetch(`/api/resumes/${r.id}/archive`, { method: "POST" }), en("Archived. It's under Archived if you need it again."))}
              onRestore={() => act(`restore-${r.id}`, () => apiFetch(`/api/resumes/${r.id}/restore`, { method: "POST" }), en("Restored to your library."))}
              onFeedback={async () => {
                if (!r.currentVersion) return;
                const res = await act(`feedback-${r.id}`, () => apiFetch(`/api/resumes/versions/${r.currentVersion!.id}/feedback`, { method: "POST" }));
                if (res) setFeedbackOf({ title: r.title, comments: ((await res.json()) as { comments: { line: string; kind: string; comment: string }[] }).comments });
              }}
              onBuild={() => r.currentVersion && void startBuilt("upload", r.currentVersion.id, `${r.title.slice(0, 110)} (built)`)}
              loadVersions={async () => {
                const res = await apiFetch(`/api/resumes/${r.id}`);
                return res.ok ? ((await res.json()) as { versions: Version[] }).versions : [];
              }}
            />
          ))}
        </ul>
      )}

      {view === "library" && items && (
        <ResumeBookCard
          choices={[
            ...items
              .filter((r) => r.currentVersion?.hasFile)
              .map((r) => ({
                versionId: r.currentVersion!.id,
                label: en("{title}, version {number}", { title: r.title, number: r.currentVersion!.number }),
                approved: approvedIds.includes(r.currentVersion!.id),
              })),
            // Approved versions that aren't the newest (a school asking for approval can still get them)
            ...approvedOlder
              .filter((a) => !items.some((r) => r.currentVersion?.id === a.versionId) && items.some((r) => r.id === a.documentId))
              .map((a) => ({
                versionId: a.versionId,
                label: en("{title}, version {number} (approved)", { title: items.find((r) => r.id === a.documentId)!.title, number: a.number }),
                approved: true,
              })),
          ]}
        />
      )}

      {feedbackOf && (
        <Modal labelledBy="feedback-title" onClose={() => setFeedbackOf(null)}>
          <h2 id="feedback-title" className="text-lg font-semibold">{en("Feedback on {title}", { title: feedbackOf.title })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{en("Suggestions only. Change what helps, in your own words.")}</p>
          {feedbackOf.comments.length === 0 ? (
            <p className="mt-3 text-sm">{en("No suggestions this time.")}</p>
          ) : (
            <ul className="mt-3 max-h-[60vh] space-y-3 overflow-auto">
              {feedbackOf.comments.map((c, i) => (
                <li key={i} className="text-sm">
                  <p className="text-xs text-muted-foreground">“{c.line}”</p>
                  <p className="mt-0.5"><Badge tone="info">{c.kind === "verb" ? en("Stronger verb") : c.kind === "outcome" ? en("Outcome") : en("Clarity")}</Badge> {c.comment}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setFeedbackOf(null)}>{en("Close")}</Button>
          </div>
        </Modal>
      )}

      {textOf && (
        <Modal labelledBy="resume-text-title" onClose={() => setTextOf(null)}>
          <h2 id="resume-text-title" className="text-lg font-semibold">
            {textOf.title}
          </h2>
          {textOf.text ? (
            <pre className="mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-4 font-sans text-sm leading-relaxed">{textOf.text}</pre>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{en("We couldn't read text from this file (it may be a scanned image). You can still send it as it is.")}</p>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" onClick={() => setTextOf(null)}>
              {en("Close")}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

/** A button that opens the file chooser (PDF or Word) */
function FileButton({ label, busy, primary, onFile }: { label: string; busy?: boolean; primary?: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" variant={primary ? "primary" : "ghost"} busy={busy} onClick={() => input.current?.click()} className={primary ? "" : "px-2"}>
        <Upload aria-hidden="true" className="h-4 w-4" />
        {label}
      </Button>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </>
  );
}

function ResumeCard({
  resume,
  approved,
  busy,
  onVersion,
  onText,
  onDownload,
  onRename,
  onArchive,
  onRestore,
  onBuild,
  onFeedback,
  loadVersions,
}: {
  resume: Resume;
  approved: boolean;
  busy: string | null;
  onVersion: (file: File) => void;
  onText: (v: Version) => void;
  onDownload: (v: Version) => void;
  onRename: (title: string) => Promise<unknown>;
  onArchive: () => void;
  onRestore: () => void;
  onBuild: () => void;
  onFeedback: () => void;
  loadVersions: () => Promise<Version[]>;
}) {
  const en = useEn();
  const v = resume.currentVersion;
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(resume.title);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const archived = !!resume.archivedAt;
  const titleId = `resume-${resume.id}`;

  const toggleVersions = async () => {
    if (!showVersions) setVersions(await loadVersions());
    setShowVersions(!showVersions);
  };
  const built = resume.kind === "Built";
  const currentId = v?.id;
  // A new version (or a send) since the list was opened: reload it
  const versionsRef = useLatestRef(async () => setVersions(await loadVersions()));
  useEffect(() => {
    if (showVersions) void versionsRef.current();
  }, [currentId, showVersions, versionsRef]);

  return (
    <li>
      <section aria-labelledby={titleId} className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              {renaming ? (
                <form
                  className="flex flex-wrap items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await onRename(title)) setRenaming(false);
                  }}
                >
                  <label className="sr-only" htmlFor={`${titleId}-title`}>
                    {en("Title")}
                  </label>
                  <input id={`${titleId}-title`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} className="rounded-md border border-border bg-background px-2 py-1 text-sm" autoFocus />
                  <Button type="submit" busy={busy === `rename-${resume.id}`}>
                    {en("Save")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setTitle(resume.title);
                      setRenaming(false);
                    }}
                  >
                    {en("Cancel")}
                  </Button>
                </form>
              ) : (
                <h2 id={titleId} className="truncate text-base font-semibold">
                  {resume.title}
                </h2>
              )}
              {v && (
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {v.hasFile
                    ? en("Version {number}, {fileName}, added {date}", { number: v.number, fileName: v.fileName ?? "", date: formatDate(v.createdAt) })
                    : en("Version {number}, text only, added {date}", { number: v.number, date: formatDate(v.createdAt) })}
                </p>
              )}
              {v?.note && <p className="mt-1 text-sm">{v.note}</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {v && !built && (v.textReadable ? <Badge tone="good">{en("Text read")}</Badge> : <Badge tone="warn">{en("Couldn't read text")}</Badge>)}
            {built && <Badge tone="info">{en("Built here")}</Badge>}
            {approved && <Badge tone="good">{en("Approved by your school")}</Badge>}
            {v && !v.hasFile && <Badge tone="info">{en("Text only")}</Badge>}
            {archived && <Badge>{en("Archived")}</Badge>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3">
          {!archived && built && (
            <Link href={`/resumes/${resume.id}`} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-muted">
              <PenLine aria-hidden="true" className="h-4 w-4" />
              {en("Edit")}
            </Link>
          )}
          {!archived && !built && <FileButton label={en("Upload a new version")} busy={busy === `version-${resume.id}`} onFile={onVersion} />}
          {!archived && !built && v?.textReadable && (
            <Button type="button" variant="ghost" className="px-2" busy={busy === "new"} onClick={onBuild}>
              <PenLine aria-hidden="true" className="h-4 w-4" />
              {en("Turn into a built résumé")}
            </Button>
          )}
          {!archived && !built && v?.textReadable && (
            <Button type="button" variant="ghost" className="px-2" busy={busy === `feedback-${resume.id}`} onClick={onFeedback}>
              <Sparkles aria-hidden="true" className="h-4 w-4" />
              {en("AI feedback")}
            </Button>
          )}
          {v && (
            <Button type="button" variant="ghost" className="px-2" onClick={() => onText(v)}>
              <FileText aria-hidden="true" className="h-4 w-4" />
              {en("View text")}
            </Button>
          )}
          {v?.hasFile && (
            <Button type="button" variant="ghost" className="px-2" busy={busy === `download-${v.id}`} onClick={() => onDownload(v)}>
              <Download aria-hidden="true" className="h-4 w-4" />
              {en("Download")}
            </Button>
          )}
          {!archived && !renaming && (
            <Button type="button" variant="ghost" className="px-2" onClick={() => setRenaming(true)}>
              <Pencil aria-hidden="true" className="h-4 w-4" />
              {en("Rename")}
            </Button>
          )}
          {v && (
            v.number > 1 || built) && (
            <Button type="button" variant="ghost" className="px-2" aria-expanded={showVersions} aria-controls={`${titleId}-versions`} onClick={() => void toggleVersions()}>
              <History aria-hidden="true" className="h-4 w-4" />
              {showVersions ? en("Hide versions") : en("Versions and where they went")}
            </Button>
          )}
          <span className="ms-auto" />
          {archived ? (
            <Button type="button" variant="secondary" busy={busy === `restore-${resume.id}`} onClick={onRestore}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              {en("Restore")}
            </Button>
          ) : (
            <Button type="button" variant="ghost" className="px-2 text-muted-foreground" busy={busy === `archive-${resume.id}`} onClick={onArchive}>
              <Archive aria-hidden="true" className="h-4 w-4" />
              {en("Archive")}
            </Button>
          )}
        </div>

        {showVersions && (
          <ul id={`${titleId}-versions`} className="mt-3 divide-y divide-border rounded-lg border border-border">
            {(versions ?? []).map((ver) => (
              <li key={ver.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{en("Version {number}", { number: ver.number })}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    {ver.fileName ? `${ver.fileName}, ` : ""}
                    {formatDate(ver.createdAt)}
                  </span>
                  {ver.note && <span className="block text-muted-foreground">{ver.note}</span>}
                  {(ver.approvals ?? []).map((x) => (
                    <span key={x.instituteId} className="block text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      {en("Approved by {school}, {date}", { school: x.school, date: formatDate(x.approvedAt) })}
                    </span>
                  ))}
                  {(ver.sends ?? []).map((x, k) => (
                    <span key={k} className="block text-xs text-muted-foreground">
                      {en("Sent: {label}, {date}", { label: x.label, date: formatDate(x.sentAt) })}
                    </span>
                  ))}
                </span>
                <span className="flex gap-1">
                  <Button type="button" variant="ghost" className="px-2" onClick={() => onText(ver)}>
                    {en("View text")}
                  </Button>
                  {ver.hasFile && (
                    <Button type="button" variant="ghost" className="px-2" busy={busy === `download-${ver.id}`} onClick={() => onDownload(ver)}>
                      {en("Download")}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </li>
  );
}


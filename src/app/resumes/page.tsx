"use client";

/**
 * Résumés (docs/resume_tools_plan_nov2026.md, stage 1): the person's own résumé library, for members and students alike.
 * Upload a PDF or Word file (Edulexa reads its text), keep versions, view the text, download, rename, archive and restore.
 * Campus job applications, document review and on-campus interview sign-up offer these résumés ("From your library") and
 * keep their own copy when one is sent.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Download, FileText, History, Pencil, RotateCcw, Upload } from "lucide-react";
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
}
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
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [textOf, setTextOf] = useState<{ title: string; text: string | null } | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch(`/api/resumes${view === "archived" ? "?archived=true" : ""}`);
    setItems(res.ok ? ((await res.json()) as { resumes: Resume[] }).resumes : []);
  }, [apiFetch, view]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, view, loadRef]);

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
        actions={<FileButton label={en("Upload résumé")} busy={busy === "upload"} primary onFile={uploadNew} />}
      />
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
              busy={busy}
              onVersion={(file) => uploadVersion(r, file)}
              onText={(v) => showText(r, v)}
              onDownload={download}
              onRename={(title) => act(`rename-${r.id}`, () => apiFetch(`/api/resumes/${r.id}`, { method: "PUT", body: JSON.stringify({ title }) }), en("Renamed."))}
              onArchive={() => act(`archive-${r.id}`, () => apiFetch(`/api/resumes/${r.id}/archive`, { method: "POST" }), en("Archived. It's under Archived if you need it again."))}
              onRestore={() => act(`restore-${r.id}`, () => apiFetch(`/api/resumes/${r.id}/restore`, { method: "POST" }), en("Restored to your library."))}
              loadVersions={async () => {
                const res = await apiFetch(`/api/resumes/${r.id}`);
                return res.ok ? ((await res.json()) as { versions: Version[] }).versions : [];
              }}
            />
          ))}
        </ul>
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
  busy,
  onVersion,
  onText,
  onDownload,
  onRename,
  onArchive,
  onRestore,
  loadVersions,
}: {
  resume: Resume;
  busy: string | null;
  onVersion: (file: File) => void;
  onText: (v: Version) => void;
  onDownload: (v: Version) => void;
  onRename: (title: string) => Promise<unknown>;
  onArchive: () => void;
  onRestore: () => void;
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
    if (!showVersions && versions === null) setVersions(await loadVersions());
    setShowVersions(!showVersions);
  };

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
            {v && (v.textReadable ? <Badge tone="good">{en("Text read")}</Badge> : <Badge tone="warn">{en("Couldn't read text")}</Badge>)}
            {v && !v.hasFile && <Badge tone="info">{en("Text only")}</Badge>}
            {archived && <Badge>{en("Archived")}</Badge>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3">
          {!archived && <FileButton label={en("Upload a new version")} busy={busy === `version-${resume.id}`} onFile={onVersion} />}
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
          {v && v.number > 1 && (
            <Button type="button" variant="ghost" className="px-2" aria-expanded={showVersions} aria-controls={`${titleId}-versions`} onClick={() => void toggleVersions()}>
              <History aria-hidden="true" className="h-4 w-4" />
              {showVersions ? en("Hide earlier versions") : en("Earlier versions")}
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


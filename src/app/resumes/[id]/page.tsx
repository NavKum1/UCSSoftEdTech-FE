"use client";

/**
 * The résumé editor (docs/resume_tools_plan_nov2026.md, stage 2): a built résumé's header, summary, sections, entries and
 * lines; verified evidence to add as lines (drafted from the data, not by AI); saving makes a new version and its PDF.
 * The server keeps a "Verified" mark only while it checks out: changing a number in a verified line, or evidence that is
 * no longer valid, removes the mark, and the page says why.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, BadgeCheck, Download, Plus, Trash2 } from "lucide-react";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, ErrorBanner, Field, PageHeader, SuccessBanner } from "@/components/career/ui";
import WritingHelp from "@/components/resumes/WritingHelp";
import { downloadFrom } from "@/lib/resumeLibrary";

type Evidence = { kind: string; id: string } | null | undefined;
interface Line { id: string; text: string; evidence?: Evidence }
interface Entry { id: string; title?: string; organization?: string; location?: string; start?: string; end?: string; lines: Line[] }
interface Section { id: string; kind: string; title?: string; entries: Entry[] }
interface Content {
  header: { name?: string; email?: string; phone?: string; location?: string; links: { label?: string; url?: string }[] };
  summary?: string;
  sections: Section[];
}
interface Rules { toolsEnabled: boolean; template: string; pageLimit: number | null; school: string | null; pageSize: string }
interface EvidenceItem { kind: string; id: string; label: string; line: string; url: string | null; verifiedBy: string | null }
interface Detail { id: string; title: string; kind: string; currentVersionId: string | null; versions: { id: string; number: number; fileName: string | null; createdAt: string }[] }

const KINDS = ["experience", "education", "projects", "skills", "certifications", "custom"] as const;
const KIND_TITLE: Record<string, string> = {
  experience: "Experience", education: "Education", projects: "Projects", skills: "Skills", certifications: "Certifications", custom: "Other",
};
const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const move = <T,>(list: T[], i: number, by: number) => {
  const j = i + by;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
};

export default function ResumeEditorPage() {
  const en = useEn();
  const { id } = useParams<{ id: string }>();
  const { apiFetch, ready, access } = useLegacyApi();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [marks, setMarks] = useState<Record<string, { url: string | null; label: string }>>({});
  const [rules, setRules] = useState<Rules | null>(null);
  const [evidence, setEvidence] = useState<EvidenceItem[] | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  // Lines that came from the server with evidence: without a mark now, their evidence no longer checks out
  const [loadedEvidence, setLoadedEvidence] = useState<Set<string>>(new Set());

  const failure = useCallback(async (res: Response) => ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? en("That didn't work. Please try again."), [en]);

  const load = useCallback(async () => {
    const d = await apiFetch(`/api/resumes/${id}`);
    if (!d.ok) return setError(await failure(d));
    const doc = (await d.json()) as Detail;
    setDetail(doc);
    if (doc.kind !== "Built" || !doc.currentVersionId) return;
    const [c, ev] = await Promise.all([apiFetch(`/api/resumes/versions/${doc.currentVersionId}/content`), apiFetch("/api/resumes/evidence")]);
    if (c.ok) {
      const body = (await c.json()) as { content: Content; marks: Record<string, { url: string | null; label: string }>; rules: Rules };
      const sections = (body.content.sections ?? []).map((s) => ({ ...s, entries: (s.entries ?? []).map((e) => ({ ...e, lines: e.lines ?? [] })) }));
      setContent({ header: { ...body.content.header, links: body.content.header?.links ?? [] }, summary: body.content.summary ?? "", sections });
      setMarks(body.marks ?? {});
      setLoadedEvidence(new Set(sections.flatMap((s) => s.entries.flatMap((e) => e.lines.filter((l) => l.evidence).map((l) => l.id)))));
      setRules(body.rules);
      setDirty(false);
    } else setError(await failure(c));
    if (ev.ok) setEvidence(((await ev.json()) as { items: EvidenceItem[] }).items);
  }, [apiFetch, id, failure]);
  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (ready) void loadRef.current();
  }, [ready, loadRef]);

  // Leaving with unsaved changes asks first
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = (fn: (c: Content) => Content) => {
    setContent((c) => (c ? fn(c) : c));
    setDirty(true);
  };
  const setSection = (si: number, fn: (s: Section) => Section) => update((c) => ({ ...c, sections: c.sections.map((s, i) => (i === si ? fn(s) : s)) }));
  const setEntry = (si: number, ei: number, fn: (e: Entry) => Entry) => setSection(si, (s) => ({ ...s, entries: s.entries.map((e, i) => (i === ei ? fn(e) : e)) }));

  const usedEvidence = useMemo(() => new Set((content?.sections ?? []).flatMap((s) => s.entries.flatMap((e) => e.lines.map((l) => (l.evidence ? `${l.evidence.kind}:${l.evidence.id}` : ""))))), [content]);

  /** Adds an evidence line to the section it belongs in (education for school records, projects otherwise) */
  const addEvidence = (item: EvidenceItem) =>
    update((c) => {
      const kind = item.kind === "school-record" ? "education" : "projects";
      const line: Line = { id: uid(), text: item.line, evidence: { kind: item.kind, id: item.id } };
      const at = c.sections.findIndex((s) => s.kind === kind);
      if (at < 0) return { ...c, sections: [...c.sections, { id: uid(), kind, title: en(KIND_TITLE[kind]), entries: [{ id: uid(), title: item.label, lines: [line] }] }] };
      return { ...c, sections: c.sections.map((s, i) => (i === at ? { ...s, entries: [...s.entries, { id: uid(), title: item.label, lines: [line] }] } : s)) };
    });

  const save = async () => {
    if (!content) return;
    setError(null);
    setNotice(null);
    setWarning(null);
    setBusy("save");
    try {
      const res = await apiFetch(`/api/resumes/${id}/content`, { method: "POST", body: JSON.stringify({ content, note: note.trim() || null }) });
      if (!res.ok) return setError(await failure(res));
      const body = (await res.json()) as { removedMarks: { lineId: string; reason: string }[]; pages: number; pageLimit: number | null; overLimit: boolean; unprintable?: string };
      const reasons = body.removedMarks.map((r) =>
        r.reason === "numbers" ? en("a verified line's numbers were changed") : r.reason === "not yours" ? en("a mark didn't belong to you") : en("its evidence is no longer valid"),
      );
      const warn: string[] = [];
      if (reasons.length)
        warn.push(reasons.length === 1 ? en("A verified mark was removed: {reasons}.", { reasons: reasons[0] }) : en("{count} verified marks were removed: {reasons}.", { count: reasons.length, reasons: Array.from(new Set(reasons)).join("; ") }));
      if (body.overLimit && body.pageLimit)
        warn.push(body.pageLimit === 1 ? en("Your résumé runs to {pages} pages; your school asks for one page.", { pages: body.pages }) : en("Your résumé runs to {pages} pages; your school asks for {limit} at most.", { pages: body.pages, limit: body.pageLimit }));
      if (body.unprintable) warn.push(en("The PDF can't print these characters yet and shows \"?\" instead: {chars}", { chars: body.unprintable }));
      setWarning(warn.length ? warn.join(" ") : null);
      setNotice(body.pages === 1 ? en("Saved as a new version. It fits on one page.") : en("Saved as a new version. It runs to {pages} pages.", { pages: body.pages }));
      setNote("");
      await load();
    } catch {
      setError(en("We couldn't reach Edulexa. Check your internet connection and try again."));
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!detail?.currentVersionId) return;
    setBusy("download");
    try {
      const res = await apiFetch(`/api/resumes/versions/${detail.currentVersionId}/file`);
      if (!res.ok) return setError(await failure(res));
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${detail.title}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(en("The download didn't work. Please try again."));
    } finally {
      setBusy(null);
    }
  };

  if (access) return <AccessNotice problem={access} feature="your résumés" />;
  if (detail && detail.kind !== "Built")
    return (
      <div className="space-y-4">
        <Link href="/resumes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          {en("Résumés")}
        </Link>
        <p className="text-sm">{en("This résumé is an uploaded file. Start a built résumé from it on the Résumés page to edit it here.")}</p>
      </div>
    );
  if (!content || !detail)
    return error ? <ErrorBanner error={error} /> : <div className="h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />;

  const input = "w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm";
  const version = detail.versions.find((v) => v.id === detail.currentVersionId);

  return (
    <div className="space-y-6">
      <Link href="/resumes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {en("Résumés")}
      </Link>
      <PageHeader
        title={detail.title}
        description={
          rules
            ? [
                rules.template === "compact" ? en("Compact template") : en("Classic template"),
                rules.pageSize === "A4" ? en("A4 paper") : en("US Letter paper"),
                rules.pageLimit === 1 ? en("Your school asks for one page at most") : rules.pageLimit ? en("Your school asks for {limit} pages at most", { limit: rules.pageLimit }) : null,
                version ? en("Version {number}", { number: version.number }) : null,
              ].filter(Boolean).join(". ")
            : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" busy={busy === "download"} disabled={dirty} onClick={() => void download()} title={dirty ? en("Save first to download this version") : undefined}>
              <Download aria-hidden="true" className="h-4 w-4" />
              {en("Download PDF")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              busy={busy === "docx"}
              disabled={dirty || !detail.currentVersionId}
              title={dirty ? en("Save first to download this version") : undefined}
              onClick={async () => {
                setBusy("docx");
                setError(await downloadFrom(apiFetch, `/api/resumes/versions/${detail.currentVersionId}/docx`, `${detail.title}.docx`));
                setBusy(null);
              }}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              {en("Download Word")}
            </Button>
            <Button type="button" busy={busy === "save"} onClick={() => void save()}>
              {en("Save version")}
            </Button>
          </div>
        }
      />
      <ErrorBanner error={error} />
      <SuccessBanner message={notice} />
      {warning && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          {warning}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section aria-labelledby="hdr" className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 id="hdr" className="mb-3 text-base font-semibold">{en("Header")}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={en("Name")}>{(p) => <input {...p} className={input} value={content.header.name ?? ""} maxLength={200} onChange={(e) => update((c) => ({ ...c, header: { ...c.header, name: e.target.value } }))} />}</Field>
              <Field label={en("Email")}>{(p) => <input {...p} className={input} type="email" value={content.header.email ?? ""} maxLength={200} onChange={(e) => update((c) => ({ ...c, header: { ...c.header, email: e.target.value } }))} />}</Field>
              <Field label={en("Phone")}>{(p) => <input {...p} className={input} value={content.header.phone ?? ""} maxLength={200} onChange={(e) => update((c) => ({ ...c, header: { ...c.header, phone: e.target.value } }))} />}</Field>
              <Field label={en("City")}>{(p) => <input {...p} className={input} value={content.header.location ?? ""} maxLength={200} onChange={(e) => update((c) => ({ ...c, header: { ...c.header, location: e.target.value } }))} />}</Field>
            </div>
            <div className="mt-3 space-y-2">
              {content.header.links.map((l, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <label className="text-xs text-muted-foreground">
                    {en("Link label")}
                    <input className={`${input} mt-1 w-40`} value={l.label ?? ""} onChange={(e) => update((c) => ({ ...c, header: { ...c.header, links: c.header.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) } }))} />
                  </label>
                  <label className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {en("Address")}
                    <input className={`${input} mt-1`} type="url" placeholder="https://" value={l.url ?? ""} onChange={(e) => update((c) => ({ ...c, header: { ...c.header, links: c.header.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) } }))} />
                  </label>
                  <Button type="button" variant="ghost" className="px-2" aria-label={en("Remove link")} onClick={() => update((c) => ({ ...c, header: { ...c.header, links: c.header.links.filter((_, j) => j !== i) } }))}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {content.header.links.length < 6 && (
                <Button type="button" variant="ghost" className="px-2" onClick={() => update((c) => ({ ...c, header: { ...c.header, links: [...c.header.links, { label: "", url: "" }] } }))}>
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {en("Add a link")}
                </Button>
              )}
            </div>
            <div className="mt-3">
              <Field label={en("Summary")} hint={en("Two or three sentences about what you do and want to do next.")}>
                {(p) => <textarea {...p} className={input} rows={3} maxLength={2000} value={content.summary ?? ""} onChange={(e) => update((c) => ({ ...c, summary: e.target.value }))} />}
              </Field>
            </div>
          </section>

          {content.sections.map((s, si) => (
            <section key={s.id} aria-label={s.title || en(KIND_TITLE[s.kind] ?? "Section")} className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-end gap-2">
                <label className="basis-full text-xs text-muted-foreground sm:min-w-0 sm:flex-1 sm:basis-auto">
                  {en("Section title")}
                  <input className={`${input} mt-1 text-base font-semibold`} value={s.title ?? ""} maxLength={200} onChange={(e) => setSection(si, (x) => ({ ...x, title: e.target.value }))} />
                </label>
                <label className="text-xs text-muted-foreground">
                  {en("Kind")}
                  <select className={`${input} mt-1 w-40`} value={s.kind} onChange={(e) => setSection(si, (x) => ({ ...x, kind: e.target.value }))}>
                    {KINDS.map((k) => <option key={k} value={k}>{en(KIND_TITLE[k])}</option>)}
                  </select>
                </label>
                <span className="flex gap-1">
                  <Button type="button" variant="ghost" className="px-2" aria-label={en("Move section up")} disabled={si === 0} onClick={() => update((c) => ({ ...c, sections: move(c.sections, si, -1) }))}><ArrowUp aria-hidden="true" className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" className="px-2" aria-label={en("Move section down")} disabled={si === content.sections.length - 1} onClick={() => update((c) => ({ ...c, sections: move(c.sections, si, 1) }))}><ArrowDown aria-hidden="true" className="h-4 w-4" /></Button>
                  <Button type="button" variant="ghost" className="px-2" aria-label={en("Remove section")} onClick={() => update((c) => ({ ...c, sections: c.sections.filter((_, i) => i !== si) }))}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
                </span>
              </div>

              <div className="mt-4 space-y-4">
                {s.entries.map((e, ei) => (
                  <div key={e.id} className="rounded-lg border border-border p-3">
                    {s.kind !== "skills" && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input className={input} aria-label={en("Title or role")} placeholder={en("Title or role")} value={e.title ?? ""} maxLength={200} onChange={(ev) => setEntry(si, ei, (x) => ({ ...x, title: ev.target.value }))} />
                        <input className={input} aria-label={en("Organization")} placeholder={en("Organization")} value={e.organization ?? ""} maxLength={200} onChange={(ev) => setEntry(si, ei, (x) => ({ ...x, organization: ev.target.value }))} />
                        <input className={input} aria-label={en("Place")} placeholder={en("Place")} value={e.location ?? ""} maxLength={200} onChange={(ev) => setEntry(si, ei, (x) => ({ ...x, location: ev.target.value }))} />
                        <div className="flex gap-2">
                          <input className={input} aria-label={en("From")} placeholder={en("From (e.g. Jun 2025)")} value={e.start ?? ""} maxLength={200} onChange={(ev) => setEntry(si, ei, (x) => ({ ...x, start: ev.target.value }))} />
                          <input className={input} aria-label={en("To")} placeholder={en("To (or Present)")} value={e.end ?? ""} maxLength={200} onChange={(ev) => setEntry(si, ei, (x) => ({ ...x, end: ev.target.value }))} />
                        </div>
                      </div>
                    )}
                    <ul className="mt-2 space-y-2">
                      {e.lines.map((l, li) => {
                        const mark = marks[l.id];
                        return (
                          <li key={l.id} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-2">
                            <textarea
                              className={`${input} min-h-[2.4rem]`}
                              rows={2}
                              maxLength={400}
                              aria-label={en("Line {number}", { number: li + 1 })}
                              value={l.text}
                              onChange={(ev) => setEntry(si, ei, (x) => ({ ...x, lines: x.lines.map((y, k) => (k === li ? { ...y, text: ev.target.value } : y)) }))}
                            />
                            <span className="flex shrink-0 items-center justify-between gap-1 sm:flex-col sm:items-end">
                              {l.evidence && (
                                <Badge tone="good">
                                  <BadgeCheck aria-hidden="true" className="me-1 inline h-3.5 w-3.5" />
                                  {mark?.label ?? (loadedEvidence.has(l.id) ? en("No longer verified") : en("Verified when saved"))}
                                </Badge>
                              )}
                              <Button type="button" variant="ghost" className="px-2" aria-label={en("Remove line")} onClick={() => setEntry(si, ei, (x) => ({ ...x, lines: x.lines.filter((_, k) => k !== li) }))}>
                                <Trash2 aria-hidden="true" className="h-4 w-4" />
                              </Button>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {e.lines.length < 20 && (
                        <Button type="button" variant="ghost" className="px-2" onClick={() => setEntry(si, ei, (x) => ({ ...x, lines: [...x.lines, { id: uid(), text: "" }] }))}>
                          <Plus aria-hidden="true" className="h-4 w-4" />
                          {en("Add a line")}
                        </Button>
                      )}
                      <span className="ms-auto flex gap-1">
                        <Button type="button" variant="ghost" className="px-2" aria-label={en("Move entry up")} disabled={ei === 0} onClick={() => setSection(si, (x) => ({ ...x, entries: move(x.entries, ei, -1) }))}><ArrowUp aria-hidden="true" className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" className="px-2" aria-label={en("Move entry down")} disabled={ei === s.entries.length - 1} onClick={() => setSection(si, (x) => ({ ...x, entries: move(x.entries, ei, 1) }))}><ArrowDown aria-hidden="true" className="h-4 w-4" /></Button>
                        <Button type="button" variant="ghost" className="px-2" aria-label={en("Remove entry")} onClick={() => setSection(si, (x) => ({ ...x, entries: x.entries.filter((_, k) => k !== ei) }))}><Trash2 aria-hidden="true" className="h-4 w-4" /></Button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {s.entries.length < 30 && (
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setSection(si, (x) => ({ ...x, entries: [...x.entries, { id: uid(), lines: [{ id: uid(), text: "" }] }] }))}>
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  {s.kind === "skills" ? en("Add a group of skills") : en("Add an entry")}
                </Button>
              )}
            </section>
          ))}

          {content.sections.length < 12 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{en("Add a section:")}</span>
              {KINDS.map((k) => (
                <Button key={k} type="button" variant="secondary" onClick={() => update((c) => ({ ...c, sections: [...c.sections, { id: uid(), kind: k, title: en(KIND_TITLE[k]), entries: [{ id: uid(), lines: [{ id: uid(), text: "" }] }] }] }))}>
                  {en(KIND_TITLE[k])}
                </Button>
              ))}
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <Field label={en("Note for this version (optional)")} hint={en("For example: tailored for backend internships.")}>
              {(p) => <input {...p} className={input} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button type="button" busy={busy === "save"} onClick={() => void save()}>{en("Save version")}</Button>
              {dirty && <span className="text-sm text-muted-foreground">{en("You have unsaved changes.")}</span>}
            </div>
          </div>
        </div>

        <aside className="order-first space-y-3 lg:sticky lg:top-24 lg:order-none lg:self-start" aria-labelledby="evidence-title">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 id="evidence-title" className="flex items-center gap-2 text-base font-semibold">
              <BadgeCheck aria-hidden="true" className="h-5 w-5 text-[var(--brand)]" />
              {en("Verified evidence")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {en("Lines drafted from what Edulexa or your school has verified. They print with a Verified mark that links to the proof. Change the wording freely; changing a number removes the mark.")}
            </p>
            <ul className="mt-3 space-y-3">
              {evidence === null && <li className="h-16 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-busy="true" />}
              {evidence?.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  {en("Nothing verified yet. Complete a coding challenge or a written exam to earn a credential, and it will appear here.")}
                </li>
              )}
              {evidence?.map((item) => {
                const used = usedEvidence.has(`${item.kind}:${item.id}`);
                return (
                  <li key={`${item.kind}:${item.id}`} className="rounded-lg border border-border p-3">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.line}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{item.verifiedBy ? en("Verified by {school}", { school: item.verifiedBy }) : en("Edulexa credential")}</span>
                      <Button type="button" variant={used ? "ghost" : "secondary"} disabled={used} onClick={() => addEvidence(item)}>
                        {used ? en("Added") : en("Add to résumé")}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <WritingHelp
            documentId={detail.id}
            versionId={detail.currentVersionId}
            dirty={dirty}
            lineText={(lineId) => content.sections.flatMap((s) => s.entries.flatMap((e) => e.lines)).find((l) => l.id === lineId)?.text ?? ""}
            onApply={(lines, orders) => {
              update((c) => ({
                ...c,
                sections: c.sections.map((s) => ({
                  ...s,
                  entries: s.entries.map((e) => {
                    const order = orders[e.id];
                    // Lines added since the suggestion (not in the suggested order) stay, after the reordered ones
                    const ordered = order
                      ? [...order.map((id) => e.lines.find((l) => l.id === id)).filter((l): l is Line => !!l), ...e.lines.filter((l) => !order.includes(l.id))]
                      : e.lines;
                    return { ...e, lines: ordered.map((l) => (lines[l.id] !== undefined ? { ...l, text: lines[l.id] } : l)) };
                  }),
                })),
              }));
              const n = Object.keys(lines).length + Object.keys(orders).length;
              setNotice(n === 1 ? en("Applied 1 change. Look it over, then save a version.") : en("Applied {count} changes. Look them over, then save a version.", { count: n }));
            }}
          />
        </aside>
      </div>
    </div>
  );
}

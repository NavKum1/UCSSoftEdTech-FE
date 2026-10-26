"use client";

/**
 * Writing an email to a lead: formatting (bold, italic, underline, heading, lists, quote, links), one-click fields that
 * fill in for this person (name, course, institute, your name), templates (and saving one, for admins), attachments
 * (brochures, fee structures), a preview of exactly what they'll receive, and sending from Edulexa (replies come back to
 * the timeline) or from your own mail app (Gmail, Outlook), recorded on the timeline either way.
 */

import React, { useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  ChevronDown,
  Eye,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Paperclip,
  PencilLine,
  Quote,
  RemoveFormatting,
  Save,
  Send,
  Underline,
  X,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";
import { crm, type GetToken, type LeadFull, type Template } from "./api";

const FIELDS: [string, string][] = [
  ["{name}", "Their name"],
  ["{course}", "Course"],
  ["{institute}", "Institute"],
  ["{counsellor}", "Your name"],
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Plain-text templates (from before formatting) become paragraphs */
const toHtml = (body: string) =>
  /<\s*(p|br|ul|ol|li|strong|em|h3|blockquote|a)\b/i.test(body) ? body : body.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const htmlToText = (html: string) => {
  const d = document.createElement("div");
  d.innerHTML = html.replace(/<li>/gi, "<li>- ").replace(/<\/(p|h3|li|blockquote)>/gi, "</$1>\n").replace(/<br\s*\/?>/gi, "\n");
  return (d.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
};

const tool = "rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40";
const active = "bg-cyan-600/15 text-cyan-800 dark:text-cyan-300";

export default function EmailComposer({
  lead,
  templates,
  isAdmin,
  initialSubject,
  getToken,
  busy,
  send,
  onCancel,
  onTemplatesChanged,
  onRecorded,
}: {
  lead: LeadFull;
  templates: Template[];
  isAdmin: boolean;
  initialSubject?: string;
  getToken: GetToken;
  busy: boolean;
  /** Sends through Edulexa; resolves true when sent */
  send: (body: { templateId: string | null; subject: string; body: string; attachmentIds: string[] }) => Promise<boolean>;
  onCancel: () => void;
  onTemplatesChanged: () => void;
  /** After recording an email sent from the person's own mail app */
  onRecorded: (lead: LeadFull) => void;
}) {
  const [subject, setSubject] = useState(initialSubject ?? "");
  const [templateId, setTemplateId] = useState("");
  const [preview, setPreview] = useState(false);
  const [files, setFiles] = useState<{ id: string; name: string; size: number }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [external, setExternal] = useState<null | "opened">(null);
  const [menu, setMenu] = useState<"fields" | "app" | null>(null);
  const [html, setHtml] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const first = (lead.name ?? "").split(" ")[0] || "there";

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" }, codeBlock: false, code: false, horizontalRule: false }),
      Placeholder.configure({ placeholder: `Hi ${first}, …` }),
    ],
    content: "",
    onUpdate: ({ editor: e }) => setHtml(e.getHTML()),
  });

  const empty = !htmlToText(html);

  const pickTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    if ((subject.trim() || !empty) && !window.confirm("Replace what you've written with this template?")) return;
    setSubject(t.subject);
    editor?.commands.setContent(toHtml(t.body));
    setHtml(editor?.getHTML() ?? "");
  };

  const insertField = (f: string) => {
    if (document.activeElement === subjectRef.current) {
      const el = subjectRef.current!;
      const at = el.selectionStart ?? subject.length;
      setSubject(subject.slice(0, at) + f + subject.slice(el.selectionEnd ?? at));
    } else editor?.chain().focus().insertContent(f).run();
    setMenu(null);
  };

  const setLink = () => {
    if (!editor) return;
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link address (e.g. https://your-site.example/brochure)", prev ?? "https://");
    if (url === null) return;
    if (!url.trim() || url.trim() === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    setMsg(null);
    for (const file of Array.from(list)) {
      if (files.length >= 5) return setMsg({ ok: false, text: "Attach up to 5 files." });
      if (file.size > 5 * 1024 * 1024) {
        setMsg({ ok: false, text: `${file.name} is over 5 MB.` });
        continue;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await authenticatedFetch("/api/institute/crm/files", { method: "POST", body: fd }, getToken);
        const d = await res.json().catch(() => null);
        if (!res.ok) setMsg({ ok: false, text: d?.error ?? `${file.name} couldn't be attached.` });
        else setFiles((f) => [...f, d]);
      } catch {
        setMsg({ ok: false, text: "We couldn't reach the server. Please check your connection and try again." });
      } finally {
        setUploading(false);
      }
    }
  };

  // What they'll receive, with this person's details filled in
  const filled = useMemo(() => {
    const map: Record<string, string> = {
      "{name}": lead.name?.trim() || "there",
      "{course}": lead.course ?? "our courses",
      "{institute}": lead.instituteName ?? "your institute",
      "{counsellor}": "your name",
    };
    const fill = (s: string, escape: boolean) => Object.entries(map).reduce((acc, [k, v]) => acc.split(k).join(escape ? esc(v) : v), s);
    return { subject: fill(subject, false), html: fill(html, true) };
  }, [subject, html, lead]);

  const totalSize = files.reduce((n, f) => n + f.size, 0);

  const doSend = async () => {
    if (!subject.trim() || empty) return setMsg({ ok: false, text: "Write a subject and a message." });
    await send({ templateId: templateId || null, subject, body: html, attachmentIds: files.map((f) => f.id) });
  };

  const saveTemplate = async () => {
    if (!subject.trim() || empty) return setMsg({ ok: false, text: "Write the subject and message you want to save." });
    const name = window.prompt("Name this template", subject.slice(0, 60));
    if (!name?.trim()) return;
    try {
      await crm(getToken, "/templates", { method: "POST", body: { name: name.trim(), subject, body: html } });
      setMsg({ ok: true, text: `Saved as the template "${name.trim()}".` });
      onTemplatesChanged();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  /** Opens the email in the person's own mail app, with the details filled in */
  const openIn = (app: "gmail" | "outlook" | "default") => {
    const to = lead.email ?? "";
    const body = htmlToText(filled.html);
    const url =
      app === "gmail"
        ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(filled.subject)}&body=${encodeURIComponent(body)}`
        : app === "outlook"
          ? `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(filled.subject)}&body=${encodeURIComponent(body)}`
          : `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(filled.subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, "_blank", "noopener");
    setMenu(null);
    setExternal("opened");
  };

  const recordExternal = async () => {
    try {
      const updated = await crm<LeadFull>(getToken, `/leads/${lead.leadId}/email/external`, { method: "POST", body: { subject, body: html } });
      onRecorded(updated);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  return (
    <div className="mb-6 overflow-hidden rounded-xl border border-cyan-600/40 bg-card">
      {/* To, template */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-2.5 text-sm">
        <span className="min-w-0 truncate">
          <span className="text-muted-foreground">To </span>
          <span className="font-medium">{lead.name ? `${lead.name} <${lead.email}>` : lead.email}</span>
        </span>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Template
          <select value={templateId} onChange={(e) => pickTemplate(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1 text-sm text-foreground">
            <option value="">{templates.length ? "None" : "No templates yet"}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input
        ref={subjectRef}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject"
        aria-label="Subject"
        maxLength={300}
        className="w-full border-b border-border bg-transparent px-4 py-2.5 text-sm font-medium focus:outline-none"
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1" role="toolbar" aria-label="Formatting">
        {[
          { label: "Bold", icon: Bold, on: editor?.isActive("bold"), run: () => editor?.chain().focus().toggleBold().run() },
          { label: "Italic", icon: Italic, on: editor?.isActive("italic"), run: () => editor?.chain().focus().toggleItalic().run() },
          { label: "Underline", icon: Underline, on: editor?.isActive("underline"), run: () => editor?.chain().focus().toggleUnderline().run() },
          { label: "Heading", icon: Heading3, on: editor?.isActive("heading"), run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
          { label: "Bulleted list", icon: List, on: editor?.isActive("bulletList"), run: () => editor?.chain().focus().toggleBulletList().run() },
          { label: "Numbered list", icon: ListOrdered, on: editor?.isActive("orderedList"), run: () => editor?.chain().focus().toggleOrderedList().run() },
          { label: "Quote", icon: Quote, on: editor?.isActive("blockquote"), run: () => editor?.chain().focus().toggleBlockquote().run() },
          { label: "Link", icon: Link2, on: editor?.isActive("link"), run: setLink },
          { label: "Clear formatting", icon: RemoveFormatting, on: false, run: () => editor?.chain().focus().unsetAllMarks().clearNodes().run() },
        ].map(({ label, icon: Icon, on, run }) => (
          <button key={label} type="button" title={label} aria-label={label} aria-pressed={!!on} disabled={preview || !editor} onMouseDown={(e) => e.preventDefault()} onClick={run} className={`${tool} ${on ? active : ""}`}>
            <Icon aria-hidden="true" className="h-4 w-4" />
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <div className="relative">
          <button type="button" disabled={preview} onMouseDown={(e) => e.preventDefault()} onClick={() => setMenu(menu === "fields" ? null : "fields")} className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium hover:bg-muted" aria-expanded={menu === "fields"}>
            Insert field <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          {menu === "fields" && (
            <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-xl border border-border bg-card p-1 shadow-lg">
              {FIELDS.map(([f, label]) => (
                <button key={f} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => insertField(f)} className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted">
                  {label} <code className="text-xs text-muted-foreground">{f}</code>
                </button>
              ))}
              <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-muted-foreground">Filled in for each person when it&apos;s sent. Works in the subject too.</p>
            </div>
          )}
        </div>
        <label className={`${tool} ml-auto inline-flex cursor-pointer items-center gap-1 text-xs font-medium`} title="Attach files">
          <Paperclip aria-hidden="true" className="h-4 w-4" /> {uploading ? "Attaching…" : "Attach"}
          <input type="file" multiple className="sr-only" disabled={uploading || files.length >= 5} accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png" onChange={(e) => {
            attach(e.target.files);
            e.target.value = "";
          }} />
        </label>
        <button type="button" onClick={() => setPreview(!preview)} aria-pressed={preview} className={`${tool} inline-flex items-center gap-1 text-xs font-medium ${preview ? active : ""}`}>
          {preview ? <PencilLine aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />} {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {/* Body or preview */}
      {preview ? (
        <div className="space-y-2 bg-muted/30 px-4 py-3 text-sm">
          <p className="text-xs text-muted-foreground">What {first} will receive</p>
          <p className="font-semibold">{filled.subject || "(no subject)"}</p>
          <div className="email-body rounded-lg border border-border bg-background px-4 py-3" dangerouslySetInnerHTML={{ __html: filled.html || "<p></p>" }} />
          <p className="text-xs text-muted-foreground">
            {lead.instituteName ?? "Your institute"} · Don&apos;t contact me again (link added automatically)
          </p>
        </div>
      ) : (
        <EditorContent editor={editor} className="email-body max-h-80 overflow-y-auto px-4 py-3 text-sm [&_.ProseMirror]:min-h-36 [&_.ProseMirror]:outline-none" />
      )}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2">
          {files.map((f) => (
            <li key={f.id} className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs">
              <Paperclip aria-hidden="true" className="h-3 w-3" /> {f.name} <span className="text-muted-foreground">({Math.ceil(f.size / 1024)} KB)</span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} className="rounded p-0.5 hover:bg-muted">
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </li>
          ))}
          <li className="self-center text-[11px] text-muted-foreground">{(totalSize / 1024 / 1024).toFixed(1)} of 10 MB</li>
        </ul>
      )}

      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`px-4 py-2 text-sm ${msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
          {msg.text}
        </p>
      )}

      {external === "opened" ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-amber-500/5 px-4 py-3 text-sm">
          <span>Sent it from your mail app?</span>
          <button type="button" onClick={recordExternal} className="rounded-lg bg-cyan-700 px-3 py-1.5 font-medium text-white hover:bg-cyan-800">
            Yes, record it on the timeline
          </button>
          <button type="button" onClick={() => setExternal(null)} className="rounded-lg border border-border px-3 py-1.5 hover:bg-muted">
            Not yet
          </button>
          <span className="w-full text-xs text-muted-foreground">Replies to your own mailbox don&apos;t come back to the timeline; attachments aren&apos;t carried over.</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={doSend} disabled={busy || uploading} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-800 disabled:opacity-50">
            <Send aria-hidden="true" className="h-4 w-4" /> Send
          </button>
          <div className="relative">
            <button type="button" onClick={() => setMenu(menu === "app" ? null : "app")} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted" aria-expanded={menu === "app"}>
              Write in my email app <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            </button>
            {menu === "app" && (
              <div className="absolute bottom-full left-0 z-30 mb-1 w-48 rounded-xl border border-border bg-card p-1 shadow-lg">
                {(
                  [
                    ["gmail", "Gmail"],
                    ["outlook", "Outlook"],
                    ["default", "My default mail app"],
                  ] as const
                ).map(([k, label]) => (
                  <button key={k} type="button" onClick={() => openIn(k)} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-muted">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isAdmin && (
            <button type="button" onClick={saveTemplate} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              <Save aria-hidden="true" className="h-4 w-4" /> Save as template
            </button>
          )}
          <button type="button" onClick={onCancel} className="ml-auto rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
            Cancel
          </button>
          <p className="w-full text-xs text-muted-foreground">
            {lead.channels.replyByEmail ? "Their reply comes back to this timeline. " : ""}A link to stop further contact is added at the bottom.
          </p>
        </div>
      )}
    </div>
  );
}


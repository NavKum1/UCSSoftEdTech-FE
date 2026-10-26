"use client";

/** A small formatted-text editor (bold, italic, underline, lists, link, fields) for email templates. */

import React, { useEffect } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Bold, Italic, Link2, List, ListOrdered, Underline } from "lucide-react";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const asHtml = (body: string) =>
  /<\s*(p|br|ul|ol|li|strong|em|h3|blockquote|a)\b/i.test(body) ? body : body.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

const FIELDS: [string, string][] = [
  ["{name}", "Their name"],
  ["{course}", "Course"],
  ["{institute}", "Institute"],
  ["{counsellor}", "Your name"],
];

export default function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [3] }, link: { openOnClick: false, autolink: true, defaultProtocol: "https" }, codeBlock: false, code: false, horizontalRule: false }),
      Placeholder.configure({ placeholder: placeholder ?? "Message" }),
    ],
    content: asHtml(value),
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // A different template loaded from outside (edit another one, or cleared after saving)
  useEffect(() => {
    if (editor && asHtml(value) !== editor.getHTML() && !editor.isFocused) editor.commands.setContent(asHtml(value), { emitUpdate: false });
  }, [value, editor]);

  const tool = (label: string, Icon: React.ElementType, on: boolean | undefined, run: () => void) => (
    <button key={label} type="button" title={label} aria-label={label} aria-pressed={!!on} onMouseDown={(e) => e.preventDefault()} onClick={run} className={`rounded-md p-1.5 hover:bg-muted ${on ? "bg-cyan-600/15 text-cyan-800 dark:text-cyan-300" : "text-muted-foreground"}`}>
      <Icon aria-hidden="true" className="h-4 w-4" />
    </button>
  );

  return (
    <div className="mt-1 overflow-hidden rounded-lg border border-border bg-background focus-within:border-cyan-600">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1" role="toolbar" aria-label="Formatting">
        {tool("Bold", Bold, editor?.isActive("bold"), () => editor?.chain().focus().toggleBold().run())}
        {tool("Italic", Italic, editor?.isActive("italic"), () => editor?.chain().focus().toggleItalic().run())}
        {tool("Underline", Underline, editor?.isActive("underline"), () => editor?.chain().focus().toggleUnderline().run())}
        {tool("Bulleted list", List, editor?.isActive("bulletList"), () => editor?.chain().focus().toggleBulletList().run())}
        {tool("Numbered list", ListOrdered, editor?.isActive("orderedList"), () => editor?.chain().focus().toggleOrderedList().run())}
        {tool("Link", Link2, editor?.isActive("link"), () => {
          const url = window.prompt("Link address", (editor?.getAttributes("link").href as string) ?? "https://");
          if (url === null || !editor) return;
          if (!url.trim() || url.trim() === "https://") editor.chain().focus().extendMarkRange("link").unsetLink().run();
          else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
        })}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {FIELDS.map(([f, label]) => (
          <button key={f} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().insertContent(f).run()} className="rounded-md px-1.5 py-1 text-xs text-cyan-800 hover:bg-cyan-600/10 dark:text-cyan-300" title={`Insert ${label.toLowerCase()}`}>
            + {label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="email-body max-h-72 overflow-y-auto px-3 py-2 text-sm [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:outline-none" />
    </div>
  );
}

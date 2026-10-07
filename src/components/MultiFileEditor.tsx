"use client";

import React, { useCallback, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor, IDisposable } from "monaco-editor";
import { FileCode2, RotateCcw } from "lucide-react";
import { normalizeEol, type EditorTelemetry } from "@/lib/editorTelemetry";

export interface EditorFile {
  name: string;
  content: string;
}

export interface MultiFileEditorApi {
  getFiles: () => EditorFile[];
  insertAtCursor: (text: string, interactionId?: string) => boolean;
  // Applies a whole-file replacement (e.g. an accepted agent proposal) as a tracked "ai-assistant" edit
  replaceFile: (name: string, content: string, interactionId?: string) => boolean;
}

interface MultiFileEditorProps {
  /** Initial contents. Read once when the editor mounts; later edits live in the Monaco models. */
  files: EditorFile[];
  entryFile?: string | null;
  fallbackLanguage?: string;
  /** Unique per attempt so models from different attempts never share a URI. */
  modelKey: string;
  theme: string;
  readOnly?: boolean;
  height?: string;
  telemetry?: EditorTelemetry | null;
  /** When present, offers a per-file "Reset to starter" action. */
  starterFiles?: EditorFile[] | null;
  onReady?: (api: MultiFileEditorApi) => void;
}

const EXTENSION_LANGUAGES: Record<string, string> = {
  py: "python",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  ts: "typescript",
  tsx: "typescript",
  go: "go",
  cs: "csharp",
  java: "java",
  rs: "rust",
  c: "c",
  h: "cpp",
  cc: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  sql: "sql",
  sh: "shell",
  bash: "shell",
  json: "json",
  md: "markdown",
  yml: "yaml",
  yaml: "yaml",
  html: "html",
  css: "css",
  kt: "kotlin",
  swift: "swift",
  dart: "dart",
  scala: "scala",
  rb: "ruby",
  php: "php",
  tf: "hcl",
  toml: "ini",
  ini: "ini",
  txt: "plaintext",
};

export function languageForFile(name: string, fallback = "plaintext"): string {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return EXTENSION_LANGUAGES[ext] ?? fallback;
}

export function orderFiles(files: EditorFile[], entryFile?: string | null): EditorFile[] {
  if (!entryFile) return files;
  const entry = files.find((f) => f.name === entryFile);
  return entry ? [entry, ...files.filter((f) => f !== entry)] : files;
}

export default function MultiFileEditor({
  files,
  entryFile,
  fallbackLanguage = "plaintext",
  modelKey,
  theme,
  readOnly = false,
  height = "380px",
  telemetry,
  starterFiles,
  onReady,
}: MultiFileEditorProps) {
  const [ordered] = useState(() => orderFiles(files, entryFile));
  const [activeFile, setActiveFile] = useState<string>(() => ordered[0]?.name ?? "");

  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const modelsRef = useRef<Map<string, MonacoEditor.ITextModel>>(new Map());
  const viewStatesRef = useRef<Map<string, MonacoEditor.ICodeEditorViewState | null>>(new Map());
  // Latest content per file, so a remount (e.g. React strict mode) restores the candidate's work without an edit
  const contentsRef = useRef<Map<string, string>>(new Map(ordered.map((f) => [f.name, normalizeEol(f.content)])));

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    const disposables: IDisposable[] = [];
    const models = new Map<string, MonacoEditor.ITextModel>();

    for (const file of ordered) {
      const uri = monaco.Uri.parse(`file:///attempt-${encodeURIComponent(modelKey)}/${file.name}`);
      monaco.editor.getModel(uri)?.dispose();
      const model = monaco.editor.createModel(
        contentsRef.current.get(file.name) ?? "",
        languageForFile(file.name, fallbackLanguage),
        uri
      );
      // Offsets must count "\n" only, matching the server's replay
      model.setEOL(monaco.editor.EndOfLineSequence.LF);
      models.set(file.name, model);
      disposables.push(
        model.onDidChangeContent(() => contentsRef.current.set(file.name, model.getValue()))
      );
      if (telemetry) disposables.push(telemetry.trackModel(model, file.name));
    }
    if (telemetry) disposables.push(telemetry.trackEditor(editor));

    modelsRef.current = models;
    const placeholder = editor.getModel();
    const first = models.get(activeFile) ?? models.values().next().value;
    if (first) editor.setModel(first);
    if (placeholder && first && placeholder !== first) placeholder.dispose();

    editor.onDidDispose(() => {
      disposables.forEach((d) => d.dispose());
      models.forEach((m) => {
        if (!m.isDisposed()) m.dispose();
      });
      if (editorRef.current === editor) editorRef.current = null;
    });

    onReady?.({
      getFiles: () =>
        ordered.map((f) => {
          const model = modelsRef.current.get(f.name);
          const content = model && !model.isDisposed() ? model.getValue() : contentsRef.current.get(f.name) ?? "";
          return { name: f.name, content };
        }),
      insertAtCursor: (text, interactionId) => {
        const ed = editorRef.current;
        const selection = ed?.getSelection();
        if (!ed || !selection) return false;
        const apply = () =>
          ed.executeEdits("ai-assistant", [{ range: selection, text: normalizeEol(text), forceMoveMarkers: true }]);
        const applied = telemetry ? telemetry.runAs("ai-assistant", interactionId, apply) : apply();
        ed.pushUndoStop();
        ed.focus();
        return applied;
      },
      replaceFile: (name, content, interactionId) => {
        const model = modelsRef.current.get(name);
        if (!model || model.isDisposed()) return false;
        // Replace only the changed middle so AI-assist character counts aren't inflated by unchanged lines
        const old = model.getValue();
        const next = normalizeEol(content);
        let start = 0;
        while (start < old.length && start < next.length && old[start] === next[start]) start++;
        let end = 0;
        while (end < old.length - start && end < next.length - start && old[old.length - 1 - end] === next[next.length - 1 - end]) end++;
        if (start === old.length && start === next.length) return true;
        const s = model.getPositionAt(start);
        const e = model.getPositionAt(old.length - end);
        const apply = () => {
          model.pushEditOperations(
            [],
            [{ range: { startLineNumber: s.lineNumber, startColumn: s.column, endLineNumber: e.lineNumber, endColumn: e.column }, text: next.slice(start, next.length - end) }],
            () => null
          );
          return true;
        };
        const applied = telemetry ? telemetry.runAs("ai-assistant", interactionId, apply) : apply();
        editorRef.current?.pushUndoStop();
        return applied;
      },
    });
  };

  const switchFile = useCallback(
    (name: string) => {
      const editor = editorRef.current;
      const model = modelsRef.current.get(name);
      if (!editor || !model || name === activeFile) return;
      viewStatesRef.current.set(activeFile, editor.saveViewState());
      editor.setModel(model);
      const viewState = viewStatesRef.current.get(name);
      if (viewState) editor.restoreViewState(viewState);
      editor.focus();
      setActiveFile(name);
    },
    [activeFile]
  );

  const starterForActive = starterFiles?.find((f) => f.name === activeFile);

  const resetActiveFile = () => {
    const model = modelsRef.current.get(activeFile);
    if (!model || !starterForActive || readOnly) return;
    if (!window.confirm(`Reset ${activeFile} to the starter code? Your changes to this file will be replaced.`)) return;
    const apply = () =>
      model.pushEditOperations([], [{ range: model.getFullModelRange(), text: normalizeEol(starterForActive.content) }], () => null);
    if (telemetry) telemetry.runAs("starter", undefined, apply);
    else apply();
  };

  const showTabs = ordered.length > 1;

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      {(showTabs || starterForActive) && (
        <div className="flex items-center justify-between border-b border-border bg-card/80">
          <div className="flex items-center overflow-x-auto" role="tablist" aria-label="Project files">
            {ordered.map((f) => (
              <button
                key={f.name}
                role="tab"
                aria-selected={f.name === activeFile}
                onClick={() => switchFile(f.name)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-mono whitespace-nowrap border-r border-border transition-colors cursor-pointer ${
                  f.name === activeFile
                    ? "bg-background text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                {f.name}
                {entryFile === f.name && showTabs && (
                  <span className="text-[9px] uppercase tracking-wider text-indigo-600 dark:text-indigo-400">entry</span>
                )}
              </button>
            ))}
          </div>
          {starterForActive && !readOnly && (
            <button
              onClick={resetActiveFile}
              title={`Reset ${activeFile} to the starter code`}
              className="flex items-center gap-1 px-3 py-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset file
            </button>
          )}
        </div>
      )}
      <Editor
        height={height}
        theme={theme}
        defaultLanguage={fallbackLanguage}
        onMount={handleMount}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "var(--font-geist-mono), monospace",
          padding: { top: 16 },
          automaticLayout: true,
          readOnly,
          // Plain-text paste only, so every paste goes through onDidPaste and is labelled correctly
          pasteAs: { enabled: false },
          dropIntoEditor: { enabled: false },
        }}
      />
    </div>
  );
}

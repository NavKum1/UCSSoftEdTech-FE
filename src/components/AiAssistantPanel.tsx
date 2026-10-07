"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bot, CornerDownLeft, Info, Loader2, Send, ShieldAlert } from "lucide-react";
import { authenticatedFetch } from "@/lib/apiClient";

export type AiPolicy = "Prohibited" | "Allowed" | "Evaluated";

interface FileContent {
  name: string;
  content: string;
}

interface Interaction {
  interactionId: string;
  prompt: string;
  response: string;
}

interface AiAssistantPanelProps {
  attemptId: string;
  aiPolicy: AiPolicy;
  getToken: () => Promise<string | null>;
  getFiles: () => FileContent[];
  /** Inserts code at the editor cursor, tagged with the interaction it came from. Returns false if it could not. */
  onInsert: (code: string, interactionId: string) => boolean;
  disabled?: boolean;
}

type Segment = { kind: "text"; value: string } | { kind: "code"; lang: string; value: string };

function splitFences(text: string): Segment[] {
  const segments: Segment[] = [];
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = fence.exec(text)) !== null) {
    if (match.index > last) segments.push({ kind: "text", value: text.slice(last, match.index) });
    segments.push({ kind: "code", lang: match[1].trim(), value: match[2].replace(/\n$/, "") });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ kind: "text", value: text.slice(last) });
  return segments.filter((s) => s.kind === "code" || s.value.trim().length > 0);
}

export function AiPolicyNotice({ aiPolicy }: { aiPolicy: AiPolicy }) {
  if (aiPolicy === "Prohibited") {
    return (
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" />
        <span>
          AI tools are not permitted for this sprint. Text pasted from outside the editor is visible to reviewers.
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-700 dark:text-indigo-400" />
      <span>
        AI use is allowed and logged. Reviewers see your prompts and how you used the answers.
        {aiPolicy === "Evaluated" && " How you use AI is part of the review."}
      </span>
    </div>
  );
}

export default function AiAssistantPanel({
  attemptId,
  aiPolicy,
  getToken,
  getFiles,
  onInsert,
  disabled = false,
}: AiAssistantPanelProps) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insertedKey, setInsertedKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    authenticatedFetch(`/api/attempts/${attemptId}/assistant`, {}, getToken)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.interactions)) {
          setInteractions(
            data.interactions.map((i: Interaction) => ({
              interactionId: i.interactionId,
              prompt: i.prompt,
              response: i.response,
            }))
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [attemptId, getToken]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [interactions, sending]);

  const send = async () => {
    const text = prompt.trim();
    if (!text || sending || disabled) return;
    setSending(true);
    setError(null);
    try {
      const res = await authenticatedFetch(
        `/api/attempts/${attemptId}/assistant`,
        { method: "POST", body: JSON.stringify({ prompt: text, files: getFiles() }) },
        getToken
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.interactionId) {
        setInteractions((prev) => [...prev, { interactionId: data.interactionId, prompt: text, response: data.response ?? "" }]);
        setPrompt("");
      } else if (res.status === 429) {
        setError(data.error || "You're sending prompts too quickly. Wait a moment and try again.");
      } else {
        setError(data.error || "The assistant is unavailable right now.");
      }
    } catch {
      setError("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const insert = (code: string, interactionId: string, key: string) => {
    if (onInsert(code, interactionId)) {
      setInsertedKey(key);
      setTimeout(() => setInsertedKey((k) => (k === key ? null : k)), 1500);
    } else {
      setError("Click into the editor where the code should go, then try again.");
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 border border-border space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-indigo-700 dark:text-indigo-400" />
          <h3 className="text-sm font-semibold text-foreground">AI Assistant</h3>
        </div>
        <span className="text-[10px] px-2.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-semibold border border-indigo-500/20">
          {aiPolicy === "Evaluated" ? "AI use reviewed" : "AI allowed"}
        </span>
      </div>

      <AiPolicyNotice aiPolicy={aiPolicy} />

      <div ref={scrollRef} className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {interactions.length === 0 && !sending && (
          <p className="text-xs text-muted-foreground italic">
            Ask about the task or your code. The assistant sees the current contents of your files.
          </p>
        )}
        {interactions.map((item) => (
          <div key={item.interactionId} className="space-y-2">
            <div className="ml-8 p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-foreground whitespace-pre-wrap">
              {item.prompt}
            </div>
            <div className="mr-4 p-2.5 rounded-xl bg-card border border-border text-xs text-foreground space-y-2">
              {splitFences(item.response).map((seg, idx) => {
                const key = `${item.interactionId}-${idx}`;
                return seg.kind === "text" ? (
                  <p key={key} className="whitespace-pre-wrap leading-relaxed">
                    {seg.value.trim()}
                  </p>
                ) : (
                  <div key={key} className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-2.5 py-1 bg-muted text-[10px] text-muted-foreground font-mono">
                      <span>{seg.lang || "code"}</span>
                      <button
                        onClick={() => insert(seg.value, item.interactionId, key)}
                        disabled={disabled}
                        className="flex items-center gap-1 font-sans font-semibold text-indigo-700 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <CornerDownLeft className="w-3 h-3" />
                        {insertedKey === key ? "Inserted" : "Insert at cursor"}
                      </button>
                    </div>
                    <pre className="p-2.5 bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto">
                      <code>{seg.value}</code>
                    </pre>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking...
          </div>
        )}
      </div>

      {error && <p className="text-[11px] text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-end gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          disabled={disabled}
          placeholder={disabled ? "The assistant is closed after submission." : "Ask the assistant..."}
          className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60"
        />
        <button
          onClick={() => void send()}
          disabled={disabled || sending || !prompt.trim()}
          aria-label="Send prompt"
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-muted disabled:text-muted-foreground transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

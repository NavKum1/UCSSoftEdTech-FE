"use client";

/** A guidance conversation: messages (staff-only notes marked) and a reply box. Shared by the person, advisors and mentors. */

import React, { useState } from "react";

export interface GuidanceMessage {
  id: string;
  authorRole: "person" | "advisor" | "mentor" | "system";
  authorName: string;
  body: string;
  via: "app" | "email";
  internal: boolean;
  createdAt: string;
}

export interface GuidanceRequestView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  question: string;
  status: string;
  createdAt: string;
  lastActivityAt: string;
  answers: { question: string; answer: string }[] | null;
  quiz: {
    primaryTrack: string;
    secondaryTrack: string;
    matchConfidence: string;
    ranking: { track: string; percent: number }[];
    answers: { question: string; answer: string }[];
  } | null;
  mentor: string | null;
  suggestedInstitute: string | null;
  suggestionNote: string | null;
  sentToInstitute: boolean;
  replyByEmail: boolean;
  messages: GuidanceMessage[];
}

export const STATUS_LABEL: Record<string, string> = {
  Open: "Waiting for an advisor",
  WithMentor: "With a mentor",
  Answered: "Answered",
  InstituteSuggested: "Institute suggested",
  SentToInstitute: "Sent to an institute",
  Resolved: "Resolved",
};

export function Messages({ messages }: { messages: GuidanceMessage[] }) {
  return (
    <ol className="space-y-3">
      {messages.map((m) => (
        <li
          key={m.id}
          className={`rounded-xl p-3 text-sm ${
            m.authorRole === "system" ? "bg-muted/40 text-muted-foreground" : m.internal ? "border border-dashed border-amber-500/50 bg-amber-500/5" : m.authorRole === "person" ? "bg-muted/60" : "bg-indigo-500/5"
          }`}
        >
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{m.authorName}</span>
            {m.authorRole === "mentor" && " (community mentor)"}
            {m.authorRole === "advisor" && " (Edulexa advisor)"} · {new Date(m.createdAt).toLocaleString()}
            {m.via === "email" && " · by email"}
            {m.internal && " · note for staff only"}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function ReplyBox({ onSend, allowInternal, placeholder }: { onSend: (body: string, internal: boolean) => Promise<boolean>; allowInternal?: boolean; placeholder?: string }) {
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        setBusy(true);
        if (await onSend(body.trim(), internal)) {
          setBody("");
          setInternal(false);
        }
        setBusy(false);
      }}
    >
      <label className="block text-sm">
        <span className="sr-only">Your reply</span>
        <textarea
          rows={3}
          value={body}
          maxLength={8000}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder ?? "Write a reply"}
          className="block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {allowInternal ? (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Note for staff only (the person doesn&apos;t see it)
          </label>
        ) : (
          <span />
        )}
        <button type="submit" disabled={busy || !body.trim()} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {busy ? "Sending…" : internal ? "Add note" : "Send"}
        </button>
      </div>
    </form>
  );
}

/** What the person told us: their answers and, if shared, their quiz. */
export function RequestDetails({ r }: { r: GuidanceRequestView }) {
  return (
    <div className="space-y-3 text-sm">
      <p className="whitespace-pre-wrap">
        <span className="font-medium">What they&apos;re unsure about:</span> {r.question}
      </p>
      {r.answers && r.answers.length > 0 && (
        <dl className="space-y-1">
          {r.answers.map((a, i) => (
            <div key={i}>
              <dt className="text-muted-foreground">{a.question}</dt>
              <dd className="font-medium">{a.answer}</dd>
            </div>
          ))}
        </dl>
      )}
      {r.quiz && (
        <details className="rounded-xl bg-muted/50 p-3">
          <summary className="cursor-pointer font-medium">
            Shared quiz: {r.quiz.primaryTrack}
            {r.quiz.secondaryTrack ? `, then ${r.quiz.secondaryTrack}` : ""} ({r.quiz.matchConfidence} match)
          </summary>
          <ul className="mt-2 text-xs">
            {r.quiz.ranking.map((x) => (
              <li key={x.track}>
                {x.track}: {x.percent}%
              </li>
            ))}
          </ul>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
            {r.quiz.answers.map((a, i) => (
              <li key={i}>
                {a.question} <span className="font-medium">{a.answer}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

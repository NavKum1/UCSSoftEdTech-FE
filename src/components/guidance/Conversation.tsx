"use client";

/** A guidance conversation: messages (staff-only notes marked) and a reply box. Shared by the person, advisors and mentors. */

import React, { useState } from "react";
import AnswerFiles, { type AnswerFile } from "@/components/guidance/AnswerFiles";
import { useEn } from "@/lib/english/EnglishProvider";

export interface GuidanceMessage {
  id: string;
  authorRole: "person" | "advisor" | "mentor" | "system";
  authorName: string;
  body: string;
  via: "app" | "email";
  internal: boolean;
  createdAt: string;
}

export interface SuggestedInstitute {
  instituteId: string;
  name: string;
  city: string | null;
  coursesInArea: number;
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
  answers: { question: string; answer: string; files?: AnswerFile[] }[] | null;
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
  /** The person may send it to an institute themselves (nobody answered in two working days) */
  canChoose?: boolean;
  /** Institutes with courses in the area the person's quiz recommended (staff and mentors; the person when canChoose) */
  suggestions?: SuggestedInstitute[];
  messages: GuidanceMessage[];
}

// Shown through en(): each line is marked so the texts are translated
export const STATUS_LABEL: Record<string, string> = {
  Open: "Waiting for an advisor", // en() where shown
  WithMentor: "With a mentor", // en() where shown
  Answered: "Answered", // en() where shown
  InstituteSuggested: "Institute suggested", // en() where shown
  SentToInstitute: "Sent to an institute", // en() where shown
  Resolved: "Resolved", // en() where shown
};

export function Messages({ messages }: { messages: GuidanceMessage[] }) {
  const en = useEn();
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
            {m.authorRole === "mentor" && en(" (community mentor)")}
            {m.authorRole === "advisor" && en(" (Edulexa advisor)")} · {new Date(m.createdAt).toLocaleString()}
            {m.via === "email" && en(" · by email")}
            {m.internal && en(" · note for staff only")}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
        </li>
      ))}
    </ol>
  );
}

export function ReplyBox({ onSend, allowInternal, placeholder }: { onSend: (body: string, internal: boolean) => Promise<boolean>; allowInternal?: boolean; placeholder?: string }) {
  const en = useEn();
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
        <span className="sr-only">{en("Your reply")}</span>
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
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />{en(" Note for staff only (the person doesn't see it)")}
          </label>
        ) : (
          <span />
        )}
        <button type="submit" disabled={busy || !body.trim()} className="rounded-lg bg-indigo-700 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-800 disabled:opacity-60">
          {busy ? en("Sending…") : internal ? en("Add note") : en("Send")}
        </button>
      </div>
    </form>
  );
}

/** What the person told us: their answers and, if shared, their quiz. */
export function RequestDetails({ r, files = false }: { r: GuidanceRequestView; /** Staff who may open attached files (advisors) */ files?: boolean }) {
  const en = useEn();
  return (
    <div className="space-y-3 text-sm">
      <p className="whitespace-pre-wrap">
        <span className="font-medium">{en("What they're unsure about:")}</span> {r.question}
      </p>
      {r.answers && r.answers.length > 0 && (
        <dl className="space-y-1">
          {r.answers.map((a, i) => (
            <div key={i}>
              <dt className="text-muted-foreground">{a.question}</dt>
              <dd className="font-medium">
                {a.answer}
                {files && <AnswerFiles files={a.files} />}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {r.quiz && (
        <details className="rounded-xl bg-muted/50 p-3">
          <summary className="cursor-pointer font-medium">
            {en("Shared quiz: {primaryTrack}{value} ({matchConfidence} match)", { primaryTrack: r.quiz.primaryTrack, value: r.quiz.secondaryTrack ? `, then ${r.quiz.secondaryTrack}` : "", matchConfidence: r.quiz.matchConfidence })}
          </summary>
          <ul className="mt-2 text-xs">
            {r.quiz.ranking.map((x) => (
              <li key={x.track}>
                {x.track}: {x.percent}%
              </li>
            ))}
          </ul>
          <ol className="mt-2 list-decimal space-y-1 ps-5 text-xs">
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

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

/** One suggested institute, as a choice: its name, city and how many of its courses are in the person's area */
function SuggestionLine({ s, area }: { s: SuggestedInstitute; area?: string | null }) {
  const en = useEn();
  return (
    <>
      <span className="font-medium">{s.name}</span>
      <span className="text-xs text-muted-foreground">
        {[s.city, area ? en(s.coursesInArea === 1 ? "1 course in {area}" : "{count} courses in {area}", { count: s.coursesInArea, area }) : null].filter(Boolean).join(" · ")}
      </span>
    </>
  );
}

/**
 * Advisors and mentors suggest an institute; the person decides, and nothing is sent unless they approve. The institutes
 * suggested for this person (courses in the area their quiz recommended) are one click away; any listed institute can be chosen.
 */
export function SuggestInstitute({ r, institutes, onSuggest }: {
  r: GuidanceRequestView;
  institutes: { id: string; name: string }[];
  onSuggest: (instituteId: string, note: string) => Promise<boolean>;
}) {
  const en = useEn();
  const [pick, setPick] = useState("");
  const [note, setNote] = useState("");
  const suggested = r.suggestions ?? [];
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{en("Suggest an institute")}</h3>
      <p className="text-xs text-muted-foreground">{en("The person decides. Nothing is sent unless they approve.")}</p>
      {suggested.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium">{en("Suggested for this person")}</legend>
          {suggested.map((s) => (
            <label key={s.instituteId} className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2 text-sm has-[:checked]:border-indigo-600">
              <input type="radio" name={`suggest-${r.id}`} className="mt-1" checked={pick === s.instituteId} onChange={() => setPick(s.instituteId)} />
              <span className="flex flex-col"><SuggestionLine s={s} area={r.quiz?.primaryTrack} /></span>
            </label>
          ))}
        </fieldset>
      )}
      <select value={pick} onChange={(e) => setPick(e.target.value)} className={field} aria-label={en("Institute")}>
        <option value="">{suggested.length > 0 ? en("Or choose another institute") : en("Choose an institute")}</option>
        {institutes.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      <input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder={en("Why this institute (optional)")} className={field} />
      <button
        type="button"
        disabled={!pick || r.sentToInstitute}
        onClick={async () => {
          if (await onSuggest(pick, note)) { setNote(""); setPick(""); }
        }}
        className="inline-flex items-center rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        {en("Suggest")}
      </button>
    </div>
  );
}

/** The person sends their request to an institute themselves, when nobody has answered it in two working days */
export function ChooseInstitute({ r, onChoose }: { r: GuidanceRequestView; onChoose: (instituteId: string) => Promise<boolean> }) {
  const en = useEn();
  const [busy, setBusy] = useState<string | null>(null);
  if (!r.canChoose || !r.suggestions?.length) return null;
  return (
    <section aria-labelledby={`choose-${r.id}`} className="space-y-2 rounded-xl border border-border bg-muted/40 p-4">
      <h3 id={`choose-${r.id}`} className="text-sm font-semibold">{en("Choose an institute yourself")}</h3>
      <p className="text-sm text-muted-foreground">
        {en("Nobody has answered yet. These institutes have courses in the area your quiz recommended. Send your request to one of them and they'll contact you, or keep waiting for an advisor.")}
      </p>
      <ul className="space-y-2">
        {r.suggestions.map((s) => (
          <li key={s.instituteId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm">
            <span className="flex flex-col"><SuggestionLine s={s} area={r.quiz?.primaryTrack} /></span>
            <button
              type="button"
              disabled={busy != null}
              onClick={async () => { setBusy(s.instituteId); await onChoose(s.instituteId); setBusy(null); }}
              className="inline-flex items-center rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
            >
              {busy === s.instituteId ? en("Sending…") : en("Send my request to this institute")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

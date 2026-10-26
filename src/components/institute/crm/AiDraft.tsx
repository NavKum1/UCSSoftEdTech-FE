"use client";

/**
 * "Draft with AI": a first draft of an email to this person, written from what they shared (their question, form
 * answers, quiz) and the conversation so far, for a chosen purpose and tone. Only a draft: it fills the composer, and the
 * counsellor edits and sends it.
 */

import React, { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { crm, type GetToken } from "./api";

const PURPOSES: [string, string][] = [
  ["first-reply", "First reply"],
  ["follow-up", "Follow up (no reply yet)"],
  ["book-counselling", "Invite to a counselling session"],
  ["after-call", "Recap after a call"],
  ["custom", "Something else (describe below)"],
];
const TONES: [string, string][] = [
  ["friendly", "Friendly"],
  ["formal", "Formal"],
  ["brief", "Short"],
];
const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Punjabi"];

export default function AiDraft({
  leadId,
  getToken,
  onDraft,
  onClose,
  suggest,
}: {
  leadId: string;
  getToken: GetToken;
  onDraft: (d: { subject: string; body: string; sample: boolean; sentToAi?: string }) => void;
  onClose: () => void;
  /** Suggested purpose from the lead's state */
  suggest?: string;
}) {
  const [purpose, setPurpose] = useState(suggest ?? "first-reply");
  const [tone, setTone] = useState("friendly");
  const [language, setLanguage] = useState("English");
  const [instructions, setInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const write = async () => {
    setBusy(true);
    setError(null);
    try {
      const d = await crm<{ subject: string; body: string; sample: boolean; sentToAi?: string }>(getToken, `/leads/${leadId}/email/draft`, {
        method: "POST",
        body: { purpose, tone, language, instructions: instructions.trim() || null },
      });
      onDraft(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const select = "mt-1 block w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm";
  return (
    <div className="space-y-3 border-b border-border bg-violet-500/5 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="flex items-center gap-1.5 font-medium">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-violet-600" /> Draft with AI
        </p>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-muted">
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="text-xs font-medium text-muted-foreground">
          The email is
          <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={select}>
            {PURPOSES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Tone
          <select value={tone} onChange={(e) => setTone(e.target.value)} className={select}>
            {TONES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Language
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className={select}>
            {LANGUAGES.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs font-medium text-muted-foreground">
        Anything to include? <span className="font-normal">(optional)</span>
        <textarea
          rows={2}
          maxLength={500}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. Mention the weekend batch starting 5 January and the 10% early fee discount"
          className={select}
        />
      </label>
      {error && <p className="text-red-700 dark:text-red-400" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={write} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3.5 py-1.5 font-medium text-white hover:bg-violet-800 disabled:opacity-50">
          <Sparkles aria-hidden="true" className="h-4 w-4" /> {busy ? "Writing…" : "Write a draft"}
        </button>
        <p className="text-xs text-muted-foreground">
          Uses what they shared and your conversation; facts like fees or dates come only from what you write above. Names, contact details and ID numbers are removed before anything goes to the AI. Check it before sending.
        </p>
      </div>
    </div>
  );
}

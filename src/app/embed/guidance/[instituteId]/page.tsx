"use client";

/**
 * The public career guidance form an institute embeds on its own website (iframe). A visitor with no account asks the
 * institute's advisor for help choosing an area or certification: what they're unsure about, the institute's own
 * questions, name and email, and consent. No Edulexa header; the institute's name is shown. Only works when the
 * institute turned its public form on (else "not available").
 */

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { getApiBaseUrl } from "@/lib/apiClient";
import GuidanceFields, { fieldInput as input, toAnswers, type GuidanceQuestion } from "@/components/counselling/GuidanceFields";

interface Form {
  instituteName: string;
  questions: GuidanceQuestion[];
}

export default function EmbeddedGuidancePage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const api = `${getApiBaseUrl().replace(/\/$/, "")}/api/public/guidance/${instituteId}`;
  const [form, setForm] = useState<Form | null>(null);
  const [missing, setMissing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [unsure, setUnsure] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState(""); // hidden bot trap
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(api)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) setForm((await res.json()) as Form);
        else setMissing(true);
      })
      .catch(() => !cancelled && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [api]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await fetch(api, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), phone: phone.trim() || null, unsure: unsure.trim(), answers: toAnswers(values), consent, website }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) setSent(true);
      else if (res.status === 429) setError("Too many requests from here just now. Please try again later.");
      else setError(body?.error ?? "Your request couldn't be sent. Please try again.");
    } catch {
      setError("We couldn't send your request. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  if (missing)
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-sm text-muted-foreground">This form isn&apos;t available right now.</div>
    );
  if (!form) return <div className="mx-auto h-64 max-w-lg animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />;
  if (sent)
    return (
      <div className="mx-auto max-w-lg p-6 text-center" role="status">
        <CheckCircle2 aria-hidden="true" className="mx-auto h-8 w-8 text-emerald-600" />
        <p className="mt-2 text-base font-semibold">Thank you. Your request was sent.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          An advisor from {form.instituteName} will contact you at {email.trim()}.
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-lg p-4 sm:p-6">
      <h1 className="text-lg font-semibold">Get career guidance from {form.instituteName}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Not sure which area or certification suits you? Tell us a little, and an advisor will get back to you.
      </p>
      <form onSubmit={send} className="mt-5 space-y-4 text-sm">
        <label className="block">
          <span className="font-medium">What are you unsure about?</span>
          <textarea
            required
            value={unsure}
            maxLength={2000}
            rows={3}
            onChange={(e) => setUnsure(e.target.value)}
            className={input}
            placeholder="e.g. I can't decide between cloud and data, or which certification would help me get a job"
          />
        </label>
        <GuidanceFields questions={form.questions} values={values} onChange={(id, v) => setValues((s) => ({ ...s, [id]: v }))} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-medium">Name</span>
            <input required value={name} maxLength={200} onChange={(e) => setName(e.target.value)} className={input} autoComplete="name" />
          </label>
          <label className="block">
            <span className="font-medium">Email</span>
            <input required type="email" value={email} maxLength={254} onChange={(e) => setEmail(e.target.value)} className={input} autoComplete="email" />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium">Phone</span> <span className="text-muted-foreground">(optional)</span>
            <input type="tel" value={phone} maxLength={64} onChange={(e) => setPhone(e.target.value)} className={input} autoComplete="tel" />
          </label>
        </div>
        <label className="absolute -left-[9999px]" aria-hidden="true">
          Website
          <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
          <span>Send this to {form.instituteName} so an advisor can contact me.</span>
        </label>
        {error && (
          <p role="alert" className="text-red-700 dark:text-red-400">
            {error}
          </p>
        )}
        <button type="submit" disabled={!consent || sending} className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
          {sending ? "Sending…" : "Send"}
        </button>
      </form>
    </div>
  );
}

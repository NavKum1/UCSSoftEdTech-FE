"use client";

/**
 * Ask an advisor (career guidance without the quiz). Someone who can't decide which area or certification suits them
 * asks an institute's advisor directly: the institute's own questions (its career guidance form, set by its admins) and
 * what they're unsure about. Name and email come filled in. With a quiz result they may also attach it (opt-in). Sent
 * only with their consent; the institute sees it as a "career guidance" lead (no course chosen).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircleQuestion, X } from "lucide-react";
import GuidanceFields, { fieldInput as input, toAnswers, type GuidanceQuestion } from "@/components/counselling/GuidanceFields";

interface Institute {
  id: string;
  name: string;
}

export default function AdvisorRequest({
  apiFetch,
  scope,
  hasQuizResult,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  /** The institute whose quiz this is (its advisor is the one asked); null on the platform quiz */
  scope: { instituteId: string; instituteName: string } | null;
  hasQuizResult: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  return (
    <section className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <MessageCircleQuestion aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
        <div>
          <p className="text-sm font-semibold">Not sure which area or certification is right for you?</p>
          <p className="text-sm text-muted-foreground">{sent ?? "Ask an advisor for career guidance. You don't need to take the quiz first."}</p>
        </div>
      </div>
      {!sent && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-xl border border-indigo-600 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          Ask an advisor
        </button>
      )}
      {open && (
        <AdvisorDialog
          apiFetch={apiFetch}
          scope={scope}
          hasQuizResult={hasQuizResult}
          onClose={() => setOpen(false)}
          onSent={(m) => {
            setSent(m);
            setOpen(false);
          }}
        />
      )}
    </section>
  );
}

function AdvisorDialog({
  apiFetch,
  scope,
  hasQuizResult,
  onClose,
  onSent,
}: {
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  scope: { instituteId: string; instituteName: string } | null;
  hasQuizResult: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const [institutes, setInstitutes] = useState<Institute[]>(scope ? [{ id: scope.instituteId, name: scope.instituteName }] : []);
  const [instituteId, setInstituteId] = useState(scope?.instituteId ?? "");
  const [questions, setQuestions] = useState<GuidanceQuestion[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [unsure, setUnsure] = useState("");
  const [shareQuiz, setShareQuiz] = useState(false);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Name and email from the account; on the platform quiz, the institutes with courses here
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [me, courses] = await Promise.all([apiFetch("/api/me/overview"), scope ? Promise.resolve(null) : apiFetch("/api/quiz/counselling/courses")]);
        if (cancelled) return;
        if (me.ok) {
          const o = (await me.json()) as { profile?: { name?: string; email?: string } };
          setName((n) => n || o.profile?.name || "");
          setEmail((e) => e || o.profile?.email || "");
        }
        if (courses?.ok) {
          const body = (await courses.json()) as { courses: { instituteId: string; instituteName: string }[] };
          const seen = new Map<string, string>();
          for (const c of body.courses) if (!seen.has(c.instituteId)) seen.set(c.instituteId, c.instituteName);
          const list = [...seen].map(([id, n]) => ({ id, name: n }));
          setInstitutes(list);
          if (list.length === 1) setInstituteId(list[0].id);
        }
      } catch {
        // fields stay as typed
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, scope]);

  // The chosen institute's own questions
  useEffect(() => {
    if (!instituteId) return;
    let cancelled = false;
    void apiFetch(`/api/quiz/counselling/guidance-form?instituteId=${instituteId}`)
      .then(async (res) => {
        if (!cancelled && res.ok) setQuestions(((await res.json()) as { questions: GuidanceQuestion[] }).questions);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [apiFetch, instituteId]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const instituteName = useMemo(() => institutes.find((i) => i.id === instituteId)?.name ?? "the institute", [institutes, instituteId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch("/api/quiz/counselling/refer-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instituteId,
          guidanceOnly: true,
          candidateName: name.trim(),
          candidateEmail: email.trim(),
          candidatePhone: phone.trim() || null,
          guidanceAnswers: toAnswers(values),
          notes: unsure.trim(),
          referralSource: "Ask an advisor",
          shareQuizResult: hasQuizResult && shareQuiz,
          consent,
        }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok) onSent(`Sent to ${instituteName}. An advisor will contact you at ${email.trim()}.`);
      else if (res.status === 429) setError("You've sent several requests in a short time. Please try again later.");
      else setError(body?.error ?? "The request couldn't be sent. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="adv-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="adv-title" className="text-base font-semibold">
            Ask an advisor
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={send} className="mt-4 space-y-4 text-sm">
          {!scope && institutes.length !== 1 && (
            <label className="block">
              <span className="font-medium">Institute</span>
              {institutes.length === 0 ? (
                <span className="mt-1 block text-muted-foreground">No institutes offer advice here yet.</span>
              ) : (
                <select required value={instituteId} onChange={(e) => setInstituteId(e.target.value)} className={input}>
                  <option value="">Choose an institute</option>
                  {institutes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
                </select>
              )}
            </label>
          )}
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
          {instituteId && <GuidanceFields questions={questions} values={values} onChange={(id, v) => setValues((s) => ({ ...s, [id]: v }))} />}
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
          {hasQuizResult && (
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={shareQuiz} onChange={(e) => setShareQuiz(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
              <span>Also share my latest quiz answers and result (optional).</span>
            </label>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" required checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-indigo-600" />
            <span>Send this to {instituteName} so an advisor can contact me.</span>
          </label>
          {error && (
            <p role="alert" className="text-red-700 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 font-medium hover:bg-muted">
              Cancel
            </button>
            <button type="submit" disabled={!consent || sending || !instituteId} className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

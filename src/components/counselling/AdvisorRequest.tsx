"use client";

/**
 * Career guidance without the quiz (owner decisions, 25 Oct 2026).
 * - Through an institute (its quiz link, its website): the request goes to that institute; no choosing.
 * - On Edulexa itself: "Ask Edulexa" by default. Edulexa advisors (or community mentors) answer, and may suggest an
 *   institute that gets the request only if the person approves. A secondary "talk to a specific institute" shows cards
 *   with each institute's real details and courses, so the choice is an informed one.
 * The form is short: what they're unsure about, the questions set for that form (one-tap choices), name and email
 * prefilled, one consent tick. With a quiz result they may attach it.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapPin, MessageCircleQuestion, X } from "lucide-react";
import GuidanceFields, { fieldInput as input, toAnswers, type GuidanceQuestion } from "@/components/counselling/GuidanceFields";
import { COMMUNITY_INSTITUTE_ID } from "@/lib/community";

type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

interface Card {
  instituteId: string;
  name: string;
  city: string | null;
  modes: string[];
  feesRange: string | null;
  about: string | null;
  coursesInArea: number;
  courses: { courseName: string; targetTrack: string; credentialType: string; duration: string; intake: string; accreditation: string; inArea: boolean }[];
}

/** A display name, never an internal id (some accounts have none) */
const realName = (n?: string | null) => (n && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(n) ? n : "");

export default function AdvisorRequest({
  apiFetch,
  scope,
  hasQuizResult,
  track,
}: {
  apiFetch: ApiFetch;
  /** The institute whose quiz this is; null on Edulexa\'s own quiz */
  scope: { instituteId: string; instituteName: string } | null;
  hasQuizResult: boolean;
  /** The area of their latest result, to show matching institutes first */
  track?: string | null;
}) {
  const [dialog, setDialog] = useState<"edulexa" | "cards" | { id: string; name: string } | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <MessageCircleQuestion aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
          <div>
            <p className="text-sm font-semibold">Not sure which area or certification is right for you?</p>
            <p className="text-sm text-muted-foreground">
              {sent ?? (scope ? `Ask an advisor at ${scope.instituteName}. You don't need to take the quiz first.` : "Ask Edulexa's advisors. You don't need to take the quiz first.")}
            </p>
          </div>
        </div>
        {!sent && (
          <button
            type="button"
            onClick={() => setDialog(scope ? { id: scope.instituteId, name: scope.instituteName } : "edulexa")}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {scope ? "Ask an advisor" : "Ask Edulexa"}
          </button>
        )}
      </div>
      {!scope && (
        <p className="mt-2 pl-8 text-sm text-muted-foreground">
          {sent ? (
            <Link href="/my/guidance" className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
              See your requests and replies
            </Link>
          ) : (
            <>
              Prefer an institute?{" "}
              <button type="button" onClick={() => setDialog("cards")} className="font-medium text-indigo-700 hover:underline dark:text-indigo-300">
                Talk to a specific institute
              </button>
            </>
          )}
        </p>
      )}

      {dialog === "edulexa" && (
        <RequestDialog
          apiFetch={apiFetch}
          to={{ kind: "edulexa" }}
          hasQuizResult={hasQuizResult}
          onClose={() => setDialog(null)}
          onSent={(m) => {
            setSent(m);
            setDialog(null);
          }}
        />
      )}
      {dialog === "cards" && <InstituteCards apiFetch={apiFetch} track={track} onClose={() => setDialog(null)} onChoose={(id, name) => setDialog({ id, name })} />}
      {dialog && typeof dialog === "object" && (
        <RequestDialog
          apiFetch={apiFetch}
          to={{ kind: "institute", id: dialog.id, name: dialog.name }}
          hasQuizResult={hasQuizResult}
          onClose={() => setDialog(null)}
          onSent={(m) => {
            setSent(m);
            setDialog(null);
          }}
        />
      )}
    </section>
  );
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[90vh] w-full ${wide ? "max-w-3xl" : "max-w-lg"} overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-muted">
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InstituteCards({ apiFetch, track, onClose, onChoose }: { apiFetch: ApiFetch; track?: string | null; onClose: () => void; onChoose: (id: string, name: string) => void }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    void apiFetch(`/api/guidance/institutes${track ? `?track=${encodeURIComponent(track)}` : ""}`)
      .then(async (r) => !cancelled && setCards(r.ok ? ((await r.json()) as Card[]) : []))
      .catch(() => !cancelled && setCards([]));
    return () => {
      cancelled = true;
    };
  }, [apiFetch, track]);
  return (
    <Modal title="Talk to a specific institute" onClose={onClose} wide>
      <p className="mt-1 text-sm text-muted-foreground">
        {track ? `Institutes with courses in ${track} come first. ` : ""}Only details each institute has given are shown.
      </p>
      {!cards ? (
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />
      ) : cards.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No institutes are listed yet. Ask Edulexa instead.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {cards.map((c) => (
            <li key={c.instituteId} className="flex flex-col rounded-xl border border-border p-4">
              <p className="font-semibold">{c.name}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {c.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden="true" className="h-3 w-3" />
                    {c.city}
                  </span>
                )}
                {c.modes.length > 0 && <span>{c.modes.join(", ")}</span>}
                {c.feesRange && <span>Fees: {c.feesRange}</span>}
              </p>
              {c.about && <p className="mt-2 text-sm text-muted-foreground">{c.about}</p>}
              <ul className="mt-2 space-y-1 text-sm">
                {c.courses.map((k) => (
                  <li key={k.courseName}>
                    <span className={k.inArea ? "font-medium" : ""}>{k.courseName}</span>
                    <span className="block text-xs text-muted-foreground">{[k.credentialType, k.duration, k.accreditation].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => onChoose(c.instituteId, c.name)}
                className="mt-3 self-start rounded-lg border border-indigo-600 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
              >
                Ask {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function RequestDialog({
  apiFetch,
  to,
  hasQuizResult,
  onClose,
  onSent,
}: {
  apiFetch: ApiFetch;
  to: { kind: "edulexa" } | { kind: "institute"; id: string; name: string };
  hasQuizResult: boolean;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const formOwner = to.kind === "edulexa" ? COMMUNITY_INSTITUTE_ID : to.id;
  const recipient = to.kind === "edulexa" ? "Edulexa" : to.name;
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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [me, form] = await Promise.all([apiFetch("/api/me/overview"), apiFetch(`/api/quiz/counselling/guidance-form?instituteId=${formOwner}`)]);
        if (cancelled) return;
        if (me.ok) {
          const o = (await me.json()) as { profile?: { name?: string; email?: string } };
          setName((n) => n || realName(o.profile?.name));
          setEmail((e) => e || o.profile?.email || "");
        }
        if (form.ok) setQuestions(((await form.json()) as { questions: GuidanceQuestion[] }).questions);
      } catch {
        // the person types them in
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, formOwner]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    const common = { name: name.trim(), email: email.trim(), phone: phone.trim() || null };
    try {
      const res =
        to.kind === "edulexa"
          ? await apiFetch("/api/guidance/requests", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...common, question: unsure.trim(), answers: toAnswers(values), shareQuizResult: hasQuizResult && shareQuiz, consent }),
            })
          : await apiFetch("/api/quiz/counselling/refer-lead", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                instituteId: to.id,
                guidanceOnly: true,
                candidateName: common.name,
                candidateEmail: common.email,
                candidatePhone: common.phone,
                guidanceAnswers: toAnswers(values),
                notes: unsure.trim(),
                referralSource: "Ask an advisor",
                shareQuizResult: hasQuizResult && shareQuiz,
                consent,
              }),
            });
      const body = await res.json().catch(() => null);
      if (res.ok)
        onSent(
          to.kind === "edulexa"
            ? `Sent to Edulexa. We'll reply in Edulexa and by email at ${common.email}.`
            : `Sent to ${to.name}. An advisor will contact you at ${common.email}.`,
        );
      else if (res.status === 429 || res.status === 409) setError(body?.error ?? "You've sent several requests in a short time. Please try again later.");
      else setError(body?.error ?? "The request couldn't be sent. Please try again.");
    } catch {
      setError("We couldn't reach the server. Please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const title = useMemo(() => (to.kind === "edulexa" ? "Ask Edulexa" : `Ask ${to.name}`), [to]);
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={send} className="mt-4 space-y-4 text-sm">
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
        <GuidanceFields questions={questions} values={values} onChange={(id, v) => setValues((s) => ({ ...s, [id]: v }))} />
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
          <span>
            {to.kind === "edulexa"
              ? "Edulexa may use what I've written to help me. Nothing goes to an institute unless I approve it."
              : `Send this to ${recipient} so an advisor can contact me.`}
          </span>
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
          <button type="submit" disabled={!consent || sending} className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-500 disabled:opacity-60">
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

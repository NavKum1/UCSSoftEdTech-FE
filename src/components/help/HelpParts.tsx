"use client";

/**
 * S4 help center: the frame of the help pages (one place for every role, with the way back to where the reader was), who to
 * contact (school admins, teachers and career staff write to Edulexa support; students go to their own school first), and
 * "Was this helpful?". API: /api/help/contact, /api/help/support, /api/help/feedback.
 */
import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import BrandMark from "@/components/brand/BrandMark";
import { HeaderControls } from "@/components/layout/AccountMenu";
import { FRAME, PAGE_Y } from "@/components/layout/Frame";
import { getSelectedSchool, useApi, useAppAuth } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, ErrorBanner, Field } from "@/components/career/ui";
import { backPath, type HelpRole } from "@/lib/help";

export interface HelpContact {
  canWrite: boolean;
  audience: HelpRole | null;
  replyTime: string;
  school: { name: string; email: string | null } | null;
  email: string | null;
}

/** Calls to /api/help carry the school the reader picked, like the career suite's calls */
export function useHelpApi() {
  const api = useApi();
  return <T,>(path: string, init: RequestInit & { json?: unknown } = {}) => {
    const school = getSelectedSchool();
    const headers = new Headers(init.headers || {});
    if (school) headers.set("X-Career-Institute", school);
    return api<T>(path, { ...init, headers });
  };
}

/** Who the reader is for help (null while loading, or when signed out) */
export function useHelpContact(): HelpContact | null {
  const { isSignedIn } = useAppAuth();
  const call = useHelpApi();
  const [c, setC] = useState<HelpContact | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    let gone = false;
    call<HelpContact>("/api/help/contact").then((x) => !gone && setC(x)).catch(() => undefined);
    return () => { gone = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);
  return c;
}

export function HelpFrame({ from, children }: { from: string | null; children: React.ReactNode }) {
  const en = useEn();
  const back = backPath(from);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
        <div className={`${FRAME} flex h-14 items-center gap-3`}>
          <Link href={back ?? "/"} className="flex items-center gap-2" aria-label={en("Edulexa home")}>
            <BrandMark size={28} wordmark={false} />
          </Link>
          <Link href={back ? `/help?from=${encodeURIComponent(back)}` : "/help"} className="font-semibold">
            {en("Help center")}
          </Link>
          <div className="ms-auto flex items-center gap-3">
            {back && (
              <Link href={back} className="hidden items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex">
                <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
                {en("Back to where you were")}
              </Link>
            )}
            <HeaderControls />
          </div>
        </div>
      </header>
      <main id="help-main" className={`${FRAME} ${PAGE_Y}`}>
        {back && (
          <Link href={back} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:hidden">
            <ArrowLeft aria-hidden="true" className="h-4 w-4 rtl:rotate-180" />
            {en("Back to where you were")}
          </Link>
        )}
        {children}
      </main>
    </div>
  );
}

/** Still need help? Who to contact, and (for school admins, teachers and career staff) a short request to Edulexa support */
export function ContactPanel({ contact, page }: { contact: HelpContact | null; page: string | null }) {
  const en = useEn();
  const call = useHelpApi();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  if (!contact) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await call("/api/help/support", { method: "POST", json: { subject, message, page: backPath(page) ?? "" } });
      setSent(true);
    } catch (err) {
      setError(err instanceof TypeError ? en("We couldn't reach the server. Please check your connection and try again.") : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="help-contact" className="rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 id="help-contact" className="text-lg font-semibold">{en("Still need help?")}</h2>
      {contact.canWrite ? (
        sent ? (
          <p className="mt-3 flex items-start gap-2 text-sm" role="status">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {en("Sent to Edulexa support. We reply within two working days, by e-mail.")}
          </p>
        ) : (
          <form onSubmit={send} className="mt-3 space-y-3">
            <p className="text-sm text-muted-foreground">
              {en("Write to Edulexa support. We see the page you came from, and we reply within two working days, by e-mail.")}
            </p>
            <Field label={en("What it's about")}>
              {(p) => <input {...p} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required />}
            </Field>
            <Field label={en("What happened, and what you expected")}>
              {(p) => <textarea {...p} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} required />}
            </Field>
            <ErrorBanner error={error} />
            <Button type="submit" busy={busy} disabled={!subject.trim() || message.trim().length < 10}>
              {en("Send to support")}
            </Button>
          </form>
        )
      ) : contact.school ? (
        <p className="mt-3 text-sm leading-6">
          {contact.school.email
            ? en("Your school helps first. Write to {school} at", { school: contact.school.name || en("your school") })
            : en("Your school helps first: ask your teacher or your career center.")}{" "}
          {contact.school.email && <a className="font-medium underline underline-offset-2" href={`mailto:${contact.school.email}`}>{contact.school.email}</a>}
        </p>
      ) : contact.email ? (
        <p className="mt-3 text-sm leading-6">
          {en("Write to us at")}{" "}
          <a className="font-medium underline underline-offset-2" href={`mailto:${contact.email}`}>{contact.email}</a>
        </p>
      ) : null}
    </section>
  );
}

/** Was this helpful? (one answer per article in this browser; the API keeps only daily totals) */
export function HelpFeedback({ slug }: { slug: string }) {
  const en = useEn();
  const { isSignedIn } = useAppAuth();
  const call = useHelpApi();
  const key = `help-feedback:${slug}`;
  // Answered before in this browser (read on the client only; a private window has no storage)
  const before = useSyncExternalStore(
    () => () => {},
    () => { try { return localStorage.getItem(key) != null; } catch { return false; } },
    () => false,
  );
  const [justAnswered, setJustAnswered] = useState(false);
  const answered = before || justAnswered;
  if (!isSignedIn) return null;
  const answer = (helpful: boolean) => {
    setJustAnswered(true);
    try { localStorage.setItem(key, helpful ? "yes" : "no"); } catch { /* private window */ }
    void call("/api/help/feedback", { method: "POST", json: { slug, helpful } }).catch(() => undefined);
  };
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5 text-sm">
      {answered ? (
        <p role="status" className="text-muted-foreground">{en("Thanks for telling us.")}</p>
      ) : (
        <>
          <span className="font-medium">{en("Was this helpful?")}</span>
          <Button variant="secondary" onClick={() => answer(true)}>{en("Yes")}</Button>
          <Button variant="secondary" onClick={() => answer(false)}>{en("No")}</Button>
        </>
      )}
    </div>
  );
}

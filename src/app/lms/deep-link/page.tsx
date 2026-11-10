"use client";

/**
 * Build & Defend 1.0, 2.10: a teacher adds an Edulexa class assessment to their course, from inside the LMS (LTI Deep
 * Linking). The API's /api/lti/launch sends the teacher's browser here with #token=...&request=...&course=... after a
 * deep-linking launch. The page lists the class assessments of the classes they teach, and the one they pick goes back
 * to the LMS as a signed response (posted to the LMS's return address), which adds it with a gradebook column out of
 * 100. The token is used for these two calls only and isn't kept. API: /api/lti/deep-link/{request}[/respond].
 */
import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Check, GraduationCap } from "lucide-react";
import { brandFill, buttonClass, formatDate } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface Choice {
  assignmentId: string;
  assessmentId: string;
  assessment: string;
  className: string;
  dueAt: string;
  linked: boolean;
}

interface Picked {
  returnUrl: string;
  jwt: string;
  assessment: string;
}

async function call<T>(path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? data?.message ?? `The request failed (${res.status}).`);
  return data as T;
}

export default function LmsDeepLinkPage() {
  const en = useEn();
  const [ctx, setCtx] = useState<{ token: string; request: string; course: string | null } | null>(null);
  const [choices, setChoices] = useState<Choice[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const form = useRef<HTMLFormElement>(null);
  // Read once: the address bar is cleared straight after (a second run would find no token)
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // Remove the token from the address bar and history before doing anything else
    window.history.replaceState(null, "", window.location.pathname);
    const token = params.get("token");
    const request = params.get("request");
    if (!token || !request) {
      queueMicrotask(() => setError(en("This page is opened from your course, when you add an activity from Edulexa. Start again from there.")));
      return;
    }
    queueMicrotask(() => setCtx({ token, request, course: params.get("course") }));
    call<{ choices: Choice[] }>(`/api/lti/deep-link/${request}`, token)
      .then((r) => {
        setChoices(r.choices);
        if (r.choices.length === 1) setSelected(r.choices[0].assignmentId);
      })
      .catch((e: Error) => setError(e.message));
  }, [en]);

  // Once the response is ready, the browser posts it to the LMS (the LMS adds the activity and its gradebook column)
  useEffect(() => {
    if (picked) form.current?.submit();
  }, [picked]);

  const add = async () => {
    if (!ctx || !selected) return;
    setBusy(true);
    setError(null);
    try {
      setPicked(await call<Picked>(`/api/lti/deep-link/${ctx.request}/respond`, ctx.token, { assignmentId: selected }));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-4 py-8">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <GraduationCap aria-hidden="true" className="h-4 w-4" />
          {en("From your course")}
        </p>
        <h1 className="mt-2 text-xl font-semibold">{en("Add a class assessment to your course")}</h1>
        {ctx?.course && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <BookOpen aria-hidden="true" className="h-3.5 w-3.5" />
            {ctx.course}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}

        {picked ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {en("Adding \"{assessment}\" to your course…", { assessment: picked.assessment })}
          </p>
        ) : choices === null && !error ? (
          <p role="status" className="mt-4 text-sm text-muted-foreground">
            {en("Loading your class assessments…")}
          </p>
        ) : choices && choices.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {en("There's no published class assessment for the classes you teach. Create one in Edulexa and give it to a class, then add it here. Your email in this course has to match your Edulexa account at the school.")}
          </p>
        ) : choices ? (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              {en("Students open it from the course. When you decide, the score and your comment go to the course's gradebook, out of 100.")}
            </p>
            <fieldset className="mt-4 space-y-2">
              <legend className="sr-only">{en("Your class assessments")}</legend>
              {choices.map((c) => (
                <label
                  key={c.assignmentId}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 " +
                    (selected === c.assignmentId ? "border-[var(--brand,#0e7490)] bg-[var(--brand,#0e7490)]/5" : "border-border hover:bg-muted/40")
                  }
                >
                  <input type="radio" name="assessment" value={c.assignmentId} checked={selected === c.assignmentId} onChange={() => setSelected(c.assignmentId)} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{c.assessment}</span>
                    <span className="block text-sm text-muted-foreground">
                      {c.className ? en("{className}, due {when}", { className: c.className, when: formatDate(c.dueAt, true) }) : en("Due {when}", { when: formatDate(c.dueAt, true) })}
                    </span>
                    {c.linked && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Check aria-hidden="true" className="h-3.5 w-3.5" />
                        {en("Already in a course")}
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </fieldset>
            <button type="button" disabled={!selected || busy} onClick={() => void add()} className={`${buttonClass("primary")} mt-6 w-full`} style={brandFill}>
              {busy ? en("Adding…") : en("Add to the course")}
            </button>
          </>
        ) : null}

        {picked && (
          <form ref={form} method="post" action={picked.returnUrl} className="hidden">
            <input type="hidden" name="JWT" value={picked.jwt} />
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * The Edulexa advisors' desk: guidance requests to Edulexa. Advisors reply (or add staff-only notes), hand a request to a
 * community mentor when they're stretched, suggest an institute (the person approves before it gets anything), and mark
 * requests resolved. Replies reach the person in Edulexa and by email.
 */

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AccessNotice, useLatestRef, useLegacyApi } from "@/lib/legacyApi";
import { Messages, ReplyBox, RequestDetails, STATUS_LABEL, type GuidanceRequestView } from "@/components/guidance/Conversation";

interface Row {
  id: string;
  name: string;
  email: string;
  question: string;
  status: string;
  lastActivityAt: string;
  mentor: string | null;
  quizShared: boolean;
}
interface Mentor {
  id: string;
  name: string;
  headline: string;
  jobTitle: string | null;
  employer: string | null;
}
interface Institute {
  id: string;
  name: string;
}

const FILTERS = ["", "Open", "WithMentor", "Answered", "InstituteSuggested", "SentToInstitute", "Resolved"];
const card = "rounded-2xl border border-border bg-card p-4";
const select = "rounded-lg border border-border bg-background px-2 py-1.5 text-sm";

export default function AdvisorDeskPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />}>
      <AdvisorDesk />
    </Suspense>
  );
}

function AdvisorDesk() {
  const { apiFetch, ready, access } = useLegacyApi();
  const params = useSearchParams();
  const [filter, setFilter] = useState("Open");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [open, setOpen] = useState<string | null>(params.get("request"));
  const [item, setItem] = useState<GuidanceRequestView | null>(null);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [mentorPick, setMentorPick] = useState("");
  const [institutePick, setInstitutePick] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const loadList = useCallback(async () => {
    const res = await apiFetch(`/api/guidance/desk${filter ? `?status=${filter}` : ""}`, {}, { quiet: true });
    if (res.status === 403) return setForbidden(true);
    setRows(res.ok ? ((await res.json()) as Row[]) : []);
  }, [apiFetch, filter]);
  const loadItem = useCallback(async () => {
    if (!open) return setItem(null);
    const res = await apiFetch(`/api/guidance/desk/${open}`, {}, { quiet: true });
    setItem(res.ok ? ((await res.json()) as GuidanceRequestView) : null);
  }, [apiFetch, open]);
  const listRef = useLatestRef(loadList);
  const itemRef = useLatestRef(loadItem);
  useEffect(() => {
    if (ready) void listRef.current();
  }, [ready, filter, listRef]);
  useEffect(() => {
    if (ready) void itemRef.current();
  }, [ready, open, itemRef]);
  useEffect(() => {
    if (!ready) return;
    void Promise.all([apiFetch("/api/guidance/desk/mentors", {}, { quiet: true }), apiFetch("/api/guidance/desk/institutes", {}, { quiet: true })]).then(async ([m, i]) => {
      if (m.ok) setMentors((await m.json()) as Mentor[]);
      if (i.ok) setInstitutes((await i.json()) as Institute[]);
    });
  }, [ready, apiFetch]);

  const act = async (path: string, body: unknown) => {
    setError(null);
    const res = await apiFetch(`/api/guidance/desk/${open}/${path}`, { method: "POST", body: JSON.stringify(body) });
    if (!res.ok) {
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
      return false;
    }
    setItem((await res.json()) as GuidanceRequestView);
    await loadList();
    return true;
  };

  if (access) return <AccessNotice problem={access} feature="the advisors' desk" />;
  if (forbidden) return <AccessNotice problem="forbidden" feature="the advisors' desk" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <section aria-labelledby="desk-list" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h1 id="desk-list" className="text-lg font-semibold">
            Guidance requests
          </h1>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className={select} aria-label="Show">
            {FILTERS.map((f) => (
              <option key={f} value={f}>
                {f ? STATUS_LABEL[f] : "All"}
              </option>
            ))}
          </select>
        </div>
        {!rows ? (
          <div className="h-40 animate-pulse rounded-2xl bg-muted motion-reduce:animate-none" aria-busy="true" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpen(r.id)}
                  aria-current={open === r.id ? "true" : undefined}
                  className={`w-full rounded-xl border p-3 text-left text-sm ${open === r.id ? "border-indigo-500 bg-indigo-500/5" : "border-border hover:bg-muted/50"}`}
                >
                  <span className="flex justify-between gap-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(r.lastActivityAt).toLocaleDateString()}</span>
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-muted-foreground">{r.question}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {STATUS_LABEL[r.status] ?? r.status}
                    {r.mentor ? ` · ${r.mentor}` : ""}
                    {r.quizShared ? " · quiz shared" : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Request" className="space-y-4">
        {!item ? (
          <p className="text-sm text-muted-foreground">Choose a request.</p>
        ) : (
          <>
            <div className={card}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {item.email}
                    {item.phone ? ` · ${item.phone}` : ""} · {STATUS_LABEL[item.status] ?? item.status}
                    {item.mentor ? ` · with ${item.mentor}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void act("status", { status: item.status === "Resolved" ? "Open" : "Resolved" })}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  {item.status === "Resolved" ? "Reopen" : "Mark resolved"}
                </button>
              </div>
              <div className="mt-3">
                <RequestDetails r={item} files />
              </div>
            </div>

            {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}

            <div className="grid gap-4 md:grid-cols-2">
              <div className={card}>
                <h3 className="text-sm font-semibold">Hand to a community mentor</h3>
                <p className="text-xs text-muted-foreground">When you&apos;re stretched: they reply in Edulexa or by email.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select value={mentorPick} onChange={(e) => setMentorPick(e.target.value)} className={select} aria-label="Mentor">
                    <option value="">{mentors.length ? "Choose a mentor" : "No mentors yet"}</option>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                        {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" disabled={!mentorPick} onClick={() => void act("mentor", { mentorProfileId: mentorPick })} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50">
                    Hand over
                  </button>
                  {item.mentor && (
                    <button type="button" onClick={() => void act("mentor", { mentorProfileId: null })} className="rounded-lg px-3 py-1.5 text-sm hover:bg-muted">
                      Take back
                    </button>
                  )}
                </div>
              </div>
              <div className={card}>
                <h3 className="text-sm font-semibold">Suggest an institute</h3>
                <p className="text-xs text-muted-foreground">The person decides. Nothing is sent unless they approve.</p>
                <div className="mt-2 space-y-2">
                  <select value={institutePick} onChange={(e) => setInstitutePick(e.target.value)} className={`${select} w-full`} aria-label="Institute">
                    <option value="">Choose an institute</option>
                    {institutes.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="Why this institute (optional)" className={`${select} w-full`} />
                  <button
                    type="button"
                    disabled={!institutePick || item.sentToInstitute}
                    onClick={async () => {
                      if (await act("suggest", { instituteId: institutePick, note })) setNote("");
                    }}
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    Suggest
                  </button>
                </div>
              </div>
            </div>

            <div className={`${card} space-y-4`}>
              <Messages messages={item.messages} />
              <ReplyBox allowInternal onSend={(body, internal) => act("messages", { body, internal })} />
              {!item.replyByEmail && <p className="text-xs text-muted-foreground">Reply-by-email isn&apos;t set up, so people reply in Edulexa.</p>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

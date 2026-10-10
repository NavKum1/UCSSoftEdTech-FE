"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { ThreadList, ThreadView, type ThreadRow } from "@/components/career/messaging/shared";
import CampaignsPanel from "@/components/career/messaging/CampaignsPanel";

type Tab = "inbox" | "campaigns" | "reports";
const FILTERS = [
  ["open", "All open"],
  ["unassigned", "Unassigned"],
  ["mine", "Assigned to me"],
  ["closed", "Closed"],
  ["all", "Everything"],
] as const;

function CareerCenterMessages() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = (params.get("tab") as Tab) || "inbox";
  const setTab = (t: Tab) => router.replace(`/career-center/messages?tab=${t}`);
  const tabs: [Tab, string][] = [
    ["inbox", "Inbox"],
    ["campaigns", "Campaigns"],
    ["reports", "Reports"],
  ];
  return (
    <div>
      <PageHeader title="Messages & campaigns" description="The shared career-center inbox for conversations with your students, plus announcements to groups of students and alumni." />
      <div role="tablist" aria-label="Messages sections" className="mb-6 flex gap-1 border-b border-border">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium focus-visible:outline-2 ${tab === key ? "border-[var(--brand,#4f46e5)]" : "border-transparent text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{tab === "campaigns" ? <CampaignsPanel /> : tab === "reports" ? <Reports /> : <Inbox />}</div>
    </div>
  );
}

function Inbox() {
  const api = useApi();
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("thread");
  const [filter, setFilter] = useState<string>("open");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useLoad(
    () => api<ThreadRow[]>(`/api/career/messaging/staff/threads?filter=${filter}${search ? `&q=${encodeURIComponent(search)}` : ""}`),
    [filter, search],
  );
  const [composing, setComposing] = useState(false);
  const select = (id: string | null) => router.replace(id ? `/career-center/messages?tab=inbox&thread=${id}` : "/career-center/messages?tab=inbox");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Show">
          {(p) => (
            <select {...p} value={filter} onChange={(e) => setFilter(e.target.value)}>
              {FILTERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </Field>
        <form
          role="search"
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <Field label="Search subject, student or text">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
        <div className="ml-auto">
          <Button onClick={() => setComposing(!composing)}>{composing ? "Cancel" : "Message a student"}</Button>
        </div>
      </div>
      {composing && (
        <Compose
          onSent={(id) => {
            setComposing(false);
            reload();
            select(id);
          }}
        />
      )}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <ErrorBanner error={error} onRetry={reload} />
          {loading && !data ? <Loading /> : data && data.length > 0 ? <ThreadList threads={data} selected={selected} onSelect={select} showStudent /> : <EmptyState title="No conversations here" />}
        </div>
        <div>{selected ? <ThreadView threadId={selected} onChanged={reload} /> : <EmptyState title="Choose a conversation" />}</div>
      </div>
    </div>
  );
}

function Compose({ onSent }: { onSent: (id: string) => void }) {
  const api = useApi();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ userId: string; name: string; email: string; role: string }[] | null>(null);
  const [student, setStudent] = useState<{ userId: string; name: string } | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const find = async () => {
    setError(null);
    try {
      setResults(await api(`/api/career/messaging/staff/students?q=${encodeURIComponent(q)}`));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("studentUserId", student.userId);
      form.append("subject", subject);
      form.append("body", body);
      if (file) form.append("file", file);
      const res = await api<{ id: string }>("/api/career/messaging/staff/threads", { method: "POST", body: form });
      onSent(res.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="New message to a student" className="mb-6">
      <ErrorBanner error={error} />
      {!student ? (
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <Field label="Find a student or alumnus (name, email or student number)">
              {(p) => (
                <input
                  {...p}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      find();
                    }
                  }}
                />
              )}
            </Field>
            <Button type="button" variant="secondary" onClick={find}>
              Find
            </Button>
          </div>
          {results && (
            <ul role="status" className="divide-y divide-border rounded-md border border-border">
              {results.length === 0 && <li className="p-3 text-sm text-muted-foreground">No one found.</li>}
              {results.map((r) => (
                <li key={r.userId}>
                  <button type="button" className="w-full p-3 text-left text-sm hover:bg-muted" onClick={() => setStudent(r)}>
                    {r.name} <span className="text-muted-foreground">({r.email}, {r.role})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <form onSubmit={send} className="space-y-3">
          <p className="text-sm">
            To <strong>{student.name}</strong>{" "}
            <button type="button" className="underline" onClick={() => setStudent(null)}>
              change
            </button>
          </p>
          <Field label="Subject">{(p) => <input {...p} required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
          <Field label="Message">{(p) => <textarea {...p} required rows={5} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
          <Field label="Attachment (optional)">{(p) => <input {...p} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}</Field>
          <Button type="submit" busy={busy}>
            Send
          </Button>
        </form>
      )}
    </Card>
  );
}

interface ReportRow {
  id: string;
  threadId: string;
  reason: string;
  details?: string | null;
  status: string;
  createdAt: string;
  reporter: string;
  resolutionNote?: string | null;
  thread: { subject: string; kind: string; studentName: string; mentorName?: string | null } | null;
  post: { authorName: string; body: string; createdAt: string } | null;
}

function Reports() {
  const api = useApi();
  const router = useRouter();
  const [status, setStatus] = useState("Open");
  const { data, error, loading, reload } = useLoad(() => api<ReportRow[]>(`/api/career/messaging/staff/reports?status=${status}`), [status]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Field label="Status">
        {(p) => (
          <select {...p} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option>Open</option>
            <option>Resolved</option>
          </select>
        )}
      </Field>
      <div aria-live="polite">
        <ErrorBanner error={actionError ?? error} />
        <SuccessBanner message={msg} />
      </div>
      {loading && !data ? (
        <Loading />
      ) : data && data.length > 0 ? (
        data.map((r) => (
          <Card key={r.id} title={`${r.reason}: ${r.thread?.subject ?? "Conversation"}`}>
            <p className="text-sm text-muted-foreground">
              Reported by {r.reporter} on {formatDate(r.createdAt, true)} · {r.thread?.kind === "Mentorship" ? `Mentorship (${r.thread.mentorName} / ${r.thread.studentName})` : `Career center (${r.thread?.studentName})`}{" "}
              <Badge tone={r.status === "Open" ? "warn" : "good"}>{r.status}</Badge>
            </p>
            {r.details && <p className="mt-2 text-sm">{r.details}</p>}
            {r.post && (
              <blockquote className="mt-2 border-l-4 border-border pl-3 text-sm">
                <span className="text-xs text-muted-foreground">
                  {r.post.authorName}, {formatDate(r.post.createdAt, true)}
                </span>
                <p className="whitespace-pre-wrap">{r.post.body}</p>
              </blockquote>
            )}
            <div className="mt-3 flex flex-wrap items-end gap-2">
              {r.thread && (
                <Button variant="secondary" onClick={() => router.replace(`/career-center/messages?tab=inbox&thread=${r.threadId}`)}>
                  {r.thread.kind === "Mentorship" ? "Read conversation" : "Open conversation"}
                </Button>
              )}
              {r.status === "Open" && (
                <>
                  <Field label="Resolution note">{(p) => <input {...p} value={notes[r.id] ?? ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />}</Field>
                  <Button
                    onClick={() =>
                      api(`/api/career/messaging/staff/reports/${r.id}/resolve`, { json: { note: notes[r.id] ?? "" } })
                        .then(() => {
                          setMsg("Report resolved.");
                          reload();
                        })
                        .catch((e: Error) => setActionError(e.message))
                    }
                  >
                    Mark resolved
                  </Button>
                </>
              )}
              {r.resolutionNote && <p className="text-sm text-muted-foreground">Resolution: {r.resolutionNote}</p>}
            </div>
            {r.thread?.kind === "Mentorship" && <p className="mt-2 text-xs text-muted-foreground">Staff can read, not answer, a reported mentorship conversation. Use the mentoring page to suspend or end the mentorship.</p>}
          </Card>
        ))
      ) : (
        <EmptyState title="No reports" />
      )}
    </div>
  );
}

export default function CareerCenterMessagesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <CareerCenterMessages />
    </Suspense>
  );
}

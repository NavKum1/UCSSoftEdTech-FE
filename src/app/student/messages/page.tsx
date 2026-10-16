"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApi } from "@/lib/appAuth";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
import { ThreadList, ThreadView, type ThreadRow } from "@/components/career/messaging/shared";

function StudentMessages() {
  const t = useCareerT("studentMessages");
  const api = useApi();
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("thread");
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, loading, reload } = useLoad(() => api<ThreadRow[]>(`/api/career/messaging/student/threads${search ? `?q=${encodeURIComponent(search)}` : ""}`), [search]);
  const [composing, setComposing] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const select = (id: string | null) => router.replace(id ? `/student/messages?thread=${id}` : "/student/messages");

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setComposeError(null);
    try {
      const form = new FormData();
      form.append("subject", subject);
      form.append("body", body);
      if (file) form.append("file", file);
      const res = await api<{ id: string }>("/api/career/messaging/student/threads", { method: "POST", body: form });
      setSubject("");
      setBody("");
      setFile(null);
      setComposing(false);
      setMsg(t("messageSentToYourCareer"));
      reload();
      select(res.id);
    } catch (err) {
      setComposeError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("messages")}
        description={t("privateConversationsWithYourCareer")}
        actions={<Button onClick={() => setComposing(!composing)}>{composing ? t("cancel") : t("messageTheCareerCenter")}</Button>}
      />
      <div aria-live="polite">
        <SuccessBanner message={msg} />
      </div>
      {composing && (
        <Card title={t("newMessageToTheCareer")} className="mb-6">
          <form onSubmit={start} className="space-y-3">
            <ErrorBanner error={composeError} />
            <Field label={t("subject")}>{(p) => <input {...p} required maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />}</Field>
            <Field label={t("message")}>{(p) => <textarea {...p} required rows={5} maxLength={10000} value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
            <Field label={t("attachmentOptional")} hint={t("pDFWordPNGJPEGOr")}>
              {(p) => <input {...p} type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
            </Field>
            <Button type="submit" busy={busy}>
              {t("send")}
            </Button>
          </form>
        </Card>
      )}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="space-y-3">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(q.trim());
            }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <Field label={t("searchMessages")}>{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
            </div>
            <Button type="submit" variant="secondary">
              {t("search")}
            </Button>
          </form>
          <ErrorBanner error={error} onRetry={reload} />
          {loading && !data ? (
            <Loading />
          ) : data && data.length > 0 ? (
            <ThreadList threads={data} selected={selected} onSelect={select} />
          ) : (
            <EmptyState title={search ? t("noConversationsMatch") : t("noConversationsYet")}>{!search && t("startOneWithTheButton")}</EmptyState>
          )}
        </div>
        <div>{selected ? <ThreadView threadId={selected} onChanged={reload} /> : <EmptyState title={t("chooseAConversation")} />}</div>
      </div>
    </div>
  );
}

export default function StudentMessagesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StudentMessages />
    </Suspense>
  );
}

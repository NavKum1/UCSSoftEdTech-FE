"use client";

/** Shared notifications page for every career-suite persona: list, mark read, per-category preferences. */

import React, { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { NonEssential, useDataSaver, useListSize } from "@/components/career/mobile/dataSaver";
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, PageHeader, SuccessBanner, useLoad, ScrollArea, useCareerFormat, useCareerT } from "@/components/career/ui";

export interface CareerNotificationItem {
  id: string;
  category: string;
  title: string;
  body: string;
  link?: string | null;
  createdAt: string;
  readAt?: string | null;
}

interface Preference {
  category: string;
  inApp: boolean;
  email: boolean;
}

// Readable name for a category such as "appointments.booked"; a message under notifications.category
// ("appointments_booked") replaces the generated English one
function generatedLabel(category: string) {
  const text = category.replace(/[._-]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function NotificationsPage() {
  const api = useApi();
  const t = useCareerT("notifications");
  const tMobile = useCareerT("mobile");
  const fmt = useCareerFormat();
  const categoryLabel = (category: string) => {
    const key = `category.${category.replace(/./g, "_")}`;
    return t.has(key) ? t(key) : generatedLabel(category);
  };
  // G10 data saver: fewer items, and the settings table loads only when asked for
  const take = useListSize(100, 25);
  const saver = useDataSaver().on;
  const [prefsWanted, setPrefsWanted] = useState(false);
  const loadPrefs = !saver || prefsWanted;
  const list = useLoad(() => api<{ unread: number; items: CareerNotificationItem[] }>(`/api/career/notifications?take=${take}`), [api, take]);
  const prefs = useLoad(() => (loadPrefs ? api<Preference[]>("/api/career/notifications/preferences") : Promise.resolve(null)), [api, loadPrefs]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const items = list.data?.items ?? [];
  const unread = list.data?.unread ?? 0;

  const markRead = async (n: CareerNotificationItem) => {
    setBusy(n.id);
    setError(null);
    try {
      await api(`/api/career/notifications/${n.id}/read`, { method: "POST" });
      list.setData((d) => (d ? { unread: Math.max(0, d.unread - 1), items: d.items.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) } : d));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const markAll = async () => {
    setBusy("all");
    setError(null);
    try {
      const r = await api<{ marked: number }>("/api/career/notifications/read-all", { method: "POST" });
      setMessage(t("markedRead", { count: r.marked }));
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  // Categories the user has seen or already configured
  const categories = Array.from(new Set([...items.map((n) => n.category), ...(prefs.data ?? []).map((p) => p.category)])).sort();
  const prefFor = (c: string): Preference => prefs.data?.find((p) => p.category === c) ?? { category: c, inApp: true, email: true };

  const setPref = async (c: string, change: Partial<Preference>) => {
    const next = { ...prefFor(c), ...change };
    setBusy(`pref:${c}`);
    setError(null);
    try {
      const saved = await api<Preference>("/api/career/notifications/preferences", { method: "PUT", json: next });
      prefs.setData((d) => [...(d ?? []).filter((p) => p.category !== c), saved]);
      setMessage(t("prefsSaved", { kind: categoryLabel(c) }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={unread ? t("unreadSummary", { count: unread }) : t("allCaughtUp")}
        actions={
          <Button variant="secondary" onClick={markAll} busy={busy === "all"} disabled={unread === 0}>
            {t("markAllRead")}
          </Button>
        }
      />
      <ErrorBanner error={error ?? list.error} onRetry={list.error ? list.reload : undefined} />
      <SuccessBanner message={message} />

      {list.loading && !list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState title={t("emptyTitle")}>{t("emptyBody")}</EmptyState>
      ) : (
        <ul className="space-y-2" aria-label={t("listLabel")}>
          {items.map((n) => {
            const isUnread = !n.readAt;
            return (
              <li
                key={n.id}
                className={`rounded-xl border p-4 ${isUnread ? "border-s-4 bg-card" : "border-border bg-background"}`}
                style={isUnread ? { borderInlineStartColor: "var(--brand, #4f46e5)" } : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={isUnread ? "font-semibold" : "font-medium"}>
                      {isUnread && <span className="sr-only">{t("unreadPrefix")}</span>}
                      {n.title}
                    </p>
                    {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                    <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge tone={isUnread ? "info" : "neutral"}>{isUnread ? t("badgeNew") : t("badgeRead")}</Badge>
                      <span>{categoryLabel(n.category)}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={n.createdAt}>{fmt.dateTime(n.createdAt)}</time>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {n.link && n.link.startsWith("/") && (
                      <Link href={n.link} className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted" onClick={() => isUnread && markRead(n)}>
                        {t("open")}
                      </Link>
                    )}
                    {isUnread && (
                      <Button variant="ghost" onClick={() => markRead(n)} busy={busy === n.id}>
                        {t("markRead")}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <NonEssential name={tMobile("notificationPrefs")} onLoad={() => setPrefsWanted(true)}>
      <Card title={t("prefsTitle")} className="mt-8">
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("prefsEmpty")}</p>
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("prefsCaption")}</caption>
              <thead>
                <tr className="border-b border-border text-start [&_th]:text-start">
                  <th scope="col" className="py-2 pe-4 font-medium">{t("colKind")}</th>
                  <th scope="col" className="py-2 pe-4 font-medium">{t("colInApp")}</th>
                  <th scope="col" className="py-2 font-medium">{t("colEmail")}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => {
                  const p = prefFor(c);
                  const label = categoryLabel(c);
                  return (
                    <tr key={c} className="border-b border-border last:border-0">
                      <th scope="row" className="py-2 pe-4 text-start font-normal">{label}</th>
                      <td className="py-2 pe-4">
                        <input type="checkbox" className="h-4 w-4" aria-label={t("showInApp", { kind: label })} checked={p.inApp} disabled={busy === `pref:${c}`} onChange={(e) => setPref(c, { inApp: e.target.checked })} />
                      </td>
                      <td className="py-2">
                        <input type="checkbox" className="h-4 w-4" aria-label={t("sendEmail", { kind: label })} checked={p.email} disabled={busy === `pref:${c}`} onChange={(e) => setPref(c, { email: e.target.checked })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>
      </NonEssential>
    </div>
  );
}

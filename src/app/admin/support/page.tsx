"use client";

/**
 * S4 help center (docs/s4_help_center_plan.md), for Edulexa staff: the support requests school admins, teachers and career
 * staff sent from the help center (each was also e-mailed to the support address; reply from the inbox), and the last 90
 * days of help totals: which articles weren't helpful, and what people searched for and didn't find. API: /api/admin/support.
 */
import React from "react";
import Link from "next/link";
import { useApi } from "@/lib/appAuth";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Card, EmptyState, ErrorBanner, formatDate, Loading, PageHeader, ScrollArea, useLoad } from "@/components/career/ui";

interface SupportData {
  supportEmail: string;
  requests: { id: string; createdAt: string; name: string; email: string; role: string; school: string; page: string; subject: string; message: string; emailed: boolean }[];
  feedback: { slug: string; helpful: number; notHelpful: number }[];
  misses: { query: string; count: number }[];
}

export default function AdminSupportPage() {
  const en = useEn();
  const api = useApi();
  const data = useLoad(() => api<SupportData>("/api/admin/support"), [api]);
  if (data.loading) return <Loading />;
  if (!data.data) return <ErrorBanner error={data.error ?? en("Support couldn't be loaded.")} onRetry={data.reload} />;
  const d = data.data;

  return (
    <div>
      <PageHeader
        title={en("Support")}
        description={en("Requests from the help center (each was also e-mailed to {email}; reply from there), and what the help center is missing.", { email: d.supportEmail })}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          {d.requests.length === 0 ? (
            <EmptyState title={en("No support requests yet")}>{en("Requests sent from the help center appear here.")}</EmptyState>
          ) : (
            d.requests.map((r) => (
              <Card key={r.id} title={r.subject}>
                <div className="space-y-2 text-sm">
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                    <span>{formatDate(r.createdAt, true)}</span>
                    <a href={`mailto:${r.email}?subject=${encodeURIComponent("Re: " + r.subject)}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                      {r.name || r.email}
                    </a>
                    <span>{r.role}</span>
                    {r.school && <span>{r.school}</span>}
                    {!r.emailed && <Badge tone="warn">{en("E-mail not sent")}</Badge>}
                  </p>
                  {r.page && <p className="text-xs text-muted-foreground">{en("From the page")} <span className="font-mono" dir="ltr">{r.page}</span></p>}
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{r.message}</p>
                </div>
              </Card>
            ))
          )}
        </div>
        <div className="min-w-0 space-y-6">
          <Card title={en("Was this helpful? (90 days)")}>
            {d.feedback.length === 0 ? (
              <p className="text-sm text-muted-foreground">{en("No answers yet.")}</p>
            ) : (
              <ScrollArea>
                <table className="w-full text-sm [&_th]:text-start">
                  <caption className="sr-only">{en("Answers per article")}</caption>
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-1.5 pe-2 font-medium">{en("Article")}</th>
                      <th scope="col" className="pe-2 text-end font-medium">{en("Yes")}</th>
                      <th scope="col" className="text-end font-medium">{en("No")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.feedback.map((f) => (
                      <tr key={f.slug} className="border-b border-border/60">
                        <td className="py-1.5 pe-2"><Link href={`/help/${f.slug}`} className="underline-offset-2 hover:underline">{f.slug}</Link></td>
                        <td className="pe-2 text-end tabular-nums">{f.helpful}</td>
                        <td className="text-end tabular-nums">{f.notHelpful}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </Card>
          <Card title={en("Searches that found nothing (90 days)")}>
            {d.misses.length === 0 ? (
              <p className="text-sm text-muted-foreground">{en("None yet.")}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {d.misses.map((m) => (
                  <li key={m.query} className="flex justify-between gap-3">
                    <span className="[overflow-wrap:anywhere]">{m.query}</span>
                    <span className="tabular-nums text-muted-foreground">{m.count}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-muted-foreground">{en("Counted without the person or school; words with @ or digits are left out.")}</p>
          </Card>
        </div>
      </div>
    </div>
  );
}

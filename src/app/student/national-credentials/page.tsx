"use client";

/**
 * A student's national credentials (G6): their APAAR ID, consent per national repository (given and revoked here,
 * explicitly, one repository at a time), and the documents published for them, with a PDF preview.
 */

import React, { useState } from "react";
import { FileDown } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  PageHeader,
  ScrollArea,
  SuccessBanner,
  useCareerFormat,
  useCareerT,
  useLoad,
} from "@/components/career/ui";
import { saveResponse } from "@/components/career/billing/money";

interface Overview {
  apaarId?: string | null;
  apaarSource?: string | null;
  apaarNotice: string;
  repositories: { provider: string; name: string; recipient: string; consented: boolean; consentedAt?: string | null }[];
  items: { sourceType: string; sourceId: string; title: string; completedAt?: string | null }[];
  documents: {
    id: string;
    provider: string;
    sourceType: string;
    sourceId: string;
    docNumber: string;
    title: string;
    status: string;
    publishedAt: string;
    withdrawnAt?: string | null;
    withdrawReason?: string | null;
    lastPulledAt?: string | null;
    pullCount: number;
  }[];
}

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";

export default function StudentNationalCredentialsPage() {
  const t = useCareerT("myNationalCredentials");
  const fmt = useCareerFormat();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const data = useLoad(() => api<Overview>("/api/career/national-credentials/me"), [api, schoolId]);

  const [apaar, setApaar] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [apaarError, setApaarError] = useState<string | null>(null);

  const [shown, setShown] = useState<Overview | null>(null);
  if (data.data && data.data !== shown) {
    setShown(data.data);
    setApaar(data.data.apaarId ?? "");
  }

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveApaar = (e: React.FormEvent) => {
    e.preventDefault();
    const value = apaar.replace(/\s+/g, "");
    if (value && !/^\d{12}$/.test(value)) {
      setApaarError(t("apaarInvalid"));
      return;
    }
    setApaarError(null);
    run("apaar", async () => {
      await api("/api/career/national-credentials/me/apaar", { method: "PUT", json: { apaarId: value || null } });
      data.reload();
      setMessage(value ? t("apaarSaved") : t("apaarRemoved"));
    });
  };

  const consent = (provider: string, name: string, give: boolean) => {
    if (!give && !window.confirm(t("revokeConfirm", { name }))) return;
    run(`consent-${provider}`, async () => {
      const res = await api<{ withdrawn?: number }>(`/api/career/national-credentials/me/consent/${encodeURIComponent(provider)}`, { method: give ? "POST" : "DELETE" });
      data.reload();
      setMessage(give ? t("consentGiven", { name }) : t("consentRevoked", { name, count: res?.withdrawn ?? 0 }));
    });
  };

  const publish = (item: Overview["items"][number], provider: string, name: string) =>
    run(`publish-${item.sourceId}-${provider}`, async () => {
      await api("/api/career/national-credentials/me/documents", { method: "POST", json: { sourceType: item.sourceType, sourceId: item.sourceId, provider } });
      data.reload();
      setMessage(t("published", { title: item.title, name }));
    });

  const withdraw = (d: Overview["documents"][number]) => {
    if (!window.confirm(t("withdrawConfirm", { title: d.title }))) return;
    run(`withdraw-${d.id}`, async () => {
      await api(`/api/career/national-credentials/me/documents/${d.id}/withdraw`, { method: "POST" });
      data.reload();
      setMessage(t("withdrawn", { title: d.title }));
    });
  };

  const preview = (d: Overview["documents"][number]) =>
    run(`pdf-${d.id}`, async () => {
      const res = await api<Response>(`/api/career/national-credentials/me/documents/${d.id}/pdf`, { raw: true });
      if (!res.ok) throw new Error(t("pdfFailed"));
      await saveResponse(res, `${d.docNumber}.pdf`);
    });

  const repos = data.data?.repositories ?? [];
  const consented = repos.filter((r) => r.consented);

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <ErrorBanner error={error} />
      <SuccessBanner message={message} />
      {data.loading && !data.data ? (
        <Loading />
      ) : data.error ? (
        <ErrorBanner error={data.error} onRetry={data.reload} />
      ) : (
        data.data && (
          <div className="space-y-6">
            <Card title={t("apaarTitle")}>
              <form onSubmit={saveApaar} className="space-y-3" noValidate>
                <p className="text-sm text-muted-foreground">{data.data.apaarNotice}</p>
                <div className="max-w-sm">
                  <Field label={t("apaarLabel")} hint={t("apaarHint")} error={apaarError}>
                    {(p) => <input {...p} value={apaar} onChange={(e) => setApaar(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={14} dir="ltr" />}
                  </Field>
                </div>
                {data.data.apaarSource === "staff" && <p className="text-xs text-muted-foreground">{t("apaarByStaff")}</p>}
                <Button type="submit" busy={busy === "apaar"}>
                  {t("apaarSave")}
                </Button>
              </form>
            </Card>

            <Card title={t("consentTitle")}>
              <p className="mb-4 text-sm text-muted-foreground">{t("consentHelp")}</p>
              {repos.length === 0 ? (
                <EmptyState title={t("noRepositories")}>{t("noRepositoriesHelp")}</EmptyState>
              ) : (
                <ul className="space-y-3">
                  {repos.map((r) => (
                    <li key={r.provider} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4">
                      <div>
                        <p className="font-medium">{r.name}</p>
                        <p className="text-sm text-muted-foreground">{t("recipient", { recipient: r.recipient })}</p>
                        <p className="mt-1 text-sm">
                          {r.consented ? (
                            <Badge tone="good">{t("consentOn", { date: fmt.date(r.consentedAt) })}</Badge>
                          ) : (
                            <Badge>{t("consentOff")}</Badge>
                          )}
                        </p>
                      </div>
                      <Button
                        variant={r.consented ? "secondary" : "primary"}
                        onClick={() => consent(r.provider, r.name, !r.consented)}
                        busy={busy === `consent-${r.provider}`}
                        aria-label={r.consented ? t("revokeFor", { name: r.name }) : t("giveFor", { name: r.name })}
                      >
                        {r.consented ? t("revoke") : t("give")}
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {consented.length > 0 && data.data.items.length > 0 && (
              <Card title={t("publishTitle")}>
                <p className="mb-4 text-sm text-muted-foreground">{t("publishHelp")}</p>
                <ul className="space-y-3">
                  {data.data.items.map((item) => (
                    <li key={item.sourceId} className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 last:border-0">
                      <div>
                        <p className="font-medium">{item.title}</p>
                        {item.completedAt && <p className="text-xs text-muted-foreground">{t("completedOn", { date: fmt.date(item.completedAt) })}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {consented.map((r) => {
                          const already = data.data!.documents.some((d) => d.sourceId === item.sourceId && d.provider === r.provider && d.status === "Published");
                          return (
                            <Button
                              key={r.provider}
                              variant="secondary"
                              disabled={already}
                              onClick={() => publish(item, r.provider, r.name)}
                              busy={busy === `publish-${item.sourceId}-${r.provider}`}
                              aria-label={t("publishFor", { title: item.title, name: r.name })}
                            >
                              {already ? t("alreadyPublished", { name: r.name }) : t("publishTo", { name: r.name })}
                            </Button>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <Card title={t("documentsTitle")}>
              {data.data.documents.length === 0 ? (
                <EmptyState title={t("noDocuments")}>{t("noDocumentsHelp")}</EmptyState>
              ) : (
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t("documentsTitle")}</caption>
                    <thead>
                      <tr className="border-b border-border [&_th]:text-start">
                        <th scope="col" className={th}>{t("colDocument")}</th>
                        <th scope="col" className={th}>{t("colNumber")}</th>
                        <th scope="col" className={th}>{t("colStatus")}</th>
                        <th scope="col" className={th}>{t("colPublished")}</th>
                        <th scope="col" className={th}>{t("colActions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.documents.map((d) => (
                        <tr key={d.id} className="border-b border-border last:border-0">
                          <th scope="row" className={`${td} text-start font-normal`}>
                            {d.title}
                            {d.lastPulledAt && <div className="text-xs text-muted-foreground">{t("lastPulled", { date: fmt.date(d.lastPulledAt) })}</div>}
                          </th>
                          <td className={td} dir="ltr">
                            {d.docNumber}
                          </td>
                          <td className={td}>
                            <Badge tone={d.status === "Published" ? "good" : d.status === "Failed" ? "bad" : "neutral"}>
                              {t.has(`docStatus.${d.status}`) ? t(`docStatus.${d.status}`) : d.status}
                            </Badge>
                          </td>
                          <td className={td}>{fmt.date(d.publishedAt)}</td>
                          <td className={td}>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="secondary" onClick={() => preview(d)} busy={busy === `pdf-${d.id}`} aria-label={t("downloadFor", { title: d.title })}>
                                <FileDown className="h-4 w-4" aria-hidden />
                                {t("download")}
                              </Button>
                              {d.status === "Published" && (
                                <Button variant="ghost" onClick={() => withdraw(d)} busy={busy === `withdraw-${d.id}`} aria-label={t("withdrawFor", { title: d.title })}>
                                  {t("withdraw")}
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              )}
            </Card>
          </div>
        )
      )}
    </div>
  );
}

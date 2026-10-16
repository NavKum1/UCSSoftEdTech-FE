"use client";

/** G18 student privacy: purpose consent, guardian status (minors) and rights requests. Used on /student/privacy. */
import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, SuccessBanner, formatDate, useLoad, ScrollArea, useCareerT, useCareerLabels } from "@/components/career/ui";

export interface Purpose {
  key: string;
  title: string;
  description: string;
  status: "NotRecorded" | "Granted" | "Withdrawn";
  allowed: boolean;
  reason?: string | null;
  grantedBy?: string | null;
  grantedAt?: string | null;
  withdrawnAt?: string | null;
  noticeVersion?: string | null;
}

export interface PrivacyRequestRow {
  id: string;
  type: "Export" | "Erasure" | "Correction";
  status: string;
  details?: string | null;
  submittedAt: string;
  dueAt: string;
  completedAt?: string | null;
  resolutionNote?: string | null;
  exportReady: boolean;
  exportAvailableUntil?: string | null;
  overdue: boolean;
}

interface Overview {
  policy: { countryCode: string; law: string; minorAge: number; guardianConsentRequired: boolean; purposeConsentRequired: boolean; rightsResponseDays: number; noticeVersion: string; noticeUrl?: string | null };
  isMinor: boolean;
  guardianConsentNeeded: boolean;
  purposes: Purpose[];
  guardians: { id: string; name: string; email: string; relationship: string; status: string; respondedAt?: string | null }[];
  requests: PrivacyRequestRow[];
}

export const REQUEST_TYPE_LABELS_KEYS = ["Export", "Erasure", "Correction"];
/** request type labels in the career language (G1) */
export function useRequestTypeLabels(): Record<string, string> {
  return useCareerLabels("studentPrivacyRights.requestType", REQUEST_TYPE_LABELS_KEYS);
}
export const REQUEST_STATUS_LABELS_KEYS = ["Submitted", "InProgress", "Completed", "Rejected", "Cancelled"];
/** request status labels in the career language (G1) */
export function useRequestStatusLabels(): Record<string, string> {
  return useCareerLabels("studentPrivacyRights.requestStatus", REQUEST_STATUS_LABELS_KEYS);
}

export function requestTone(status: string): "neutral" | "good" | "warn" | "bad" | "info" {
  if (status === "Completed") return "good";
  if (status === "Rejected") return "bad";
  if (status === "InProgress") return "info";
  return "neutral";
}

export async function downloadBlob(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function StudentPrivacyRights() {
  const t = useCareerT("studentPrivacyRights");
  const REQUEST_STATUS_LABELS = useRequestStatusLabels();
  const REQUEST_TYPE_LABELS = useRequestTypeLabels();
  const api = useApi();
  const data = useLoad(() => api<Overview>("/api/career/privacy/student"), [api]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [type, setType] = useState("Export");
  const [details, setDetails] = useState("");
  const [gName, setGName] = useState("");
  const [gEmail, setGEmail] = useState("");

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const setPurpose = (p: Purpose, grant: boolean) =>
    run(p.key, async () => {
      if (!grant && !window.confirm(t("withdrawConsentToTitleThis", { title: p.title }))) return;
      const lang = typeof document !== "undefined" ? document.documentElement.lang || "en" : "en";
      await api(`/api/career/privacy/student/purposes/${p.key}`, { method: "PUT", json: { grant, language: lang } });
      setMsg(grant ? t("youAgreedToTitle", { title: p.title }) : t("youWithdrewConsentToTitle", { title: p.title }));
      data.reload();
    });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === "Erasure" && !window.confirm(t("askYourSchoolToDelete"))) return;
    run("request", async () => {
      await api("/api/career/privacy/student/requests", { method: "POST", json: { type, details } });
      setDetails("");
      setMsg(t("yourRequestWasSentTo"));
      data.reload();
    });
  };

  const addGuardian = (e: React.FormEvent) => {
    e.preventDefault();
    run("guardian", async () => {
      await api("/api/career/privacy/student/guardians", { method: "POST", json: { name: gName, email: gEmail, relationship: "Parent" } });
      setGName("");
      setGEmail("");
      setMsg(t("weEmailedYourParentOr"));
      data.reload();
    });
  };

  const cancel = (r: PrivacyRequestRow) =>
    run(r.id, async () => {
      await api(`/api/career/privacy/student/requests/${r.id}/cancel`, { method: "POST" });
      setMsg(t("requestCancelled"));
      data.reload();
    });

  const download = (r: PrivacyRequestRow) =>
    run(r.id, async () => {
      const res = await api<Response>(`/api/career/privacy/student/requests/${r.id}/export`, { raw: true });
      await downloadBlob(res, "career-record.zip");
    });

  const d = data.data;
  return (
    <>
      <ErrorBanner error={err ?? data.error} />
      <SuccessBanner message={msg} />

      <Card title={t("howYourDataIsUsed")} className="mb-6">
        {data.loading && !d ? (
          <Loading />
        ) : d ? (
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              {t("theseUsesNeedYourConsent", { law: d.policy.law, noticeVersion: d.policy.noticeVersion })}
              {d.policy.noticeUrl ? (
                <>
                  , <a className="underline" href={d.policy.noticeUrl} target="_blank" rel="noreferrer">{t("readTheFullNotice")}</a>
                </>
              ) : null}
              {t("youCanWithdrawAtAny")}
            </p>
            {d.guardianConsentNeeded && (
              <p role="status" className="rounded-md border border-border bg-muted p-3">
                {t("youreUnderMinorAgeSoA", { minorAge: d.policy.minorAge })}
              </p>
            )}
            <ul className="divide-y divide-border">
              {d.purposes.map((p) => (
                <li key={p.key} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium">{p.title}</h3>
                    <p className="text-muted-foreground">{p.description}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      {p.allowed ? <Badge tone="good">{t("on")}</Badge> : <Badge tone="warn">{t("off")}</Badge>}
                      {p.status === "Granted" && p.grantedAt && (
                        <span className="text-xs text-muted-foreground">
                          {t("agreedGrantedAt", { grantedAt: formatDate(p.grantedAt) })}{p.grantedBy === "Guardian" ? t("byYourGuardian") : ""}
                        </span>
                      )}
                      {p.status === "Withdrawn" && p.withdrawnAt && <span className="text-xs text-muted-foreground">{t("withdrawnWithdrawnAt", { withdrawnAt: formatDate(p.withdrawnAt) })}</span>}
                      {!p.allowed && p.reason && <span className="text-xs text-muted-foreground">{p.reason}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!d.guardianConsentNeeded && !(p.status === "Granted") && (
                      <Button variant="secondary" busy={busy === p.key} onClick={() => setPurpose(p, true)} aria-label={t("agreeToTitle", { title: p.title })}>
                        {t("agree")}
                      </Button>
                    )}
                    {p.allowed && (
                      <Button variant="secondary" busy={busy === p.key} onClick={() => setPurpose(p, false)} aria-label={t("withdrawConsentToTitle", { title: p.title })}>
                        {t("withdraw")}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      {d?.isMinor && (
        <Card title={t("parentOrGuardian")} className="mb-6">
          {d.guardians.length > 0 && (
            <ul className="mb-4 space-y-1 text-sm">
              {d.guardians.map((g) => (
                <li key={g.id} className="flex flex-wrap items-center gap-2">
                  <span>{g.name}</span>
                  <span className="text-muted-foreground"><bdi>{g.email}</bdi></span>
                  <Badge tone={g.status === "Consented" ? "good" : g.status === "Declined" ? "bad" : "neutral"}>{g.status}</Badge>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addGuardian} className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <Field label={t("guardiansName")}>{(p) => <input {...p} value={gName} onChange={(e) => setGName(e.target.value)} required />}</Field>
            <Field label={t("guardiansEmail")}>{(p) => <input {...p} type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} required />}</Field>
            <Button type="submit" busy={busy === "guardian"}>{t("sendConsentRequest")}</Button>
          </form>
        </Card>
      )}

      <Card title={t("yourDataRights")} className="mb-6">
        <form onSubmit={submit} className="mb-4 grid gap-3 sm:grid-cols-3 sm:items-end">
          <Field label={t("whatDoYouWant")}>
            {(p) => (
              <select {...p} value={type} onChange={(e) => setType(e.target.value)}>
                {Object.entries(REQUEST_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("details")} hint={type === "Correction" ? t("sayWhatIsWrongAnd") : t("optional")}>
            {(p) => <input {...p} value={details} onChange={(e) => setDetails(e.target.value)} required={type === "Correction"} maxLength={4000} />}
          </Field>
          <Button type="submit" busy={busy === "request"}>{t("sendRequest")}</Button>
        </form>
        {d && d.policy && <p className="mb-3 text-sm text-muted-foreground">{t("yourCareerOfficeAnswersWithin", { rightsResponseDays: d.policy.rightsResponseDays })}</p>}
        {(d?.requests ?? []).length === 0 ? (
          <EmptyState title={t("noRequestsYet")} />
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("yourDataRequests")}</caption>
              <thead>
                <tr className="border-b border-border [&_th]:text-start">
                  <th scope="col" className="py-2 pe-3 font-medium">{t("request")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("sent")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("dueBy")}</th>
                  <th scope="col" className="py-2 pe-3 font-medium">{t("status")}</th>
                  <th scope="col" className="py-2"><span className="sr-only">{t("actions")}</span></th>
                </tr>
              </thead>
              <tbody>
                {d!.requests.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pe-3">{REQUEST_TYPE_LABELS[r.type] ?? r.type}{r.details && <div className="text-xs text-muted-foreground">{r.details}</div>}</td>
                    <td className="py-2 pe-3">{formatDate(r.submittedAt)}</td>
                    <td className="py-2 pe-3">{formatDate(r.dueAt)}</td>
                    <td className="py-2 pe-3">
                      <Badge tone={requestTone(r.status)}>{REQUEST_STATUS_LABELS[r.status] ?? r.status}</Badge>
                      {r.resolutionNote && <div className="text-xs text-muted-foreground">{r.resolutionNote}</div>}
                    </td>
                    <td className="py-2 text-end">
                      {r.exportReady && (
                        <Button variant="secondary" busy={busy === r.id} onClick={() => download(r)}>{t("download")}</Button>
                      )}
                      {r.status === "Submitted" && (
                        <Button variant="ghost" busy={busy === r.id} onClick={() => cancel(r)} aria-label={t("cancelRequestType", { type: REQUEST_TYPE_LABELS[r.type] })}>{t("cancel")}</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>
    </>
  );
}

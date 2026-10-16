"use client";

/**
 * National credential repositories (G6) for career staff: repository connections (career admins; API keys are
 * write-only and never shown), APAAR ID coverage, the publish log with withdrawal, and the draft Academic Bank of
 * Credits export. Documents reach a repository only for students who consented.
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

interface SettingField {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
  hint?: string | null;
}

interface Repository {
  provider: string;
  displayName: string;
  country: string;
  model: string;
  status: string;
  ownerMustDo: string[];
  implemented: boolean;
  testOnly: boolean;
  settings: SettingField[];
  endpoints?: { pullUri: string; pullDoc: string; method: string } | null;
  connection?: {
    id: string;
    enabled: boolean;
    updatedAt: string;
    lastActivityAt?: string | null;
    lastStatus?: string | null;
    settings: Record<string, string>;
    secretsSet: string[];
  } | null;
}

interface Coverage {
  students: number;
  withApaar: number;
  withoutApaar: number;
  repositories: { provider: string; name: string; consented: number; published: number; withdrawn: number; failed: number }[];
}

interface Doc {
  id: string;
  studentUserId: string;
  holderName: string;
  provider: string;
  sourceType: string;
  docType: string;
  docNumber: string;
  title: string;
  status: string;
  publishedAt: string;
  withdrawnAt?: string | null;
  withdrawReason?: string | null;
  lastPulledAt?: string | null;
  pullCount: number;
  lastError?: string | null;
}

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";
const DOC_TONE: Record<string, "good" | "neutral" | "bad"> = { Published: "good", Withdrawn: "neutral", Failed: "bad" };

export default function NationalCredentialsStaffPage() {
  const t = useCareerT("nationalCredentials");
  const fmt = useCareerFormat();
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  const isAdmin = me ? me.memberships.some((m) => m.instituteId === schoolId && m.role === "CareerAdmin") : true;

  const repos = useLoad(() => (isAdmin ? api<{ note: string; repositories: Repository[] }>("/api/career/national-credentials/connections") : Promise.resolve(null)), [api, schoolId, isAdmin]);
  const coverage = useLoad(() => (isAdmin ? api<Coverage>("/api/career/national-credentials/coverage") : Promise.resolve(null)), [api, schoolId, isAdmin]);
  const [statusFilter, setStatusFilter] = useState("");
  const docs = useLoad(
    () => api<Doc[]>(`/api/career/national-credentials/documents${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ""}`),
    [api, schoolId, statusFilter],
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [abcResult, setAbcResult] = useState<string | null>(null);

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

  const withdraw = (d: Doc) => {
    if (!window.confirm(t("withdrawConfirm", { title: d.title, name: d.holderName }))) return;
    run(`withdraw-${d.id}`, async () => {
      await api(`/api/career/national-credentials/documents/${d.id}/withdraw`, { method: "POST", json: { reason: null } });
      docs.reload();
      coverage.reload();
      setMessage(t("withdrawn", { number: d.docNumber }));
    });
  };

  const exportAbc = (e: React.FormEvent) => {
    e.preventDefault();
    run("abc", async () => {
      const q = new URLSearchParams();
      if (from) q.set("from", from);
      if (to) q.set("to", to);
      const res = await api<Response>(`/api/career/national-credentials/abc/export${q.toString() ? `?${q}` : ""}`, { raw: true });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error((body && (body.message as string)) || t("abcFailed"));
      }
      const rows = Number(res.headers.get("X-Abc-Rows") ?? 0);
      const missing = Number(res.headers.get("X-Abc-Missing-Apaar") ?? 0);
      await saveResponse(res, "abc-draft.csv");
      setAbcResult(t("abcDone", { rows, missing }));
    });
  };

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <ErrorBanner error={error} />
      <SuccessBanner message={message} />

      <div className="space-y-6">
        {isAdmin && (
          <Card title={t("coverageTitle")}>
            {coverage.loading && !coverage.data ? (
              <Loading />
            ) : coverage.error ? (
              <ErrorBanner error={coverage.error} onRetry={coverage.reload} />
            ) : (
              coverage.data && (
                <div className="space-y-4">
                  <dl className="grid gap-4 sm:grid-cols-3">
                    <Stat label={t("students")} value={fmt.number(coverage.data.students)} />
                    <Stat
                      label={t("withApaar")}
                      value={fmt.number(coverage.data.withApaar)}
                      note={coverage.data.students > 0 ? t("percentOfStudents", { percent: fmt.percent(coverage.data.withApaar / coverage.data.students) }) : undefined}
                    />
                    <Stat label={t("withoutApaar")} value={fmt.number(coverage.data.withoutApaar)} />
                  </dl>
                  {coverage.data.repositories.length > 0 && (
                    <ScrollArea>
                      <table className="w-full text-sm">
                        <caption className="sr-only">{t("consentCaption")}</caption>
                        <thead>
                          <tr className="border-b border-border [&_th]:text-start">
                            <th scope="col" className={th}>{t("colRepository")}</th>
                            <th scope="col" className={`${th} text-end`}>{t("colConsented")}</th>
                            <th scope="col" className={`${th} text-end`}>{t("colPublished")}</th>
                            <th scope="col" className={`${th} text-end`}>{t("colWithdrawn")}</th>
                            <th scope="col" className={`${th} text-end`}>{t("colFailed")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {coverage.data.repositories.map((r) => (
                            <tr key={r.provider} className="border-b border-border last:border-0">
                              <th scope="row" className={`${td} text-start font-normal`}>{r.name}</th>
                              <td className={`${td} text-end tabular-nums`}>{fmt.number(r.consented)}</td>
                              <td className={`${td} text-end tabular-nums`}>{fmt.number(r.published)}</td>
                              <td className={`${td} text-end tabular-nums`}>{fmt.number(r.withdrawn)}</td>
                              <td className={`${td} text-end tabular-nums`}>{fmt.number(r.failed)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  )}
                  <p className="text-xs text-muted-foreground">{t("apaarNotice")}</p>
                </div>
              )
            )}
          </Card>
        )}

        {isAdmin && (
          <section aria-labelledby="repos-heading" className="space-y-4">
            <h2 id="repos-heading" className="text-lg font-semibold">
              {t("connectionsTitle")}
            </h2>
            {repos.loading && !repos.data ? (
              <Loading />
            ) : repos.error ? (
              <ErrorBanner error={repos.error} onRetry={repos.reload} />
            ) : (
              repos.data && (
                <>
                  <p className="text-sm text-muted-foreground">{repos.data.note}</p>
                  {repos.data.repositories.map((r) => (
                    <ConnectionCard
                      key={r.provider}
                      repo={r}
                      onSaved={(next) => {
                        repos.setData((d) => (d ? { ...d, repositories: d.repositories.map((x) => (x.provider === next.provider ? next : x)) } : d));
                        coverage.reload();
                        setMessage(t("connectionSaved", { name: next.displayName }));
                      }}
                      onRemoved={() => {
                        repos.reload();
                        setMessage(t("connectionRemoved", { name: r.displayName }));
                      }}
                      onError={setError}
                    />
                  ))}
                </>
              )
            )}
          </section>
        )}

        <Card
          title={t("logTitle")}
          actions={
            <label className="flex items-center gap-2 text-sm">
              <span>{t("filterStatus")}</span>
              <select className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{t("statusAll")}</option>
                {["Published", "Withdrawn", "Failed"].map((s) => (
                  <option key={s} value={s}>
                    {t(`docStatus.${s}`)}
                  </option>
                ))}
              </select>
            </label>
          }
        >
          {docs.loading && !docs.data ? (
            <Loading />
          ) : docs.error ? (
            <ErrorBanner error={docs.error} onRetry={docs.reload} />
          ) : !docs.data || docs.data.length === 0 ? (
            <EmptyState title={t("noDocuments")}>{t("noDocumentsHelp")}</EmptyState>
          ) : (
            <ScrollArea>
              <table className="w-full text-sm">
                <caption className="sr-only">{t("logTitle")}</caption>
                <thead>
                  <tr className="border-b border-border [&_th]:text-start">
                    <th scope="col" className={th}>{t("colStudent")}</th>
                    <th scope="col" className={th}>{t("colDocument")}</th>
                    <th scope="col" className={th}>{t("colNumber")}</th>
                    <th scope="col" className={th}>{t("colStatus")}</th>
                    <th scope="col" className={th}>{t("colPublishedAt")}</th>
                    <th scope="col" className={`${th} text-end`}>{t("colPulls")}</th>
                    <th scope="col" className={th}>{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.data.map((d) => (
                    <tr key={d.id} className="border-b border-border last:border-0">
                      <th scope="row" className={`${td} text-start font-normal`}>
                        <bdi>{d.holderName}</bdi>
                      </th>
                      <td className={td}>
                        <div>{d.title}</div>
                        <div className="text-xs text-muted-foreground">{d.provider}</div>
                      </td>
                      <td className={td} dir="ltr">
                        {d.docNumber}
                      </td>
                      <td className={td}>
                        <Badge tone={DOC_TONE[d.status] ?? "neutral"}>{t.has(`docStatus.${d.status}`) ? t(`docStatus.${d.status}`) : d.status}</Badge>
                        {d.withdrawReason && <div className="mt-1 text-xs text-muted-foreground">{d.withdrawReason}</div>}
                        {d.lastError && <div className="mt-1 text-xs text-red-700 dark:text-red-400">{d.lastError}</div>}
                      </td>
                      <td className={td}>{fmt.date(d.publishedAt)}</td>
                      <td className={`${td} text-end tabular-nums`}>
                        {fmt.number(d.pullCount)}
                        {d.lastPulledAt && <div className="text-xs text-muted-foreground">{t("lastPulled", { date: fmt.date(d.lastPulledAt) })}</div>}
                      </td>
                      <td className={td}>
                        {d.status === "Published" && (
                          <Button variant="secondary" onClick={() => withdraw(d)} busy={busy === `withdraw-${d.id}`} aria-label={t("withdrawFor", { number: d.docNumber })}>
                            {t("withdraw")}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </Card>

        {isAdmin && (
          <Card title={t("abcTitle")}>
            <form onSubmit={exportAbc} className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("abcHelp")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("abcFrom")}>{(p) => <input {...p} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
                <Field label={t("abcTo")}>{(p) => <input {...p} type="date" value={to} onChange={(e) => setTo(e.target.value)} />}</Field>
              </div>
              <Button type="submit" busy={busy === "abc"}>
                <FileDown className="h-4 w-4" aria-hidden />
                {t("abcDownload")}
              </Button>
              <p role="status" className="text-sm">
                {abcResult}
              </p>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

function ConnectionCard({
  repo,
  onSaved,
  onRemoved,
  onError,
}: {
  repo: Repository;
  onSaved: (r: Repository) => void;
  onRemoved: () => void;
  onError: (e: string | null) => void;
}) {
  const t = useCareerT("nationalCredentials");
  const fmt = useCareerFormat();
  const api = useApi();
  const conn = repo.connection;
  const plain = repo.settings.filter((s) => !s.secret);
  const secret = repo.settings.filter((s) => s.secret);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(plain.map((s) => [s.key, conn?.settings?.[s.key] ?? ""])));
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [clear, setClear] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(conn?.enabled ?? false);
  const [busy, setBusy] = useState<string | null>(null);
  const headingId = `repo-${repo.provider}`;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");
    onError(null);
    const typed = Object.fromEntries(Object.entries(secrets).filter(([, v]) => v.trim()));
    api<Repository>(`/api/career/national-credentials/connections/${encodeURIComponent(repo.provider)}`, {
      method: "PUT",
      json: { enabled, settings: values, secrets: Object.keys(typed).length ? typed : undefined, clearSecrets: clear.length ? clear : undefined },
    })
      .then((next) => {
        // Typed keys are never kept in the page once they are saved
        setSecrets({});
        setClear([]);
        onSaved(next);
      })
      .catch((err: Error) => onError(err.message))
      .finally(() => setBusy(null));
  };

  const remove = () => {
    if (!window.confirm(t("removeConfirm", { name: repo.displayName }))) return;
    setBusy("remove");
    onError(null);
    api(`/api/career/national-credentials/connections/${encodeURIComponent(repo.provider)}`, { method: "DELETE" })
      .then(onRemoved)
      .catch((err: Error) => onError(err.message))
      .finally(() => setBusy(null));
  };

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-base font-semibold">
          {repo.displayName}
        </h3>
        <div className="flex flex-wrap gap-2">
          {repo.testOnly && <Badge tone="info">{t("testOnly")}</Badge>}
          {!repo.implemented ? <Badge>{t("notBuilt")}</Badge> : conn?.enabled ? <Badge tone="good">{t("on")}</Badge> : <Badge tone="warn">{t("off")}</Badge>}
        </div>
      </div>
      <p className="text-sm">{repo.model}</p>
      <p className="mt-1 text-sm text-muted-foreground">{repo.status}</p>
      {repo.ownerMustDo.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-medium">{t("ownerMustDo")}</summary>
          <ul className="mt-2 list-disc space-y-1 ps-5">
            {repo.ownerMustDo.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </details>
      )}
      {repo.endpoints && (
        <dl className="mt-3 space-y-1 text-sm">
          <dt className="font-medium">{t("pullEndpoints", { method: repo.endpoints.method })}</dt>
          <dd className="break-all font-mono text-xs" dir="ltr">
            {repo.endpoints.pullUri}
          </dd>
          <dd className="break-all font-mono text-xs" dir="ltr">
            {repo.endpoints.pullDoc}
          </dd>
        </dl>
      )}
      {conn?.lastActivityAt && (
        <p className="mt-2 text-xs text-muted-foreground">{t("lastActivity", { date: fmt.dateTime(conn.lastActivityAt), status: conn.lastStatus ?? "—" })}</p>
      )}

      {repo.implemented && (
        <form onSubmit={save} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {plain.map((s) => (
              <Field key={s.key} label={s.required ? t("requiredLabel", { label: s.label }) : s.label} hint={s.hint ?? undefined}>
                {(p) =>
                  s.key === "requireNameMatch" ? (
                    <select {...p} value={values[s.key] || "true"} onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}>
                      <option value="true">{t("yes")}</option>
                      <option value="false">{t("no")}</option>
                    </select>
                  ) : (
                    <input {...p} value={values[s.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))} spellCheck={false} dir="ltr" />
                  )
                }
              </Field>
            ))}
            {secret.map((s) => {
              const isSet = conn?.secretsSet.includes(s.key) && !clear.includes(s.key);
              return (
                <div key={s.key} className="space-y-2">
                  <Field label={s.required ? t("requiredLabel", { label: s.label }) : s.label} hint={isSet ? t("secretSet") : t("secretNotSet")}>
                    {(p) => (
                      <input
                        {...p}
                        type="password"
                        autoComplete="new-password"
                        value={secrets[s.key] ?? ""}
                        placeholder={isSet ? t("secretPlaceholderSet") : ""}
                        onChange={(e) => setSecrets((v) => ({ ...v, [s.key]: e.target.value }))}
                        dir="ltr"
                      />
                    )}
                  </Field>
                  {conn?.secretsSet.includes(s.key) && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={clear.includes(s.key)}
                        onChange={(e) => setClear((c) => (e.target.checked ? [...c, s.key] : c.filter((x) => x !== s.key)))}
                      />
                      {t("clearSecret", { label: s.label })}
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            {t("enable", { name: repo.displayName })}
          </label>
          <p className="text-xs text-muted-foreground">{t("secretsWriteOnly")}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" busy={busy === "save"}>
              {t("saveConnection")}
            </Button>
            {conn && (
              <Button type="button" variant="danger" onClick={remove} busy={busy === "remove"}>
                {t("removeConnection")}
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

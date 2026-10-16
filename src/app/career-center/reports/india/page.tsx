"use client";

/**
 * India report packs: NIRF Graduation Outcomes (G3), NAAC student progression 5.2 and NBA SAR criterion 4.6 (G4),
 * built from the placement office's records and outcomes. Data tables to help the institution fill its own
 * submission; every pack names its official source and says what to verify. Not a submission, no compliance claim.
 */

import React, { useState } from "react";
import Link from "next/link";
import { useCareerShell } from "@/components/career/CareerShell";
import { Button, Card, ErrorBanner, Field, Loading, PageHeader, ScrollArea, SuccessBanner, useLoad, useCareerT } from "@/components/career/ui";
import { inrGrouped } from "@/components/career/placements/shared";
import { useRunner } from "@/components/career/placements/useRunner";

interface PackSource {
  title: string;
  url: string;
  date: string;
}

interface PackInfo {
  key: string;
  name: string;
  body: string;
  plan: string;
  description: string;
  sources: PackSource[];
  verifyNote: string;
}

interface PackView {
  pack: PackInfo;
  disclaimer: string;
  info: { meta: { years: number[]; programme?: string; programmes: string[]; variant?: string }; warnings: string[] };
  tables: { key: string; title: string; columns: { label: string; verified: boolean }[]; rows: (string | number | null)[][]; notes: string[] }[];
}

const MONEY_COLUMN = /salary|package|Rs\./i;

function cell(value: string | number | null, column: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && MONEY_COLUMN.test(column) && !/lakh/i.test(column)) return `₹${inrGrouped(value)}`;
  return String(value);
}

export default function IndiaReportsPage() {
  const tr = useCareerT("careerCenterReportsIndia");
  const { schoolId } = useCareerShell();
  const { api, busy, err, msg, download } = useRunner();
  const catalog = useLoad(() => api<{ packs: PackInfo[]; disclaimer: string }>("/api/career/frameworks/packs"), [api, schoolId]);
  const [key, setKey] = useState("nirf-go");
  const [years, setYears] = useState("");
  const [programme, setProgramme] = useState("");
  const [variant, setVariant] = useState("college");
  const [selfReported, setSelfReported] = useState(false);
  const [applied, setApplied] = useState({ years: "", programme: "", variant: "college", selfReported: false });

  const query = `years=${encodeURIComponent(applied.years)}&programme=${encodeURIComponent(applied.programme)}&variant=${applied.variant}&includeSelfReported=${applied.selfReported}`;
  const view = useLoad(() => api<PackView>(`/api/career/frameworks/packs/${key}?${query}`), [api, schoolId, key, query]);
  const programmes = view.data?.info.meta.programmes ?? [];

  return (
    <div>
      <p className="mb-2 text-sm">
        <Link href="/career-center/placements" className="underline">
          {tr("placementOffice")}
        </Link>
      </p>
      <PageHeader
        title={tr("nIRFNAACAndNBAReports")}
        description={tr("placementHigherStudiesAndExamination")}
      />
      {catalog.loading && !catalog.data ? <Loading /> : <ErrorBanner error={catalog.error} onRetry={catalog.reload} />}
      {catalog.data && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{catalog.data.disclaimer}</p>
      )}
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <Card title={tr("report")}>
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied({ years, programme, variant, selfReported });
          }}
        >
          <Field label={tr("pack")}>
            {(p) => (
              <select {...p} value={key} onChange={(e) => setKey(e.target.value)}>
                {(catalog.data?.packs ?? []).map((pk) => <option key={pk.key} value={pk.key}>{pk.name}</option>)}
              </select>
            )}
          </Field>
          <Field label={tr("graduatingYears")} hint={tr("commaSeparatedEG2025")}>
            {(p) => <input {...p} value={years} onChange={(e) => setYears(e.target.value)} />}
          </Field>
          <Field label={key === "nba-sar-4-6" ? tr("programme") : tr("programmeOptionalFilter")}>
            {(p) => (
              <select {...p} value={programme} onChange={(e) => setProgramme(e.target.value)}>
                <option value="">{key === "nba-sar-4-6" ? tr("firstOnRecord") : tr("allProgrammes")}</option>
                {programmes.map((pr) => <option key={pr} value={pr}>{pr}</option>)}
              </select>
            )}
          </Field>
          {key === "naac-5-2" && (
            <Field label={tr("nAACManual")}>
              {(p) => (
                <select {...p} value={variant} onChange={(e) => setVariant(e.target.value)}>
                  <option value="college">{tr("affiliatedConstituentColleges")}</option>
                  <option value="university">{tr("universities")}</option>
                </select>
              )}
            </Field>
          )}
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" checked={selfReported} onChange={(e) => setSelfReported(e.target.checked)} />
            {tr("includeOutcomesStudentsReportedThemselve")}
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="submit">{tr("show")}</Button>
            <Button type="button" variant="secondary" busy={busy === "csv"} onClick={() => void download(`/api/career/frameworks/packs/${key}/export?${query}&format=csv`, "csv", `${key}.csv`)}>
              {tr("downloadCSV")}
            </Button>
            <Button type="button" variant="secondary" busy={busy === "xlsx"} onClick={() => void download(`/api/career/frameworks/packs/${key}/export?${query}&format=xlsx`, "xlsx", `${key}.xlsx`)}>
              {tr("downloadExcel")}
            </Button>
          </div>
        </form>
      </Card>

      {view.loading && !view.data ? (
        <Loading />
      ) : view.error ? (
        <ErrorBanner error={view.error} onRetry={view.reload} />
      ) : (
        view.data && (
          <div className="mt-6 space-y-6">
            <Card title={view.data.pack.name}>
              <p className="text-sm">{view.data.pack.description}</p>
              <p className="mt-2 text-sm font-medium">{view.data.pack.verifyNote}</p>
              <h3 className="mt-3 text-sm font-semibold">{tr("officialSourcesUsed")}</h3>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">
                {view.data.pack.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer noopener" className="underline">
                      {s.title}
                    </a>{" "}
                    ({s.date})
                  </li>
                ))}
              </ul>
              {view.data.info.warnings.length > 0 && (
                <div role="status"><ul className="mt-3 space-y-1 text-sm text-amber-800 dark:text-amber-300">
                  {view.data.info.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul></div>
              )}
            </Card>
            {view.data.tables.map((t) => (
              <Card key={t.key}>
                <ScrollArea>
                  <table className="w-full text-sm">
                    <caption className="mb-2 text-start font-semibold">{t.title}</caption>
                    <thead>
                      <tr className="border-b border-border align-bottom [&_th]:text-start">
                        {t.columns.map((c, i) => (
                          <th key={`${c.label}-${i}`} scope="col" className="py-2 pe-3 font-medium">
                            {c.label.replace(/ \*$/, "")}
                            {!c.verified && (
                              <span title={tr("notConfirmedFromTheOfficial")} className="ms-1">
                                *<span className="sr-only">{" "}{tr("verifyAgainstTheCurrentOfficial")}</span>
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.length === 0 ? (
                        <tr>
                          <td colSpan={t.columns.length} className="py-2 text-muted-foreground">{tr("nothingRecordedForTheseYears")}</td>
                        </tr>
                      ) : (
                        t.rows.map((r, i) => (
                          <tr key={i} className="border-b border-border last:border-0">
                            {r.map((c, j) => (
                              <td key={j} className="py-2 pe-3 align-top">{cell(c, t.columns[j]?.label ?? "")}</td>
                            ))}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </ScrollArea>
                {t.notes.length > 0 && (
                  <ul className="mt-3 list-disc space-y-1 ps-5 text-xs text-muted-foreground">
                    {t.notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}
              </Card>
            ))}
            <p className="text-xs text-muted-foreground">{tr("notConfirmedFromTheOfficial2")}{" "}{view.data.pack.body === "NIRF" ? tr("nIRFDataCaptureFormat") : tr("bodyManual", { body: view.data.pack.body })}.</p>
          </div>
        )
      )}
    </div>
  );
}

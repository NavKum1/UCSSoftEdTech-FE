"use client";

/**
 * Sponsorship-history lookup over public Department of Labor LCA data. A data lookup only: it is not a job search
 * and never lists openings.
 */

import React, { useState } from "react";
import { Info } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, formatDate, useLoad, ScrollArea, useCareerT, useCareerFormat } from "@/components/career/ui";
import { currentFormatLocale } from "@/components/career/i18n/CareerI18nProvider";

export interface SponsorSummary {
  normalizedKey: string;
  name: string;
  otherNames: string[];
  totalCases: number;
  totalCertified: number;
  firstFiscalYear: number;
  latestFiscalYear: number;
  latestCertified: number;
}

interface SponsorYear {
  fiscalYear: number;
  displayName: string;
  totalCases: number;
  certified: number;
  certifiedWithdrawn: number;
  denied: number;
  withdrawn: number;
  wages: { min: number | null; median: number | null; max: number | null; basis: string };
  names: string[];
  topJobTitles: { title: string; count: number }[];
  topSocCodes: { code: string; title: string | null; count: number }[];
  states: { state: string; count: number }[];
  visaClasses: { visaClass: string; count: number }[];
}

interface SponsorDetail {
  employer: SponsorSummary;
  years: SponsorYear[];
  disclaimer: string;
}

interface Meta {
  lastUpdated: string | null;
  fiscalYears: number[];
  employers: number;
  disclaimer: string;
  source: string;
}

const money = (n: number | null) => (n == null ? "—" : n.toLocaleString(currentFormatLocale(), { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

export function SponsorDisclaimer({ text }: { text: string }) {
  return (
    <div role="note" className="mb-4 flex items-start gap-2 rounded-md border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </div>
  );
}

export default function SponsorLookup() {
  const tr = useCareerT("sponsorLookup");
  const fmt = useCareerFormat();
  const api = useApi();
  const meta = useLoad(() => api<Meta>("/api/career/international/sponsor-meta"), [api]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SponsorSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [detail, setDetail] = useState<SponsorDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) {
      setErr(tr("typeAtLeastTwoCharacters"));
      return;
    }
    setSearching(true);
    setErr(null);
    setDetail(null);
    try {
      const res = await api<{ items: SponsorSummary[] }>(`/api/career/international/sponsors?q=${encodeURIComponent(q.trim())}`);
      setResults(res.items);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const open = async (key: string) => {
    setLoadingDetail(true);
    setErr(null);
    try {
      setDetail(await api<SponsorDetail>(`/api/career/international/sponsors/${encodeURIComponent(key)}`));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <Card title={tr("employerSponsorshipHistory")}>
      <p className="mb-3 text-sm text-muted-foreground">
        {tr("lookUpHowManyLabor")}
      </p>
      {meta.data && <SponsorDisclaimer text={meta.data.disclaimer} />}
      {meta.data && meta.data.employers === 0 && <p className="mb-3 text-sm text-muted-foreground">{tr("noSponsorshipDataHasBeen")}</p>}
      <form onSubmit={search} className="flex flex-wrap items-end gap-2" role="search">
        <div className="min-w-64 flex-1">
          <Field label={tr("employerName")} hint={tr("spellingVariationsLikeIncLLC")}>
            {(p) => <input {...p} value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} autoComplete="off" />}
          </Field>
        </div>
        <Button type="submit" busy={searching} className="mb-5">
          {tr("search")}
        </Button>
      </form>
      <ErrorBanner error={err ?? meta.error} />
      <div aria-live="polite">
        {results && !detail && (
          results.length === 0 ? (
            <EmptyState title={tr("noMatchingEmployers")}>{tr("tryAShorterPartOf")}</EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {results.map((r) => (
                <li key={r.normalizedKey}>
                  <button type="button" onClick={() => open(r.normalizedKey)} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-start hover:bg-muted focus-visible:outline-2">
                    <span>
                      <span className="font-medium">{r.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {tr("fY")}{r.firstFiscalYear === r.latestFiscalYear ? r.latestFiscalYear : `${r.firstFiscalYear}–${r.latestFiscalYear}`}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">
                      {tr("totalCertified2CertifiedLCAs", { totalCertified: r.totalCertified, totalCertified2: fmt.number(r.totalCertified) })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}
        {loadingDetail && <Loading />}
        {detail && <SponsorDetailView detail={detail} onBack={() => setDetail(null)} />}
      </div>
      {meta.data && (
        <p className="mt-4 text-xs text-muted-foreground">
          {tr("sourceSource", { source: meta.data.source })}{meta.data.lastUpdated ? tr("lastUpdatedLastUpdated", { lastUpdated: formatDate(meta.data.lastUpdated) }) : ""}
          {meta.data.fiscalYears.length > 0 ? tr("fiscalYearsFiscalYears", { fiscalYears: meta.data.fiscalYears.join(", ") }) : ""}
        </p>
      )}
    </Card>
  );
}

function SponsorDetailView({ detail, onBack }: { detail: SponsorDetail; onBack: () => void }) {
  const tr = useCareerT("sponsorLookup");
  const e = detail.employer;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{e.name}</h3>
          {e.otherNames.length > 1 && <p className="text-xs text-muted-foreground">{tr("alsoFiledAsValue", { value: e.otherNames.filter((n) => n !== e.name).join("; ") })}</p>}
        </div>
        <Button variant="secondary" onClick={onBack}>
          {tr("backToResults")}
        </Button>
      </div>
      <SponsorDisclaimer text={detail.disclaimer} />
      <ScrollArea>
        <table className="w-full text-sm">
          <caption className="sr-only">{tr("lCAFilingsByFiscalYear", { name: e.name })}</caption>
          <thead className="text-start text-xs uppercase text-muted-foreground [&_th]:text-start">
            <tr>
              <th scope="col" className="py-2 pe-3">{tr("fiscalYear")}</th>
              <th scope="col" className="py-2 pe-3">{tr("certified")}</th>
              <th scope="col" className="py-2 pe-3">{tr("otherOutcomes")}</th>
              <th scope="col" className="py-2 pe-3">{tr("offeredWageAnnual")}</th>
              <th scope="col" className="py-2 pe-3">{tr("topJobTitles")}</th>
              <th scope="col" className="py-2 pe-3">{tr("states")}</th>
            </tr>
          </thead>
          <tbody>
            {detail.years.map((y) => (
              <tr key={y.fiscalYear} className="border-t border-border align-top">
                <th scope="row" className="py-2 pe-3 text-start font-medium">{tr("fYFiscalYear", { fiscalYear: y.fiscalYear })}</th>
                <td className="py-2 pe-3 tabular-nums">
                  {y.certified}
                  {y.certifiedWithdrawn > 0 && <span className="block text-xs text-muted-foreground">{tr("certifiedWithdrawnCertifiedThenWithdrawn", { certifiedWithdrawn: y.certifiedWithdrawn })}</span>}
                </td>
                <td className="py-2 pe-3 text-xs">
                  {tr("deniedDeniedWithdrawnWithdrawn", { denied: y.denied, withdrawn: y.withdrawn })}
                </td>
                <td className="py-2 pe-3 text-xs">
                  {y.wages.median == null ? "—" : (
                    <>
                      {tr.rich("medianMedianRangeMinMax", { median: money(y.wages.median), span: (chunks) => <span className="block text-muted-foreground">{chunks}</span>, min: money(y.wages.min), max: money(y.wages.max) })}
                    </>
                  )}
                </td>
                <td className="py-2 pe-3 text-xs">
                  {y.topJobTitles.length === 0 ? "—" : y.topJobTitles.map((t) => <span key={t.title} className="block">{t.title} ({t.count})</span>)}
                  {y.topSocCodes.length > 0 && (
                    <span className="mt-1 block text-muted-foreground">
                      {tr("occupationsValue", { value: y.topSocCodes.map((s) => `${s.title ?? s.code} (${s.count})`).join(", ") })}
                    </span>
                  )}
                </td>
                <td className="py-2 pe-3 text-xs">{y.states.length === 0 ? "—" : y.states.map((s) => `${s.state} ${s.count}`).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <p className="mt-2 text-xs text-muted-foreground">{tr("wagesAreTheEmployersOffered")}</p>
    </div>
  );
}

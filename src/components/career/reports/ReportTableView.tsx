"use client";

import React, { useId, useState } from "react";
import { ScrollArea, useCareerT } from "@/components/career/ui";
import { currentFormatLocale } from "@/components/career/i18n/CareerI18nProvider";

export type Cell = string | number | null;

export interface ReportTable {
  key: string;
  title: string;
  columns: string[];
  rows: Cell[][];
  note?: string | null;
  chartColumn?: number | null;
}

const fmt = (v: Cell) => (v === null || v === undefined ? "—" : typeof v === "number" ? v.toLocaleString(currentFormatLocale(), { maximumFractionDigits: 1 }) : v);

/**
 * One report table: a single-series horizontal bar chart (brand color, value printed beside each bar, so meaning never
 * depends on color) with the full data table as the accessible alternative. Suppressed cells ("<10") draw no bar.
 */
export function ReportTableView({ table, onExport, exporting }: { table: ReportTable; onExport?: () => void; exporting?: boolean }) {
  const t = useCareerT("reportTableView");
  const [view, setView] = useState<"chart" | "table">(table.chartColumn != null ? "chart" : "table");
  const headingId = useId();
  const col = table.chartColumn ?? null;
  const numeric = col == null ? [] : table.rows.map((r) => (typeof r[col] === "number" ? (r[col] as number) : null));
  const max = Math.max(1, ...numeric.map((v) => v ?? 0));

  return (
    <section aria-labelledby={headingId} className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-semibold">
          {table.title}
        </h3>
        <div className="flex items-center gap-2">
          {col != null && table.rows.length > 0 && (
            <div role="group" aria-label={t("titleViewAs", { title: table.title })} className="inline-flex rounded-md border border-border text-xs">
              {(["chart", "table"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`px-2.5 py-1 capitalize focus-visible:outline-2 focus-visible:outline-offset-1 ${view === v ? "bg-muted font-semibold" : ""}`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
          {onExport && (
            <button type="button" onClick={onExport} disabled={exporting} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted focus-visible:outline-2 disabled:opacity-50">
              {exporting ? t("exporting") : t("cSV")}
            </button>
          )}
        </div>
      </div>

      {table.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noDataForThisPeriod")}</p>
      ) : view === "chart" && col != null ? (
        <figure>
          <figcaption className="mb-2 text-xs text-muted-foreground">{table.columns[col]}</figcaption>
          <ul className="space-y-1.5">
            {table.rows.map((r, i) => {
              const v = numeric[i];
              return (
                <li key={`${r[0]}-${i}`} className="grid grid-cols-[minmax(6rem,12rem)_1fr] items-center gap-3 text-sm" title={`${r[0]}: ${fmt(r[col])}`}>
                  <span className="truncate text-muted-foreground">{r[0]}</span>
                  <span className="flex items-center gap-2">
                    {v != null && v > 0 && (
                      <span aria-hidden className="h-3 rounded-e" style={{ width: `${Math.max(1, (v / max) * 85)}%`, background: "var(--brand, #4f46e5)" }} />
                    )}
                    <span className="tabular-nums font-medium">{fmt(r[col])}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </figure>
      ) : (
        <ScrollArea>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-muted-foreground [&_th]:text-start">
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={`py-1.5 pe-3 font-medium ${i > 0 ? "text-end" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={`${r[0]}-${i}`} className="border-b border-border/60 last:border-0">
                  {r.map((c, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="py-1.5 pe-3 text-start font-normal">
                        {fmt(c)}
                      </th>
                    ) : (
                      <td key={j} className="py-1.5 pe-3 text-end tabular-nums">
                        {fmt(c)}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
      {table.note && <p className="mt-2 text-xs text-muted-foreground">{table.note}</p>}
    </section>
  );
}

export { fmt as formatCell };

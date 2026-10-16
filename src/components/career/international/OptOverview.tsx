"use client";

/** Read-only OPT summary used by the student tracker and the international-office detail view. */

import React from "react";
import { Badge, Card, ScrollArea, useCareerT } from "@/components/career/ui";
import {
  DeadlineBadge,
  LevelBadge,
  formatDay,
  type OptAuthorization,
  type OptDeadline,
  type OptEmployment,
  type OptView,
  useStateText,
} from "./shared";

export function UnemploymentMeter({ view }: { view: OptView }) {
  const t = useCareerT("optOverview");
  const STATE_TEXT = useStateText();
  const s = view.status;
  if (s.state === "NoAuthorization") {
    return <p className="text-sm text-muted-foreground">{t("addYourOPTAuthorizationThe")}</p>;
  }
  if (s.state === "PreCompletionOnly") {
    return <p className="text-sm">{t("preCompletionOPTHasNo")}</p>;
  }
  const pct = Math.min(100, Math.round((s.daysUsed / Math.max(1, s.limit)) * 100));
  const barColor = s.level === "ok" ? "bg-emerald-600" : s.level === "notice" || s.level === "warning" ? "bg-amber-500" : "bg-red-600";
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-3xl font-semibold tabular-nums">
          {s.daysUsed} <span className="text-base font-normal text-muted-foreground">{t("ofLimitUnemploymentDaysUsed", { limit: s.limit })}</span>
        </p>
        <LevelBadge level={s.level} />
        <Badge tone="neutral">{STATE_TEXT[s.state]}</Badge>
      </div>
      <div
        className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={s.limit}
        aria-valuenow={s.daysUsed}
        aria-label={t("unemploymentDaysUsed")}
      >
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        <li>
          {t.rich("daysRemainingDaysLeft", { strong: (chunks) => <strong>{chunks}</strong>, daysRemaining: s.daysRemaining })}{s.hasStem ? t("postCompletionAndSTEMExtension") : ""}.
        </li>
        {s.state === "NotStarted" && <li>{t("countingStartsOnCountingFromYour", { countingFrom: formatDay(s.countingFrom) })}</li>}
        {s.state === "Active" && (
          <li>
            {t("today")}{" "}{s.employedToday ? t("yourRecordedEmploymentCountsSo") : t("noQualifyingEmploymentIsRecorded")}
          </li>
        )}
        {s.limitReachedOn && s.level !== "limit" && s.state === "Active" && !s.employedToday && (
          <li>{t("ifYouStayUnemployedYou", { limitReachedOn: formatDay(s.limitReachedOn) })}</li>
        )}
        {s.level === "limit" && s.limitReachedOn && <li>{t("theLimitWasReachedOn", { limitReachedOn: formatDay(s.limitReachedOn) })}</li>}
        {s.nextWarningAt != null && s.level !== "limit" && <li>{t("nextWarningAtNextWarningAtDays", { nextWarningAt: s.nextWarningAt })}</li>}
        {s.state === "Ended" && <li>{t("yourCountedOPTPeriodsHave")}</li>}
      </ul>
    </div>
  );
}

export function ChecksList({ checks }: { checks: OptView["checks"] }) {
  const t = useCareerT("optOverview");
  if (checks.length === 0) return <p className="text-sm text-muted-foreground">{t("nothingNeedsYourAttentionRight")}</p>;
  return (
    <ul className="space-y-2 text-sm">
      {checks.map((c, i) => (
        <li key={i} className="flex items-start gap-2">
          <Badge tone={c.level === "bad" ? "bad" : c.level === "warn" ? "warn" : "info"}>{c.level === "bad" ? t("important") : c.level === "warn" ? t("check") : t("note")}</Badge>
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function DeadlinesTable({ deadlines, actions }: { deadlines: OptDeadline[]; actions?: (d: OptDeadline) => React.ReactNode }) {
  const t = useCareerT("optOverview");
  if (deadlines.length === 0) return <p className="text-sm text-muted-foreground">{t("noReportingDeadlinesYet")}</p>;
  return (
    <ScrollArea>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("reportingAndEvaluationDeadlines")}</caption>
        <thead className="text-start text-xs uppercase text-muted-foreground [&_th]:text-start">
          <tr>
            <th scope="col" className="py-2 pe-3">{t("what")}</th>
            <th scope="col" className="py-2 pe-3">{t("due")}</th>
            <th scope="col" className="py-2 pe-3">{t("status")}</th>
            {actions && <th scope="col" className="py-2"><span className="sr-only">{t("actions")}</span></th>}
          </tr>
        </thead>
        <tbody>
          {deadlines.map((d) => (
            <tr key={d.key} className="border-t border-border">
              <td className="py-2 pe-3">{d.label}</td>
              <td className="py-2 pe-3 whitespace-nowrap">{formatDay(d.dueOn)}</td>
              <td className="py-2 pe-3"><DeadlineBadge status={d.status} /></td>
              {actions && <td className="py-2 text-end">{actions(d)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

export function AuthorizationsTable({ items, actions }: { items: OptAuthorization[]; actions?: (a: OptAuthorization) => React.ReactNode }) {
  const t = useCareerT("optOverview");
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t("noOPTAuthorizationRecorded")}</p>;
  return (
    <ScrollArea>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("oPTAuthorizationPeriods")}</caption>
        <thead className="text-start text-xs uppercase text-muted-foreground [&_th]:text-start">
          <tr>
            <th scope="col" className="py-2 pe-3">{t("type")}</th>
            <th scope="col" className="py-2 pe-3">{t("eADStart")}</th>
            <th scope="col" className="py-2 pe-3">{t("eADEnd")}</th>
            <th scope="col" className="py-2 pe-3">{t("selfEvaluations")}</th>
            {actions && <th scope="col" className="py-2"><span className="sr-only">{t("actions")}</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-border align-top">
              <td className="py-2 pe-3">
                {a.label}
                {!a.countsTowardUnemployment && <span className="block text-xs text-muted-foreground">{t("noUnemploymentLimit")}</span>}
              </td>
              <td className="py-2 pe-3 whitespace-nowrap">{formatDay(a.eadStart)}</td>
              <td className="py-2 pe-3 whitespace-nowrap">{formatDay(a.eadEnd)}</td>
              <td className="py-2 pe-3">
                {a.evaluations
                  ? a.evaluations.map((e) => (
                      <span key={e.month} className="block">
                        {t("monthMonthDueDueOn", { month: e.month, dueOn: formatDay(e.dueOn) })}{" "}{e.submittedOn ? t("submittedSubmittedOn", { submittedOn: formatDay(e.submittedOn) }) : t("notSubmitted")}
                      </span>
                    ))
                  : "—"}
              </td>
              {actions && <td className="py-2 text-end">{actions(a)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

export function EmploymentsTable({ items, hasStem, actions }: { items: OptEmployment[]; hasStem: boolean; actions?: (j: OptEmployment) => React.ReactNode }) {
  const t = useCareerT("optOverview");
  if (items.length === 0) return <p className="text-sm text-muted-foreground">{t("noEmploymentRecorded")}</p>;
  return (
    <ScrollArea>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("employmentDuringOPT")}</caption>
        <thead className="text-start text-xs uppercase text-muted-foreground [&_th]:text-start">
          <tr>
            <th scope="col" className="py-2 pe-3">{t("employer")}</th>
            <th scope="col" className="py-2 pe-3">{t("dates")}</th>
            <th scope="col" className="py-2 pe-3">{t("hoursWeek")}</th>
            <th scope="col" className="py-2 pe-3">{t("counts")}</th>
            <th scope="col" className="py-2 pe-3">{t("reportedToDSO")}</th>
            {actions && <th scope="col" className="py-2"><span className="sr-only">{t("actions")}</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr key={j.id} className="border-t border-border align-top">
              <td className="py-2 pe-3">
                <span className="font-medium">{j.employerName}</span>
                {j.jobTitle && <span className="block text-xs text-muted-foreground">{j.jobTitle}</span>}
                <span className="block text-xs text-muted-foreground">
                  {j.relatedToMajor ? t("relatedToMajor") : t("notConfirmedAsRelatedTo")}
                  {" · "}
                  {j.eVerifyEmployer ? t("eVerifyEmployer") : t("notEVerify")}
                </span>
              </td>
              <td className="py-2 pe-3 whitespace-nowrap">
                {formatDay(j.startDate)} – {j.endDate ? formatDay(j.endDate) : t("present")}
              </td>
              <td className="py-2 pe-3 tabular-nums">{j.hoursPerWeek}</td>
              <td className="py-2 pe-3">
                <span className="block">{t("postCompletion2")}{" "}{j.countsForPostCompletion ? t("yes") : t("no")}</span>
                {hasStem && <span className="block">{t("sTEM")}{" "}{j.countsForStem ? t("yes") : t("no")}</span>}
              </td>
              <td className="py-2 pe-3">
                <span className="block">{t("start")}{" "}{j.startReportedOn ? formatDay(j.startReportedOn) : t("notYet")}</span>
                {j.endDate && <span className="block">{t("end")}{" "}{j.endReportedOn ? formatDay(j.endReportedOn) : t("notYet")}</span>}
              </td>
              {actions && <td className="py-2 text-end">{actions(j)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}

export function SpansAndRules({ view }: { view: OptView }) {
  const t = useCareerT("optOverview");
  const r = view.rules;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title={t("unemploymentPeriodsCounted")}>
        {view.status.unemployedSpans.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noUnemploymentDaysCounted")}</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {view.status.unemployedSpans.map((s, i) => (
              <li key={i}>
                {t.rich("startEndDaysDays", { days: s.days, start: formatDay(s.start), end: formatDay(s.end), strong: (chunks) => <strong>{chunks}</strong> })}{s.phase === "StemExtension" ? t("sTEMExtension") : t("postCompletion")})
              </li>
            ))}
          </ul>
        )}
        {view.cpt.periods.length > 0 && (
          <p className="mt-4 text-sm">
            {t.rich("fullTimeCPTOnRecord", { strong: (chunks) => <strong>{chunks}</strong>, fullTimeDays: view.cpt.fullTimeDays })}
          </p>
        )}
      </Card>
      <Card title={t("howDaysAreCounted")}>
        <ul className="list-disc space-y-1 ps-5 text-sm">
          <li>{t("postCompletionOPTAllowsUp", { postCompletionUnemploymentDays: r.postCompletionUnemploymentDays })}</li>
          <li>{t("aSTEMExtensionAddsStemAdditionalUnemploy", { stemAdditionalUnemploymentDays: r.stemAdditionalUnemploymentDays, stemTotalUnemploymentDays: r.stemTotalUnemploymentDays })}</li>
          <li>
            {t("aJobCountsWhenIt", { minHoursPerWeek: r.minHoursPerWeek })}
            {r.combineHoursAcrossJobs ? t("relatedJobsHeldAtThe") : ""}{t("duringASTEMExtensionThe")}
          </li>
          <li>{t("countingStartsOnYourEAD")}</li>
          <li>{t("reportEmploymentChangesWithinReportingWi", { reportingWindowDays: r.reportingWindowDays })}</li>
          <li>{t("sTEMSelfEvaluationsAreDue", { stemEvaluationMonths: r.stemEvaluationMonths.join(" and ") })}</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{r.note}</p>
      </Card>
    </div>
  );
}

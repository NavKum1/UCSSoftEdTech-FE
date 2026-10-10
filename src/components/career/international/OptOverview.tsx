"use client";

/** Read-only OPT summary used by the student tracker and the international-office detail view. */

import React from "react";
import { Badge, Card } from "@/components/career/ui";
import {
  DeadlineBadge,
  LevelBadge,
  STATE_TEXT,
  formatDay,
  type OptAuthorization,
  type OptDeadline,
  type OptEmployment,
  type OptView,
} from "./shared";

export function UnemploymentMeter({ view }: { view: OptView }) {
  const s = view.status;
  if (s.state === "NoAuthorization") {
    return <p className="text-sm text-muted-foreground">Add your OPT authorization (the dates on your EAD card) to start counting.</p>;
  }
  if (s.state === "PreCompletionOnly") {
    return <p className="text-sm">Pre-completion OPT has no unemployment limit, so no days are counted.</p>;
  }
  const pct = Math.min(100, Math.round((s.daysUsed / Math.max(1, s.limit)) * 100));
  const barColor = s.level === "ok" ? "bg-emerald-600" : s.level === "notice" || s.level === "warning" ? "bg-amber-500" : "bg-red-600";
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <p className="text-3xl font-semibold tabular-nums">
          {s.daysUsed} <span className="text-base font-normal text-muted-foreground">of {s.limit} unemployment days used</span>
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
        aria-label="Unemployment days used"
      >
        <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        <li>
          <strong>{s.daysRemaining}</strong> days left{s.hasStem ? " (post-completion and STEM extension combined)" : ""}.
        </li>
        {s.state === "NotStarted" && <li>Counting starts on {formatDay(s.countingFrom)}, your EAD start date.</li>}
        {s.state === "Active" && (
          <li>
            Today: {s.employedToday ? "your recorded employment counts, so no day is added." : "no qualifying employment is recorded, so today counts as unemployed."}
          </li>
        )}
        {s.limitReachedOn && s.level !== "limit" && s.state === "Active" && !s.employedToday && (
          <li>If you stay unemployed, you would reach the limit on {formatDay(s.limitReachedOn)}.</li>
        )}
        {s.level === "limit" && s.limitReachedOn && <li>The limit was reached on {formatDay(s.limitReachedOn)}.</li>}
        {s.nextWarningAt != null && s.level !== "limit" && <li>Next warning at {s.nextWarningAt} days.</li>}
        {s.state === "Ended" && <li>Your counted OPT periods have ended.</li>}
      </ul>
    </div>
  );
}

export function ChecksList({ checks }: { checks: OptView["checks"] }) {
  if (checks.length === 0) return <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {checks.map((c, i) => (
        <li key={i} className="flex items-start gap-2">
          <Badge tone={c.level === "bad" ? "bad" : c.level === "warn" ? "warn" : "info"}>{c.level === "bad" ? "Important" : c.level === "warn" ? "Check" : "Note"}</Badge>
          <span>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}

export function DeadlinesTable({ deadlines, actions }: { deadlines: OptDeadline[]; actions?: (d: OptDeadline) => React.ReactNode }) {
  if (deadlines.length === 0) return <p className="text-sm text-muted-foreground">No reporting deadlines yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Reporting and evaluation deadlines</caption>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-3">What</th>
            <th scope="col" className="py-2 pr-3">Due</th>
            <th scope="col" className="py-2 pr-3">Status</th>
            {actions && <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {deadlines.map((d) => (
            <tr key={d.key} className="border-t border-border">
              <td className="py-2 pr-3">{d.label}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{formatDay(d.dueOn)}</td>
              <td className="py-2 pr-3"><DeadlineBadge status={d.status} /></td>
              {actions && <td className="py-2 text-right">{actions(d)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuthorizationsTable({ items, actions }: { items: OptAuthorization[]; actions?: (a: OptAuthorization) => React.ReactNode }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No OPT authorization recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">OPT authorization periods</caption>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-3">Type</th>
            <th scope="col" className="py-2 pr-3">EAD start</th>
            <th scope="col" className="py-2 pr-3">EAD end</th>
            <th scope="col" className="py-2 pr-3">Self-evaluations</th>
            {actions && <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-t border-border align-top">
              <td className="py-2 pr-3">
                {a.label}
                {!a.countsTowardUnemployment && <span className="block text-xs text-muted-foreground">No unemployment limit</span>}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">{formatDay(a.eadStart)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{formatDay(a.eadEnd)}</td>
              <td className="py-2 pr-3">
                {a.evaluations
                  ? a.evaluations.map((e) => (
                      <span key={e.month} className="block">
                        {e.month}-month: due {formatDay(e.dueOn)} — {e.submittedOn ? `submitted ${formatDay(e.submittedOn)}` : "not submitted"}
                      </span>
                    ))
                  : "—"}
              </td>
              {actions && <td className="py-2 text-right">{actions(a)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function EmploymentsTable({ items, hasStem, actions }: { items: OptEmployment[]; hasStem: boolean; actions?: (j: OptEmployment) => React.ReactNode }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No employment recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Employment during OPT</caption>
        <thead className="text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th scope="col" className="py-2 pr-3">Employer</th>
            <th scope="col" className="py-2 pr-3">Dates</th>
            <th scope="col" className="py-2 pr-3">Hours/week</th>
            <th scope="col" className="py-2 pr-3">Counts?</th>
            <th scope="col" className="py-2 pr-3">Reported to DSO</th>
            {actions && <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((j) => (
            <tr key={j.id} className="border-t border-border align-top">
              <td className="py-2 pr-3">
                <span className="font-medium">{j.employerName}</span>
                {j.jobTitle && <span className="block text-xs text-muted-foreground">{j.jobTitle}</span>}
                <span className="block text-xs text-muted-foreground">
                  {j.relatedToMajor ? "Related to major" : "Not confirmed as related to major"}
                  {" · "}
                  {j.eVerifyEmployer ? "E-Verify employer" : "Not E-Verify"}
                </span>
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">
                {formatDay(j.startDate)} – {j.endDate ? formatDay(j.endDate) : "present"}
              </td>
              <td className="py-2 pr-3 tabular-nums">{j.hoursPerWeek}</td>
              <td className="py-2 pr-3">
                <span className="block">Post-completion: {j.countsForPostCompletion ? "yes" : "no"}</span>
                {hasStem && <span className="block">STEM: {j.countsForStem ? "yes" : "no"}</span>}
              </td>
              <td className="py-2 pr-3">
                <span className="block">Start: {j.startReportedOn ? formatDay(j.startReportedOn) : "not yet"}</span>
                {j.endDate && <span className="block">End: {j.endReportedOn ? formatDay(j.endReportedOn) : "not yet"}</span>}
              </td>
              {actions && <td className="py-2 text-right">{actions(j)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SpansAndRules({ view }: { view: OptView }) {
  const r = view.rules;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Unemployment periods counted">
        {view.status.unemployedSpans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unemployment days counted.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {view.status.unemployedSpans.map((s, i) => (
              <li key={i}>
                {formatDay(s.start)} – {formatDay(s.end)}: <strong>{s.days}</strong> day{s.days === 1 ? "" : "s"} ({s.phase === "StemExtension" ? "STEM extension" : "post-completion"})
              </li>
            ))}
          </ul>
        )}
        {view.cpt.periods.length > 0 && (
          <p className="mt-4 text-sm">
            Full-time CPT on record: <strong>{view.cpt.fullTimeDays}</strong> days (12 months or more can affect OPT eligibility).
          </p>
        )}
      </Card>
      <Card title="How days are counted">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Post-completion OPT allows up to {r.postCompletionUnemploymentDays} days of unemployment in total.</li>
          <li>A STEM extension adds {r.stemAdditionalUnemploymentDays} days, for {r.stemTotalUnemploymentDays} in total across both periods.</li>
          <li>
            A job counts when it is related to your major and is at least {r.minHoursPerWeek} hours a week
            {r.combineHoursAcrossJobs ? " (related jobs held at the same time are added together)" : ""}. During a STEM extension the employer must also use E-Verify.
          </li>
          <li>Counting starts on your EAD start date. Days between EAD periods are not counted here; ask your DSO how they apply to you.</li>
          <li>Report employment changes within {r.reportingWindowDays} days.</li>
          <li>STEM self-evaluations are due at {r.stemEvaluationMonths.join(" and ")} months.</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">{r.note}</p>
      </Card>
    </div>
  );
}

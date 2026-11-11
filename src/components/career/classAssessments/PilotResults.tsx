"use client";

/**
 * Build & Defend Stage 3: a pilot's results, the same for the school (school admins: the whole school; teachers: their own
 * classes) and for Edulexa staff. Completion, the teachers' active review time, how often the AI's suggested scores matched the
 * teachers', the points the evidence raised, appeals, and the students' anonymous answers after the viva (shown from 3 up).
 * API: /api/career/class-assessments/pilot-results (and .csv); staff: /api/career/platform/schools/{id}/pilot-results.
 */
import React, { useState } from "react";
import { useEn } from "@/lib/english/EnglishProvider";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, StatTile, buttonClass, formatDate, useLoad } from "@/components/career/ui";
import type { useApi } from "@/lib/appAuth";
import { downloadBlob } from "@/components/career/privacy/StudentPrivacyRights";

type Api = ReturnType<typeof useApi>;

export interface PilotFigures {
  completion: { students: number; started: number; handedIn: number; vivaDone: number; decided: number };
  reviewTime: { measured: number; medianMinutes: number | null; averageMinutes: number | null; totalHours: number };
  aiMatch: { attempts: number; criteria: number; withinPct: number | null; samePct: number | null; averageDifference: number | null; attemptsAllWithinPct: number | null };
  integrity: { opened: number; withPoints: number; points: { code: string; count: number }[] };
  appeals: { open: number; upheld: number; changed: number };
  feedback: { answers: number; shown: boolean; fair: number | null; ownWork: number | null; fairCounts: number[] | null; ownWorkCounts: number[] | null; comments: string[] | null };
}

export interface PilotResultsData {
  school: { id: string; name: string; pilotStartsAt: string | null; pilotEndsAt: string | null };
  scope: "school" | "classes";
  from: string | null;
  to: string | null;
  matchPoints: number;
  minAnswers: number;
  total: PilotFigures;
  assessments: { assessmentId: string; assignmentId: string; title: string; template: string; className: string; opensAt: string; dueAt: string; figures: PilotFigures }[];
}


/** The page: dates, the CSV, and the results (the API path decides whose results they are) */
export function PilotResultsPage({ api, path, csvPath, staff = false }: { api: Api; path: string; csvPath: string; staff?: boolean }) {
  const en = useEn();
  const [range, setRange] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [draft, setDraft] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const query = new URLSearchParams();
  if (range.from) query.set("from", range.from);
  if (range.to) query.set("to", range.to + "T23:59:59Z");
  const qs = query.toString() ? `?${query}` : "";
  const res = useLoad(() => api<PilotResultsData>(path + qs), [api, path, qs]);
  const [downloading, setDownloading] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);

  const download = async () => {
    setDownloading(true);
    setCsvError(null);
    try {
      const r = await api<Response>(csvPath + qs, { raw: true });
      if (!r.ok) throw new Error(en("The spreadsheet couldn't be made. Please try again."));
      await downloadBlob(r, "pilot-results.csv");
    } catch (e) {
      setCsvError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const d = res.data;
  const pilot = d?.school.pilotStartsAt && d.school.pilotEndsAt;
  const title = pilot ? en("Pilot results") : en("Assessment results");
  const description = d
    ? d.from && d.to
      ? en("{school}, {from} to {to}", { school: d.school.name, from: formatDate(d.from), to: formatDate(d.to) })
      : d.from
        ? en("{school}, from {from}", { school: d.school.name, from: formatDate(d.from) })
        : en("{school}, all assessments so far", { school: d.school.name })
    : undefined;

  return (
    <div>
      <PageHeader
        title={staff && d ? `${title}: ${d.school.name}` : title}
        description={description}
        actions={
          <Button variant="secondary" busy={downloading} onClick={() => void download()} disabled={!d}>
            {en("Download spreadsheet (CSV)")}
          </Button>
        }
      />
      <ErrorBanner error={csvError} />
      <form
        className="mb-6 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setRange(draft);
        }}
      >
        <div className="w-40">
          <Field label={en("From")}>{(p) => <input {...p} type="date" value={draft.from} onChange={(e) => setDraft((x) => ({ ...x, from: e.target.value }))} />}</Field>
        </div>
        <div className="w-40">
          <Field label={en("To")}>{(p) => <input {...p} type="date" value={draft.to} onChange={(e) => setDraft((x) => ({ ...x, to: e.target.value }))} />}</Field>
        </div>
        <button type="submit" className={buttonClass("secondary")}>{en("Show")}</button>
        {(range.from || range.to) && (
          <button type="button" className={buttonClass("ghost")} onClick={() => { setDraft({ from: "", to: "" }); setRange({ from: "", to: "" }); }}>
            {pilot ? en("The pilot's dates") : en("All dates")}
          </button>
        )}
      </form>
      <ErrorBanner error={res.error} onRetry={res.reload} />
      {res.loading && !d ? <Loading /> : d ? <PilotResultsView data={d} /> : null}
    </div>
  );
}

export function PilotResultsView({ data }: { data: PilotResultsData }) {
  const en = useEn();
  const f = data.total;
  if (data.assessments.length === 0)
    return (
      <EmptyState title={en("No assessments in these dates yet")}>
        {data.scope === "classes"
          ? en("Results appear here once you give an assessment to one of your classes.")
          : en("Results appear here once a teacher gives an assessment to a class.")}
      </EmptyState>
    );
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v)}%`);
  const minutes = (v: number | null) => (v == null ? "–" : en("{minutes} min", { minutes: v }));
  return (
    <div className="space-y-6">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <StatTile label={en("Decided")} value={en("{done} of {students}", { done: f.completion.decided, students: f.completion.students })}
            hint={en("Students whose result a teacher has decided")} />
        </li>
        <li>
          <StatTile label={en("Review time per attempt")} value={minutes(f.reviewTime.medianMinutes)}
            hint={f.reviewTime.measured ? en("Middle value, from {count} reviews", { count: f.reviewTime.measured }) : en("Measured once teachers decide")} />
        </li>
        <li>
          <StatTile label={en("AI matched the teacher")} value={pct(f.aiMatch.withinPct)}
            hint={f.aiMatch.criteria ? en("Scores within {points} points, over {count} criteria", { points: data.matchPoints, count: f.aiMatch.criteria }) : en("Compared once teachers decide")} />
        </li>
        <li>
          <StatTile label={en("Students found it fair")} value={f.feedback.shown && f.feedback.fair != null ? en("{score} of 5", { score: f.feedback.fair }) : "–"}
            hint={f.feedback.shown ? en("Average of {count} anonymous answers", { count: f.feedback.answers }) : en("Shown from {min} answers ({count} so far)", { min: data.minAnswers, count: f.feedback.answers })} />
        </li>
      </ul>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={en("Completion")}>
          <Funnel c={f.completion} />
        </Card>
        <Card title={en("The AI's suggestions and the teachers' scores")}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Figure label={en("Criteria within {points} points", { points: data.matchPoints })} value={pct(f.aiMatch.withinPct)} />
            <Figure label={en("Criteria left unchanged")} value={pct(f.aiMatch.samePct)} />
            <Figure label={en("Average difference")} value={f.aiMatch.averageDifference == null ? "–" : en("{points} points", { points: f.aiMatch.averageDifference })} />
            <Figure label={en("Attempts with every criterion within {points}", { points: data.matchPoints })} value={pct(f.aiMatch.attemptsAllWithinPct)} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {en("From {count} decided attempts with suggestions. The AI only suggests; teachers decide every score.", { count: f.aiMatch.attempts })}
          </p>
        </Card>
        <Card title={en("Teachers' review time")}>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Figure label={en("Middle value per attempt")} value={minutes(f.reviewTime.medianMinutes)} />
            <Figure label={en("Average per attempt")} value={minutes(f.reviewTime.averageMinutes)} />
            <Figure label={en("Total")} value={en("{hours} hours", { hours: f.reviewTime.totalHours })} />
            <Figure label={en("Reviews measured")} value={String(f.reviewTime.measured)} />
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            {en("Active time on the evidence page, from the first look to the decision. Time with the page in the background, or with nobody active for 2 minutes, doesn't count.")}
          </p>
        </Card>
        <Card title={en("Points to talk about and appeals")}>
          <PointsAndAppeals f={f} />
        </Card>
      </div>

      <Card title={en("What students said")}>
        <StudentAnswers f={f.feedback} min={data.minAnswers} />
      </Card>

      <Card title={en("By assessment")}>
        <ByAssessment rows={data.assessments} matchPoints={data.matchPoints} />
      </Card>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Funnel({ c }: { c: PilotFigures["completion"] }) {
  const en = useEn();
  const steps = [
    { label: en("In the class"), value: c.students },
    { label: en("Started"), value: c.started },
    { label: en("Handed in their work"), value: c.handedIn },
    { label: en("Finished the viva"), value: c.vivaDone },
    { label: en("Decided by a teacher"), value: c.decided },
  ];
  const top = Math.max(1, c.students, c.started);
  return (
    <ol className="space-y-2.5 text-sm">
      {steps.map((s) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span>{s.label}</span>
            <span className="font-semibold tabular-nums">{s.value}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${Math.round((100 * s.value) / top)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Short names for the points the evidence raises (the evidence page explains each in full) */
function usePointName() {
  const en = useEn();
  return (code: string): string => {
    switch (code) {
      case "same_files":
      case "same_upload":
        return en("Same work as another student");
      case "repo_commits_low":
        return en("Few of the repository's commits are theirs");
      case "repo_not_verified":
        return en("Repository ownership not confirmed");
      case "change_not_handed_in":
        return en("Change task not handed in");
      case "change_test_machinery":
        return en("Change task used the test machinery");
      default:
        if (code.startsWith("coding_") || code.startsWith("change_")) return en("Editing pattern worth asking about");
        return en("Other point");
    }
  };
}

function PointsAndAppeals({ f }: { f: PilotFigures }) {
  const en = useEn();
  const name = usePointName();
  // Codes that share a short name are counted together
  const grouped = new Map<string, number>();
  for (const p of f.integrity.points) grouped.set(name(p.code), (grouped.get(name(p.code)) ?? 0) + p.count);
  return (
    <div className="space-y-4 text-sm">
      <p>
        {f.integrity.opened === 0
          ? en("Counted once teachers open students' evidence.")
          : en("{count} of {opened} attempts teachers opened raised a point to talk about.", { count: f.integrity.withPoints, opened: f.integrity.opened })}
      </p>
      {grouped.size > 0 && (
        <ul className="space-y-1.5">
          {[...grouped.entries()].sort((a, b) => b[1] - a[1]).map(([label, count]) => (
            <li key={label} className="flex items-baseline justify-between gap-3">
              <span>{label}</span>
              <Badge tone="warn">{count}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">{en("Points are things worth asking the student about, not findings.")}</p>
      <div className="border-t border-border pt-3">
        <p className="font-medium">{en("Appeals")}</p>
        <p className="mt-1 text-muted-foreground">
          {f.appeals.open + f.appeals.upheld + f.appeals.changed === 0
            ? en("No appeals.")
            : en("{open} open, {upheld} upheld, {changed} changed", { open: f.appeals.open, upheld: f.appeals.upheld, changed: f.appeals.changed })}
        </p>
      </div>
    </div>
  );
}

function StudentAnswers({ f, min }: { f: PilotFigures["feedback"]; min: number }) {
  const en = useEn();
  if (!f.shown)
    return (
      <p className="text-sm text-muted-foreground">
        {en("Students answer two questions after the viva, anonymously. The answers show here from {min} up, so no one's can be picked out ({count} so far).", { min, count: f.answers })}
      </p>
    );
  const scale = [en("Not at all"), en("A little"), en("Partly"), en("Mostly"), en("Completely")];
  const bars = (title: string, avg: number | null, counts: number[] | null) => (
    <div>
      <p className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{title}</span>
        <span className="font-semibold tabular-nums">{avg == null ? "–" : en("{score} of 5", { score: avg })}</span>
      </p>
      <ol className="mt-2 space-y-1">
        {(counts ?? []).map((n, i) => (
          <li key={i} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-xs">
            <span className="text-muted-foreground">{scale[i]}</span>
            <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <span className="block h-full rounded-full bg-[var(--brand)]" style={{ width: `${f.answers ? Math.round((100 * n) / f.answers) : 0}%` }} />
            </span>
            <span className="text-end tabular-nums">{n}</span>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <div className="space-y-5 text-sm">
      <div className="grid gap-6 md:grid-cols-2">
        {bars(en("Was this assessment fair?"), f.fair, f.fairCounts)}
        {bars(en("Did the viva reflect your own work?"), f.ownWork, f.ownWorkCounts)}
      </div>
      <p className="text-xs text-muted-foreground">{en("From {count} anonymous answers.", { count: f.answers })}</p>
      {f.comments && f.comments.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="font-medium">{en("Comments")}</p>
          <ul className="mt-2 space-y-2">
            {f.comments.map((c, i) => (
              <li key={i} className="whitespace-pre-line rounded-lg border border-border bg-muted/40 p-3">{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ByAssessment({ rows, matchPoints }: { rows: PilotResultsData["assessments"]; matchPoints: number }) {
  const en = useEn();
  const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v)}%`);
  return (
    <ul className="divide-y divide-border text-sm">
      {rows.map((r) => {
        const f = r.figures;
        return (
          <li key={r.assignmentId} className="grid gap-3 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.title}</p>
              <p className="text-xs text-muted-foreground">{en("{className}, due {due}", { className: r.className, due: formatDate(r.dueAt) })}</p>
            </div>
            <Cell label={en("Decided")} value={en("{done} of {students}", { done: f.completion.decided, students: f.completion.students })} />
            <Cell label={en("Review time")} value={f.reviewTime.medianMinutes == null ? "–" : en("{minutes} min", { minutes: f.reviewTime.medianMinutes })} />
            <Cell label={en("AI within {points}", { points: matchPoints })} value={pct(f.aiMatch.withinPct)} />
            <Cell label={en("Answers")} value={String(f.feedback.answers)} />
          </li>
        );
      })}
    </ul>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 md:block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums md:block">{value}</span>
    </div>
  );
}


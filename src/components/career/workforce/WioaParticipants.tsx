"use client";

/** G15: WIOA participant records (periods of participation), quarterly wages, credentials and measurable skill gains. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { checkboxClass, useDateOnly, useIsCareerAdmin } from "./shared";
import type { WioaDefinitions } from "./WioaReport";

interface Participant {
  id: string;
  studentUserId: string;
  studentName?: string | null;
  studentEmail?: string | null;
  program: string;
  localId?: string | null;
  entryDate: string;
  exitDate?: string | null;
  exitReasonCode: string;
  trainingType: string;
  trainingEnrolledDate?: string | null;
  trainingCompletedDate?: string | null;
  youthEducationQ2: boolean;
  youthEducationQ4: boolean;
  postsecondaryWithinYear: boolean;
  notes?: string | null;
}

interface Detail {
  participant: Participant;
  wages: { id: string; year: number; quarter: number; amount: number; source: string; employerName?: string | null; employerKey?: string | null; sourceDocument?: string | null; enteredVia: string }[];
  credentials: { id?: string | null; typeCode: number; name: string; attainedOn: string; origin: string; note?: string | null }[];
  gains: { id?: string | null; gainType: string; achievedOn: string; origin: string; note?: string | null }[];
  quarters: { q2: QuarterView | null; q4: QuarterView | null };
  placements: { id: string; employerName: string; title: string; employmentType: string; startDate?: string | null; verificationLevel: string }[];
}

interface QuarterView {
  quarter: string;
  status: string;
  earnings?: number | null;
  source?: string | null;
}

type FormState = {
  email: string;
  program: string;
  localId: string;
  entryDate: string;
  exitDate: string;
  exitReasonCode: string;
  trainingType: string;
  trainingEnrolledDate: string;
  trainingCompletedDate: string;
  youthEducationQ2: boolean;
  youthEducationQ4: boolean;
  postsecondaryWithinYear: boolean;
  notes: string;
};

const emptyForm: FormState = {
  email: "", program: "Adult", localId: "", entryDate: "", exitDate: "", exitReasonCode: "00", trainingType: "None", trainingEnrolledDate: "", trainingCompletedDate: "",
  youthEducationQ2: false, youthEducationQ4: false, postsecondaryWithinYear: false, notes: "",
};

const fromParticipant = (p: Participant): FormState => ({
  email: p.studentEmail ?? "", program: p.program, localId: p.localId ?? "", entryDate: p.entryDate, exitDate: p.exitDate ?? "", exitReasonCode: p.exitReasonCode,
  trainingType: p.trainingType, trainingEnrolledDate: p.trainingEnrolledDate ?? "", trainingCompletedDate: p.trainingCompletedDate ?? "",
  youthEducationQ2: p.youthEducationQ2, youthEducationQ4: p.youthEducationQ4, postsecondaryWithinYear: p.postsecondaryWithinYear, notes: p.notes ?? "",
});

const payload = (f: FormState) => ({
  email: f.email || undefined, program: f.program, localId: f.localId || null, entryDate: f.entryDate || null, exitDate: f.exitDate || null,
  exitReasonCode: f.exitDate ? f.exitReasonCode : "00", trainingType: f.trainingType, trainingEnrolledDate: f.trainingEnrolledDate || null,
  trainingCompletedDate: f.trainingCompletedDate || null, youthEducationQ2: f.youthEducationQ2, youthEducationQ4: f.youthEducationQ4,
  postsecondaryWithinYear: f.postsecondaryWithinYear, notes: f.notes || null,
});

function ParticipantForm({ defs, initial, creating, onSubmit, onCancel }: { defs: WioaDefinitions; initial: FormState; creating: boolean; onSubmit: (f: FormState) => Promise<void>; onCancel?: () => void }) {
  const t = useCareerT("workforce");
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<FormState>) => setF({ ...f, ...patch });
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(f);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {creating && <Field label={t("studentEmail")}>{(props) => <input {...props} type="email" required dir="ltr" value={f.email} onChange={(e) => set({ email: e.target.value })} />}</Field>}
        <Field label={t("program")}>
          {(props) => (
            <select {...props} value={f.program} onChange={(e) => set({ program: e.target.value })}>
              {defs.programs.map((p) => (
                <option key={p} value={p}>
                  {t(`programs.${p}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("localId")} hint={t("localIdHint")}>{(props) => <input {...props} dir="ltr" value={f.localId} onChange={(e) => set({ localId: e.target.value })} />}</Field>
        <Field label={t("entryDate")}>{(props) => <input {...props} type="date" required value={f.entryDate} onChange={(e) => set({ entryDate: e.target.value })} />}</Field>
        <Field label={t("exitDate")} hint={t("exitDateHint")}>{(props) => <input {...props} type="date" value={f.exitDate} onChange={(e) => set({ exitDate: e.target.value })} />}</Field>
        <Field label={t("exitReason")}>
          {(props) => (
            <select {...props} value={f.exitReasonCode} disabled={!f.exitDate} onChange={(e) => set({ exitReasonCode: e.target.value })}>
              {defs.exitReasons.map((c) => (
                <option key={c} value={c}>
                  {t(`exitReasons.c${c}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("trainingType")}>
          {(props) => (
            <select {...props} value={f.trainingType} onChange={(e) => set({ trainingType: e.target.value })}>
              {defs.trainingTypes.map((x) => (
                <option key={x} value={x}>
                  {t(`trainingTypes.${x}`)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label={t("trainingEnrolled")}>{(props) => <input {...props} type="date" value={f.trainingEnrolledDate} onChange={(e) => set({ trainingEnrolledDate: e.target.value })} />}</Field>
        <Field label={t("trainingCompleted")}>{(props) => <input {...props} type="date" value={f.trainingCompletedDate} onChange={(e) => set({ trainingCompletedDate: e.target.value })} />}</Field>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t("followUpLegend")}</legend>
        {f.program === "Youth" && (
          <>
            <div className="flex items-center gap-2">
              <input id="p-yq2" type="checkbox" className={checkboxClass} checked={f.youthEducationQ2} onChange={(e) => set({ youthEducationQ2: e.target.checked })} />
              <label htmlFor="p-yq2" className="text-sm">{t("youthQ2")}</label>
            </div>
            <div className="flex items-center gap-2">
              <input id="p-yq4" type="checkbox" className={checkboxClass} checked={f.youthEducationQ4} onChange={(e) => set({ youthEducationQ4: e.target.checked })} />
              <label htmlFor="p-yq4" className="text-sm">{t("youthQ4")}</label>
            </div>
          </>
        )}
        <div className="flex items-center gap-2">
          <input id="p-ps" type="checkbox" className={checkboxClass} checked={f.postsecondaryWithinYear} onChange={(e) => set({ postsecondaryWithinYear: e.target.checked })} />
          <label htmlFor="p-ps" className="text-sm">{t("postsecondaryWithinYear")}</label>
        </div>
      </fieldset>
      <Field label={t("notes")}>{(props) => <textarea {...props} rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />}</Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" busy={busy}>
          {creating ? t("addParticipant") : t("saveParticipant")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("cancel")}
          </Button>
        )}
      </div>
    </form>
  );
}

function ParticipantDetail({ id, defs, onChanged, onClose }: { id: string; defs: WioaDefinitions; onChanged: () => void; onClose: () => void }) {
  const api = useApi();
  const t = useCareerT("workforce");
  const fmt = useCareerFormat();
  const dateOnly = useDateOnly();
  const isAdmin = useIsCareerAdmin();
  const detail = useLoad(() => api<Detail>(`/api/career/workforce/wioa/participants/${id}`), [api, id]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [wage, setWage] = useState({ year: String(new Date().getUTCFullYear() - 1), quarter: "1", amount: "", source: "UiWage", employerName: "", employerKey: "", sourceDocument: "" });
  const [cred, setCred] = useState({ typeCode: "5", name: "", attainedOn: "" });
  const [gain, setGain] = useState({ gainType: "TrainingMilestone", achievedOn: "", note: "" });

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(success);
      detail.reload();
      onChanged();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (detail.loading && !detail.data) return <Loading />;
  if (!detail.data) return <ErrorBanner error={detail.error} onRetry={detail.reload} />;
  const d = detail.data;
  const p = d.participant;
  const quarter = (label: string, q: QuarterView | null) =>
    q ? (
      <p className="text-sm">
        {t("quarterLine", { label, quarter: q.quarter, status: t(`quarterStatus.${q.status}`) })}
        {q.earnings ? ` · ${fmt.currency(q.earnings, "USD")}` : ""}
      </p>
    ) : null;

  return (
    <Card
      title={t("participantTitle", { name: p.studentName ?? p.studentEmail ?? "" })}
      actions={
        <Button variant="ghost" onClick={onClose}>
          {t("close")}
        </Button>
      }
    >
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <div className="space-y-6">
        <section aria-labelledby="pd-follow">
          <h3 id="pd-follow" className="font-semibold">{t("followUpTitle")}</h3>
          {d.quarters.q2 ? (
            <>
              {quarter(t("q2Label"), d.quarters.q2)}
              {quarter(t("q4Label"), d.quarters.q4)}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noExitYet")}</p>
          )}
        </section>

        <section aria-labelledby="pd-edit">
          <h3 id="pd-edit" className="mb-2 font-semibold">{t("editTitle")}</h3>
          <ParticipantForm
            key={p.id}
            defs={defs}
            creating={false}
            initial={fromParticipant(p)}
            onSubmit={(f) => run(() => api(`/api/career/workforce/wioa/participants/${p.id}`, { method: "PUT", json: { ...payload(f), email: undefined } }), t("saved"))}
          />
        </section>

        <section aria-labelledby="pd-wages">
          <h3 id="pd-wages" className="mb-2 font-semibold">{t("wagesTitle")}</h3>
          {d.wages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noWages")}</p>
          ) : (
            <ScrollArea>
              <table className="w-full text-sm [&_th]:text-start">
                <caption className="sr-only">{t("wagesTitle")}</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1 pe-3">{t("quarterCol")}</th>
                    <th className="py-1 pe-3">{t("amountCol")}</th>
                    <th className="py-1 pe-3">{t("sourceCol")}</th>
                    <th className="py-1 pe-3">{t("employerCol")}</th>
                    {isAdmin && <th className="py-1">{t("actionsCol")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {d.wages.map((w) => (
                    <tr key={w.id} className="border-b border-border">
                      <td className="py-1 pe-3">{t("quarterValue", { year: w.year, quarter: w.quarter })}</td>
                      <td className="py-1 pe-3">{fmt.currency(w.amount, "USD")}</td>
                      <td className="py-1 pe-3">{t(`wageSources.${w.source}`)}</td>
                      <td className="py-1 pe-3">{w.employerName ?? w.employerKey ?? "—"}</td>
                      {isAdmin && (
                        <td className="py-1">
                          <Button variant="ghost" onClick={() => run(() => api(`/api/career/workforce/wioa/wages/${w.id}`, { method: "DELETE" }), t("deleted"))}>
                            {t("delete")}
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          )}
          {isAdmin ? (
            <form
              className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                run(
                  () => api(`/api/career/workforce/wioa/participants/${p.id}/wages`, {
                    json: { year: Number(wage.year), quarter: Number(wage.quarter), amount: wage.amount === "" ? null : Number(wage.amount), source: wage.source, employerName: wage.employerName || null, employerKey: wage.employerKey || null, sourceDocument: wage.sourceDocument || null },
                  }),
                  t("wageAdded"),
                );
              }}
            >
              <Field label={t("year")}>{(props) => <input {...props} type="number" min={2015} value={wage.year} onChange={(e) => setWage({ ...wage, year: e.target.value })} />}</Field>
              <Field label={t("quarter")}>
                {(props) => (
                  <select {...props} value={wage.quarter} onChange={(e) => setWage({ ...wage, quarter: e.target.value })}>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={String(n)}>{t("quarterOption", { quarter: n })}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("amount")}>{(props) => <input {...props} type="number" min={0} step="0.01" required value={wage.amount} onChange={(e) => setWage({ ...wage, amount: e.target.value })} />}</Field>
              <Field label={t("wageSource")}>
                {(props) => (
                  <select {...props} value={wage.source} onChange={(e) => setWage({ ...wage, source: e.target.value })}>
                    {defs.wageSources.map((s) => (
                      <option key={s} value={s}>{t(`wageSources.${s}`)}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t("employerName")}>{(props) => <input {...props} value={wage.employerName} onChange={(e) => setWage({ ...wage, employerName: e.target.value })} />}</Field>
              <Field label={t("employerKey")} hint={t("employerKeyHint")}>{(props) => <input {...props} dir="ltr" value={wage.employerKey} onChange={(e) => setWage({ ...wage, employerKey: e.target.value })} />}</Field>
              <Field label={t("sourceDocument")} hint={t("sourceDocumentHint")}>{(props) => <input {...props} value={wage.sourceDocument} onChange={(e) => setWage({ ...wage, sourceDocument: e.target.value })} />}</Field>
              <Button type="submit">{t("addWage")}</Button>
            </form>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t("wagesAdminOnly")}</p>
          )}
        </section>

        <section aria-labelledby="pd-creds">
          <h3 id="pd-creds" className="mb-2 font-semibold">{t("credentialsTitle")}</h3>
          {d.credentials.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noCredentials")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.credentials.map((c, i) => (
                <li key={c.id ?? `v${i}`} className="flex flex-wrap items-center gap-2">
                  <span>{t("credentialLine", { name: c.name, type: t(`credentialTypes.t${c.typeCode}`), date: dateOnly(c.attainedOn) })}</span>
                  <Badge tone={c.origin === "Recorded" ? "neutral" : "info"}>{t(`origins.${c.origin}`)}</Badge>
                  {c.id && (
                    <Button variant="ghost" onClick={() => run(() => api(`/api/career/workforce/wioa/credentials/${c.id}`, { method: "DELETE" }), t("deleted"))}>
                      {t("delete")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api(`/api/career/workforce/wioa/participants/${p.id}/credentials`, { json: { typeCode: Number(cred.typeCode), name: cred.name, attainedOn: cred.attainedOn || null } }), t("credentialAdded"));
            }}
          >
            <Field label={t("credentialType")}>
              {(props) => (
                <select {...props} value={cred.typeCode} onChange={(e) => setCred({ ...cred, typeCode: e.target.value })}>
                  {defs.credentialTypes.map((c) => (
                    <option key={c} value={String(c)}>{t(`credentialTypes.t${c}`)}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("credentialName")}>{(props) => <input {...props} required value={cred.name} onChange={(e) => setCred({ ...cred, name: e.target.value })} />}</Field>
            <Field label={t("attainedOn")}>{(props) => <input {...props} type="date" required value={cred.attainedOn} onChange={(e) => setCred({ ...cred, attainedOn: e.target.value })} />}</Field>
            <Button type="submit">{t("addCredential")}</Button>
          </form>
        </section>

        <section aria-labelledby="pd-gains">
          <h3 id="pd-gains" className="mb-2 font-semibold">{t("gainsTitle")}</h3>
          {d.gains.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noGains")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {d.gains.map((g, i) => (
                <li key={g.id ?? `g${i}`} className="flex flex-wrap items-center gap-2">
                  <span>{t("gainLine", { type: t(`gainTypes.${g.gainType}`), date: dateOnly(g.achievedOn) })}</span>
                  <Badge tone={g.origin === "Recorded" ? "neutral" : "info"}>{t(`origins.${g.origin}`)}</Badge>
                  {g.id && (
                    <Button variant="ghost" onClick={() => run(() => api(`/api/career/workforce/wioa/gains/${g.id}`, { method: "DELETE" }), t("deleted"))}>
                      {t("delete")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form
            className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api(`/api/career/workforce/wioa/participants/${p.id}/gains`, { json: { gainType: gain.gainType, achievedOn: gain.achievedOn || null, note: gain.note || null } }), t("gainAdded"));
            }}
          >
            <Field label={t("gainType")}>
              {(props) => (
                <select {...props} value={gain.gainType} onChange={(e) => setGain({ ...gain, gainType: e.target.value })}>
                  {defs.gainTypes.map((g) => (
                    <option key={g} value={g}>{t(`gainTypes.${g}`)}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("achievedOn")}>{(props) => <input {...props} type="date" required value={gain.achievedOn} onChange={(e) => setGain({ ...gain, achievedOn: e.target.value })} />}</Field>
            <Field label={t("gainNote")}>{(props) => <input {...props} value={gain.note} onChange={(e) => setGain({ ...gain, note: e.target.value })} />}</Field>
            <Button type="submit">{t("addGain")}</Button>
          </form>
        </section>

        <section aria-labelledby="pd-placements">
          <h3 id="pd-placements" className="mb-1 font-semibold">{t("placementsTitle")}</h3>
          <p className="mb-2 text-xs text-muted-foreground">{t("placementsHint")}</p>
          {d.placements.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPlacements")}</p>
          ) : (
            <ul className="list-disc space-y-1 ps-5 text-sm">
              {d.placements.map((x) => (
                <li key={x.id}>{t("placementLine", { title: x.title, employer: x.employerName, date: dateOnly(x.startDate), level: x.verificationLevel })}</li>
              ))}
            </ul>
          )}
        </section>

        {isAdmin && (
          <Button
            variant="danger"
            onClick={() =>
              run(async () => {
                await api(`/api/career/workforce/wioa/participants/${p.id}`, { method: "DELETE" });
                onClose();
              }, t("deleted"))
            }
          >
            {t("deleteParticipant")}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function WioaParticipantsPanel({ defs, initialSelected }: { defs: WioaDefinitions; initialSelected?: string | null }) {
  const api = useApi();
  const { schoolId } = useCareerShell();
  const t = useCareerT("workforce");
  const dateOnly = useDateOnly();
  const isAdmin = useIsCareerAdmin();
  const [query, setQuery] = useState({ q: "", program: "" });
  const [applied, setApplied] = useState(query);
  const qs = new URLSearchParams({ ...(applied.q ? { q: applied.q } : {}), ...(applied.program ? { program: applied.program } : {}) }).toString();
  const list = useLoad(() => api<Participant[]>(`/api/career/workforce/wioa/participants?${qs}`), [api, schoolId, qs]);
  const [adding, setAdding] = useState(false);
  const [picked, setSelected] = useState<string | null | undefined>(undefined);
  const selected = picked === undefined ? (initialSelected ?? null) : picked;
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [imported, setImported] = useState<{ added: number; skipped: { line: number; reason: string }[] } | null>(null);

  return (
    <div className="space-y-6">
      <div aria-live="polite">
        <ErrorBanner error={err} />
        <SuccessBanner message={msg} />
      </div>
      <Card>
        <form
          className="grid gap-3 sm:grid-cols-3 sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(query);
          }}
        >
          <Field label={t("search")}>{(props) => <input {...props} type="search" value={query.q} onChange={(e) => setQuery({ ...query, q: e.target.value })} />}</Field>
          <Field label={t("program")}>
            {(props) => (
              <select {...props} value={query.program} onChange={(e) => setQuery({ ...query, program: e.target.value })}>
                <option value="">{t("allPrograms")}</option>
                {defs.programs.map((p) => (
                  <option key={p} value={p}>{t(`programs.${p}`)}</option>
                ))}
              </select>
            )}
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{t("searchButton")}</Button>
            {!adding && (
              <Button type="button" variant="secondary" onClick={() => setAdding(true)}>
                {t("addParticipant")}
              </Button>
            )}
          </div>
        </form>
      </Card>

      {adding && (
        <Card title={t("addParticipantTitle")}>
          <ParticipantForm
            defs={defs}
            creating
            initial={emptyForm}
            onCancel={() => setAdding(false)}
            onSubmit={async (f) => {
              setErr(null);
              setMsg(null);
              try {
                const created = await api<Participant>("/api/career/workforce/wioa/participants", { json: payload(f) });
                setAdding(false);
                setMsg(t("participantAdded"));
                setSelected(created.id);
                list.reload();
              } catch (e) {
                setErr((e as Error).message);
              }
            }}
          />
        </Card>
      )}

      {selected && <ParticipantDetail id={selected} defs={defs} onChanged={list.reload} onClose={() => { setSelected(null); list.reload(); }} />}

      <ErrorBanner error={list.error} onRetry={list.reload} />
      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState title={t("noParticipants")}>{t("noParticipantsHint")}</EmptyState>
      ) : (
        <ScrollArea>
          <table className="w-full text-sm [&_th]:text-start">
            <caption className="sr-only">{t("participantsCaption")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pe-3">{t("nameCol")}</th>
                <th className="py-2 pe-3">{t("program")}</th>
                <th className="py-2 pe-3">{t("entryDate")}</th>
                <th className="py-2 pe-3">{t("exitDate")}</th>
                <th className="py-2 pe-3">{t("trainingType")}</th>
                <th className="py-2">{t("actionsCol")}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="py-2 pe-3">
                    <bdi>{p.studentName ?? p.studentEmail}</bdi>
                    {p.localId && <span className="ms-1 text-xs text-muted-foreground">({p.localId})</span>}
                  </td>
                  <td className="py-2 pe-3">{t(`programs.${p.program}`)}</td>
                  <td className="py-2 pe-3">{dateOnly(p.entryDate)}</td>
                  <td className="py-2 pe-3">
                    {p.exitDate ? dateOnly(p.exitDate) : t("current")}
                    {p.exitReasonCode !== "00" && (
                      <span className="ms-1">
                        <Badge tone="warn">{t("excludedBadge", { code: p.exitReasonCode })}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="py-2 pe-3">{t(`trainingTypes.${p.trainingType}`)}</td>
                  <td className="py-2">
                    <Button variant="secondary" onClick={() => setSelected(p.id)} aria-label={t("openParticipant", { name: p.studentName ?? p.studentEmail ?? "" })}>
                      {t("open")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}

      {isAdmin && (
        <Card title={t("importTitle")}>
          <p className="mb-3 text-sm">{t("importIntro")}</p>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setErr(null);
              setMsg(null);
              try {
                const r = await api<{ added: number; skipped: { line: number; reason: string }[] }>("/api/career/workforce/wioa/wages/import", { json: { csv } });
                setImported(r);
                setMsg(t("importResult", { added: r.added, skipped: r.skipped.length }));
              } catch (ex) {
                setErr((ex as Error).message);
              }
            }}
          >
            <Field label={t("importLabel")} hint={t("importHint")}>
              {(props) => <textarea {...props} rows={5} dir="ltr" value={csv} onChange={(e) => setCsv(e.target.value)} />}
            </Field>
            <Button type="submit" disabled={!csv.trim()}>{t("importButton")}</Button>
            {imported && imported.skipped.length > 0 && (
              <ul className="list-disc space-y-1 ps-5 text-xs">
                {imported.skipped.map((s) => (
                  <li key={s.line}>{t("skippedLine", { line: s.line, reason: s.reason })}</li>
                ))}
              </ul>
            )}
          </form>
        </Card>
      )}
    </div>
  );
}

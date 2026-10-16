"use client";

/** "My next step": students report where they are going after school, confirm offers and correct their own reports. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad, useCareerT } from "@/components/career/ui";
import { labelOf } from "@/components/career/coreLabels";
import {
  Placement,
  PlacementForm,
  VERIFICATION_TONE,
  emptyPlacementForm,
  placementPayload,
  useEmploymentTypeLabels,
  useSalaryBandLabels,
  useSourceLabels,
  useStatusLabels,
  useVerificationLabels,
} from "@/components/career/outcomesLabels";

interface Mine {
  placements: Placement[];
  status?: string | null;
  offers: { bookingId: string; employerName: string; positionTitle: string; outcomeAt?: string | null }[];
  employmentTypes: string[];
  salaryBands: string[];
}

export default function NextStepPage() {
  const tr = useCareerT("studentNextStep");
  const EMPLOYMENT_TYPE_LABELS = useEmploymentTypeLabels();
  const SALARY_BAND_LABELS = useSalaryBandLabels();
  const SOURCE_LABELS = useSourceLabels();
  const STATUS_LABELS = useStatusLabels();
  const VERIFICATION_LABELS = useVerificationLabels();
  const api = useApi();
  const { schoolId } = useCareerShell();
  const mine = useLoad(() => api<Mine>("/api/career/outcomes/me"), [api, schoolId]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // "new" or a placement id
  const [form, setForm] = useState<PlacementForm>(emptyPlacementForm);
  const [offerForm, setOfferForm] = useState<Record<string, { employmentType: string; startDate: string; location: string }>>({});

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

  if (mine.loading && !mine.data) return <Loading />;
  if (!mine.data) return <ErrorBanner error={mine.error ?? tr("yourNextStepCouldntBe")} onRetry={mine.reload} />;
  const data = mine.data;
  const types = data.employmentTypes;

  const startEdit = (p?: Placement) => {
    setEditing(p ? p.id : "new");
    setForm(
      p
        ? { employerName: p.employerName, title: p.title, employmentType: p.employmentType, startDate: p.startDate ?? "", location: p.location ?? "", salaryBand: p.salaryBand ?? "", evidenceNotes: p.evidenceNotes ?? "" }
        : emptyPlacementForm,
    );
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    void run("save", async () => {
      if (editing === "new") {
        const r = await api<{ merged: boolean }>("/api/career/outcomes/me/placements", { method: "POST", json: placementPayload(form) });
        setMsg(r.merged ? tr("thanksThisMatchedSomethingAlready") : tr("thanksYourNextStepWas"));
      } else {
        await api(`/api/career/outcomes/me/placements/${editing}`, { method: "PUT", json: placementPayload(form) });
        setMsg(tr("yourChangesWereSaved"));
      }
      setEditing(null);
      mine.reload();
    });
  };

  const remove = (p: Placement) => {
    if (!window.confirm(tr("removeTitleAtEmployerNameFrom", { title: p.title, employerName: p.employerName }))) return;
    void run(p.id, async () => {
      await api(`/api/career/outcomes/me/placements/${p.id}`, { method: "DELETE" });
      setMsg(tr("removed"));
      mine.reload();
    });
  };

  const setStatus = (status: string | null) =>
    run("status", async () => {
      await api("/api/career/outcomes/me/status", { method: "PUT", json: { status } });
      setMsg(status ? tr("savedStatus", { status: labelOf(STATUS_LABELS, status) }) : tr("statusCleared"));
      mine.reload();
    });

  const answerOffer = (bookingId: string, accept: boolean) =>
    run(bookingId, async () => {
      if (accept) {
        const f = offerForm[bookingId] ?? { employmentType: "FullTime", startDate: "", location: "" };
        await api(`/api/career/outcomes/me/offers/${bookingId}/accept`, { method: "POST", json: { employmentType: f.employmentType, startDate: f.startDate || null, location: f.location.trim() || null } });
        setMsg(tr("congratulationsTheOfferWasAdded"));
      } else {
        await api(`/api/career/outcomes/me/offers/${bookingId}/decline`, { method: "POST" });
        setMsg(tr("gotItWeWontAsk"));
      }
      mine.reload();
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr("myNextStep")}
        description={tr("tellYourCareerCenterWhere")}
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      {data.offers.length > 0 && (
        <Card title={tr("didYouAcceptTheseOffers")}>
          <ul className="space-y-4">
            {data.offers.map((o) => {
              const f = offerForm[o.bookingId] ?? { employmentType: "FullTime", startDate: "", location: "" };
              const setF = (next: Partial<typeof f>) => setOfferForm({ ...offerForm, [o.bookingId]: { ...f, ...next } });
              return (
                <li key={o.bookingId} className="rounded-md border border-border p-3">
                  <p className="font-medium">{tr("positionTitleAtEmployerName", { positionTitle: o.positionTitle, employerName: o.employerName })}</p>
                  {o.outcomeAt && <p className="text-xs text-muted-foreground">{tr("offerRecordedOutcomeAt", { outcomeAt: formatDate(o.outcomeAt) })}</p>}
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Field label={tr("type")}>
                      {(p) => (
                        <select {...p} value={f.employmentType} onChange={(e) => setF({ employmentType: e.target.value })}>
                          {types.map((t) => <option key={t} value={t}>{labelOf(EMPLOYMENT_TYPE_LABELS, t)}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field label={tr("startDateIfKnown")}>{(p) => <input {...p} type="date" value={f.startDate} onChange={(e) => setF({ startDate: e.target.value })} />}</Field>
                    <Field label={tr("locationIfKnown")}>{(p) => <input {...p} maxLength={200} value={f.location} onChange={(e) => setF({ location: e.target.value })} />}</Field>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button busy={busy === o.bookingId} onClick={() => answerOffer(o.bookingId, true)}>{tr("iAccepted")}</Button>
                    <Button variant="secondary" disabled={busy === o.bookingId} onClick={() => answerOffer(o.bookingId, false)}>{tr("iDidntAccept")}</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title={tr("whereImGoing")} actions={editing ? undefined : <Button onClick={() => startEdit()}>{tr("addMyNextStep")}</Button>}>
        {data.placements.length === 0 && !editing ? (
          <EmptyState title={tr("nothingOnYourRecordYet")}>{tr("addAJobInternshipGraduate")}</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {data.placements.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{tr("titleAtEmployerName", { title: p.title, employerName: p.employerName })}</p>
                  <p className="text-sm text-muted-foreground">
                    {labelOf(EMPLOYMENT_TYPE_LABELS, p.employmentType)}
                    {p.startDate && tr("startsStartDate", { startDate: formatDate(p.startDate) })}
                    {p.location && ` · ${p.location}`}
                    {p.salaryBand && ` · ${labelOf(SALARY_BAND_LABELS, p.salaryBand)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">{tr("fromValue", { value: p.sources.map((s) => labelOf(SOURCE_LABELS, s)).join(", ") })}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={VERIFICATION_TONE[p.verificationLevel] ?? "neutral"}>{labelOf(VERIFICATION_LABELS, p.verificationLevel)}</Badge>
                  {p.studentEditable ? (
                    <>
                      <Button variant="secondary" onClick={() => startEdit(p)} aria-label={tr("editTitleAtEmployerName", { title: p.title, employerName: p.employerName })}>{tr("edit")}</Button>
                      <Button variant="ghost" disabled={busy === p.id} onClick={() => remove(p)} aria-label={tr("removeTitleAtEmployerName", { title: p.title, employerName: p.employerName })}>{tr("remove")}</Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">{tr("somethingWrongContactYourCareer")}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {editing && (
          <form onSubmit={save} className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2" aria-label={editing === "new" ? tr("addMyNextStep") : tr("editMyNextStep")}>
            <Field label={tr("employerOrSchool")}>{(p) => <input {...p} required maxLength={200} value={form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })} />}</Field>
            <Field label={tr("jobTitleOrProgram")}>{(p) => <input {...p} required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
            <Field label={tr("type")}>
              {(p) => (
                <select {...p} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                  {types.map((t) => <option key={t} value={t}>{labelOf(EMPLOYMENT_TYPE_LABELS, t)}</option>)}
                </select>
              )}
            </Field>
            <Field label={tr("startDate")}>{(p) => <input {...p} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}</Field>
            <Field label={tr("location")}>{(p) => <input {...p} maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
            <Field label={tr("salaryRangeOptional")} hint={tr("yearlyInUSDollarsReported")}>
              {(p) => (
                <select {...p} value={form.salaryBand} onChange={(e) => setForm({ ...form, salaryBand: e.target.value })}>
                  <option value="">{tr("preferNotToSay")}</option>
                  {data.salaryBands.map((b) => <option key={b} value={b}>{labelOf(SALARY_BAND_LABELS, b)}</option>)}
                </select>
              )}
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" busy={busy === "save"}>{tr("save")}</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>{tr("cancel")}</Button>
            </div>
          </form>
        )}
      </Card>

      <Card title={tr("stillLooking")}>
        <fieldset>
          <legend className="mb-2 text-sm text-muted-foreground">{tr("ifYouDontHaveA")}</legend>
          <div className="flex flex-wrap gap-2">
            {Object.keys(STATUS_LABELS).map((s) => (
              <Button key={s} variant={data.status === s ? "primary" : "secondary"} aria-pressed={data.status === s} busy={busy === "status"} onClick={() => setStatus(data.status === s ? null : s)}>
                {STATUS_LABELS[s]}
              </Button>
            ))}
          </div>
        </fieldset>
      </Card>
    </div>
  );
}

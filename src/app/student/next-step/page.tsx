"use client";

/** "My next step": students report where they are going after school, confirm offers and correct their own reports. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { labelOf } from "@/components/career/coreLabels";
import {
  EMPLOYMENT_TYPE_LABELS,
  Placement,
  PlacementForm,
  SALARY_BAND_LABELS,
  SOURCE_LABELS,
  STATUS_LABELS,
  VERIFICATION_LABELS,
  VERIFICATION_TONE,
  emptyPlacementForm,
  placementPayload,
} from "@/components/career/outcomesLabels";

interface Mine {
  placements: Placement[];
  status?: string | null;
  offers: { bookingId: string; employerName: string; positionTitle: string; outcomeAt?: string | null }[];
  employmentTypes: string[];
  salaryBands: string[];
}

export default function NextStepPage() {
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
  if (!mine.data) return <ErrorBanner error={mine.error ?? "Your next step couldn't be loaded."} onRetry={mine.reload} />;
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
        setMsg(r.merged ? "Thanks! This matched something already on your record, so we combined them." : "Thanks! Your next step was saved.");
      } else {
        await api(`/api/career/outcomes/me/placements/${editing}`, { method: "PUT", json: placementPayload(form) });
        setMsg("Your changes were saved.");
      }
      setEditing(null);
      mine.reload();
    });
  };

  const remove = (p: Placement) => {
    if (!window.confirm(`Remove ${p.title} at ${p.employerName} from your record?`)) return;
    void run(p.id, async () => {
      await api(`/api/career/outcomes/me/placements/${p.id}`, { method: "DELETE" });
      setMsg("Removed.");
      mine.reload();
    });
  };

  const setStatus = (status: string | null) =>
    run("status", async () => {
      await api("/api/career/outcomes/me/status", { method: "PUT", json: { status } });
      setMsg(status ? `Saved: ${labelOf(STATUS_LABELS, status)}.` : "Status cleared.");
      mine.reload();
    });

  const answerOffer = (bookingId: string, accept: boolean) =>
    run(bookingId, async () => {
      if (accept) {
        const f = offerForm[bookingId] ?? { employmentType: "FullTime", startDate: "", location: "" };
        await api(`/api/career/outcomes/me/offers/${bookingId}/accept`, { method: "POST", json: { employmentType: f.employmentType, startDate: f.startDate || null, location: f.location.trim() || null } });
        setMsg("Congratulations! The offer was added to your record.");
      } else {
        await api(`/api/career/outcomes/me/offers/${bookingId}/decline`, { method: "POST" });
        setMsg("Got it. We won't ask about this offer again.");
      }
      mine.reload();
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My next step"
        description="Tell your career center where you are headed after school. Only you and your school’s career center see this; it is never shared with employers."
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      {data.offers.length > 0 && (
        <Card title="Did you accept these offers?">
          <ul className="space-y-4">
            {data.offers.map((o) => {
              const f = offerForm[o.bookingId] ?? { employmentType: "FullTime", startDate: "", location: "" };
              const setF = (next: Partial<typeof f>) => setOfferForm({ ...offerForm, [o.bookingId]: { ...f, ...next } });
              return (
                <li key={o.bookingId} className="rounded-md border border-border p-3">
                  <p className="font-medium">{o.positionTitle} at {o.employerName}</p>
                  {o.outcomeAt && <p className="text-xs text-muted-foreground">Offer recorded {formatDate(o.outcomeAt)}</p>}
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <Field label="Type">
                      {(p) => (
                        <select {...p} value={f.employmentType} onChange={(e) => setF({ employmentType: e.target.value })}>
                          {types.map((t) => <option key={t} value={t}>{labelOf(EMPLOYMENT_TYPE_LABELS, t)}</option>)}
                        </select>
                      )}
                    </Field>
                    <Field label="Start date (if known)">{(p) => <input {...p} type="date" value={f.startDate} onChange={(e) => setF({ startDate: e.target.value })} />}</Field>
                    <Field label="Location (if known)">{(p) => <input {...p} maxLength={200} value={f.location} onChange={(e) => setF({ location: e.target.value })} />}</Field>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button busy={busy === o.bookingId} onClick={() => answerOffer(o.bookingId, true)}>I accepted</Button>
                    <Button variant="secondary" disabled={busy === o.bookingId} onClick={() => answerOffer(o.bookingId, false)}>I didn&apos;t accept</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card title="Where I'm going" actions={editing ? undefined : <Button onClick={() => startEdit()}>Add my next step</Button>}>
        {data.placements.length === 0 && !editing ? (
          <EmptyState title="Nothing on your record yet">Add a job, internship, graduate program, service or anything else you&apos;re doing next.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {data.placements.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{p.title} at {p.employerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {labelOf(EMPLOYMENT_TYPE_LABELS, p.employmentType)}
                    {p.startDate && ` · starts ${formatDate(p.startDate)}`}
                    {p.location && ` · ${p.location}`}
                    {p.salaryBand && ` · ${labelOf(SALARY_BAND_LABELS, p.salaryBand)}`}
                  </p>
                  <p className="text-xs text-muted-foreground">From: {p.sources.map((s) => labelOf(SOURCE_LABELS, s)).join(", ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={VERIFICATION_TONE[p.verificationLevel] ?? "neutral"}>{labelOf(VERIFICATION_LABELS, p.verificationLevel)}</Badge>
                  {p.studentEditable ? (
                    <>
                      <Button variant="secondary" onClick={() => startEdit(p)} aria-label={`Edit ${p.title} at ${p.employerName}`}>Edit</Button>
                      <Button variant="ghost" disabled={busy === p.id} onClick={() => remove(p)} aria-label={`Remove ${p.title} at ${p.employerName}`}>Remove</Button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">Something wrong? Contact your career center.</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {editing && (
          <form onSubmit={save} className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-2" aria-label={editing === "new" ? "Add my next step" : "Edit my next step"}>
            <Field label="Employer or school">{(p) => <input {...p} required maxLength={200} value={form.employerName} onChange={(e) => setForm({ ...form, employerName: e.target.value })} />}</Field>
            <Field label="Job title or program">{(p) => <input {...p} required maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />}</Field>
            <Field label="Type">
              {(p) => (
                <select {...p} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value })}>
                  {types.map((t) => <option key={t} value={t}>{labelOf(EMPLOYMENT_TYPE_LABELS, t)}</option>)}
                </select>
              )}
            </Field>
            <Field label="Start date">{(p) => <input {...p} type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />}</Field>
            <Field label="Location">{(p) => <input {...p} maxLength={200} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
            <Field label="Salary range (optional)" hint="Yearly, in US dollars. Reported only in totals.">
              {(p) => (
                <select {...p} value={form.salaryBand} onChange={(e) => setForm({ ...form, salaryBand: e.target.value })}>
                  <option value="">Prefer not to say</option>
                  {data.salaryBands.map((b) => <option key={b} value={b}>{labelOf(SALARY_BAND_LABELS, b)}</option>)}
                </select>
              )}
            </Field>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" busy={busy === "save"}>Save</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>

      <Card title="Still looking?">
        <fieldset>
          <legend className="mb-2 text-sm text-muted-foreground">If you don&apos;t have a next step yet, let your career center know how you&apos;re doing.</legend>
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

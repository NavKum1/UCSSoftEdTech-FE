"use client";

import React, { useState } from "react";
import { Button, Field, useLoad } from "@/components/career/ui";
import { CPT_NOTICE, type Api, type ExperienceDetail, type Program } from "./shared";

export interface RegistrationValues {
  programId: string;
  employerId: string;
  employerName: string;
  employerWebsite: string;
  supervisorName: string;
  supervisorEmail: string;
  supervisorTitle: string;
  roleTitle: string;
  startDate: string;
  endDate: string;
  hoursPerWeek: string;
  paid: boolean;
  location: string;
  remote: boolean;
  objectives: string;
  cptStatus: string;
  cptDso: string;
  cptStart: string;
  cptEnd: string;
}

export function valuesFrom(x: ExperienceDetail | null): RegistrationValues {
  return {
    programId: x?.program.id ?? "",
    employerId: x?.employer.id ?? "",
    employerName: x?.employer.name ?? "",
    employerWebsite: x?.employer.website ?? "",
    supervisorName: x?.supervisor.name ?? "",
    supervisorEmail: x?.supervisor.email ?? "",
    supervisorTitle: x?.supervisor.title ?? "",
    roleTitle: x?.roleTitle ?? "",
    startDate: x?.startDate ?? "",
    endDate: x?.endDate ?? "",
    hoursPerWeek: x ? String(x.hoursPerWeek) : "",
    paid: x?.paid ?? false,
    location: x?.location ?? "",
    remote: x?.remote ?? false,
    objectives: (x?.learningObjectives ?? []).join("\n"),
    cptStatus: x?.cpt.status ?? "",
    cptDso: x?.cpt.dsoApprovalDate ?? "",
    cptStart: x?.cpt.startDate ?? "",
    cptEnd: x?.cpt.endDate ?? "",
  };
}

export function toPayload(v: RegistrationValues, isF1: boolean) {
  return {
    programId: v.programId || undefined,
    employerId: v.employerId || undefined,
    employerName: v.employerId ? undefined : v.employerName,
    employerWebsite: v.employerId ? undefined : v.employerWebsite,
    supervisorName: v.supervisorName,
    supervisorEmail: v.supervisorEmail,
    supervisorTitle: v.supervisorTitle,
    roleTitle: v.roleTitle,
    startDate: v.startDate || undefined,
    endDate: v.endDate || undefined,
    hoursPerWeek: v.hoursPerWeek ? Number(v.hoursPerWeek) : undefined,
    paid: v.paid,
    location: v.location,
    remote: v.remote,
    learningObjectives: v.objectives.split("\n").map((s) => s.trim()).filter(Boolean),
    cpt: isF1
      ? { status: v.cptStatus || undefined, dsoApprovalDate: v.cptDso || undefined, startDate: v.cptStart || undefined, endDate: v.cptEnd || undefined }
      : undefined,
  };
}

interface EmployerChoice {
  id: string;
  name: string;
  website?: string | null;
  verificationStatus: string;
}

export function RegistrationForm({
  api,
  programs,
  isF1,
  cptStatuses,
  initial,
  lockProgram,
  submitLabel,
  onSubmit,
}: {
  api: Api;
  programs: Program[];
  isF1: boolean;
  cptStatuses: string[];
  initial: RegistrationValues;
  lockProgram?: boolean;
  submitLabel: string;
  onSubmit: (v: RegistrationValues) => Promise<void>;
}) {
  const [v, setV] = useState<RegistrationValues>(initial);
  const [busy, setBusy] = useState(false);
  const [newEmployer, setNewEmployer] = useState(!initial.employerId);
  const employers = useLoad(() => api<EmployerChoice[]>("/api/career/experiences/employers"), [api]);
  const set = <K extends keyof RegistrationValues>(k: K, value: RegistrationValues[K]) => setV((old) => ({ ...old, [k]: value }));
  const program = programs.find((p) => p.id === v.programId);

  return (
    <form
      className="space-y-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSubmit(newEmployer ? { ...v, employerId: "" } : v);
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">Program</legend>
        <Field label="Credit program" hint={program ? `${program.creditHours} credits · at least ${program.requiredHours} hours${program.requiredDocuments.length ? ` · documents: ${program.requiredDocuments.join(", ")}` : ""}` : undefined}>
          {(p) => (
            <select {...p} value={v.programId} onChange={(e) => set("programId", e.target.value)} required disabled={lockProgram}>
              <option value="">Choose a program</option>
              {programs.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.code} {pr.title}
                </option>
              ))}
            </select>
          )}
        </Field>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">Organization and supervisor</legend>
        <div className="flex gap-4 text-sm" role="radiogroup" aria-label="Employer">
          <label className="flex items-center gap-2">
            <input type="radio" name="employer-mode" checked={!newEmployer} onChange={() => setNewEmployer(false)} /> Choose from the list
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="employer-mode" checked={newEmployer} onChange={() => setNewEmployer(true)} /> Enter a new organization
          </label>
        </div>
        {!newEmployer ? (
          <Field label="Organization" hint="Organizations approved by your career center.">
            {(p) => (
              <select {...p} value={v.employerId} onChange={(e) => set("employerId", e.target.value)} required>
                <option value="">Choose an organization</option>
                {(employers.data ?? []).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Organization name">{(p) => <input {...p} value={v.employerName} onChange={(e) => set("employerName", e.target.value)} required />}</Field>
            <Field label="Website" hint="For example acme.com. Your career center verifies new organizations.">
              {(p) => <input {...p} value={v.employerWebsite} onChange={(e) => set("employerWebsite", e.target.value)} />}
            </Field>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Site supervisor name">{(p) => <input {...p} value={v.supervisorName} onChange={(e) => set("supervisorName", e.target.value)} required />}</Field>
          <Field label="Supervisor work email" hint="They get secure links to sign and evaluate; no account needed.">
            {(p) => <input {...p} type="email" value={v.supervisorEmail} onChange={(e) => set("supervisorEmail", e.target.value)} required />}
          </Field>
          <Field label="Supervisor job title">{(p) => <input {...p} value={v.supervisorTitle} onChange={(e) => set("supervisorTitle", e.target.value)} />}</Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">The position</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Your role title">{(p) => <input {...p} value={v.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} required />}</Field>
          <Field label="Hours per week">{(p) => <input {...p} type="number" min={1} max={80} step="0.5" value={v.hoursPerWeek} onChange={(e) => set("hoursPerWeek", e.target.value)} required />}</Field>
          <Field label="Start date">{(p) => <input {...p} type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} required />}</Field>
          <Field label="End date">{(p) => <input {...p} type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} required />}</Field>
          <Field label="Location" hint="City and state, or leave blank if fully remote.">{(p) => <input {...p} value={v.location} onChange={(e) => set("location", e.target.value)} />}</Field>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={v.paid} onChange={(e) => set("paid", e.target.checked)} /> Paid position
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={v.remote} onChange={(e) => set("remote", e.target.checked)} /> Remote
          </label>
        </div>
        <Field label="Learning objectives" hint="One per line, up to 10. What you will learn or be able to do.">
          {(p) => <textarea {...p} rows={4} value={v.objectives} onChange={(e) => set("objectives", e.target.value)} />}
        </Field>
      </fieldset>

      {isF1 && (
        <fieldset className="space-y-3 rounded-md border border-border p-4">
          <legend className="px-1 text-base font-semibold">Curricular practical training (F-1)</legend>
          <p className="text-sm" role="note">
            {CPT_NOTICE}
          </p>
          {program?.requireCpt && <p className="text-sm font-medium">Your career center can approve this experience only after the CPT dates on your I-20 and the DSO approval date are recorded.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="CPT authorization status">
              {(p) => (
                <select {...p} value={v.cptStatus} onChange={(e) => set("cptStatus", e.target.value)}>
                  <option value="">Not recorded</option>
                  {cptStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="DSO approval date">{(p) => <input {...p} type="date" value={v.cptDso} onChange={(e) => set("cptDso", e.target.value)} />}</Field>
            <Field label="CPT start date on I-20">{(p) => <input {...p} type="date" value={v.cptStart} onChange={(e) => set("cptStart", e.target.value)} />}</Field>
            <Field label="CPT end date on I-20">{(p) => <input {...p} type="date" value={v.cptEnd} onChange={(e) => set("cptEnd", e.target.value)} />}</Field>
          </div>
        </fieldset>
      )}

      <Button type="submit" busy={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

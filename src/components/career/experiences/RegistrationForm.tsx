"use client";

import React, { useState } from "react";
import { Button, Field, useLoad, useCareerT } from "@/components/career/ui";
import { type Api, type ExperienceDetail, type Program } from "./shared";

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
  const t = useCareerT("registrationForm");
  const tShared = useCareerT("experiencesShared");
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
        <legend className="text-base font-semibold">{t("program")}</legend>
        <Field label={t("creditProgram")} hint={program ? t("creditHoursCreditsAtLeastRequiredHours", { creditHours: program.creditHours, requiredHours: program.requiredHours, value: program.requiredDocuments.length ? t("documentsRequiredDocuments", { requiredDocuments: program.requiredDocuments.join(", ") }) : "" }) : undefined}>
          {(p) => (
            <select {...p} value={v.programId} onChange={(e) => set("programId", e.target.value)} required disabled={lockProgram}>
              <option value="">{t("chooseAProgram")}</option>
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
        <legend className="text-base font-semibold">{t("organizationAndSupervisor")}</legend>
        <div className="flex gap-4 text-sm" role="radiogroup" aria-label={t("employer")}>
          <label className="flex items-center gap-2">
            <input type="radio" name="employer-mode" checked={!newEmployer} onChange={() => setNewEmployer(false)} />{" "}{t("chooseFromTheList")}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="employer-mode" checked={newEmployer} onChange={() => setNewEmployer(true)} />{" "}{t("enterANewOrganization")}
          </label>
        </div>
        {!newEmployer ? (
          <Field label={t("organization")} hint={t("organizationsApprovedByYourCareer")}>
            {(p) => (
              <select {...p} value={v.employerId} onChange={(e) => set("employerId", e.target.value)} required>
                <option value="">{t("chooseAnOrganization")}</option>
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
            <Field label={t("organizationName")}>{(p) => <input {...p} value={v.employerName} onChange={(e) => set("employerName", e.target.value)} required />}</Field>
            <Field label={t("website")} hint={t("forExampleAcmeComYour")}>
              {(p) => <input {...p} value={v.employerWebsite} onChange={(e) => set("employerWebsite", e.target.value)} />}
            </Field>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t("siteSupervisorName")}>{(p) => <input {...p} value={v.supervisorName} onChange={(e) => set("supervisorName", e.target.value)} required />}</Field>
          <Field label={t("supervisorWorkEmail")} hint={t("theyGetSecureLinksTo")}>
            {(p) => <input {...p} type="email" value={v.supervisorEmail} onChange={(e) => set("supervisorEmail", e.target.value)} required />}
          </Field>
          <Field label={t("supervisorJobTitle")}>{(p) => <input {...p} value={v.supervisorTitle} onChange={(e) => set("supervisorTitle", e.target.value)} />}</Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-base font-semibold">{t("thePosition")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("yourRoleTitle")}>{(p) => <input {...p} value={v.roleTitle} onChange={(e) => set("roleTitle", e.target.value)} required />}</Field>
          <Field label={t("hoursPerWeek")}>{(p) => <input {...p} type="number" min={1} max={80} step="0.5" value={v.hoursPerWeek} onChange={(e) => set("hoursPerWeek", e.target.value)} required />}</Field>
          <Field label={t("startDate")}>{(p) => <input {...p} type="date" value={v.startDate} onChange={(e) => set("startDate", e.target.value)} required />}</Field>
          <Field label={t("endDate")}>{(p) => <input {...p} type="date" value={v.endDate} onChange={(e) => set("endDate", e.target.value)} required />}</Field>
          <Field label={t("location")} hint={t("cityAndStateOrLeave")}>{(p) => <input {...p} value={v.location} onChange={(e) => set("location", e.target.value)} />}</Field>
        </div>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={v.paid} onChange={(e) => set("paid", e.target.checked)} />{" "}{t("paidPosition")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={v.remote} onChange={(e) => set("remote", e.target.checked)} />{" "}{t("remote")}
          </label>
        </div>
        <Field label={t("learningObjectives")} hint={t("onePerLineUpTo")}>
          {(p) => <textarea {...p} rows={4} value={v.objectives} onChange={(e) => set("objectives", e.target.value)} />}
        </Field>
      </fieldset>

      {isF1 && (
        <fieldset className="space-y-3 rounded-md border border-border p-4">
          <legend className="px-1 text-base font-semibold">{t("curricularPracticalTrainingF1")}</legend>
          <p className="text-sm" role="note">
            {tShared("cptNotice")}
          </p>
          {program?.requireCpt && <p className="text-sm font-medium">{t("yourCareerCenterCanApprove")}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("cPTAuthorizationStatus")}>
              {(p) => (
                <select {...p} value={v.cptStatus} onChange={(e) => set("cptStatus", e.target.value)}>
                  <option value="">{t("notRecorded")}</option>
                  {cptStatuses.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/([a-z])([A-Z])/g, "$1 $2")}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label={t("dSOApprovalDate")}>{(p) => <input {...p} type="date" value={v.cptDso} onChange={(e) => set("cptDso", e.target.value)} />}</Field>
            <Field label={t("cPTStartDateOnI")}>{(p) => <input {...p} type="date" value={v.cptStart} onChange={(e) => set("cptStart", e.target.value)} />}</Field>
            <Field label={t("cPTEndDateOnI")}>{(p) => <input {...p} type="date" value={v.cptEnd} onChange={(e) => set("cptEnd", e.target.value)} />}</Field>
          </div>
        </fieldset>
      )}

      <Button type="submit" busy={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

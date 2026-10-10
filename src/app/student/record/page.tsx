"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { WORK_AUTH_LABELS, labelOf } from "@/components/career/coreLabels";

interface Profile {
  preferredName?: string | null;
  pronouns?: string | null;
  phone?: string | null;
  workAuthorization: string;
  requiresSponsorshipNow?: boolean | null;
  requiresSponsorshipFuture?: boolean | null;
}

interface Education {
  id: string;
  schoolName: string;
  degreeLevel: string;
  majors: string[];
  minors: string[];
  college?: string | null;
  startDate?: string | null;
  graduationDate?: string | null;
  isPrimary: boolean;
  verifiedBySchool: boolean;
}

interface RecordResponse {
  school: { instituteId: string; displayName: string; slug: string };
  role: string;
  ferpaHold: boolean;
  profile: Profile;
  education: Education[];
  workAuthorizationOptions: string[];
  degreeLevels: string[];
}

interface EduForm {
  schoolName: string;
  degreeLevel: string;
  majors: string;
  minors: string;
  college: string;
  startDate: string;
  graduationDate: string;
  isPrimary: boolean;
}

const emptyEdu = (school: string): EduForm => ({ schoolName: school, degreeLevel: "Bachelor", majors: "", minors: "", college: "", startDate: "", graduationDate: "", isPrimary: false });

const triState = (v: boolean | null | undefined) => (v === true ? "yes" : v === false ? "no" : "");
const fromTri = (v: string) => (v === "yes" ? true : v === "no" ? false : null);

export default function StudentRecordPage() {
  const api = useApi();
  const { data, setData, error, loading, reload } = useLoad(() => api<RecordResponse>("/api/career/student/record"), [api]);
  const [draft, setProfile] = useState<Profile | null>(null);
  const profile = draft ?? data?.profile ?? null;
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [edu, setEdu] = useState<EduForm>(emptyEdu(""));

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const p = await api<Profile>("/api/career/student/profile", {
        method: "PUT",
        json: {
          preferredName: profile.preferredName ?? "",
          pronouns: profile.pronouns ?? "",
          phone: profile.phone ?? "",
          workAuthorization: profile.workAuthorization,
          requiresSponsorshipNow: profile.requiresSponsorshipNow,
          requiresSponsorshipFuture: profile.requiresSponsorshipFuture,
          // "Prefer not to say" sets an answer back to unknown
          clear: [
            ...(profile.requiresSponsorshipNow == null ? ["requiresSponsorshipNow"] : []),
            ...(profile.requiresSponsorshipFuture == null ? ["requiresSponsorshipFuture"] : []),
          ],
        },
      });
      setData((d) => (d ? { ...d, profile: p } : d));
      setProfile(null);
      setMsg("Your profile was saved.");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (e?: Education) => {
    setMsg(null);
    setErr(null);
    if (!e) {
      setEdu(emptyEdu(data?.school.displayName ?? ""));
      setEditing("new");
      return;
    }
    setEdu({
      schoolName: e.schoolName,
      degreeLevel: e.degreeLevel,
      majors: e.majors.join(", "),
      minors: e.minors.join(", "),
      college: e.college ?? "",
      startDate: e.startDate ?? "",
      graduationDate: e.graduationDate ?? "",
      isPrimary: e.isPrimary,
    });
    setEditing(e.id);
  };

  const splitList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

  const saveEdu = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    try {
      const body = {
        schoolName: edu.schoolName,
        degreeLevel: edu.degreeLevel,
        majors: splitList(edu.majors),
        minors: splitList(edu.minors),
        college: edu.college || null,
        startDate: edu.startDate || null,
        graduationDate: edu.graduationDate || null,
        isPrimary: edu.isPrimary,
      };
      if (editing === "new") await api("/api/career/student/education", { method: "POST", json: body });
      else await api(`/api/career/student/education/${editing}`, { method: "PUT", json: body });
      setEditing(null);
      setMsg("Education saved.");
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const removeEdu = async (e: Education) => {
    if (!window.confirm(`Delete ${e.degreeLevel} at ${e.schoolName}?`)) return;
    setErr(null);
    try {
      await api(`/api/career/student/education/${e.id}`, { method: "DELETE" });
      setMsg("Education entry deleted.");
      reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    }
  };

  if (loading && !data) return <Loading />;
  if (!data || !profile) return <ErrorBanner error={error ?? "Your record couldn't be loaded."} onRetry={reload} />;

  return (
    <div>
      <PageHeader title="My record" description={`Your career record at ${data.school.displayName}. Employers only see the parts you or your school's directory policy allow.`} />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <Card title="About you" className="mb-6">
        <form onSubmit={saveProfile} className="grid gap-4 sm:grid-cols-2">
          <Field label="Preferred name">
            {(p) => <input {...p} value={profile.preferredName ?? ""} onChange={(e) => setProfile({ ...profile, preferredName: e.target.value })} autoComplete="nickname" />}
          </Field>
          <Field label="Pronouns" hint="Optional, for example she/her or they/them.">
            {(p) => <input {...p} value={profile.pronouns ?? ""} onChange={(e) => setProfile({ ...profile, pronouns: e.target.value })} />}
          </Field>
          <Field label="Phone">
            {(p) => <input {...p} type="tel" value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} autoComplete="tel" />}
          </Field>
          <Field label="Work authorization" hint="Used to match you with eligible opportunities. It's never shared without a legal basis.">
            {(p) => (
              <select {...p} value={profile.workAuthorization} onChange={(e) => setProfile({ ...profile, workAuthorization: e.target.value })}>
                {data.workAuthorizationOptions.map((o) => (
                  <option key={o} value={o}>{labelOf(WORK_AUTH_LABELS, o)}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Do you need visa sponsorship now?">
            {(p) => (
              <select {...p} value={triState(profile.requiresSponsorshipNow)} onChange={(e) => setProfile({ ...profile, requiresSponsorshipNow: fromTri(e.target.value) })}>
                <option value="">Prefer not to say</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            )}
          </Field>
          <Field label="Will you need sponsorship in the future?">
            {(p) => (
              <select {...p} value={triState(profile.requiresSponsorshipFuture)} onChange={(e) => setProfile({ ...profile, requiresSponsorshipFuture: fromTri(e.target.value) })}>
                <option value="">Prefer not to say</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            )}
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" busy={saving && editing === null}>Save profile</Button>
          </div>
        </form>
      </Card>

      <Card title="Education" actions={editing === null && <Button variant="secondary" onClick={() => startEdit()}>Add education</Button>}>
        {editing !== null && (
          <form onSubmit={saveEdu} className="mb-6 grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2" aria-label={editing === "new" ? "Add education" : "Edit education"}>
            <Field label="School">{(p) => <input {...p} required value={edu.schoolName} onChange={(e) => setEdu({ ...edu, schoolName: e.target.value })} />}</Field>
            <Field label="Degree">
              {(p) => (
                <select {...p} value={edu.degreeLevel} onChange={(e) => setEdu({ ...edu, degreeLevel: e.target.value })}>
                  {data.degreeLevels.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              )}
            </Field>
            <Field label="Majors" hint="Separate with commas (up to 4).">{(p) => <input {...p} value={edu.majors} onChange={(e) => setEdu({ ...edu, majors: e.target.value })} />}</Field>
            <Field label="Minors" hint="Separate with commas (up to 4).">{(p) => <input {...p} value={edu.minors} onChange={(e) => setEdu({ ...edu, minors: e.target.value })} />}</Field>
            <Field label="College or school within the university">{(p) => <input {...p} value={edu.college} onChange={(e) => setEdu({ ...edu, college: e.target.value })} />}</Field>
            <div />
            <Field label="Start date">{(p) => <input {...p} type="date" value={edu.startDate} onChange={(e) => setEdu({ ...edu, startDate: e.target.value })} />}</Field>
            <Field label="Graduation date (expected or actual)">{(p) => <input {...p} type="date" value={edu.graduationDate} onChange={(e) => setEdu({ ...edu, graduationDate: e.target.value })} />}</Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="h-4 w-4" checked={edu.isPrimary} onChange={(e) => setEdu({ ...edu, isPrimary: e.target.checked })} />
              This is my main program
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" busy={saving}>Save</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        )}

        {data.education.length === 0 ? (
          <EmptyState title="No education added yet">Add your current program so career staff and approved employers see the right details.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {data.education.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">
                    {e.degreeLevel}
                    {e.majors.length > 0 && ` in ${e.majors.join(", ")}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {e.schoolName}
                    {e.college && ` · ${e.college}`}
                    {e.minors.length > 0 && ` · Minor: ${e.minors.join(", ")}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {e.startDate ? `${formatDate(e.startDate)} – ` : ""}
                    {e.graduationDate ? `Graduation ${formatDate(e.graduationDate)}` : "Graduation date not set"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {e.isPrimary && <Badge tone="info">Main program</Badge>}
                    {e.verifiedBySchool && <Badge tone="good">Verified by school</Badge>}
                  </div>
                </div>
                {e.verifiedBySchool ? (
                  <p className="max-w-xs text-xs text-muted-foreground">From your school&apos;s records. Ask your career center to correct it.</p>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(e)} aria-label={`Edit ${e.degreeLevel} at ${e.schoolName}`}>Edit</Button>
                    <Button variant="ghost" onClick={() => removeEdu(e)} aria-label={`Delete ${e.degreeLevel} at ${e.schoolName}`}>Delete</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

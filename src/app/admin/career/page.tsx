"use client";

import Link from "next/link";
/** Platform operator console for the career suite: enable schools, white-label brands (F10), employer verification. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, buttonClass, Card, EmptyState, ErrorBanner, Field, formatDate, Loading, PageHeader, SuccessBanner, useLoad, ScrollArea } from "@/components/career/ui";

interface Brand {
  id: string;
  key: string;
  displayName: string;
  legalName?: string | null;
  logoUrl?: string | null;
  primaryColor: string;
  hosts: string;
  emailFromName?: string | null;
  emailFromAddress?: string | null;
  supportEmail?: string | null;
  privacyUrl?: string | null;
  termsUrl?: string | null;
  showPoweredBy: boolean;
  isWhiteLabel: boolean;
}

interface SchoolRow {
  instituteId: string;
  slug: string;
  displayName: string;
  emailDomains: string;
  brandId?: string | null;
  partnerKey?: string | null;
  partnerOrgId?: string | null;
  pilotStartsAt?: string | null;
  pilotEndsAt?: string | null;
}

interface EmployerRow {
  id: string;
  name: string;
  website?: string | null;
  emailDomain?: string | null;
  verificationStatus: string;
  flagReason?: string | null;
  hqCountry?: string | null;
  verificationRequestedAt?: string | null;
  activeUsers: number;
  approvedSchools: number;
}

/**
 * H52 "Ask Edulexa to verify us": companies whose owner asked Edulexa staff to verify them, oldest first. Verify, or decline with
 * a short reason the company sees (it can ask again). The company's team is told either way.
 */
function WaitingForVerification({ onDecided }: { onDecided: (message: string) => void }) {
  const api = useApi();
  const waiting = useLoad(() => api<EmployerRow[]>("/api/career/platform/employers?requested=true&take=100"), [api]);
  const [declining, setDeclining] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const decide = async (o: EmployerRow, status: "StaffVerified" | "Unverified") => {
    setBusy(o.id + status);
    setErr(null);
    try {
      await api(`/api/career/platform/employers/${o.id}/verification`, { method: "POST", json: { status, reason: status === "Unverified" ? reason.trim() : null } });
      onDecided(status === "StaffVerified" ? `${o.name} is verified. Its team was told.` : `${o.name} was declined. Its team was told why.`);
      setDeclining(null);
      setReason("");
      waiting.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-labelledby="waiting-verification" className="mb-6">
      <h3 id="waiting-verification" className="mb-2 text-sm font-semibold">
        Asked to be verified{waiting.data ? ` (${waiting.data.length})` : ""}
      </h3>
      <ErrorBanner error={err ?? waiting.error} onRetry={err ? undefined : waiting.reload} />
      {waiting.loading && !waiting.data ? (
        <Loading />
      ) : waiting.data && waiting.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No company is waiting.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {(waiting.data ?? []).map((o) => (
            <li key={o.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium">{o.name}</span>{" "}
                  {o.website ? (
                    <a className="break-all underline" href={/^https?:\/\//i.test(o.website) ? o.website : `https://${o.website}`} target="_blank" rel="noopener noreferrer">
                      {o.website}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">No website</span>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Asked on {formatDate(o.verificationRequestedAt)} · {o.hqCountry ?? "—"} · signs in with {o.emailDomain ?? "a free e-mail service"} · {o.verificationStatus === "DomainVerified" ? "e-mail address checked" : "e-mail address not checked"} · {o.activeUsers} active users
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button busy={busy === o.id + "StaffVerified"} onClick={() => decide(o, "StaffVerified")} aria-label={`Verify ${o.name}`}>
                    Verify
                  </Button>
                  <Button variant="secondary" onClick={() => { setDeclining(declining === o.id ? null : o.id); setReason(""); }} aria-expanded={declining === o.id} aria-label={`Decline ${o.name}`}>
                    Decline
                  </Button>
                </div>
              </div>
              {declining === o.id && (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    decide(o, "Unverified");
                  }}
                >
                  <Field label="Reason the company sees" hint="Say what to fix, in a sentence.">
                    {(p) => <input {...p} required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />}
                  </Field>
                  <Button type="submit" variant="danger" busy={busy === o.id + "Unverified"} disabled={!reason.trim()}>
                    Decline
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const emptySchool = { name: "", slug: "", emailDomains: "", timeZone: "America/New_York", brandKey: "edulexa", partnerKey: "", partnerOrgId: "", adminEmail: "", adminName: "", countryCode: "US", instituteId: "" };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

function BrandEditor({ brand, onSaved }: { brand: Brand; onSaved: (b: Brand) => void }) {
  const api = useApi();
  const [b, setB] = useState(brand);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (k: keyof Brand) => (e: React.ChangeEvent<HTMLInputElement>) => setB({ ...b, [k]: e.target.value });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^#[0-9a-fA-F]{6}$/.test(b.primaryColor)) {
      setErr("Primary color must look like #1a2b3c.");
      return;
    }
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const saved = await api<Brand>(`/api/career/platform/brands/${encodeURIComponent(b.key)}`, {
        method: "PUT",
        json: {
          displayName: b.displayName,
          legalName: b.legalName ?? "",
          logoUrl: b.logoUrl ?? "",
          primaryColor: b.primaryColor,
          hosts: b.hosts,
          emailFromName: b.emailFromName ?? "",
          emailFromAddress: b.emailFromAddress ?? "",
          supportEmail: b.supportEmail ?? "",
          privacyUrl: b.privacyUrl ?? "",
          termsUrl: b.termsUrl ?? "",
          showPoweredBy: b.showPoweredBy,
        },
      });
      setB(saved);
      onSaved(saved);
      setMsg("Brand saved.");
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="rounded-lg border border-border p-4" aria-label={`Brand ${b.key}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="inline-block h-5 w-5 rounded" style={{ background: b.primaryColor }} aria-hidden />
        <h3 className="font-semibold">{b.displayName}</h3>
        <Badge>{b.key}</Badge>
        {b.isWhiteLabel && <Badge tone="info">White label</Badge>}
      </div>
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Display name">{(p) => <input {...p} required value={b.displayName} onChange={set("displayName")} />}</Field>
        <Field label="Legal name">{(p) => <input {...p} value={b.legalName ?? ""} onChange={set("legalName")} />}</Field>
        <Field label="Hosts" hint="Comma-separated domains that show this brand.">{(p) => <input {...p} value={b.hosts} onChange={set("hosts")} />}</Field>
        <Field label="Primary color">
          {(p) => (
            <div className="flex gap-2">
              <input type="color" aria-label="Pick primary color" className="h-10 w-12 rounded border border-border" value={/^#[0-9a-fA-F]{6}$/.test(b.primaryColor) ? b.primaryColor : "#4f46e5"} onChange={set("primaryColor")} />
              <input {...p} value={b.primaryColor} onChange={set("primaryColor")} />
            </div>
          )}
        </Field>
        <Field label="Logo URL">{(p) => <input {...p} type="url" value={b.logoUrl ?? ""} onChange={set("logoUrl")} />}</Field>
        <Field label="Support email">{(p) => <input {...p} type="email" value={b.supportEmail ?? ""} onChange={set("supportEmail")} />}</Field>
        <Field label="Email sender name">{(p) => <input {...p} value={b.emailFromName ?? ""} onChange={set("emailFromName")} />}</Field>
        <Field label="Email sender address">{(p) => <input {...p} type="email" value={b.emailFromAddress ?? ""} onChange={set("emailFromAddress")} />}</Field>
        <Field label="Privacy policy URL">{(p) => <input {...p} type="url" value={b.privacyUrl ?? ""} onChange={set("privacyUrl")} />}</Field>
        <Field label="Terms URL">{(p) => <input {...p} type="url" value={b.termsUrl ?? ""} onChange={set("termsUrl")} />}</Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={b.showPoweredBy} onChange={(e) => setB({ ...b, showPoweredBy: e.target.checked })} />
        Show &quot;Powered by&quot; in the footer
      </label>
      <Button type="submit" className="mt-3" busy={busy}>Save brand</Button>
    </form>
  );
}

// Change a school's brand or partner link after it was enabled
function SchoolRowEditor({ school, brands, onSaved }: { school: SchoolRow; brands: Brand[]; onSaved: () => void }) {
  const api = useApi();
  const current = brands.find((b) => b.id === school.brandId)?.key ?? "edulexa";
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ brandKey: current, partnerKey: school.partnerKey ?? "", partnerOrgId: school.partnerOrgId ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      // Empty partner fields remove the partner link
      await api(`/api/career/platform/schools/${school.instituteId}`, { method: "PUT", json: { brandKey: f.brandKey, partnerKey: f.partnerKey.trim(), partnerOrgId: f.partnerOrgId.trim() } });
      setOpen(false);
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <Button variant="ghost" onClick={() => setOpen(true)} aria-label={`Change brand or partner for ${school.displayName}`}>
        Change
      </Button>
    );
  return (
    <form onSubmit={save} className="grid min-w-xl gap-2 sm:grid-cols-4" aria-label={`Brand and partner for ${school.displayName}`}>
      <div className="sm:col-span-4">
        <ErrorBanner error={err} />
      </div>
      <Field label="Brand">
        {(p) => (
          <select {...p} value={f.brandKey} onChange={(e) => setF({ ...f, brandKey: e.target.value })}>
            {brands.map((b) => <option key={b.key} value={b.key}>{b.displayName} ({b.key})</option>)}
          </select>
        )}
      </Field>
      <Field label="Partner key">{(p) => <input {...p} value={f.partnerKey} onChange={(e) => setF({ ...f, partnerKey: e.target.value })} />}</Field>
      <Field label="Partner org id">{(p) => <input {...p} value={f.partnerOrgId} onChange={(e) => setF({ ...f, partnerOrgId: e.target.value })} />}</Field>
      <div className="flex items-end gap-2">
        <Button type="submit" busy={busy}>Save</Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

/** Build & Defend Stage 3: the school's pilot weeks, and its results */
function PilotCell({ school, onSaved }: { school: SchoolRow; onSaved: (msg: string) => void }) {
  const api = useApi();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ startsAt: school.pilotStartsAt?.slice(0, 10) ?? "", endsAt: school.pilotEndsAt?.slice(0, 10) ?? "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = async (body: { startsAt: string | null; endsAt: string | null }) => {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/career/platform/schools/${school.instituteId}/pilot`, { method: "PUT", json: body });
      setOpen(false);
      onSaved(body.startsAt ? `${school.displayName} is a pilot school.` : `${school.displayName} is no longer a pilot school.`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (!open)
    return (
      <div className="flex flex-wrap items-center gap-2">
        {school.pilotStartsAt ? (
          <>
            <span className="whitespace-nowrap">{school.pilotStartsAt.slice(0, 10)} to {school.pilotEndsAt?.slice(0, 10)}</span>
            <Link href={`/admin/career/pilot/${school.instituteId}`} className="font-medium underline-offset-2 hover:underline">Results</Link>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        <Button variant="ghost" onClick={() => setOpen(true)} aria-label={`Pilot dates for ${school.displayName}`}>{school.pilotStartsAt ? "Change" : "Set"}</Button>
      </div>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save({ startsAt: f.startsAt || null, endsAt: f.endsAt ? f.endsAt + "T23:59:59Z" : null });
      }}
      className="grid min-w-80 gap-2 sm:grid-cols-2"
      aria-label={`Pilot dates for ${school.displayName}`}
    >
      <div className="sm:col-span-2"><ErrorBanner error={err} /></div>
      <Field label="Pilot starts">{(p) => <input {...p} type="date" required value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} />}</Field>
      <Field label="Pilot ends">{(p) => <input {...p} type="date" required value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} />}</Field>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
        <Button type="submit" busy={busy}>Save</Button>
        {school.pilotStartsAt && <Button type="button" variant="ghost" disabled={busy} onClick={() => void save({ startsAt: null, endsAt: null })}>End the pilot</Button>}
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </form>
  );
}

const emptyBrand = { key: "", displayName: "", primaryColor: "#4f46e5", hosts: "", supportEmail: "", isWhiteLabel: true };

export default function CareerPlatformAdminPage() {
  const api = useApi();
  const brands = useLoad(() => api<Brand[]>("/api/career/platform/brands"), [api]);
  const schools = useLoad(() => api<SchoolRow[]>("/api/career/platform/schools"), [api]);
  const [form, setForm] = useState(emptySchool);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [verify, setVerify] = useState({ id: "", status: "StaffVerified", reason: "" });
  const [q, setQ] = useState("");
  const [newBrand, setNewBrand] = useState(emptyBrand);
  const [empQ, setEmpQ] = useState("");
  const [empSearch, setEmpSearch] = useState("");
  const employers = useLoad(() => api<EmployerRow[]>(`/api/career/platform/employers?take=50${empSearch ? `&q=${encodeURIComponent(empSearch)}` : ""}`), [api, empSearch]);

  const createBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("brand");
    setErr(null);
    setMsg(null);
    try {
      const b = await api<Brand>("/api/career/platform/brands", {
        method: "POST",
        json: { ...newBrand, key: newBrand.key.trim().toLowerCase(), hosts: newBrand.hosts.trim() || null, supportEmail: newBrand.supportEmail.trim() || null },
      });
      setMsg(`Brand ${b.displayName} (${b.key}) was created.`);
      setNewBrand(emptyBrand);
      brands.reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const brandKey = (id?: string | null) => brands.data?.find((b) => b.id === id)?.key ?? "—";

  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("school");
    setErr(null);
    setMsg(null);
    try {
      const n = (s: string) => s.trim() || null;
      const r = await api<{ instituteId: string; slug: string; displayName: string; brand: string }>("/api/career/platform/schools", {
        method: "POST",
        json: {
          instituteId: n(form.instituteId),
          name: form.name.trim(),
          slug: form.slug.trim(),
          emailDomains: n(form.emailDomains),
          timeZone: n(form.timeZone),
          brandKey: form.brandKey,
          partnerKey: n(form.partnerKey),
          partnerOrgId: n(form.partnerOrgId),
          adminEmail: n(form.adminEmail),
          adminName: n(form.adminName),
          countryCode: n(form.countryCode),
        },
      });
      setMsg(`${r.displayName} is enabled (${r.slug}, brand ${r.brand}).${form.adminEmail ? ` ${form.adminEmail} was invited as career center admin.` : ""}`);
      setForm(emptySchool);
      schools.reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("verify");
    setErr(null);
    setMsg(null);
    try {
      const r = await api<{ id: string; verificationStatus: string }>(`/api/career/platform/employers/${verify.id.trim()}/verification`, {
        method: "POST",
        json: { status: verify.status, reason: verify.reason.trim() || null },
      });
      setMsg(`Employer ${r.id} is now ${r.verificationStatus}.`);
      setVerify({ id: "", status: "StaffVerified", reason: "" });
      employers.reload();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const filtered = (schools.data ?? []).filter((s) => !q || `${s.displayName} ${s.slug} ${s.emailDomains}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Career settings"
        description="Enable schools, manage white-label brands and review employer verification."
        actions={<><Link href="/admin/career/sponsors" className={buttonClass("secondary")}>Sponsorship data</Link><Link href="/admin/career/incidents" className={buttonClass("secondary")}>Privacy incidents</Link></>}
      />
      <ErrorBanner error={err} />
      <SuccessBanner message={msg} />

      <Card title="Enable a school">
        <form onSubmit={enable} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="School name">{(p) => <input {...p} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.slug && form.slug !== slugify(form.name) ? form.slug : slugify(e.target.value) })} />}</Field>
          <Field label="Slug" hint="3-50 lower-case letters, digits or hyphens.">{(p) => <input {...p} required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />}</Field>
          <Field label="Student email domains" hint="Comma-separated.">{(p) => <input {...p} value={form.emailDomains} onChange={(e) => setForm({ ...form, emailDomains: e.target.value })} />}</Field>
          <Field label="Time zone (IANA)">{(p) => <input {...p} value={form.timeZone} onChange={(e) => setForm({ ...form, timeZone: e.target.value })} />}</Field>
          <Field label="Brand">
            {(p) => (
              <select {...p} value={form.brandKey} onChange={(e) => setForm({ ...form, brandKey: e.target.value })}>
                {(brands.data ?? [{ key: "edulexa", displayName: "Default" } as Brand]).map((b) => <option key={b.key} value={b.key}>{b.displayName} ({b.key})</option>)}
              </select>
            )}
          </Field>
          <Field label="Country code">{(p) => <input {...p} maxLength={2} value={form.countryCode} onChange={(e) => setForm({ ...form, countryCode: e.target.value.toUpperCase() })} />}</Field>
          <Field label="First admin email">{(p) => <input {...p} type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />}</Field>
          <Field label="First admin name">{(p) => <input {...p} value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} />}</Field>
          <Field label="Existing institute id" hint="Optional: link an existing institute instead of creating one.">{(p) => <input {...p} value={form.instituteId} onChange={(e) => setForm({ ...form, instituteId: e.target.value })} />}</Field>
          <Field label="Partner key">{(p) => <input {...p} value={form.partnerKey} onChange={(e) => setForm({ ...form, partnerKey: e.target.value })} />}</Field>
          <Field label="Partner organization id">{(p) => <input {...p} value={form.partnerOrgId} onChange={(e) => setForm({ ...form, partnerOrgId: e.target.value })} />}</Field>
          <div className="flex items-end">
            <Button type="submit" busy={busy === "school"}>Enable school</Button>
          </div>
        </form>
      </Card>

      <Card title={`Schools (${schools.data?.length ?? 0})`}>
        <ErrorBanner error={schools.error} onRetry={schools.reload} />
        <div className="mb-3 max-w-sm">
          <Field label="Filter">{(p) => <input {...p} type="search" value={q} onChange={(e) => setQ(e.target.value)} />}</Field>
        </div>
        {schools.loading && !schools.data ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState title="No schools" />
        ) : (
          <ScrollArea>
            <table className="w-full text-sm">
              <caption className="sr-only">Schools with the career suite</caption>
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border text-start">
                  <th scope="col" className="py-2 pe-3 font-medium">School</th>
                  <th scope="col" className="py-2 pe-3 font-medium">Slug</th>
                  <th scope="col" className="py-2 pe-3 font-medium">Domains</th>
                  <th scope="col" className="py-2 pe-3 font-medium">Brand</th>
                  <th scope="col" className="py-2 pe-3 font-medium">Partner</th>
                  <th scope="col" className="py-2 pe-3 font-medium">Pilot</th>
                  <th scope="col" className="py-2 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.instituteId} className="border-b border-border last:border-0">
                    <td className="py-2 pe-3">{s.displayName}<div className="font-mono text-xs text-muted-foreground">{s.instituteId}</div></td>
                    <td className="py-2 pe-3">{s.slug}</td>
                    <td className="py-2 pe-3">{s.emailDomains || "—"}</td>
                    <td className="py-2 pe-3">{brandKey(s.brandId)}</td>
                    <td className="py-2 pe-3">{[s.partnerKey, s.partnerOrgId].filter(Boolean).join(" / ") || "—"}</td>
                    <td className="py-2 pe-3">
                      <PilotCell school={s} onSaved={(m) => { setMsg(m); schools.reload(); }} />
                    </td>
                    <td className="py-2">
                      {brands.data && (
                        <SchoolRowEditor
                          school={s}
                          brands={brands.data}
                          onSaved={() => {
                            setMsg(`${s.displayName} was updated.`);
                            schools.reload();
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
        )}
      </Card>

      <Card title="Brands">
        <ErrorBanner error={brands.error} onRetry={brands.reload} />
        {brands.loading && !brands.data ? (
          <Loading />
        ) : (
          <div className="space-y-4">
            <form onSubmit={createBrand} className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="New brand">
              <h3 className="font-semibold sm:col-span-2 lg:col-span-3">New brand</h3>
              <Field label="Key" hint="Lower-case letters, digits and hyphens, for example acme-careers.">{(p) => <input {...p} required value={newBrand.key} onChange={(e) => setNewBrand({ ...newBrand, key: e.target.value })} />}</Field>
              <Field label="Display name">{(p) => <input {...p} required value={newBrand.displayName} onChange={(e) => setNewBrand({ ...newBrand, displayName: e.target.value })} />}</Field>
              <Field label="Primary color" hint="Hex color, for example #4f46e5.">{(p) => <input {...p} pattern="#[0-9a-fA-F]{6}" value={newBrand.primaryColor} onChange={(e) => setNewBrand({ ...newBrand, primaryColor: e.target.value })} />}</Field>
              <Field label="Hosts" hint="Comma-separated; optional.">{(p) => <input {...p} value={newBrand.hosts} onChange={(e) => setNewBrand({ ...newBrand, hosts: e.target.value })} />}</Field>
              <Field label="Support email">{(p) => <input {...p} type="email" value={newBrand.supportEmail} onChange={(e) => setNewBrand({ ...newBrand, supportEmail: e.target.value })} />}</Field>
              <label className="flex items-center gap-2 self-end text-sm">
                <input type="checkbox" className="h-4 w-4" checked={newBrand.isWhiteLabel} onChange={(e) => setNewBrand({ ...newBrand, isWhiteLabel: e.target.checked })} />
                White label (partner brand)
              </label>
              <div>
                <Button type="submit" busy={busy === "brand"}>Create brand</Button>
              </div>
            </form>
            {(brands.data ?? []).map((b) => (
              <BrandEditor key={b.id} brand={b} onSaved={(nb) => brands.setData((d) => (d ? d.map((x) => (x.id === nb.id ? nb : x)) : d))} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Employer verification">
        <WaitingForVerification
          onDecided={(m) => {
            setErr(null);
            setMsg(m);
            employers.reload();
          }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setEmpSearch(empQ.trim());
          }}
          className="mb-3 flex max-w-lg flex-wrap items-end gap-2"
          role="search"
        >
          <Field label="Find an employer" hint="Name, email domain or website.">{(p) => <input {...p} type="search" value={empQ} onChange={(e) => setEmpQ(e.target.value)} />}</Field>
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <ErrorBanner error={employers.error} onRetry={employers.reload} />
        <div aria-live="polite">
          {employers.data &&
            (employers.data.length === 0 ? (
              <EmptyState title="No employers match" />
            ) : (
              <ul className="mb-4 divide-y divide-border text-sm">
                {employers.data.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <span className="font-medium">{o.name}</span> <span className="text-muted-foreground">{o.emailDomain ?? o.website ?? ""}</span>
                      <div className="text-xs text-muted-foreground">
                        {o.activeUsers} active users · approved at {o.approvedSchools} schools{o.flagReason ? ` · ${o.flagReason}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone={o.verificationStatus === "Flagged" ? "bad" : o.verificationStatus === "Unverified" ? "warn" : "good"}>{o.verificationStatus}</Badge>
                      <Button variant="ghost" onClick={() => setVerify({ ...verify, id: o.id })} aria-label={`Select ${o.name} for verification`}>Select</Button>
                    </div>
                  </li>
                ))}
              </ul>
            ))}
        </div>
        <form onSubmit={submitVerification} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Employer id">{(p) => <input {...p} required pattern="[0-9a-fA-F-]{36}" value={verify.id} onChange={(e) => setVerify({ ...verify, id: e.target.value })} />}</Field>
          <Field label="Status">
            {(p) => (
              <select {...p} value={verify.status} onChange={(e) => setVerify({ ...verify, status: e.target.value })}>
                <option value="StaffVerified">Verified by staff</option>
                <option value="Flagged">Flagged for review</option>
                <option value="Unverified">Unverified</option>
              </select>
            )}
          </Field>
          <Field label="Reason (the company sees it when flagged or declined)">{(p) => <input {...p} value={verify.reason} onChange={(e) => setVerify({ ...verify, reason: e.target.value })} />}</Field>
          <div className="flex items-end">
            <Button type="submit" busy={busy === "verify"}>Update</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

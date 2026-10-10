"use client";

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, EmptyState, ErrorBanner, Loading, PageHeader, SuccessBanner, formatDate, useLoad } from "@/components/career/ui";
import { FERPA_CATEGORY_LABELS, LEGAL_BASIS_LABELS, labelOf } from "@/components/career/coreLabels";

interface Consent {
  id: string;
  recipientType: string;
  recipientName: string;
  categories: string[] | null;
  purpose: string;
  source?: string | null;
  grantedAt: string;
  expiresAt?: string | null;
  revokedAt?: string | null;
  active: boolean;
}

interface Disclosure {
  id: string;
  recipientType: string;
  recipientName: string;
  categories: string[] | null;
  purpose: string;
  legalBasis: string;
  occurredAt: string;
}

const cats = (c: string[] | null) => (c ?? []).map((x) => labelOf(FERPA_CATEGORY_LABELS, x)).join(", ") || "—";

export default function StudentPrivacyPage() {
  const api = useApi();
  const record = useLoad(() => api<{ ferpaHold: boolean; school: { displayName: string } }>("/api/career/student/record"), [api]);
  const consents = useLoad(() => api<Consent[]>("/api/career/student/consents"), [api]);
  const disclosures = useLoad(() => api<Disclosure[]>("/api/career/student/disclosures"), [api]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const hold = record.data?.ferpaHold ?? false;

  const toggleHold = async () => {
    const next = !hold;
    if (next && !window.confirm("Turn on a directory hold? Employers won't see your directory information unless you share it yourself.")) return;
    setBusy("hold");
    setErr(null);
    try {
      const r = await api<{ ferpaHold: boolean }>("/api/career/student/ferpa-hold", { method: "PUT", json: { hold: next } });
      record.setData((d) => (d ? { ...d, ferpaHold: r.ferpaHold } : d));
      setMsg(r.ferpaHold ? "Directory hold is on." : "Directory hold is off.");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (c: Consent) => {
    if (!window.confirm(`Stop sharing with ${c.recipientName}? They keep anything already shared, but won't get updates.`)) return;
    setBusy(c.id);
    setErr(null);
    try {
      await api(`/api/career/student/consents/${c.id}/revoke`, { method: "POST" });
      setMsg(`Sharing with ${c.recipientName} was stopped.`);
      consents.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageHeader title="Privacy & sharing" description="You control who sees your career record. Under FERPA, your school can only share it with your consent or as directory information." />
      <ErrorBanner error={err ?? record.error ?? consents.error ?? disclosures.error} />
      <SuccessBanner message={msg} />

      <Card title="Directory information" className="mb-6">
        {record.loading && !record.data ? (
          <Loading />
        ) : record.data ? (
          <div className="space-y-3 text-sm">
            <p>
              Schools may share some basic &quot;directory information&quot; (like your name, major and graduation date) with approved employers without asking you first.
              A <strong>directory hold</strong> stops that: employers then see your details only when you choose to share them.
            </p>
            <p className="flex flex-wrap items-center gap-2">
              Status: {hold ? <Badge tone="warn">Hold on – not shared</Badge> : <Badge tone="good">No hold – directory information may be shared</Badge>}
            </p>
            <Button variant={hold ? "secondary" : "primary"} onClick={toggleHold} busy={busy === "hold"} aria-pressed={hold}>
              {hold ? "Turn off directory hold" : "Turn on directory hold"}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card title="What you've agreed to share" className="mb-6">
        {consents.loading && !consents.data ? (
          <Loading />
        ) : (consents.data ?? []).length === 0 ? (
          <EmptyState title="You haven't shared your record with anyone">When you agree to share something, it shows here and you can stop it at any time.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Your sharing consents</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">Shared with</th>
                  <th scope="col" className="py-2 pr-3 font-medium">What</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Why</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Since</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Status</th>
                  <th scope="col" className="py-2"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {consents.data!.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pr-3">{c.recipientName}<div className="text-xs text-muted-foreground">{c.recipientType}</div></td>
                    <td className="py-2 pr-3">{cats(c.categories)}</td>
                    <td className="py-2 pr-3">{c.purpose || "—"}</td>
                    <td className="py-2 pr-3">
                      {formatDate(c.grantedAt)}
                      {c.expiresAt && <div className="text-xs text-muted-foreground">Ends {formatDate(c.expiresAt)}</div>}
                    </td>
                    <td className="py-2 pr-3">
                      {c.active ? <Badge tone="good">Active</Badge> : c.revokedAt ? <Badge>Stopped {formatDate(c.revokedAt)}</Badge> : <Badge>Expired</Badge>}
                    </td>
                    <td className="py-2 text-right">
                      {c.active && (
                        <Button variant="secondary" onClick={() => revoke(c)} busy={busy === c.id} aria-label={`Stop sharing with ${c.recipientName}`}>
                          Stop sharing
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Who saw what, when and why">
        <p className="mb-3 text-sm text-muted-foreground">Every time your record is released outside your school, it&apos;s logged here.</p>
        {disclosures.loading && !disclosures.data ? (
          <Loading />
        ) : (disclosures.data ?? []).length === 0 ? (
          <EmptyState title="No one outside your school has seen your record" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Disclosure history</caption>
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="py-2 pr-3 font-medium">When</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Who</th>
                  <th scope="col" className="py-2 pr-3 font-medium">What</th>
                  <th scope="col" className="py-2 pr-3 font-medium">Why</th>
                  <th scope="col" className="py-2 font-medium">Allowed by</th>
                </tr>
              </thead>
              <tbody>
                {disclosures.data!.map((d) => (
                  <tr key={d.id} className="border-b border-border last:border-0 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap">{formatDate(d.occurredAt, true)}</td>
                    <td className="py-2 pr-3">{d.recipientName}<div className="text-xs text-muted-foreground">{d.recipientType}</div></td>
                    <td className="py-2 pr-3">{cats(d.categories)}</td>
                    <td className="py-2 pr-3">{d.purpose || "—"}</td>
                    <td className="py-2">{labelOf(LEGAL_BASIS_LABELS, d.legalBasis)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

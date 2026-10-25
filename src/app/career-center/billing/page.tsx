"use client";

/**
 * A school's own billing (G9), career admins only: billing details with GSTIN, invoices with GST invoice PDFs, online
 * payment through the provider the platform operator chose (Razorpay or Stripe hosted link), and refunds with their
 * credit-note numbers. Invoices and refunds are issued by the platform operator; this page never creates them.
 */

import React, { useState } from "react";
import { ExternalLink, FileDown } from "lucide-react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  PageHeader,
  ScrollArea,
  SuccessBanner,
  useCareerFormat,
  useCareerT,
  useLoad,
} from "@/components/career/ui";
import { GST_STATES, formatMinor, saveResponse } from "@/components/career/billing/money";

interface Profile {
  instituteId: string;
  exists: boolean;
  legalName?: string | null;
  gstin?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
  pincode?: string | null;
  countryCode?: string | null;
  billingEmail?: string | null;
  provider?: string | null;
  currency?: string | null;
  updatedAt?: string | null;
}

interface Line {
  description?: string;
  Description?: string;
  quantity?: number;
  Quantity?: number;
  unitAmountMinor?: number;
  UnitAmountMinor?: number;
  amountMinor?: number;
  AmountMinor?: number;
}

interface Refund {
  id: string;
  amountMinor: number;
  status: string;
  reason?: string | null;
  creditNoteNumber?: string | null;
  creditNoteDate?: string | null;
  taxableMinor?: number | null;
  cgstMinor?: number | null;
  sgstMinor?: number | null;
  igstMinor?: number | null;
  createdAt: string;
}

interface Invoice {
  id: string;
  number: string;
  financialYear?: string | null;
  issueDate: string;
  currency: string;
  provider: string;
  status: string;
  lines: Line[];
  placeOfSupply?: { code: string; name?: string | null } | null;
  taxType?: string | null;
  sacCode?: string | null;
  reverseCharge?: boolean;
  taxableValueMinor: number;
  cgst: { rate?: number | null; amountMinor?: number | null };
  stateTax: { label?: string | null; rate?: number | null; amountMinor?: number | null };
  igst: { rate?: number | null; amountMinor?: number | null };
  roundOffMinor?: number | null;
  totalMinor: number;
  amountPaidMinor: number;
  amountRefundedMinor: number;
  payment: { orderId?: string | null; paymentLinkUrl?: string | null; paymentId?: string | null; paidAt?: string | null; paymentAttempts?: number; lastError?: string | null };
  refunds: Refund[];
  notes?: string | null;
  cancelledAt?: string | null;
}

interface PayStart {
  provider: string;
  mode: string;
  url?: string | null;
}

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  Issued: "warn",
  Paid: "good",
  PartiallyRefunded: "info",
  Refunded: "neutral",
  Cancelled: "bad",
};

const PROFILE_FIELDS = ["legalName", "gstin", "addressLine1", "addressLine2", "city", "stateCode", "pincode", "countryCode", "billingEmail"] as const;
type ProfileForm = Record<(typeof PROFILE_FIELDS)[number], string>;

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";

function toForm(p: Profile | null): ProfileForm {
  const f = {} as ProfileForm;
  for (const k of PROFILE_FIELDS) f[k] = (p?.[k] as string | null | undefined) ?? (k === "countryCode" ? "IN" : "");
  return f;
}

const lineValue = (l: Line) => ({
  description: l.description ?? l.Description ?? "",
  quantity: l.quantity ?? l.Quantity ?? 1,
  unit: l.unitAmountMinor ?? l.UnitAmountMinor ?? 0,
  amount: l.amountMinor ?? l.AmountMinor ?? 0,
});

export default function CareerBillingPage() {
  const t = useCareerT("billing");
  const fmt = useCareerFormat();
  const api = useApi();
  const { me, schoolId } = useCareerShell();
  const isAdmin = me ? me.memberships.some((m) => m.instituteId === schoolId && m.role === "CareerAdmin") : true;

  const profile = useLoad(() => api<Profile>("/api/career/billing/profile"), [api, schoolId]);
  const invoices = useLoad(() => api<Invoice[]>("/api/career/billing/invoices"), [api, schoolId]);

  const [form, setForm] = useState<ProfileForm>(toForm(null));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Refill the form when a new profile arrives (state adjusted during render, not in an effect)
  const [shown, setShown] = useState<Profile | null>(null);
  if (profile.data && profile.data !== shown) {
    setShown(profile.data);
    setForm(toForm(profile.data));
  }

  const money = (minor: number | null | undefined, currency: string) => formatMinor(minor, currency, fmt.locale);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    run("profile", async () => {
      const body: Record<string, string> = {};
      for (const k of PROFILE_FIELDS) body[k] = form[k].trim();
      // A registered school's state comes from its GSTIN
      if (body.gstin) delete body.stateCode;
      const saved = await api<Profile>("/api/career/billing/profile", { method: "PUT", json: body });
      profile.setData(saved);
      setMessage(t("profileSaved"));
    });
  };

  const downloadPdf = (inv: Invoice) =>
    run(`pdf-${inv.id}`, async () => {
      const res = await api<Response>(`/api/career/billing/invoices/${inv.id}/pdf`, { raw: true });
      if (!res.ok) throw new Error(t("pdfFailed"));
      await saveResponse(res, `${inv.number.replace(/[^A-Za-z0-9-]+/g, "-")}.pdf`);
    });

  const pay = (inv: Invoice) =>
    run(`pay-${inv.id}`, async () => {
      const start = await api<PayStart>(`/api/career/billing/invoices/${inv.id}/pay`, { method: "POST", json: { mode: "link" } });
      if (!start.url) throw new Error(t("payNoLink"));
      invoices.reload();
      window.open(start.url, "_blank", "noopener,noreferrer");
      setMessage(t("payOpened", { provider: providerName(start.provider) }));
    });

  const providerName = (p: string | null | undefined) => (p === "razorpay" ? "Razorpay" : p === "stripe" ? "Stripe" : p || t("providerNotSet"));

  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (me && !isAdmin) {
    return (
      <div>
        <PageHeader title={t("title")} />
        <EmptyState title={t("adminOnlyTitle")}>{t("adminOnly")}</EmptyState>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />
      <ErrorBanner error={error} />
      <SuccessBanner message={message} />

      <div className="space-y-6">
        <Card title={t("profileTitle")}>
          {profile.loading && !profile.data ? (
            <Loading />
          ) : profile.error ? (
            <ErrorBanner error={profile.error} onRetry={profile.reload} />
          ) : (
            <form onSubmit={saveProfile} className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("profileHelp")}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("legalName")}>{(p) => <input {...p} value={form.legalName} onChange={set("legalName")} autoComplete="organization" required maxLength={200} />}</Field>
                <Field label={t("gstin")} hint={t("gstinHint")}>
                  {(p) => <input {...p} value={form.gstin} onChange={set("gstin")} maxLength={15} spellCheck={false} className={`${p.className} uppercase`} dir="ltr" />}
                </Field>
                <Field label={t("addressLine1")}>{(p) => <input {...p} value={form.addressLine1} onChange={set("addressLine1")} autoComplete="address-line1" maxLength={200} />}</Field>
                <Field label={t("addressLine2")}>{(p) => <input {...p} value={form.addressLine2} onChange={set("addressLine2")} autoComplete="address-line2" maxLength={200} />}</Field>
                <Field label={t("city")}>{(p) => <input {...p} value={form.city} onChange={set("city")} autoComplete="address-level2" maxLength={100} />}</Field>
                <Field label={t("state")} hint={form.gstin.trim() ? t("stateFromGstin") : t("stateHint")}>
                  {(p) => (
                    <select {...p} value={form.gstin.trim() ? form.gstin.trim().slice(0, 2) : form.stateCode} onChange={set("stateCode")} disabled={!!form.gstin.trim()}>
                      <option value="">{t("stateNone")}</option>
                      {GST_STATES.map(([code, name]) => (
                        <option key={code} value={code}>
                          {t("stateOption", { code, name })}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={t("pincode")}>{(p) => <input {...p} value={form.pincode} onChange={set("pincode")} inputMode="numeric" autoComplete="postal-code" maxLength={10} dir="ltr" />}</Field>
                <Field label={t("country")} hint={t("countryHint")}>{(p) => <input {...p} value={form.countryCode} onChange={set("countryCode")} maxLength={2} className={`${p.className} uppercase`} dir="ltr" />}</Field>
                <Field label={t("billingEmail")}>{(p) => <input {...p} type="email" value={form.billingEmail} onChange={set("billingEmail")} autoComplete="email" maxLength={200} dir="ltr" />}</Field>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-medium">{t("paymentProvider")}</dt>
                  <dd className="text-muted-foreground">{providerName(profile.data?.provider)}</dd>
                </div>
                <div>
                  <dt className="font-medium">{t("currency")}</dt>
                  <dd className="text-muted-foreground">{profile.data?.currency || "INR"}</dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">{t("providerSetByOperator")}</p>
              <Button type="submit" busy={busy === "profile"}>
                {t("saveProfile")}
              </Button>
            </form>
          )}
        </Card>

        <Card title={t("invoicesTitle")}>
          {invoices.loading && !invoices.data ? (
            <Loading />
          ) : invoices.error ? (
            <ErrorBanner error={invoices.error} onRetry={invoices.reload} />
          ) : !invoices.data || invoices.data.length === 0 ? (
            <EmptyState title={t("noInvoices")}>{t("noInvoicesHelp")}</EmptyState>
          ) : (
            <ScrollArea>
              <table className="w-full text-sm">
                <caption className="sr-only">{t("invoicesTitle")}</caption>
                <thead>
                  <tr className="border-b border-border [&_th]:text-start">
                    <th scope="col" className={th}>{t("colNumber")}</th>
                    <th scope="col" className={th}>{t("colDate")}</th>
                    <th scope="col" className={`${th} text-end`}>{t("colTotal")}</th>
                    <th scope="col" className={`${th} text-end`}>{t("colPaid")}</th>
                    <th scope="col" className={th}>{t("colStatus")}</th>
                    <th scope="col" className={th}>{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.data.map((inv) => {
                    const expanded = open === inv.id;
                    const detailsId = `invoice-${inv.id}`;
                    return (
                      <React.Fragment key={inv.id}>
                        <tr className="border-b border-border">
                          <th scope="row" className={`${td} text-start font-medium`} dir="ltr">
                            {inv.number}
                          </th>
                          <td className={td}>{fmt.date(inv.issueDate)}</td>
                          <td className={`${td} text-end tabular-nums`}>{money(inv.totalMinor, inv.currency)}</td>
                          <td className={`${td} text-end tabular-nums`}>{money(inv.amountPaidMinor, inv.currency)}</td>
                          <td className={td}>
                            <Badge tone={STATUS_TONE[inv.status] ?? "neutral"}>{t.has(`status.${inv.status}`) ? t(`status.${inv.status}`) : inv.status}</Badge>
                          </td>
                          <td className={td}>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="secondary" onClick={() => downloadPdf(inv)} busy={busy === `pdf-${inv.id}`} aria-label={t("downloadPdfFor", { number: inv.number })}>
                                <FileDown className="h-4 w-4" aria-hidden />
                                {t("downloadPdf")}
                              </Button>
                              {inv.status === "Issued" && (
                                <Button onClick={() => pay(inv)} busy={busy === `pay-${inv.id}`} aria-label={t("payFor", { number: inv.number, provider: providerName(inv.provider) })}>
                                  <ExternalLink className="h-4 w-4" aria-hidden />
                                  {t("pay", { provider: providerName(inv.provider) })}
                                </Button>
                              )}
                              <Button variant="ghost" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setOpen(expanded ? null : inv.id)}>
                                {expanded ? t("hideDetails") : t("showDetails")}
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="border-b border-border">
                            <td colSpan={6} id={detailsId} className="py-3">
                              <InvoiceDetails inv={inv} money={money} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          )}
        </Card>
        <p className="text-xs text-muted-foreground">{t("taxNotice")}</p>
      </div>
    </div>
  );
}

function InvoiceDetails({ inv, money }: { inv: Invoice; money: (minor: number | null | undefined, currency: string) => string }) {
  const t = useCareerT("billing");
  const fmt = useCareerFormat();
  const rate = (r: number | null | undefined) => (r === null || r === undefined ? "" : fmt.number(r));
  const taxRows: [string, number | null | undefined][] = [];
  if (inv.cgst?.amountMinor) taxRows.push([t("cgst", { rate: rate(inv.cgst.rate) }), inv.cgst.amountMinor]);
  if (inv.stateTax?.amountMinor) taxRows.push([t("stateTax", { label: inv.stateTax.label || "SGST", rate: rate(inv.stateTax.rate) }), inv.stateTax.amountMinor]);
  if (inv.igst?.amountMinor) taxRows.push([t("igst", { rate: rate(inv.igst.rate) }), inv.igst.amountMinor]);
  return (
    <div className="space-y-4">
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        {inv.placeOfSupply && (
          <div>
            <dt className="font-medium">{t("placeOfSupply")}</dt>
            <dd>{t("stateOption", { code: inv.placeOfSupply.code, name: inv.placeOfSupply.name ?? "" })}</dd>
          </div>
        )}
        {inv.sacCode && (
          <div>
            <dt className="font-medium">{t("sac")}</dt>
            <dd dir="ltr" className="text-start">{inv.sacCode}</dd>
          </div>
        )}
        <div>
          <dt className="font-medium">{t("reverseCharge")}</dt>
          <dd>{inv.reverseCharge ? t("yes") : t("no")}</dd>
        </div>
      </dl>
      <table className="w-full text-sm">
        <caption className="sr-only">{t("linesCaption", { number: inv.number })}</caption>
        <thead>
          <tr className="border-b border-border [&_th]:text-start">
            <th scope="col" className={th}>{t("colDescription")}</th>
            <th scope="col" className={`${th} text-end`}>{t("colQuantity")}</th>
            <th scope="col" className={`${th} text-end`}>{t("colUnit")}</th>
            <th scope="col" className={`${th} text-end`}>{t("colAmount")}</th>
          </tr>
        </thead>
        <tbody>
          {(inv.lines ?? []).map((raw, i) => {
            const l = lineValue(raw);
            return (
              <tr key={i} className="border-b border-border">
                <td className={td}>{l.description}</td>
                <td className={`${td} text-end tabular-nums`}>{fmt.number(l.quantity)}</td>
                <td className={`${td} text-end tabular-nums`}>{money(l.unit, inv.currency)}</td>
                <td className={`${td} text-end tabular-nums`}>{money(l.amount, inv.currency)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3} className={`${td} text-end font-medium`}>{t("taxableValue")}</th>
            <td className={`${td} text-end tabular-nums`}>{money(inv.taxableValueMinor, inv.currency)}</td>
          </tr>
          {taxRows.map(([label, amount]) => (
            <tr key={label}>
              <th scope="row" colSpan={3} className={`${td} text-end font-normal`}>{label}</th>
              <td className={`${td} text-end tabular-nums`}>{money(amount, inv.currency)}</td>
            </tr>
          ))}
          {!!inv.roundOffMinor && (
            <tr>
              <th scope="row" colSpan={3} className={`${td} text-end font-normal`}>{t("roundOff")}</th>
              <td className={`${td} text-end tabular-nums`}>{money(inv.roundOffMinor, inv.currency)}</td>
            </tr>
          )}
          <tr>
            <th scope="row" colSpan={3} className={`${td} text-end font-semibold`}>{t("total")}</th>
            <td className={`${td} text-end font-semibold tabular-nums`}>{money(inv.totalMinor, inv.currency)}</td>
          </tr>
        </tfoot>
      </table>

      {inv.payment?.paidAt && <p className="text-sm">{t("paidOn", { date: fmt.dateTime(inv.payment.paidAt) })}</p>}
      {inv.payment?.lastError && inv.status === "Issued" && <p className="text-sm text-red-700 dark:text-red-400">{t("lastPaymentError", { error: inv.payment.lastError })}</p>}
      {inv.notes && <p className="text-sm text-muted-foreground">{t("notes", { notes: inv.notes })}</p>}

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t("refundsTitle")}</h3>
        {inv.refunds.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRefunds")}</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">{t("refundsCaption", { number: inv.number })}</caption>
            <thead>
              <tr className="border-b border-border [&_th]:text-start">
                <th scope="col" className={th}>{t("colCreditNote")}</th>
                <th scope="col" className={th}>{t("colDate")}</th>
                <th scope="col" className={`${th} text-end`}>{t("colAmount")}</th>
                <th scope="col" className={`${th} text-end`}>{t("colTaxReversed")}</th>
                <th scope="col" className={th}>{t("colStatus")}</th>
                <th scope="col" className={th}>{t("colReason")}</th>
              </tr>
            </thead>
            <tbody>
              {inv.refunds.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className={td} dir="ltr">{r.creditNoteNumber ?? t("creditNotePending")}</td>
                  <td className={td}>{fmt.date(r.creditNoteDate ?? r.createdAt)}</td>
                  <td className={`${td} text-end tabular-nums`}>{money(r.amountMinor, inv.currency)}</td>
                  <td className={`${td} text-end tabular-nums`}>{money((r.cgstMinor ?? 0) + (r.sgstMinor ?? 0) + (r.igstMinor ?? 0), inv.currency)}</td>
                  <td className={td}>
                    <Badge tone={r.status === "processed" ? "good" : r.status === "failed" ? "bad" : "info"}>{t.has(`refundStatus.${r.status}`) ? t(`refundStatus.${r.status}`) : r.status}</Badge>
                  </td>
                  <td className={td}>{r.reason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

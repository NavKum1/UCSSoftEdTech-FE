"use client";

/** G5 staff view: the school's post-study work-rights trackers with each student's next date. Tracker only. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, Button, Card, EmptyState, ErrorBanner, Field, Loading, ScrollArea, SuccessBanner, useCareerFormat, useCareerT, useLoad } from "@/components/career/ui";
import { itemTone, VerifyNotice, type PacksResponse, type WorkRightsItem } from "@/components/career/international/WorkRights";

interface StaffRow {
  id: string;
  studentUserId: string;
  name: string | null;
  email: string | null;
  countryCode: string;
  country: string | null;
  status: string;
  optionLabel: string | null;
  computedPermitEnd: string | null;
  next: WorkRightsItem | null;
  overdue: number;
  dueSoon: number;
}
interface StaffResponse {
  verifyNotice: string;
  byCountry: { countryCode: string; count: number }[];
  trackers: StaffRow[];
}

export default function WorkRightsStaff() {
  const api = useApi();
  const { schoolId, me } = useCareerShell();
  const t = useCareerT("workRights");
  const fmt = useCareerFormat();
  const [country, setCountry] = useState("");
  const packs = useLoad(() => api<PacksResponse>("/api/career/international/work-rights/packs"), [api]);
  const list = useLoad(() => api<StaffResponse>(`/api/career/international/work-rights/staff${country ? `?country=${country}` : ""}`), [api, schoolId, country]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const isAdmin = !!me?.memberships.some((m) => m.role === "CareerAdmin" && (!schoolId || m.instituteId === schoolId));

  const sweep = async () => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<{ sent: number }>("/api/career/international/work-rights/sweep", { method: "POST" });
      setMsg(t("remindersSent", { count: r.sent }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title={t("staffTitle")}
      actions={
        isAdmin ? (
          <Button variant="secondary" busy={busy} onClick={sweep}>
            {t("sendReminders")}
          </Button>
        ) : undefined
      }
    >
      <p className="mb-3 text-sm">{t("staffIntro")}</p>
      {list.data && <VerifyNotice text={list.data.verifyNotice} extra={t("trackerOnly")} />}
      <ErrorBanner error={err ?? list.error} onRetry={list.reload} />
      <SuccessBanner message={msg} />
      <div className="mb-3 max-w-xs">
        <Field label={t("filterCountry")}>
          {(props) => (
            <select {...props} value={country} onChange={(e) => setCountry(e.target.value)}>
              <option value="">{t("allCountries")}</option>
              {packs.data?.packs.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.country}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data || list.data.trackers.length === 0 ? (
        <EmptyState title={t("staffEmpty")} />
      ) : (
        <ScrollArea label={t("staffCaption")}>
          <table className="w-full text-sm">
            <caption className="sr-only">{t("staffCaption")}</caption>
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground [&_th]:text-start">
                <th scope="col" className="py-1.5 pe-3 font-medium">{t("colStudent")}</th>
                <th scope="col" className="py-1.5 pe-3 font-medium">{t("colCountry")}</th>
                <th scope="col" className="py-1.5 pe-3 font-medium">{t("colStatus")}</th>
                <th scope="col" className="py-1.5 pe-3 font-medium">{t("colNext")}</th>
                <th scope="col" className="py-1.5 pe-3 font-medium">{t("colEnds")}</th>
              </tr>
            </thead>
            <tbody>
              {list.data.trackers.map((r) => (
                <tr key={r.id} className="border-b border-border/60 align-top">
                  <th scope="row" className="py-1.5 pe-3 text-start font-normal">
                    <bdi>{r.name ?? r.email}</bdi>
                    {r.email && <span className="block text-xs text-muted-foreground"><bdi>{r.email}</bdi></span>}
                  </th>
                  <td className="py-1.5 pe-3">
                    {r.country ?? r.countryCode}
                    {r.optionLabel && <span className="block text-xs text-muted-foreground">{r.optionLabel}</span>}
                  </td>
                  <td className="py-1.5 pe-3">{t(`statuses.${r.status}`)}</td>
                  <td className="py-1.5 pe-3">
                    {r.next ? (
                      <>
                        <span className="block">{r.next.label}</span>
                        <span className="me-2 text-xs">{r.next.dueOn ? fmt.date(r.next.dueOn) : "—"}</span>
                        <Badge tone={itemTone(r.next.status)}>{t(`itemStatus.${r.next.status}`)}</Badge>
                        {!r.next.verified && <span className="ms-2"><Badge tone="warn">{t("unconfirmed")}</Badge></span>}
                      </>
                    ) : (
                      "—"
                    )}
                    {r.overdue > 0 && (
                      <span className="mt-1 block">
                        <Badge tone="bad">{t("itemStatus.overdue")}: {r.overdue}</Badge>
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pe-3 whitespace-nowrap">{r.computedPermitEnd ? fmt.date(r.computedPermitEnd) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </Card>
  );
}

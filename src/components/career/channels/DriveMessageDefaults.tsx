"use client";

/**
 * H3: suggested WhatsApp templates and India DLT texts for the campus-drive notice types, checked against the college's
 * Pulse Relay workspace, with the DLT notes. Career admins apply them to the template mapping in one step.
 */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { Badge, Button, Card, ErrorBanner, Loading, ScrollArea, SuccessBanner, useCareerT, useLoad } from "@/components/career/ui";

interface DefaultsType {
  type: string;
  note: string;
  allowed: boolean;
  whatsApp: { name: string; language: string; category: string; params: string[]; body: string; approvedInWorkspace?: boolean | null };
  sms: { text: string; dltText: string; dltCategory: string; matchedDltTemplateId?: string | null };
}

interface Defaults {
  brand: string;
  linkExample: string;
  linkFitsDltVariable: boolean;
  workspaceChecked: boolean;
  notes: string[];
  types: DefaultsType[];
}

const th = "py-2 pe-3 font-medium";
const td = "py-2 pe-3 align-top";

export function DriveMessageDefaults<S>({ canEdit, onApplied }: { canEdit: boolean; onApplied: (settings: S) => void }) {
  const t = useCareerT("channelDriveDefaults");
  const tt = useCareerT("careerCenterChatSms");
  const api = useApi();
  const loaded = useLoad(() => api<Defaults>("/api/career/channels/admin/template-defaults"), [api]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const apply = async (overwrite: boolean) => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const r = await api<{ applied: { type: string; smsText?: string | null; whatsApp?: string | null }[]; settings: S }>("/api/career/channels/admin/template-defaults/apply", {
        method: "POST",
        json: { overwrite },
      });
      onApplied(r.settings);
      setMsg(t("applied", { count: r.applied.filter((a) => a.smsText || a.whatsApp).length }));
      loaded.reload();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const d = loaded.data;
  return (
    <Card title={t("title")}>
      <p className="text-sm text-muted-foreground">{t("intro")}</p>
      {canEdit && d && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" busy={busy} onClick={() => void apply(false)}>
            {t("apply")}
          </Button>
          <Button type="button" variant="ghost" busy={busy} onClick={() => void apply(true)}>
            {t("applyOverwrite")}
          </Button>
        </div>
      )}
      <ErrorBanner error={err ?? loaded.error} />
      <SuccessBanner message={msg} />
      {!d ? (
        <Loading />
      ) : (
        <div className="mt-3 space-y-4">
          {!d.workspaceChecked && <p className="text-sm text-muted-foreground">{t("notChecked")}</p>}
          {!d.linkFitsDltVariable && <p className="break-words text-sm text-amber-800 dark:text-amber-200">{t("linkTooLong", { link: d.linkExample })}</p>}
          <ScrollArea label={t("tableLabel")}>
            <table className="w-full text-sm">
              <caption className="sr-only">{t("tableLabel")}</caption>
              <thead>
                <tr className="border-b border-border [&_th]:text-start">
                  <th scope="col" className={th}>{t("colType")}</th>
                  <th scope="col" className={th}>{t("colWhatsApp")}</th>
                  <th scope="col" className={th}>{t("colDlt")}</th>
                </tr>
              </thead>
              <tbody>
                {d.types.map((x) => (
                  <tr key={x.type} className="border-b border-border last:border-0">
                    <th scope="row" className={`${td} text-start font-normal`}>
                      <div className="font-medium">{tt(`type.${x.type}`)}</div>
                      <div className="text-xs text-muted-foreground">{x.allowed ? t("allowed") : t("notAllowed")}</div>
                    </th>
                    <td className={td}>
                      <code dir="ltr" className="block break-all text-xs">{`${x.whatsApp.name} (${x.whatsApp.language}, ${x.whatsApp.category})`}</code>
                      <p dir="ltr" className="mt-1 break-words text-xs text-muted-foreground">{x.whatsApp.body}</p>
                      {d.workspaceChecked && (
                        <Badge tone={x.whatsApp.approvedInWorkspace ? "good" : "warn"}>{x.whatsApp.approvedInWorkspace ? t("approved") : t("notApproved")}</Badge>
                      )}
                    </td>
                    <td className={td}>
                      <p dir="ltr" className="break-words text-xs">{x.sms.dltText}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t("dltCategory", { category: x.sms.dltCategory })}</p>
                      {d.workspaceChecked && (
                        <Badge tone={x.sms.matchedDltTemplateId ? "good" : "warn"}>
                          {x.sms.matchedDltTemplateId ? t("registered", { id: x.sms.matchedDltTemplateId }) : t("notRegistered")}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollArea>
          <div>
            <h3 className="text-sm font-semibold">{t("notesTitle")}</h3>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-muted-foreground">
              {d.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

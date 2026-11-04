"use client";

/**
 * Admissions settings (5 Nov 2026, moved out of the CRM page's tabs into the portal's Settings): the admissions team,
 * email templates, email opens and integrations (your own systems, SMS and WhatsApp). Institute admins only.
 */
import React, { useCallback, useEffect, useState } from "react";
import { useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useLatestRef } from "@/lib/legacyApi";
import { crm, type Member, type Template } from "@/components/institute/crm/api";
import SettingsView from "@/components/institute/crm/SettingsView";
import { PageHeader } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";
import { InstituteAdminOnly } from "@/components/institute/InstituteAdminOnly";

export default function AdmissionsSettingsPage() {
  const en = useEn();
  const { getToken, isLoaded, isSignedIn } = useAppAuth();
  const [team, setTeam] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    const [t, tp] = await Promise.all([crm<Member[]>(getToken, "/team").catch(() => []), crm<Template[]>(getToken, "/templates").catch(() => [])]);
    setTeam(t);
    setTemplates(tp);
    const res = await authenticatedFetch("/api/institute/profile", {}, getToken).catch(() => null);
    if (res?.ok) setWebhookUrl(((await res.json()) as { outboundWebhookUrl: string | null }).outboundWebhookUrl ?? "");
  }, [getToken]);

  const loadRef = useLatestRef(load);
  useEffect(() => {
    if (isLoaded && isSignedIn) void loadRef.current();
  }, [isLoaded, isSignedIn, loadRef, version]);

  return (
    <InstituteAdminOnly>
      <div className="space-y-6">
        <PageHeader title={en("Admissions settings")} description={en("Your admissions team, email templates and the systems your leads go to.")} />
        <SettingsView getToken={getToken} team={team} templates={templates} webhookUrl={webhookUrl} reload={() => setVersion((v) => v + 1)} />
      </div>
    </InstituteAdminOnly>
  );
}

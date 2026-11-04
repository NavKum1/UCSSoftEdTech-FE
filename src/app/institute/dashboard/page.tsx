"use client";

/**
 * The institute admissions CRM (API: /api/institute/crm). Opens on the day's work: leads not contacted yet, follow-ups
 * due, and the caller's own leads, then Leads (table or board), Follow-ups, Insights and, for institute admins, Settings
 * (team, email templates, integrations), Staff access and Import (leads from another system's CSV export). ?lead=<id>
 * opens a lead directly (links in reminder and reply emails).
 */

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarClock, Inbox, Reply, UserRound } from "lucide-react";
import { useAppAuth as useAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { useLatestRef } from "@/lib/legacyApi";
import { crm, query, type Filters, type LeadList, type Member, type OpenTask, type Template } from "@/components/institute/crm/api";
import LeadsView from "@/components/institute/crm/LeadsView";
import LeadDrawer from "@/components/institute/crm/LeadDrawer";
import TasksView from "@/components/institute/crm/TasksView";
import InsightsView from "@/components/institute/crm/InsightsView";
import PeopleView from "@/components/institute/crm/PeopleView";
import SettingsView from "@/components/institute/crm/SettingsView";
import ImportView from "@/components/institute/crm/ImportView";
import StaffAccess from "@/components/institute/StaffAccess";
import { Button, PageHeader, Tabs } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";

type Tab = "leads" | "people" | "followups" | "insights" | "settings" | "staff" | "import";

export default function InstituteCrmPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-muted motion-reduce:animate-none" aria-busy="true" />}>
      <Crm />
    </Suspense>
  );
}

function Crm() {
  const en = useEn();
  const { getToken, isLoaded, isSignedIn, roles } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const isAdmin = roles.includes("InstituteAdmin") || roles.includes("SuperAdmin");

  const [tab, setTab] = useState<Tab>("leads");
  const [filters, setFilters] = useState<Filters>({});
  const [data, setData] = useState<LeadList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [team, setTeam] = useState<Member[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [profile, setProfile] = useState<{ name: string; outboundWebhookUrl: string | null } | null>(null);
  const [mine, setMine] = useState<OpenTask[]>([]);
  const [version, setVersion] = useState(0);
  const openId = params.get("lead");

  const ready = isLoaded && isSignedIn;

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      setData(await crm<LeadList>(getToken, `/leads${query(filters)}`));
      setError(null);
    } catch (e) {
      setError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [getToken, filters]);

  const loadSetup = useCallback(async () => {
    const [t, tp, tasks] = await Promise.all([
      crm<Member[]>(getToken, "/team").catch(() => []),
      crm<Template[]>(getToken, "/templates").catch(() => []),
      crm<OpenTask[]>(getToken, "/tasks?scope=all").catch(() => []),
    ]);
    setTeam(t);
    setTemplates(tp);
    setMine(tasks);
    const res = await authenticatedFetch("/api/institute/profile", {}, getToken).catch(() => null);
    if (res?.ok) setProfile(await res.json());
  }, [getToken]);

  // The next page of the table (50 at a time)
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = useCallback(async () => {
    if (!data?.hasMore) return;
    setLoadingMore(true);
    try {
      const q = query(filters);
      const r = await crm<LeadList>(getToken, `/leads${q}${q ? "&" : "?"}summary=false&page=${data.page + 1}`);
      setData((d) => (d ? { ...d, leads: [...d.leads, ...r.leads.filter((l) => !d.leads.some((x) => x.leadId === l.leadId))], page: r.page, hasMore: r.hasMore } : d));
    } catch (e) {
      setError(e instanceof TypeError ? "We couldn't reach the server. Please check your connection and try again." : (e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  }, [data, filters, getToken]);

  const loadLeadsRef = useLatestRef(loadLeads);
  const loadSetupRef = useLatestRef(loadSetup);
  useEffect(() => {
    if (ready) loadLeadsRef.current();
  }, [ready, loadLeadsRef, filters]);

  useEffect(() => {
    if (ready) loadSetupRef.current();
  }, [ready, loadSetupRef, version]);

  const refresh = useCallback(() => {
    loadLeads();
    setVersion((v) => v + 1);
  }, [loadLeads]);

  const openLead = (id: string) => router.push(`/institute/dashboard?lead=${id}`, { scroll: false });
  const closeLead = useCallback(() => router.push("/institute/dashboard", { scroll: false }), [router]);

  const showLeads = (f: Filters) => {
    setFilters(f);
    setTab("leads");
  };

  const newCount = data?.counts?.New ?? 0;
  const overdue = mine.filter((t) => t.overdue).length;
  const dueToday = mine.filter((t) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return !t.overdue && new Date(t.dueAt) <= end;
  }).length;
  const unassigned = data?.unassignedOpen ?? 0;

  const TABS: [Tab, string][] = [
    ["leads", "Leads"],
    ["people", "People"],
    ["followups", "Follow-ups"],
    ["insights", "Insights"],
    ...(isAdmin ? [["settings", "Settings"] as [Tab, string], ["staff", "Staff access"] as [Tab, string], ["import", "Import"] as [Tab, string]] : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={en("Admissions")}
        description={
          <>
            {profile?.name ? `${profile.name} · ` : ""}
            {data ? `${(data.totalAll ?? data.total ?? 0).toLocaleString()} ${(data.totalAll ?? data.total) === 1 ? "lead" : "leads"}` : en("Your leads from Edulexa and your website")}
            {data?.me ? ` · signed in as ${data.me.name}` : ""}
          </>
        }
      />

      {/* Today */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Today icon={Inbox} label={en("New, not contacted")} value={newCount} tone={newCount > 0 ? "sky" : undefined} onClick={() => showLeads({ stage: "New" })} />
        <Today icon={Reply} label={en("Replied, need your answer")} value={data?.awaiting ?? 0} tone={(data?.awaiting ?? 0) > 0 ? "sky" : undefined} onClick={() => showLeads({ awaiting: true })} />
        <Today icon={AlertTriangle} label={en("Follow-ups overdue")} value={overdue} tone={overdue > 0 ? "red" : undefined} onClick={() => showLeads({ overdue: true })} />
        <Today icon={CalendarClock} label={en("Follow-ups due today")} value={dueToday} onClick={() => setTab("followups")} />
        {data?.me ? (
          <Today icon={UserRound} label={en("My open leads")} value={data.mineOpen} onClick={() => showLeads({ owner: "me" })} />
        ) : (
          <Today icon={UserRound} label={en("Unassigned open leads")} value={unassigned} tone={unassigned > 0 ? "amber" : undefined} onClick={() => showLeads({ owner: "none" })} />
        )}
      </div>

      {isAdmin && team.length === 0 && profile && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-sm">
          <p>
            <span className="font-medium">{en("Set up your team")}</span>{en(" to assign leads and send follow-up reminders. Add your email templates while you're there.")}
          </p>
          <Button type="button" onClick={() => setTab("settings")}>
            {en("Add your team")}
          </Button>
        </div>
      )}

      <Tabs<Tab>
        label={en("CRM")}
        value={tab}
        onChange={setTab}
        items={TABS.map(([k, label]) => ({ id: k, label: en(label), count: k === "followups" && overdue > 0 ? overdue : undefined }))}
      />

      {tab === "leads" && (
        <LeadsView getToken={getToken} team={team} data={data} filters={filters} setFilters={setFilters} loading={loading} error={error} openLead={openLead} reload={refresh} loadMore={loadMore} loadingMore={loadingMore} />
      )}
      {tab === "people" && <PeopleView getToken={getToken} openLead={openLead} />}
      {tab === "followups" && <TasksView getToken={getToken} openLead={openLead} version={version} />}
      {tab === "insights" && <InsightsView getToken={getToken} />}
      {tab === "settings" && isAdmin && (
        <SettingsView getToken={getToken} team={team} templates={templates} webhookUrl={profile?.outboundWebhookUrl ?? ""} reload={() => setVersion((v) => v + 1)} />
      )}

      {tab === "staff" && isAdmin && <StaffAccess getToken={getToken} />}
      {tab === "import" && isAdmin && <ImportView getToken={getToken} onImported={refresh} />}

      {openId && ready && <LeadDrawer key={openId} leadId={openId} getToken={getToken} team={team} templates={templates} isAdmin={isAdmin} me={data?.me ?? null} onClose={closeLead} onChanged={refresh} />}
    </div>
  );
}

function Today({ icon: Icon, label, value, tone, onClick }: { icon: React.ElementType; label: string; value: number; tone?: "sky" | "red" | "amber"; onClick: () => void }) {
  const en = useEn();
  const color = tone === "red" ? "text-red-700 dark:text-red-400" : tone === "amber" ? "text-amber-700 dark:text-amber-400" : tone === "sky" ? "text-indigo-700 dark:text-indigo-400" : "text-foreground";
  return (
    <button type="button" onClick={onClick} className="group rounded-xl border border-border bg-card p-4 text-start shadow-sm transition-colors hover:border-[var(--brand,#0e7490)] focus-visible:outline-2 focus-visible:outline-offset-2">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </span>
      <span className={`mt-2 block text-2xl font-semibold tabular-nums tracking-tight ${color}`}>{value}</span>
      <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">{en("View")}</span>
    </button>
  );
}

"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCareerShell } from "@/components/career/CareerShell";
import { Loading, PageHeader, useCareerT } from "@/components/career/ui";
import { TabPanel, Tabs } from "@/components/career/appointments/shared";
import { StaffSchedule } from "@/components/career/appointments/StaffSchedule";
import { AppointmentDetail } from "@/components/career/appointments/AppointmentDetail";
import { StaffDropIn } from "@/components/career/appointments/StaffDropIn";
import { AvailabilityPanel, ReportsPanel, TypesPanel } from "@/components/career/appointments/StaffSettings";
import { GroupSessionDetail, StaffGroupSessions } from "@/components/career/appointments/StaffGroupSessions";

export default function CareerCenterAppointmentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Appointments />
    </Suspense>
  );
}

type Tab = "schedule" | "group" | "dropin" | "availability" | "types" | "reports";

function Appointments() {
  const t = useCareerT("careerCenterAppointments");
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("id");
  // H14: ?tab=group&session=<id> opens one group session (links in notifications and the schedule)
  const session = params.get("session");
  const initial = (params.get("tab") as Tab | null) ?? "schedule";
  const [tab, setTab] = useState<Tab>(initial);
  const { me, schoolId } = useCareerShell();
  const isAdmin = !!me?.memberships.some((m) => m.role === "CareerAdmin" && (!schoolId || m.instituteId === schoolId));
  const open = (id: string) => router.push(`/career-center/appointments?id=${id}`);
  const openGroup = (id: string) => router.push(`/career-center/appointments?tab=group&session=${id}`);
  const backToGroups = () => {
    setTab("group");
    router.push("/career-center/appointments?tab=group");
  };

  if (selected) return <AppointmentDetail id={selected} onBack={() => router.push("/career-center/appointments")} onOpen={open} />;
  if (session) return <GroupSessionDetail id={session} onBack={backToGroups} />;

  return (
    <div>
      <PageHeader title={t("appointments")} description={t("advisingSchedulesAvailabilityDropIn")} />
      <Tabs<Tab>
        label={t("appointmentSections")}
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "schedule", label: t("schedule") },
          { key: "dropin", label: t("dropIn") },
          { key: "group", label: t("groupSessions") },
          { key: "availability", label: t("availability") },
          { key: "types", label: t("appointmentTypes") },
          { key: "reports", label: t("reports") },
        ]}
      />
      <TabPanel id={tab}>
        {tab === "schedule" && <StaffSchedule onOpen={open} onOpenGroup={openGroup} />}
        {tab === "group" && <StaffGroupSessions isAdmin={isAdmin} onOpen={openGroup} />}
        {tab === "dropin" && <StaffDropIn isAdmin={isAdmin} />}
        {tab === "availability" && <AvailabilityPanel isAdmin={isAdmin} />}
        {tab === "types" && <TypesPanel isAdmin={isAdmin} />}
        {tab === "reports" && <ReportsPanel />}
      </TabPanel>
    </div>
  );
}

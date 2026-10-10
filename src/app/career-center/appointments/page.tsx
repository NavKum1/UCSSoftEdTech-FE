"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCareerShell } from "@/components/career/CareerShell";
import { Loading, PageHeader } from "@/components/career/ui";
import { TabPanel, Tabs } from "@/components/career/appointments/shared";
import { StaffSchedule } from "@/components/career/appointments/StaffSchedule";
import { AppointmentDetail } from "@/components/career/appointments/AppointmentDetail";
import { StaffDropIn } from "@/components/career/appointments/StaffDropIn";
import { AvailabilityPanel, ReportsPanel, TypesPanel } from "@/components/career/appointments/StaffSettings";

export default function CareerCenterAppointmentsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Appointments />
    </Suspense>
  );
}

type Tab = "schedule" | "dropin" | "availability" | "types" | "reports";

function Appointments() {
  const router = useRouter();
  const params = useSearchParams();
  const selected = params.get("id");
  const initial = (params.get("tab") as Tab | null) ?? "schedule";
  const [tab, setTab] = useState<Tab>(initial);
  const { me, schoolId } = useCareerShell();
  const isAdmin = !!me?.memberships.some((m) => m.role === "CareerAdmin" && (!schoolId || m.instituteId === schoolId));
  const open = (id: string) => router.push(`/career-center/appointments?id=${id}`);

  if (selected) return <AppointmentDetail id={selected} onBack={() => router.push("/career-center/appointments")} onOpen={open} />;

  return (
    <div>
      <PageHeader title="Appointments" description="Advising schedules, availability, drop-in queues and appointment reports. Advising notes are education records and are never shared with employers." />
      <Tabs<Tab>
        label="Appointment sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "schedule", label: "Schedule" },
          { key: "dropin", label: "Drop-in" },
          { key: "availability", label: "Availability" },
          { key: "types", label: "Appointment types" },
          { key: "reports", label: "Reports" },
        ]}
      />
      <TabPanel id={tab}>
        {tab === "schedule" && <StaffSchedule onOpen={open} />}
        {tab === "dropin" && <StaffDropIn isAdmin={isAdmin} />}
        {tab === "availability" && <AvailabilityPanel isAdmin={isAdmin} />}
        {tab === "types" && <TypesPanel isAdmin={isAdmin} />}
        {tab === "reports" && <ReportsPanel />}
      </TabPanel>
    </div>
  );
}

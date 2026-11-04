"use client";

/** Pages of the institute portal's Settings: institute admins (and platform admins) only; counselors see why. */
import React from "react";
import { useAppAuth } from "@/lib/appAuth";
import { EmptyState } from "@/components/career/ui";
import { useEn } from "@/lib/english/EnglishProvider";

export function InstituteAdminOnly({ children }: { children: React.ReactNode }) {
  const en = useEn();
  const { isLoaded, roles } = useAppAuth();
  if (!isLoaded) return null;
  if (roles.includes("InstituteAdmin") || roles.includes("SuperAdmin")) return <>{children}</>;
  return <EmptyState title={en("For your institute's admins")}>{en("Ask an institute admin if you need a change here.")}</EmptyState>;
}

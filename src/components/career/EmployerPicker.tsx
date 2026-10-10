"use client";

/** Loads the signed-in user's employer accounts and remembers which one they're working in. */

import React, { useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useLoad } from "@/components/career/ui";

export interface EmployerOrg {
  id: string;
  name: string;
  website?: string | null;
  emailDomain?: string | null;
  industry?: string | null;
  sizeBand?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  hqCity?: string | null;
  hqState?: string | null;
  hqCountry: string;
  verificationStatus: string;
  flagReason?: string | null;
  createdAt: string;
}

export interface EmployerAccount {
  employer: EmployerOrg;
  role: string;
}

const KEY = "career.employerId";

function readSaved() {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function useEmployers() {
  const api = useApi();
  const load = useLoad(() => api<EmployerAccount[]>("/api/career/employer"), [api]);
  const [chosen, setChosen] = useState<string | null>(() => (typeof window === "undefined" ? null : readSaved()));
  const list = load.data ?? [];
  const current = list.find((a) => a.employer.id === chosen) ?? list[0] ?? null;

  const select = (id: string) => {
    setChosen(id);
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* per-browser convenience only */
    }
  };

  return { ...load, accounts: list, current, select };
}

export function EmployerPicker({ accounts, current, onSelect }: { accounts: EmployerAccount[]; current: EmployerAccount | null; onSelect: (id: string) => void }) {
  if (accounts.length < 2) return null;
  return (
    <label className="flex items-center gap-2 text-sm">
      <span>Company</span>
      <select className="rounded-md border border-border bg-background px-2 py-1" value={current?.employer.id ?? ""} onChange={(e) => onSelect(e.target.value)}>
        {accounts.map((a) => (
          <option key={a.employer.id} value={a.employer.id}>
            {a.employer.name}
          </option>
        ))}
      </select>
    </label>
  );
}

"use client";

/**
 * Shared pieces for G15 (WIOA, apprenticeships, short-term credentials) and G16 (CIRR-style cohort reports):
 * downloads, admin check, date-only formatting and the verified/unconfirmed rule list with sources.
 */

import React, { useCallback, useState, useSyncExternalStore } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerShell } from "@/components/career/CareerShell";
import { Badge, useCareerFormat, useCareerT } from "@/components/career/ui";

export interface Fact {
  text: string;
  verified: boolean;
  sourceUrl?: string | null;
}

export interface Source {
  title: string;
  url: string;
  official: boolean;
}

/** Career admin at the chosen school (wage entry, detail exports, credential definitions). */
export function useIsCareerAdmin() {
  const { schoolId, me } = useCareerShell();
  return !!me?.memberships.some((m) => m.role === "CareerAdmin" && (!schoolId || m.instituteId === schoolId));
}

/** Date-only values ("2025-03-31") shown as calendar dates, without a time-zone shift. */
export function useDateOnly() {
  const fmt = useCareerFormat();
  return useCallback((v: string | null | undefined) => (v ? fmt.date(v, { timeZone: "UTC" }) : "—"), [fmt]);
}

/** Downloads an export from the API; returns the busy key and the last error. */
export function useDownload() {
  const api = useApi();
  const t = useCareerT("workforceShared");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const download = useCallback(
    async (key: string, path: string, fallbackName: string) => {
      setBusy(key);
      setError(null);
      try {
        const res = await api<Response>(path, { raw: true });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error((body && body.message) || t("exportFailed", { status: res.status }));
        }
        const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        return true;
      } catch (e) {
        setError((e as Error).message);
        return false;
      } finally {
        setBusy(null);
      }
    },
    [api, t],
  );
  return { busy, error, download };
}

export function FactList({ facts }: { facts: Fact[] }) {
  const t = useCareerT("workforceShared");
  return (
    <ul className="list-disc space-y-2 ps-5 text-sm">
      {facts.map((f, i) => (
        <li key={i}>
          {f.text}{" "}
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge tone={f.verified ? "good" : "warn"}>{f.verified ? t("verified") : t("unconfirmed")}</Badge>
            {f.sourceUrl && (
              <a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline">
                {t("source")}
              </a>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SourceList({ sources }: { sources: Source[] }) {
  const t = useCareerT("workforceShared");
  return (
    <ul className="list-disc space-y-1 ps-5 text-sm">
      {sources.map((s) => (
        <li key={s.url}>
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
            {s.title}
          </a>{" "}
          <span className="text-xs text-muted-foreground">({s.official ? t("official") : t("secondary")})</span>
        </li>
      ))}
    </ul>
  );
}

/** Two- or three-way view switch (buttons with aria-pressed, keyboard-operable). */
export function ViewSwitch<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap rounded-md border border-border text-sm">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={`px-3 py-1.5 focus-visible:outline-2 focus-visible:outline-offset-1 ${value === o.key ? "bg-muted font-semibold" : ""}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/** The URL hash without "#" (deep links to a view or record); empty during server rendering. */
export function useLocationHash() {
  return useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
}

export function setLocationHash(value: string | null) {
  const url = window.location.pathname + window.location.search + (value ? `#${value}` : "");
  window.history.replaceState(null, "", url);
}

export const checkboxClass = "h-4 w-4 rounded border-border";

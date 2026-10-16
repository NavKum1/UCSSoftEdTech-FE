"use client";

/**
 * G10 data saver for the career suite. On when the user turns it on, or (unless they turned it off) when the browser
 * reports Save-Data or a 2G connection. While on, <html data-save-data="on"> switches to system fonts and hides
 * non-essential images (see mobile.css), lists ask for fewer items (useListSize) and extras wait for a click
 * (NonEssential). The choice is kept in this browser only.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useCareerT } from "@/components/career/i18n/CareerI18nProvider";

const STORAGE_KEY = "career.dataSaver"; // "on" | "off"; absent = follow the connection

type Choice = "on" | "off" | null;

interface NetworkInformationLike extends EventTarget {
  saveData?: boolean;
  effectiveType?: string;
}

function connection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

/** True when the browser asks to save data or the connection is 2G or slower. */
export function connectionWantsSaver(): boolean {
  const c = connection();
  if (!c) return false;
  return !!c.saveData || c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

function readChoice(): Choice {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "on" || v === "off" ? v : null;
  } catch {
    return null;
  }
}

interface DataSaverState {
  /** Data saver is on (by choice or detected). */
  on: boolean;
  /** On because of the connection, not by the user's choice. */
  automatic: boolean;
  setOn: (on: boolean) => void;
}

const DataSaverContext = createContext<DataSaverState>({ on: false, automatic: false, setOn: () => {} });

export function DataSaverProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoice] = useState<Choice>(null);
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    // Browser-only signals: read after mount so the server render and first client render match
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoice(readChoice());
    setDetected(connectionWantsSaver());
    const c = connection();
    const onChange = () => setDetected(connectionWantsSaver());
    c?.addEventListener?.("change", onChange);
    return () => c?.removeEventListener?.("change", onChange);
  }, []);

  const on = choice === "on" || (choice === null && detected);

  useEffect(() => {
    const root = document.documentElement;
    if (on) root.dataset.saveData = "on";
    else delete root.dataset.saveData;
  }, [on]);

  const setOn = useCallback((value: boolean) => {
    const next: Choice = value ? "on" : "off";
    setChoice(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage blocked: choice lasts for this page */
    }
  }, []);

  return <DataSaverContext.Provider value={{ on, automatic: on && choice === null, setOn }}>{children}</DataSaverContext.Provider>;
}

export function useDataSaver() {
  return useContext(DataSaverContext);
}

/** Page size for a list: the normal size, or a smaller one (default a quarter, at least 10) with data saver on. */
export function useListSize(normal: number, saver = Math.max(10, Math.round(normal / 4))) {
  return useDataSaver().on ? Math.min(normal, saver) : normal;
}

/**
 * A widget that is not needed to use the page. With data saver on it is not rendered (so its requests are not
 * made) until the user asks for it.
 */
export function NonEssential({ name, children, onLoad }: { name: string; children: React.ReactNode; onLoad?: () => void }) {
  const { on } = useDataSaver();
  const t = useCareerT("mobile");
  const [loaded, setLoaded] = useState(false);
  if (!on || loaded) return <>{children}</>;
  return (
    <div className="mt-8 rounded-xl border border-dashed border-border p-4 text-sm">
      <p className="text-muted-foreground">{t("deferredTitle", { name })}</p>
      <button
        type="button"
        onClick={() => {
          setLoaded(true);
          onLoad?.();
        }}
        className="mt-2 rounded-md border border-border px-3 py-2 font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {t("loadNow", { name })}
      </button>
    </div>
  );
}

/** Small switch shown under the career shell. */
export function DataSaverToggle() {
  const { on, automatic, setOn } = useDataSaver();
  const t = useCareerT("mobile");
  return (
    <div role="group" aria-label={t("dataSaver")} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => setOn(!on)}
        className="min-h-6 rounded-md border border-border px-2 py-1 font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {on ? t("turnOff") : t("turnOn")}
      </button>
      <span role="status">{on ? t("dataSaverOn") : t("dataSaverOff")}{automatic ? ` ${t("dataSaverAuto")}` : ""}</span>
    </div>
  );
}

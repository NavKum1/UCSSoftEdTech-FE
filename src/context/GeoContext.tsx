"use client";

import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { useEn } from "@/lib/english/EnglishProvider";

export type Region = "US" | "IN" | "EU";

export interface RegionComplianceConfig {
  id: Region;
  name: string;
  shortName: string;
  flag: string;
  currency: string;
  symbol: string;
  locale: string;
}

export const REGIONS: Record<Region, RegionComplianceConfig> = {
  US: {
    id: "US",
    name: "United States & Global",
    shortName: "United States ($)",
    flag: "🇺🇸",
    currency: "USD",
    symbol: "$",
    locale: "en-US",
  },
  IN: {
    id: "IN",
    name: "India & South Asia",
    shortName: "India (₹)",
    flag: "🇮🇳",
    currency: "INR",
    symbol: "₹",
    locale: "en-IN",
  },
  EU: {
    id: "EU",
    name: "Europe & United Kingdom",
    shortName: "Europe / UK (€)",
    flag: "🇪🇺",
    currency: "EUR",
    symbol: "€",
    locale: "en-GB",
  },
};

interface GeoContextType {
  region: Region;
  config: RegionComplianceConfig;
  setRegion: (region: Region) => void;
}

// The US unless the visitor's time zone says otherwise (owner decision 4 Nov 2026: Edulexa is a US product)
function detectInitialRegion(): Region {
  if (typeof window === "undefined") return "US";
  try {
    const saved = localStorage.getItem("edulexa_geo_region") as Region | null;
    if (saved && REGIONS[saved]) return saved;

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (
      tz.includes("Calcutta") ||
      tz.includes("Kolkata") ||
      tz.includes("India") ||
      tz.includes("Asia/Colombo") ||
      tz.includes("Asia/Karachi") ||
      tz.includes("Asia/Dhaka") ||
      tz.includes("Asia/Kathmandu")
    ) {
      return "IN";
    }
    if (
      tz.includes("Europe") ||
      tz.includes("London") ||
      tz.includes("Paris") ||
      tz.includes("Berlin") ||
      tz.includes("Amsterdam") ||
      tz.includes("Dublin") ||
      tz.includes("Rome") ||
      tz.includes("Madrid")
    ) {
      return "EU";
    }
    if (tz.includes("America") || tz.includes("New_York") || tz.includes("Chicago") || tz.includes("Los_Angeles") || tz.includes("Toronto")) {
      return "US";
    }
  } catch {
    // ignore
  }
  return "US";
}

const GeoContext = createContext<GeoContextType>({
  region: "US",
  config: REGIONS.US,
  setRegion: () => {},
});

export function GeoProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<Region>("US");

  useEffect(() => {
    // 1. Sync on mount
    const detected = detectInitialRegion();
    // The server can't see localStorage or the time zone, so it renders "US" and the client corrects it after
    // hydration. A lazy useState initializer would mismatch hydration on every region-priced page.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-hydration sync, see above
    setRegionState(detected);

    // 2. Cross-tab and window event listener
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "edulexa_geo_region" && e.newValue && REGIONS[e.newValue as Region]) {
        setRegionState(e.newValue as Region);
      }
    };
    const handleCustomChange = (e: Event) => {
      const customEvt = e as CustomEvent<Region>;
      if (customEvt.detail && REGIONS[customEvt.detail]) {
        setRegionState(customEvt.detail);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("edulexa-geo-change", handleCustomChange);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("edulexa-geo-change", handleCustomChange);
    };
  }, []);

  const setRegion = (newRegion: Region) => {
    setRegionState(newRegion);
    try {
      localStorage.setItem("edulexa_geo_region", newRegion);
      window.dispatchEvent(new CustomEvent("edulexa-geo-change", { detail: newRegion }));
    } catch {
      // storage disabled
    }
  };

  const config = REGIONS[region];


  return (
    <GeoContext.Provider
      value={{
        region,
        config,
        setRegion,
      }}
    >
      {children}
    </GeoContext.Provider>
  );
}

export function useGeo() {
  return useContext(GeoContext);
}

export function ProductRegionSwitcher({ className = "" }: { className?: string }) {
  const en = useEn();
  const { region, setRegion } = useGeo();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Escape closes the list and returns focus to its button
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <div className={`relative inline-block text-start ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border transition-colors shadow-sm"
        title={en("Change Country & Compliance Jurisdiction")}
        aria-label={`Region and currency: ${REGIONS[region].name}, ${REGIONS[region].currency}`}
        aria-expanded={isOpen}
        aria-controls="region-switcher-list"
      >
        <span aria-hidden>{REGIONS[region].flag}</span>
        <span className="font-semibold text-foreground">{REGIONS[region].currency}</span>
        <span className="text-[10px] text-muted-foreground" aria-hidden>▼</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-[90]"
            aria-hidden
            onClick={() => setIsOpen(false)}
          />
          <div id="region-switcher-list" className="absolute end-0 mt-2 z-[100] w-56 rounded-xl border border-border bg-white dark:bg-slate-900 p-1.5 shadow-2xl">
            <div className="px-2.5 py-1.5 font-mono text-[10px] uppercase text-muted-foreground border-b border-border/80 mb-1">
              {en("Select Region & Currency")}
            </div>
            {(Object.keys(REGIONS) as Region[]).map((rKey) => {
              const r = REGIONS[rKey];
              const isSelected = region === rKey;
              return (
                <button
                  key={rKey}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setRegion(rKey);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-800 dark:text-indigo-300 font-semibold border border-indigo-500/30"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base" aria-hidden>{r.flag}</span>
                    <span className="text-start">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {r.symbol} {r.currency}
                      </div>
                    </span>
                  </span>
                  {isSelected && <span className="text-indigo-700 dark:text-indigo-400 text-xs font-bold" aria-hidden>✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

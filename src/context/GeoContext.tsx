"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type Region = "US" | "IN" | "EU";

export interface RegionComplianceConfig {
  id: Region;
  name: string;
  shortName: string;
  flag: string;
  currency: string;
  symbol: string;
  locale: string;
  rateMultiplier: number;
  complianceBadges: Array<{ label: string; desc: string; dot: string }>;
  tax: {
    regimeTitle: string;
    withholdingRatePercent: number;
    withholdingLabel: string;
    certificateName: string;
    taxIdLabel: string;
    taxIdPlaceholder: string;
    payoutRail: string;
    institutionLegalNotice: string;
  };
  metrics: {
    recoveredGmvSample: number;
    taxWithheldSample: number;
    currencyCode: string;
  };
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
    rateMultiplier: 0.05, // e.g. 1500 INR -> $75.00
    complianceBadges: [
      { label: "SOC 2 Type II", desc: "Enterprise Audited", dot: "bg-emerald-400" },
      { label: "FERPA Certified", desc: "US Higher-Ed Privacy", dot: "bg-blue-400" },
      { label: "California CCPA", desc: "Consumer Data Protection", dot: "bg-purple-400" },
    ],
    tax: {
      regimeTitle: "IRS Form 1099-NEC & W-9 Independent Contractor Ledger",
      withholdingRatePercent: 0,
      withholdingLabel: "0% Backup Withholding (W-9 on File)",
      certificateName: "IRS Form 1099-NEC",
      taxIdLabel: "Tax ID (SSN / EIN / ITIN)",
      taxIdPlaceholder: "XX-XXXXXXX",
      payoutRail: "ACH Direct Deposit / FedNow (Same-Day)",
      institutionLegalNotice: "EIN: 12-3456789 • Form 1099-NEC annual summary reported to IRS & dispatched to mentor by Jan 31.",
    },
    metrics: {
      recoveredGmvSample: 42500,
      taxWithheldSample: 0,
      currencyCode: "USD",
    },
  },
  IN: {
    id: "IN",
    name: "India & South Asia",
    shortName: "India (₹)",
    flag: "🇮🇳",
    currency: "INR",
    symbol: "₹",
    locale: "en-IN",
    rateMultiplier: 1.0, // base 1500 INR -> ₹1,500
    complianceBadges: [
      { label: "India DPDP Act 2023", desc: "Sovereign In-Region Storage", dot: "bg-purple-400" },
      { label: "ISO 27001", desc: "Certified Security Posture", dot: "bg-cyan-400" },
      { label: "Section 194J & GST", desc: "Automated TDS & Form 16A", dot: "bg-emerald-400" },
    ],
    tax: {
      regimeTitle: "Indian Statutory Section 194J Professional Services Ledger",
      withholdingRatePercent: 10,
      withholdingLabel: "10% Section 194J Statutory TDS",
      certificateName: "Form 16A TDS Certificate",
      taxIdLabel: "Permanent Account Number (PAN)",
      taxIdPlaceholder: "ABCDE1234F",
      payoutRail: "NEFT / RTGS / IMPS Instant Payout",
      institutionLegalNotice: "TAN: BLRE12345T • Section 194J TDS certificate (Form 16A) automatically credited to mentor PAN upon quarterly reconciliation.",
    },
    metrics: {
      recoveredGmvSample: 3450000,
      taxWithheldSample: 18500,
      currencyCode: "INR",
    },
  },
  EU: {
    id: "EU",
    name: "Europe & United Kingdom",
    shortName: "Europe / UK (€)",
    flag: "🇪🇺",
    currency: "EUR",
    symbol: "€",
    locale: "en-GB",
    rateMultiplier: 0.046, // e.g. 1500 INR -> €70.00
    complianceBadges: [
      { label: "EU GDPR & UK DPA", desc: "Standard Contractual Clauses", dot: "bg-purple-400" },
      { label: "EU AI Act Compliant", desc: "2024 High-Risk EdTech Conformity", dot: "bg-emerald-400" },
      { label: "ISO 27001", desc: "Certified Posture", dot: "bg-cyan-400" },
    ],
    tax: {
      regimeTitle: "EU DAC7 Directive & VAT Reverse Charge Ledger",
      withholdingRatePercent: 0,
      withholdingLabel: "0% (Reverse Charge / DAC7 Platform Directive)",
      certificateName: "EU DAC7 Annual Platform Report / W-8BEN",
      taxIdLabel: "EU VAT Number or National Tax ID",
      taxIdPlaceholder: "EU123456789",
      payoutRail: "SEPA Credit Transfer / BACS",
      institutionLegalNotice: "EU VAT ID: EU372001928 • Cross-border digital services reported under EU DAC7 Directive.",
    },
    metrics: {
      recoveredGmvSample: 39000,
      taxWithheldSample: 0,
      currencyCode: "EUR",
    },
  },
};

interface GeoContextType {
  region: Region;
  config: RegionComplianceConfig;
  setRegion: (region: Region) => void;
  formatCurrency: (amount: number) => string;
  convertFromInr: (inrAmount: number) => number;
}

const GeoContext = createContext<GeoContextType>({
  region: "US",
  config: REGIONS.US,
  setRegion: () => {},
  formatCurrency: (amt) => `$${amt.toLocaleString()}`,
  convertFromInr: (amt) => Math.round(amt * 0.05),
});

export function GeoProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<Region>("US");

  useEffect(() => {
    // 1. Check persistent localStorage (shared key with marketing site)
    try {
      const saved = localStorage.getItem("edulexa_geo_region") as Region | null;
      if (saved && REGIONS[saved]) {
        setRegionState(saved);
        return;
      }
    } catch {
      // ignore storage access errors
    }

    // 2. Auto-detect from visitor's timezone
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
      if (tz.includes("Calcutta") || tz.includes("Kolkata") || tz.includes("India")) {
        setRegionState("IN");
      } else if (
        tz.includes("Europe") ||
        tz.includes("London") ||
        tz.includes("Paris") ||
        tz.includes("Berlin") ||
        tz.includes("Amsterdam") ||
        tz.includes("Dublin")
      ) {
        setRegionState("EU");
      } else {
        setRegionState("US");
      }
    } catch {
      setRegionState("US");
    }
  }, []);

  const setRegion = (newRegion: Region) => {
    setRegionState(newRegion);
    try {
      localStorage.setItem("edulexa_geo_region", newRegion);
    } catch {
      // storage disabled
    }
  };

  const config = REGIONS[region];

  const formatCurrency = (amount: number): string => {
    return `${config.symbol}${amount.toLocaleString(config.locale)}`;
  };

  const convertFromInr = (inrAmount: number): number => {
    if (region === "IN") return inrAmount;
    if (region === "US") return Math.round(inrAmount * 0.05);
    return Math.round(inrAmount * 0.046);
  };

  return (
    <GeoContext.Provider
      value={{
        region,
        config,
        setRegion,
        formatCurrency,
        convertFromInr,
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
  const { region, setRegion } = useGeo();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`relative inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 transition-colors shadow-sm"
        title="Change Country & Compliance Jurisdiction"
      >
        <span>{REGIONS[region].flag}</span>
        <span className="font-semibold text-slate-200">{REGIONS[region].currency}</span>
        <span className="text-[10px] text-slate-500">▼</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-50 w-56 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl backdrop-blur-xl">
            <div className="px-2.5 py-1.5 font-mono text-[10px] uppercase text-slate-400 border-b border-slate-800/80 mb-1">
              Select Region &amp; Currency
            </div>
            {(Object.keys(REGIONS) as Region[]).map((rKey) => {
              const r = REGIONS[rKey];
              const isSelected = region === rKey;
              return (
                <button
                  key={rKey}
                  type="button"
                  onClick={() => {
                    setRegion(rKey);
                    setIsOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs transition ${
                    isSelected
                      ? "bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base">{r.flag}</span>
                    <span className="text-left">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {r.symbol} {r.currency} • {r.complianceBadges[0].label}
                      </div>
                    </span>
                  </span>
                  {isSelected && <span className="text-indigo-400 text-xs font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

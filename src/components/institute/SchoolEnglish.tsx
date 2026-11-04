"use client";

/**
 * The school's English around its staff's pages (2 Nov 2026): a school with British English has its team read British
 * spelling, unless they chose their own English. Remembered, so their other pages follow it too. Also the school's
 * country (useSchoolCountry), for what only some countries need, such as India's DLT ids for SMS, and where replies to
 * its emails go (useSchoolReplies).
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { EnglishScope } from "@/lib/english/EnglishProvider";
import type { English } from "@/lib/english";

/** Where replies to the school's emails go: into the CRM (inbound email set up), or to an address */
export type SchoolReplies = { intoCrm: boolean; address: string | null };

const CountryCtx = createContext<string | null>(null);
const RepliesCtx = createContext<SchoolReplies | null>(null);

/** The school's country (ISO code such as "US" or "IN"); null while loading or outside the institute pages */
export const useSchoolCountry = () => useContext(CountryCtx);
/** Where replies to the school's emails go; null while loading or outside the institute pages */
export const useSchoolReplies = () => useContext(RepliesCtx);

export function SchoolEnglishScope({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAppAuth();
  const [english, setEnglish] = useState<English | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [replies, setReplies] = useState<SchoolReplies | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    let live = true;
    authenticatedFetch("/api/institute/setup/english", {}, getToken)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => {
        if (!live) return;
        if (b?.english === "US" || b?.english === "GB") setEnglish(b.english);
        if (typeof b?.country === "string") setCountry(b.country);
        if (b?.replies && typeof b.replies === "object") setReplies({ intoCrm: !!b.replies.intoCrm, address: typeof b.replies.address === "string" ? b.replies.address : null });
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isSignedIn, getToken]);
  return (
    <CountryCtx.Provider value={country}>
      <RepliesCtx.Provider value={replies}>
        <EnglishScope english={english} remember>
          {children}
        </EnglishScope>
      </RepliesCtx.Provider>
    </CountryCtx.Provider>
  );
}

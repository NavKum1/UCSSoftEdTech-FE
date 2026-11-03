"use client";

/**
 * The school's English around its staff's pages (2 Nov 2026): a US school's team reads US spelling, unless they chose
 * their own English. Remembered, so their other pages follow it too.
 */
import React, { useEffect, useState } from "react";
import { useAppAuth } from "@/lib/appAuth";
import { authenticatedFetch } from "@/lib/apiClient";
import { EnglishScope } from "@/lib/english/EnglishProvider";
import type { English } from "@/lib/english";

export function SchoolEnglishScope({ children }: { children: React.ReactNode }) {
  const { getToken, isSignedIn } = useAppAuth();
  const [english, setEnglish] = useState<English | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    let live = true;
    authenticatedFetch("/api/institute/setup/english", {}, getToken)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => live && (b?.english === "US" || b?.english === "GB") && setEnglish(b.english))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isSignedIn, getToken]);
  return (
    <EnglishScope english={english} remember>
      {children}
    </EnglishScope>
  );
}

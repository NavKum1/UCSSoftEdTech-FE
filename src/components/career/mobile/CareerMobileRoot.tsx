"use client";

/**
 * G10 mobile and low-bandwidth mode for the career persona layouts: data saver (dataSaver.tsx), the installable
 * web app's service worker (src/app/sw.ts, built to /sw.js) with an "update ready" prompt, and an offline notice.
 * The service worker caches only the app shell and static files, never API responses or pages with student data.
 */

import React, { useEffect, useState } from "react";
import { useCareerT } from "@/components/career/i18n/CareerI18nProvider";
import { DataSaverProvider, DataSaverToggle } from "./dataSaver";
import "./mobile.css";

const SW_URL = "/sw.js";

function useServiceWorker() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Production only: next dev does not build sw.js (disabled in next.config.ts)
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    const watch = (reg: ServiceWorkerRegistration) => {
      // A worker already waiting (installed in an earlier visit) or one that finishes installing now
      if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        next?.addEventListener("statechange", () => {
          if (!cancelled && next.state === "installed" && navigator.serviceWorker.controller) setWaiting(next);
        });
      });
    };
    navigator.serviceWorker
      .register(SW_URL, { scope: "/" })
      .then((reg) => {
        if (cancelled) return;
        watch(reg);
        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
      })
      .catch(() => {
        /* not installable here (http, private mode): the site works the same without it */
      });
    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const update = () => waiting?.postMessage({ type: "SKIP_WAITING" });
  return { waiting, update, dismiss: () => setWaiting(null) };
}

function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

function MobileBar() {
  const t = useCareerT("mobile");
  const { waiting, update, dismiss } = useServiceWorker();
  const online = useOnline();
  return (
    <aside aria-label={t("dataSaver")}>
      <div className="border-t border-border px-4 py-2">
        <DataSaverToggle />
      </div>
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-3 pointer-events-none" aria-live="polite">
        {!online && (
          <p className="pointer-events-auto max-w-xl rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground shadow">{t("offline")}</p>
        )}
        {waiting && (
          <div role="status" className="pointer-events-auto flex max-w-xl flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground shadow">
            <span>{t("updateReady")}</span>
            <button
              type="button"
              onClick={update}
              className="rounded-md px-3 py-1.5 font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ background: "#4338ca" }}
            >
              {t("updateNow")}
            </button>
            <button type="button" onClick={dismiss} className="rounded-md border border-border px-3 py-1.5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2">
              {t("later")}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

export default function CareerMobileRoot({ children }: { children: React.ReactNode }) {
  return (
    <DataSaverProvider>
      {children}
      <MobileBar />
    </DataSaverProvider>
  );
}

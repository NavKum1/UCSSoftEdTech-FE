"use client";

import { useCallback, useState } from "react";
import { useApi } from "@/lib/appAuth";
import { useCareerT } from "@/components/career/ui";

/** Busy/error/success state for page actions, plus a file download helper (CSV/XLSX exports). */
export function useRunner() {
  const api = useApi();
  const tr = useCareerT("placementsShared");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const run = useCallback(async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }, []);

  const download = useCallback(
    (path: string, key: string, fallbackName: string) =>
      run(key, async () => {
        const res = await api<Response>(path, { raw: true });
        if (!res.ok) {
          let message = tr("exportFailedStatus", { status: res.status });
          try {
            const body = await res.json();
            if (body?.message) message = String(body.message);
          } catch {
            // not JSON
          }
          throw new Error(message);
        }
        const name = /filename="?([^";]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? fallbackName;
        const url = URL.createObjectURL(await res.blob());
        const a = document.createElement("a");
        a.href = url;
        a.download = name;
        a.click();
        URL.revokeObjectURL(url);
        setMsg(tr("downloadStarted"));
      }),
    [api, run, tr],
  );

  return { api, busy, err, msg, setErr, setMsg, run, download };
}

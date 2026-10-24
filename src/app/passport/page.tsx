"use client";

/**
 * The member's own skill passport: what others see (PassportView), plus the controls that are only theirs: display name,
 * target role, sharing on or off, and a new link when an old one was shared too widely.
 */

import React, { useEffect, useState } from "react";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import PassportView, { type PassportData } from "@/components/passport/PassportView";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";

interface OwnPassport extends PassportData {
  userId: string;
  currentStreakDays: number;
  longestStreakDays: number;
  sharingEnabled: boolean;
  publicShareToken: string | null;
}

const card = "rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]";

export default function SkillPassportPage() {
  const { apiFetch, ready, access } = useLegacyApi();
  const [passport, setPassport] = useState<OwnPassport | null>(null);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState<"profile" | "sharing" | "rotate" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/passport");
        if (cancelled) return;
        if (!res.ok) {
          setFailed(true);
          return;
        }
        const p = (await res.json()) as OwnPassport;
        setPassport(p);
        setName(p.fullName);
        setRole(p.targetRole);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, apiFetch]);

  const update = async (kind: "profile" | "sharing" | "rotate", body: Record<string, unknown>, done: string) => {
    setSaving(kind);
    setMessage(null);
    try {
      const res = await apiFetch("/api/passport", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) {
        const p = (await res.json()) as OwnPassport;
        setPassport(p);
        setMessage(done);
      } else setMessage("That didn't save. Please try again.");
    } catch {
      setMessage("That didn't save. Please check your connection and try again.");
    } finally {
      setSaving(null);
    }
  };

  if (access) return <AccessNotice problem={access} feature="Your skill passport" />;
  if (failed && !passport)
    return (
      <main className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl font-semibold">We couldn&apos;t load your passport</h1>
        <p className="mt-2 text-sm text-muted-foreground">Please refresh the page to try again.</p>
      </main>
    );
  if (!passport)
    return (
      <main className="mx-auto max-w-6xl px-4 py-10" aria-busy="true" aria-label="Loading your passport">
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </main>
    );

  const shareUrl = passport.publicShareToken && typeof window !== "undefined" ? `${window.location.origin}/passport/public/${passport.publicShareToken}` : null;
  const dirty = name.trim() !== passport.fullName || role.trim() !== passport.targetRole;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <div className="mb-6">
        <h1 className="sr-only">Skill passport</h1>
        <p className="text-sm text-muted-foreground">
          Your verified record of skills and credentials, built from your graded results. You decide who sees it.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PassportView data={passport} publicView={false} />
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="pp-share" className={`${card} p-5 sm:p-6`}>
            <h2 id="pp-share" className="flex items-center gap-2 text-base font-semibold">
              <Link2 aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Sharing
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Anyone with the link sees your name, target role, skills and credentials. Never your email or activity history.
            </p>
            <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border p-3">
              <span className="text-sm font-medium">{passport.sharingEnabled ? "Sharing is on" : "Sharing is off"}</span>
              <input
                type="checkbox"
                role="switch"
                className="h-5 w-9 cursor-pointer accent-indigo-600"
                checked={passport.sharingEnabled}
                disabled={saving !== null}
                onChange={(e) =>
                  void update("sharing", { sharingEnabled: e.target.checked }, e.target.checked ? "Your passport link works now." : "Your passport link no longer works.")
                }
              />
            </label>
            {shareUrl && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-2 pl-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{shareUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareUrl).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void update("rotate", { rotateShareLink: true }, "New link created. The old link no longer works.")}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                  Create a new link (the old one stops working)
                </button>
              </div>
            )}
          </section>

          <section aria-labelledby="pp-profile" className={`${card} p-5 sm:p-6`}>
            <h2 id="pp-profile" className="text-base font-semibold">
              How you appear
            </h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void update("profile", { fullName: name, targetRole: role }, "Saved.");
              }}
            >
              <label className="block text-sm">
                <span className="font-medium">Name</span>
                <input
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-2 focus:outline-indigo-600"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Target role</span>
                <input
                  value={role}
                  maxLength={120}
                  placeholder="e.g. Backend engineer"
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-2 focus:outline-indigo-600"
                />
              </label>
              <button
                type="submit"
                disabled={!dirty || saving !== null}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                {saving === "profile" ? "Saving…" : "Save"}
              </button>
            </form>
          </section>
          <p role="status" className="min-h-5 text-sm text-muted-foreground">
            {message}
          </p>
        </aside>
      </div>
    </main>
  );
}

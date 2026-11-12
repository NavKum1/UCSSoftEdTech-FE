"use client";

/**
 * The member's own skill passport: what others see (PassportView), plus the controls that are only theirs: display name,
 * target role, sharing on or off, and a new link when an old one was shared too widely.
 */

import React, { useEffect, useState } from "react";
import { Check, Copy, Link2, RefreshCw } from "lucide-react";
import PassportView, { type PassportData } from "@/components/passport/PassportView";
import { AccessNotice, useLegacyApi } from "@/lib/legacyApi";
import { useEn } from "@/lib/english/EnglishProvider";
import { Button, PageHeader, buttonClass } from "@/components/career/ui";
import { HelpLink } from "@/components/help/HelpLink";

interface OwnPassport extends PassportData {
  userId: string;
  currentStreakDays: number;
  longestStreakDays: number;
  sharingEnabled: boolean;
  publicShareToken: string | null;
}

const card = "rounded-xl border border-border bg-card shadow-sm";

export default function SkillPassportPage() {
  const en = useEn();
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
      } else setMessage(en("That didn't save. Please try again."));
    } catch {
      setMessage(en("That didn't save. Please check your connection and try again."));
    } finally {
      setSaving(null);
    }
  };

  if (access) return <AccessNotice problem={access} feature="Your skill passport" />;
  if (failed && !passport)
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-xl font-semibold">{en("We couldn't load your passport")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{en("Please refresh the page to try again.")}</p>
      </div>
    );
  if (!passport)
    return (
      <div aria-busy="true" aria-label={en("Loading your passport")}>
        <div className={`${card} h-40 animate-pulse motion-reduce:animate-none`} />
      </div>
    );

  const shareUrl = passport.publicShareToken && typeof window !== "undefined" ? `${window.location.origin}/passport/public/${passport.publicShareToken}` : null;
  const dirty = name.trim() !== passport.fullName || role.trim() !== passport.targetRole;

  return (
    <div>
      <PageHeader
        title={en("Skill passport")}
        description={en("Your verified record of skills and credentials, built from your graded results. You decide who sees it.")} actions={<HelpLink slug="credentials-and-passport" forAudience={{ member: "member-results-and-credentials" }} />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PassportView data={passport} publicView={false} />
        </div>

        <aside className="space-y-6">
          <section aria-labelledby="pp-share" className={`${card} p-5 sm:p-6`}>
            <h2 id="pp-share" className="flex items-center gap-2 text-base font-semibold">
              <Link2 aria-hidden="true" className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              {en("Sharing")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {en("Anyone with the link sees your name, target role, skills and credentials. Never your email or activity history.")}
            </p>
            <label className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span className="text-sm font-medium">{passport.sharingEnabled ? en("Sharing is on") : en("Sharing is off")}</span>
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
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-2 ps-3">
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{shareUrl}</span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareUrl).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className={`${buttonClass("secondary")} h-8 px-2.5`}
                  >
                    {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
                    {copied ? en("Copied") : en("Copy")}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={saving !== null}
                  onClick={() => void update("rotate", { rotateShareLink: true }, "New link created. The old link no longer works.")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
                >
                  <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                  {en("Create a new link (the old one stops working)")}
                </button>
              </div>
            )}
          </section>

          <section aria-labelledby="pp-profile" className={`${card} p-5 sm:p-6`}>
            <h2 id="pp-profile" className="text-base font-semibold">
              {en("How you appear")}
            </h2>
            <form
              className="mt-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void update("profile", { fullName: name, targetRole: role }, "Saved.");
              }}
            >
              <label className="block text-sm">
                <span className="font-medium">{en("Name")}</span>
                <input
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:outline-2 focus:outline-indigo-600"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">{en("Target role")}</span>
                <input
                  value={role}
                  maxLength={120}
                  placeholder={en("e.g. Backend engineer")}
                  onChange={(e) => setRole(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm focus:outline-2 focus:outline-indigo-600"
                />
              </label>
              <Button type="submit" className="w-full" disabled={!dirty || saving !== null}>
                {saving === "profile" ? en("Saving…") : en("Save")}
              </Button>
            </form>
          </section>
          <p role="status" className="min-h-5 text-sm text-muted-foreground">
            {message}
          </p>
        </aside>
      </div>
    </div>
  );
}
